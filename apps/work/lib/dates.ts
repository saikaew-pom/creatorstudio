// Date-only helpers for a Thailand-only app (Thai copy, Buddhist-year calendar,
// no per-user timezone setting anywhere). "Today" must mean the calendar day in
// Bangkok (UTC+7), not the runtime's own local timezone — server processes here
// run in UTC, so a bare `new Date().toISOString().slice(0,10)` silently returns
// YESTERDAY's date for roughly 1/3 of every day (00:00–07:00 Bangkok time),
// which skews any "this week" window built from it. This works identically in
// the browser and on the server since it's pure UTC-epoch arithmetic, never
// touching the runtime's own local timezone.
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

export function todayIsoBangkok(): string {
  return new Date(Date.now() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

/** Pure calendar-date arithmetic on a "YYYY-MM-DD" string — parses/re-serializes
 * as UTC so it's unaffected by the runtime's local timezone or DST. */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
