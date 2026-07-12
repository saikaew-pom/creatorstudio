// Work module — boards, tasks, comments, activity (docs/07-work-crm.md §2,
// migration 0006_work.sql). Every table here is workspace-scoped AND behind the
// work_crm entitlement at the RLS layer, so these are thin wrappers — the DB is
// deny-by-default regardless of what the app-layer requireFeature guard does.
import type { SupabaseClient } from "@supabase/supabase-js";

export type BoardView = "list" | "board" | "calendar" | "gantt";
export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export interface BoardRow {
  id: string;
  workspace_id: string;
  name: string;
  default_view: BoardView;
  position: number;
  archived: boolean;
  created_at: string;
}

export interface TaskRow {
  id: string;
  workspace_id: string;
  board_id: string;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  assignee_name: string | null;
  start_date: string | null;
  due_date: string | null;
  estimate_hours: number | null;
  position: number;
  links: Record<string, string>;
  created_by: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommentRow {
  id: string;
  task_id: string;
  workspace_id: string;
  author_id: string;
  author_name: string | null;
  body: string;
  created_at: string;
}

export interface ActivityRow {
  id: string;
  task_id: string;
  workspace_id: string;
  actor_id: string | null;
  actor_name: string | null;
  kind: string;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface WorkloadRow {
  user_id: string;
  display_name: string | null;
  capacity_hours: number;
  allocated_hours: number;
  over_allocated: boolean;
}

// ---------------------------------------------------------------- boards ----
export async function listBoards(db: SupabaseClient, wsId: string): Promise<BoardRow[]> {
  const { data, error } = await db
    .from("boards")
    .select("*")
    .eq("workspace_id", wsId)
    .eq("archived", false)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BoardRow[];
}

export async function getBoard(db: SupabaseClient, boardId: string): Promise<BoardRow | null> {
  const { data, error } = await db.from("boards").select("*").eq("id", boardId).maybeSingle();
  if (error) throw error;
  return data as BoardRow | null;
}

export async function createBoard(
  db: SupabaseClient, wsId: string, name: string, defaultView: BoardView = "board"
): Promise<BoardRow> {
  const { data, error } = await db
    .from("boards")
    .insert({ workspace_id: wsId, name, default_view: defaultView })
    .select("*")
    .single();
  if (error) throw error;
  return data as BoardRow;
}

// ----------------------------------------------------------------- tasks ----
type TaskJoinRow = Omit<TaskRow, "assignee_name"> & {
  profiles: { display_name: string | null } | { display_name: string | null }[] | null;
};

function withAssigneeName(row: TaskJoinRow): TaskRow {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const { profiles: _profiles, ...rest } = row;
  return { ...rest, assignee_name: profile?.display_name ?? null };
}

const TASK_SELECT =
  "*, profiles!tasks_assignee_id_fkey(display_name)"; // tasks has 2 fks into profiles (assignee_id, created_by) — must disambiguate

export async function listTasksForBoard(db: SupabaseClient, boardId: string): Promise<TaskRow[]> {
  const { data, error } = await db
    .from("tasks")
    .select(TASK_SELECT)
    .eq("board_id", boardId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => withAssigneeName(r as unknown as TaskJoinRow));
}

/** All non-done tasks across a workspace with a due_date in [since, until] — feeds
 * the Workload view, which aggregates across every board, not just one. */
export async function listWorkspaceTasksInRange(
  db: SupabaseClient, wsId: string, since: string, until: string
): Promise<TaskRow[]> {
  const { data, error } = await db
    .from("tasks")
    .select(TASK_SELECT)
    .eq("workspace_id", wsId)
    .neq("status", "done")
    .not("due_date", "is", null)
    .gte("due_date", since)
    .lte("due_date", until);
  if (error) throw error;
  return (data ?? []).map((r) => withAssigneeName(r as unknown as TaskJoinRow));
}

export async function getTask(db: SupabaseClient, taskId: string): Promise<TaskRow | null> {
  const { data, error } = await db.from("tasks").select(TASK_SELECT).eq("id", taskId).maybeSingle();
  if (error) throw error;
  return data ? withAssigneeName(data as unknown as TaskJoinRow) : null;
}

export async function createTask(
  db: SupabaseClient,
  opts: {
    workspace_id: string; board_id: string; title: string; assignee_id?: string | null;
    priority?: TaskPriority; start_date?: string | null; due_date?: string | null; estimate_hours?: number | null;
  }
): Promise<TaskRow> {
  const { data, error } = await db
    .from("tasks")
    .insert({
      workspace_id: opts.workspace_id, board_id: opts.board_id, title: opts.title,
      assignee_id: opts.assignee_id ?? null, priority: opts.priority ?? "normal",
      start_date: opts.start_date ?? null, due_date: opts.due_date ?? null,
      estimate_hours: opts.estimate_hours ?? null,
    })
    .select(TASK_SELECT)
    .single();
  if (error) throw error;
  return withAssigneeName(data as unknown as TaskJoinRow);
}

/** Generic field edit — NOT for status/position (use reorderTask, which goes
 * through the reorder_task RPC for fractional-position + advisory-lock safety).
 * Throws if the id doesn't match a row the caller can see (RLS-filtered or
 * simply nonexistent) — `.update()`/`.delete()` alone silently affect 0 rows
 * rather than erroring, which would otherwise report success for a no-op. */
export async function updateTask(
  db: SupabaseClient, taskId: string,
  patch: Partial<{
    title: string; description: string | null; priority: TaskPriority; assignee_id: string | null;
    start_date: string | null; due_date: string | null; estimate_hours: number | null;
  }>
): Promise<void> {
  const { data, error } = await db.from("tasks").update(patch).eq("id", taskId).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("task not found");
}

export async function deleteTask(db: SupabaseClient, taskId: string): Promise<void> {
  const { data, error } = await db.from("tasks").delete().eq("id", taskId).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("task not found");
}

/** Moves a task to `status` at the midpoint of (prevTaskId, nextTaskId) within
 * that status column — advisory-locked + fractional on the DB side (0006 §4). */
export async function reorderTask(
  db: SupabaseClient, taskId: string, status: TaskStatus, prevTaskId: string | null, nextTaskId: string | null
): Promise<number> {
  const { data, error } = await db.rpc("reorder_task", {
    p_task: taskId, p_status: status, p_prev: prevTaskId, p_next: nextTaskId,
  });
  if (error) throw error;
  return Number(data);
}

/** due_date-only move for the Calendar view's drag-to-date (doesn't touch
 * status/position — reorder_task is for the kanban board specifically). */
export async function moveTaskDueDate(db: SupabaseClient, taskId: string, dueDate: string | null): Promise<void> {
  const { error } = await db.from("tasks").update({ due_date: dueDate }).eq("id", taskId);
  if (error) throw error;
}

// -------------------------------------------------------------- comments ----
export async function listComments(db: SupabaseClient, taskId: string): Promise<CommentRow[]> {
  const { data, error } = await db
    .from("task_comments")
    .select("id, task_id, workspace_id, author_id, body, created_at, profiles(display_name)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((m) => {
    const row = m as unknown as CommentRow & { profiles: { display_name: string | null } | null };
    return { ...row, author_name: row.profiles?.display_name ?? null };
  });
}

export async function addComment(db: SupabaseClient, taskId: string, wsId: string, body: string): Promise<CommentRow> {
  const { data, error } = await db
    .from("task_comments")
    .insert({ task_id: taskId, workspace_id: wsId, body })
    .select("id, task_id, workspace_id, author_id, body, created_at, profiles(display_name)")
    .single();
  if (error) throw error;
  const row = data as unknown as CommentRow & { profiles: { display_name: string | null } | null };
  return { ...row, author_name: row.profiles?.display_name ?? null };
}

export async function deleteComment(db: SupabaseClient, commentId: string): Promise<void> {
  const { error } = await db.from("task_comments").delete().eq("id", commentId);
  if (error) throw error;
}

// -------------------------------------------------------------- activity ----
export async function listActivity(db: SupabaseClient, taskId: string): Promise<ActivityRow[]> {
  const { data, error } = await db
    .from("task_activity")
    .select("id, task_id, workspace_id, actor_id, kind, detail, created_at, profiles(display_name)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((m) => {
    const row = m as unknown as ActivityRow & { profiles: { display_name: string | null } | null };
    return { ...row, actor_name: row.profiles?.display_name ?? null };
  });
}

// -------------------------------------------------------------- workload ----
/** Pure aggregation (no DB call) — sums estimate_hours of non-done, due-dated
 * tasks per assignee against workspace_members.capacity_hours. Kept as a plain
 * function over already-fetched rows rather than a SQL aggregate RPC: the
 * inputs are already RLS-readable to the caller, so there's no need for new SQL
 * surface just to do a GROUP BY sum this codebase already does in TS elsewhere
 * (see adminListWorkspaces' member_count). */
export function computeWorkload(
  members: { user_id: string; display_name: string | null; capacity_hours: number }[],
  tasks: Pick<TaskRow, "assignee_id" | "estimate_hours">[]
): WorkloadRow[] {
  const allocated = new Map<string, number>();
  for (const t of tasks) {
    if (!t.assignee_id) continue;
    allocated.set(t.assignee_id, (allocated.get(t.assignee_id) ?? 0) + (t.estimate_hours ?? 0));
  }
  return members.map((m) => {
    const allocated_hours = allocated.get(m.user_id) ?? 0;
    return {
      user_id: m.user_id, display_name: m.display_name, capacity_hours: m.capacity_hours,
      allocated_hours, over_allocated: allocated_hours > m.capacity_hours,
    };
  });
}
