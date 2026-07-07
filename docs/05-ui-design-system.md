# 05 — UI / DESIGN SYSTEM

Both apps share `packages/ui`. Dark-first, violet-accent, Thai-optimized.

## 1. Tokens

```css
:root[data-theme="dark"] {
  --bg: #0a0a12;            /* app background (near-black, slight blue) */
  --bg-raised: #12121c;     /* cards */
  --bg-inset: #0d0d16;      /* inputs, wells */
  --border: #23233a;
  --text: #ececf4; --text-dim: #8b8ba3;
  --accent: #7c5cff;        /* violet — primary buttons, active states */
  --accent-2: #a78bfa;      /* gradient partner */
  --success: #34d399; --warn: #fbbf24; --danger: #f87171;
  --gold: #d4a94e;          /* featured/HERO cards */
  --radius: 12px; --radius-lg: 16px;
}
/* light theme = same hues, inverted neutrals; support both (theme toggle in header) */
```
Fonts: UI = **IBM Plex Sans Thai** or **Noto Sans Thai** (400/500/700); caption fonts bundled
separately (Kanit, Prompt, Sarabun, Mitr). Numbers/timers may use JetBrains Mono.

## 2. Component inventory (build once, reuse everywhere)

| Component | Notes |
|---|---|
| `MetaPill` | header pills (brand/model/streak/credits) — icon + text, hover = ring |
| `SectionCard` | title row (emoji+name) + action row (copy/regen/refine) + body |
| `ChipSelect` | single & multi variants; selected = accent fill; used for templates, niches, platforms, hook types, moods, filters |
| `OptionCard` | radio-card with title+subtitle+badge (script modes, B-roll tiers, packs) |
| `PromptBox` | monospace-ish English prompt display + copy button (Inspiration, Visual Prompts) |
| `CreditTag` | "1 เครดิต" / "ใช้ 1 · เหลือ 31" cost transparency element — REQUIRED next to every paid action |
| `QuotaBanner` | "🔥 เหลือ {n} ครั้งวันนี้ — เพิ่ม API Key เพื่อใช้ไม่จำกัด" |
| `JobProgressButton` | button morphs into progress ("กำลังฝังซับ 34%") |
| `TemplateCard` | thumb + badges(HOT/NEW/Featured) + category chip + title + usage count |
| `WizardStepper` | numbered steps with connectors (brand wizard, editor 01/02/03) |
| `TimelineTrack` | studio: waveform / chip / block tracks with time ruler |
| `CaptionCard` | time range + type tag + editable text + merge/split |
| `EmptyState` | icon + one-liner + tip line + CTA (folders, styles pattern) |
| `OnboardingChecklist` | progress bar + strikethrough rows + arrow links |
| `StatTile` | label caps small + huge number (STYLES 0 / VIDEOS 0) |

## 3. Layout rules

- App shell: fixed sidebar 260px (App A) with grouped nav (สร้าง CONTENT/WORKFLOW · แบรนด์ของคุณ ·
  ของฉัน · เครดิต+แพ็คเกจ · เรียนรู้), collapsible; each item = icon + name + one-line subtitle
  (this two-line nav pattern is core to the reference feel).
- Studio (App B) editor is full-bleed, no sidebar: top bar + 3-pane (list / preview / settings)
  + bottom timeline.
- Content width max 1180px centered on non-editor pages.
- Cards over tables everywhere except credit history (list rows).
- Every AI output section: actions top-right, copy affordance ALWAYS visible (not hover-only).
- Mobile: sidebar → bottom tabs; editor step 03 stacks (preview on top, settings sheet).

## 4. Voice & microcopy rules

- Friendly Thai, no formal ครับ/ค่ะ from the system; sparse emoji as bullets (💡 tips, 🔥 quota,
  ✅ success).
- Every constraint is explained with the *why*: "ไม่มี B-roll = วิดีโอไม่มีภาพประกอบ".
- Costs always visible pre-click; results always announce next step ("เข้าไปแต่งซับ + ส่งออกได้เลย").
- Dates in พ.ศ.; times "7 ก.ค. 14:49".

## 5. States that must exist for every generator screen

idle → generating (skeleton + rotating step labels, Thai) → done → refine-diff flash
(changed section pulses) → error (Thai message + "ลองใหม่" + no credit loss note).
Never show a raw spinner without a label.
