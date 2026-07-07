# 04 — VIDEO PIPELINE (studio worker) + MCP SERVER

The studio's magic = one architectural split (BLUEPRINT P8):

```
PREVIEW RENDER (minutes-charged)          EXPORT (free, fast)
script ──▶ TTS ──▶ align ──▶ B-roll ──▶ base.mp4 (no captions)
                                   └──▶ captions.json (cards)
user styles captions in browser (live overlay, zero re-render)
                                   base.mp4 + captions.json ──▶ burn ──▶ final.mp4
```

## 1. Preview render job (`kind: preview_render`)

Worker steps — update `render_jobs.progress/step_label` after each:

| # | step_label (Thai) | What happens |
|---|---|---|
| 1 | กำลังเตรียมสคริปต์ | Freeze segments; optional VD.2 polish already applied in UI |
| 2 | กำลังสร้างเสียงพากย์ | TTS per segment (§2). Output: seg_###.mp3 + durations |
| 3 | กำลังจับเวลาซับ | Word-level alignment (§3) → caption cards (§4) |
| 4 | กำลังหาภาพประกอบ | VD.1 keywords → Pexels/Pixabay fetch → broll_plan (§5) |
| 5 | กำลังประกอบวิดีโอ | Remotion render: B-roll sequence + voice + music (auto-duck) → base.mp4 |
| 6 | เสร็จแล้ว | Upload to storage, project.status='rendered', notification |

Concurrency: 1 render per user at a time; queue others. Estimated time shown as
"~{n} นาที · ปิดแท็บได้ งานทำต่อเบื้องหลัง".

## 2. TTS

- **Gemini TTS** (default): voice from curated list (each: id, display name, gender,
  character tag e.g. "Aoede — Female · Breezy", sample mp3 pre-generated for ฟังตัวอย่าง).
  Generate per-segment (not whole script) → natural pauses at segment joins + per-segment
  timing for free.
- **ElevenLabs**: user voiceId + user key (or house key on paid plans). Same per-segment call.
- Post: loudness-normalize (-16 LUFS), concat with 250ms gaps → voice.wav + segment offsets.

## 3. Alignment (captions need word timestamps)

Run STT-with-timestamps on voice.wav (Whisper large-v3 word_timestamps=true, Thai).
We know the intended text — use it: align Whisper's word stream to the script text
(simple DTW / greedy match on normalized Thai) so caption text = *user's script*, timing =
*audio truth*. Fallback if alignment confidence low: distribute words evenly across the
segment's audio duration (good enough at 2-4s segments).

## 4. Caption chunking (การ์ดซับ)

Input: word list with times + segment types. `chunk_mode`:
- `sentence` (1 ประโยค): split on Thai sentence-ish boundaries (space clusters, particles
  ครับ/ค่ะ/นะ + pause > 300ms) — max 12 words per card.
- `w4` / `w3` / `w2` (≤N คำ): TikTok rapid style — greedy N-word cards, never split across a
  pause > 400ms.
Card inherits `type:'hook'` if inside segment 1. Changing chunk_mode **re-chunks and discards
manual merges/splits** — warn exactly like the reference: "เปลี่ยนแล้วจะล้างการรวม/แยก/สีราย
การ์ดที่แก้ไว้". Merge = concat adjacent cards; split = at word boundary nearest midpoint.
Persist to `captions.cards`.

## 5. B-roll assembly

For each segment: search primary keyword (orientation=portrait, size≥1080) on the user's
configured source(s); need ≥3 candidates else try alts, else other provider, else fallback
pool by `vibe`. Selection rules:
- slice segments into 3–5s windows; one clip per window (this is the "สลับทุก 3-5 วิ" feel)
- no clip reused within 30s; adjacent windows must differ in `vibe` or query when possible
- trim clips center-out; scale/crop cover to 1080×1920; 0.3s crossfade
Store plan in `broll_plan.items` — the timeline's keyword chips render from this, and the
advanced settings let users edit a keyword → re-fetch just that window (no full re-render;
B-roll swap re-renders base in background as a cheap job).

## 6. Caption styling system (step 03)

`CaptionStyle` state (persisted per project):
```ts
type CaptionStyle = {
  preset: "bounce_viral"|"dark_shadow"|"thick_outline"|"minimal";   // 4 สไตล์แนะนำ
  effect_base: "standard"|"minimal"|"bold"|"karaoke"|"popline"|"outline"; // 6 ปรับได้
  theme: null|"neon_green"|"pastel"|"classic"|"hormozi"|"beast"|"white_box"|"yellow_box"
        |"retro"|"news"|"red_fire"|"electric";                       // 11 เอฟเฟกต์ติดสไตล์
  text_effect: "pop"|"bounce"|"fade"|"short"|"glow"|"slide"|"spin_zoom"|"highlight"
        |"karaoke"|"typewriter"|null;                                // เอฟเฟกต์ตัวอักษร
  font_family: string;      // default "Kanit" — bundle Thai fonts: Kanit, Prompt, Sarabun, Mitr
  font_weight: "bold"|"light"; font_size_px: number;                 // default 80
  color_base: string; color_emphasis: string;   // HOOK·CTA cards use color_emphasis
  shadow: boolean; outline: boolean; outline_width: number;
  pos_vertical_pct: number;                     // default 88 (ล่าง); บน/กลาง/ล่าง = 12/50/88
  scope_overrides: Record<cardIdx, Partial<CaptionStyle>>;  // การ์ดที่เลือก scope
}
```
Implementation: **each preset/theme/effect is a React component/props-map used identically in
(a) the browser preview overlay and (b) the Remotion export composition** — one source of
truth in `packages/ui/captions/`. Theme selection overrides effect_base (reference behavior:
"เลือกกลุ่มนี้แล้วระบบจะใช้เอฟเฟกต์ประจำสไตล์แทนปุ่มเอฟเฟกต์ด้านล่าง").
Theme quick-specs: hormozi = huge bold white + yellow keyword highlight + hard shadow;
beast = bouncy pop-in, saturated colors, thick black outline; karaoke = word-by-word fill;
news = lower-third bar; white_box/yellow_box = solid box behind text; typewriter = char reveal.
Interactions: drag caption on preview = set pos_vertical_pct; Space play/pause; ←/→ ±1s;
Ctrl+Z undo (style + card edits, in-memory stack).

## 7. Upload-own-clip mode

1. Upload vertical mp4/mov (≤10 min plan cap) → probe + normalize to 1080×1920.
2. Whisper transcribe (Thai) with word timestamps → VD.4 call → caption cards + spans.
3. B-roll: alternate pattern — keep original video full-screen for spans where the person is
   the point (default: first 3s + every other span), overlay B-roll windows for the rest;
   **original audio always continuous**.
4. Same step-03 styling + export. Charge minutes = source duration.

## 8. Export job (`kind: export`)

Remotion composition: base.mp4 as background layer + caption components from
captions.json/CaptionStyle → encode H.264 1080×1920 30fps + AAC. Progress = "กำลังฝังซับ {p}%".
Output → storage → gallery row → notification "วิดีโอเรนเดอร์เสร็จแล้ว — เข้าไปแต่งซับ + ส่งออกได้เลย".
No minute charge (already paid at preview). Retention cron per plan.

## 9. Music & ducking

House library (22 tracks, mood-tagged, loudness-normalized). Duck: sidechain — music −18dB
under voice with 150ms attack / 400ms release (implement as volume envelope computed from
voice VAD, applied in Remotion audio). Loop track to clip length, 2s fade-out. Label on
timeline: "♪ ลดเสียงใต้เสียงพูดอัตโนมัติ". User upload: mp3/wav ≤10MB, stored per user.

## 10. MCP server (`studio.<domain>/api/mcp`)

Streamable-HTTP MCP endpoint. Auth: OAuth (Supabase) for Claude-family clients; bearer
`mcp_tokens` for headless agents. Tools:

```
create_video({script, voice?, music_mood?, broll_tier?}) → {project_id, job_id}
get_job_status({job_id}) → {status, progress, step_label}
list_projects() / get_project({id})
set_caption_style({project_id, preset?, theme?, ...CaptionStyle partial})
export_video({project_id}) → {job_id}
get_download_url({project_id}) → {url, expires_at}
get_quota() → {minutes_left, credits, plan}
```
Rules: tools respect the same quota/credit checks as the UI; `create_video` validates that
Pexels/Pixabay key exists and returns the Thai error string guiding to settings if not
(mirrors the reference warning). Rate-limit per token. Log tool calls.

## 11. Cost & quota accounting

- Preview render: charge `ceil(clip_seconds/60)` minutes at enqueue, reconcile on finish.
- Minutes exhausted → offer credits: 2 credits = 1 minute (auto-convert with confirm dialog).
- Image B-roll tiers (phase 2): debit estimate at enqueue, reconcile actual images generated.
- All charges show *before* the button ("ใช้ ~1 จาก 74 นาทีที่เหลือ").
