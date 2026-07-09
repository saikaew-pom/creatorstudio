// MCP tool definitions + handlers (doc 04 §10). Each tool runs on behalf of the
// token's owner (userId) via the admin client, manually scoped by user_id (the caller
// has no session, so RLS can't scope for us — every query filters user_id explicitly).
import { splitScript } from "@cs/prompts";
import {
  upsertProject, enqueueRenderJob, getMinutesUsedThisMonth, MINUTE_LIMITS,
  publicRenderUrl,
} from "@cs/db";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const TOOLS: ToolDef[] = [
  {
    name: "create_video",
    description: "สร้างวิดีโอสั้น 9:16 จากสคริปต์ไทย (เสียงพากย์ AI + B-roll + ซับ). คืน project_id และ job_id — ใช้ get_job_status ติดตามความคืบหน้า",
    inputSchema: {
      type: "object",
      properties: {
        script: { type: "string", description: "สคริปต์ไทย 1 บรรทัด = 1 เซ็กเมนต์ (บรรทัดแรก = hook)" },
        voice: { type: "string", description: "เสียง Gemini: Aoede|Puck|Kore|Charon (ค่าเริ่มต้น Aoede)" },
        broll_tier: { type: "string", enum: ["ai", "stock"], description: "แหล่ง B-roll (ค่าเริ่มต้น ai)" },
        name: { type: "string", description: "ชื่อโปรเจกต์ (ไม่บังคับ)" },
      },
      required: ["script"],
    },
  },
  { name: "get_job_status", description: "ดูสถานะงานเรนเดอร์/ส่งออก", inputSchema: { type: "object", properties: { job_id: { type: "string" } }, required: ["job_id"] } },
  { name: "list_projects", description: "รายการโปรเจกต์วิดีโอทั้งหมด", inputSchema: { type: "object", properties: {} } },
  { name: "get_project", description: "รายละเอียดโปรเจกต์", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "set_caption_style", description: "ตั้งค่าสไตล์ซับของโปรเจกต์ (theme, font, ตำแหน่ง ฯลฯ)", inputSchema: { type: "object", properties: { project_id: { type: "string" }, theme: { type: "string" }, font_family: { type: "string" }, font_size_px: { type: "number" }, pos_vertical_pct: { type: "number" } }, required: ["project_id"] } },
  { name: "export_video", description: "ส่งออกวิดีโอ (ฝังซับลงไฟล์). คืน job_id", inputSchema: { type: "object", properties: { project_id: { type: "string" } }, required: ["project_id"] } },
  { name: "get_download_url", description: "ลิงก์ดาวน์โหลดวิดีโอที่ส่งออกแล้ว", inputSchema: { type: "object", properties: { project_id: { type: "string" } }, required: ["project_id"] } },
  { name: "get_quota", description: "ดูโควตานาที เครดิต และแผนของผู้ใช้", inputSchema: { type: "object", properties: {} } },
];

type Args = Record<string, unknown>;

export async function callTool(
  admin: SupabaseClient,
  userId: string,
  name: string,
  args: Args
): Promise<unknown> {
  switch (name) {
    case "create_video": {
      const script = String(args.script ?? "").trim();
      if (!script) throw new Error("ต้องมีสคริปต์");
      const segments = splitScript(script);
      const estMinutes = Math.max(1, Math.ceil(segments[segments.length - 1].est_end / 60));

      const { data: profile } = await admin.from("profiles").select("plan").eq("id", userId).maybeSingle();
      const plan = (profile?.plan as string) ?? "free";
      const limit = MINUTE_LIMITS[plan] ?? MINUTE_LIMITS.free;
      const used = await getMinutesUsedThisMonth(admin, userId);
      if (used + estMinutes > limit) throw new Error(`นาทีไม่พอ — ใช้ไป ${used}/${limit} นาทีเดือนนี้`);

      const project = await upsertProject(admin, userId, {
        name: String(args.name ?? "MCP Video"), mode: "script", script, segments, status: "rendering",
      });
      const job = await enqueueRenderJob(admin, userId, project.id, "preview_render",
        { script, voice: String(args.voice ?? "Aoede"), brollTier: (args.broll_tier as string) ?? "ai" }, estMinutes);
      return { project_id: project.id, job_id: job.id, est_minutes: estMinutes };
    }
    case "get_job_status": {
      const { data } = await admin.from("render_jobs").select("status,progress,step_label,result_path,error,project_id").eq("id", String(args.job_id)).eq("user_id", userId).maybeSingle();
      if (!data) throw new Error("ไม่พบงานนี้");
      return data;
    }
    case "list_projects": {
      const { data } = await admin.from("projects").select("id,name,status,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(50);
      return { projects: data ?? [] };
    }
    case "get_project": {
      const { data } = await admin.from("projects").select("*").eq("id", String(args.id)).eq("user_id", userId).maybeSingle();
      if (!data) throw new Error("ไม่พบโปรเจกต์");
      return data;
    }
    case "set_caption_style": {
      const projectId = String(args.project_id);
      const { data: proj } = await admin.from("projects").select("id").eq("id", projectId).eq("user_id", userId).maybeSingle();
      if (!proj) throw new Error("ไม่พบโปรเจกต์");
      const { data: cap } = await admin.from("captions").select("style").eq("project_id", projectId).maybeSingle();
      if (!cap) throw new Error("ยังไม่มีซับ — เรนเดอร์วิดีโอให้เสร็จก่อน");
      const style = { ...(cap.style as object ?? {}) };
      for (const k of ["theme", "font_family", "font_size_px", "pos_vertical_pct"] as const) {
        if (args[k] !== undefined) (style as Record<string, unknown>)[k] = args[k];
      }
      // UPDATE, not upsert: the captions row always exists post-render, and a
      // style-only upsert 400s (omits the NOT NULL `cards` column). Check the error —
      // an unchecked upsert here silently returned success while persisting nothing.
      const { error } = await admin.from("captions").update({ style, updated_at: new Date().toISOString() }).eq("project_id", projectId);
      if (error) throw error;
      return { ok: true, style };
    }
    case "export_video": {
      const projectId = String(args.project_id);
      const { data: proj } = await admin.from("projects").select("id").eq("id", projectId).eq("user_id", userId).maybeSingle();
      if (!proj) throw new Error("ไม่พบโปรเจกต์");
      const job = await enqueueRenderJob(admin, userId, projectId, "export", {}, 0);
      return { job_id: job.id };
    }
    case "get_download_url": {
      const projectId = String(args.project_id);
      const { data: proj } = await admin.from("projects").select("id,status").eq("id", projectId).eq("user_id", userId).maybeSingle();
      if (!proj) throw new Error("ไม่พบโปรเจกต์");
      const path = `${userId}/${projectId}/final.mp4`;
      return { url: publicRenderUrl(admin, path), status: proj.status };
    }
    case "get_quota": {
      const { data: profile } = await admin.from("profiles").select("plan").eq("id", userId).maybeSingle();
      const plan = (profile?.plan as string) ?? "free";
      const limit = MINUTE_LIMITS[plan] ?? MINUTE_LIMITS.free;
      const used = await getMinutesUsedThisMonth(admin, userId);
      // Admin client bypasses RLS — must filter credit_transactions by user_id
      // explicitly (getCreditBalance relies on RLS and would sum ALL users here).
      const { data: txns } = await admin.from("credit_transactions").select("amount").eq("user_id", userId);
      const credits = (txns ?? []).reduce((s: number, r: { amount: number }) => s + r.amount, 0);
      return { plan, minutes_left: Math.max(0, limit - used), minutes_used: used, minutes_limit: limit, credits };
    }
    default:
      throw new Error(`ไม่รู้จักเครื่องมือ: ${name}`);
  }
}
