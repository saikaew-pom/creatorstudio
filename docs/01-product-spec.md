# 01 — PRODUCT SPEC (screens & behaviors)

Two Next.js apps, shared Supabase. All routes below were verified against the reference
product's information architecture. Thai strings are placeholders to be revised by a human;
keep them in `packages/ui/locale/th.ts`.

---

## APP A — Content Engine (`app.<domain>`)

### Route map

```
/dashboard          home
/studio             Content Studio (topic → kit)          [?jobId= reopens old kit]
/viral-studio       template gallery
/viral-studio/[slug] template detail + form + output
/image-studio       Visual/Image Studio
/inspiration        public gallery of featured generations
/inspiration/[id]   detail w/ visible prompt + remix
/brands             Brand Voice list + /brands/new wizard
/styles             Style Cloner list + create
/history            My Works (all generations)
/collections        Folders
/calendar           Content Calendar
/credits            credit balance + packs + history
/pricing            plans
/settings           profile, API keys (BYO), preferences
```

### A1. Global header (every page)

Left: logo + "Content Engine". Right meta pills, in order:
1. **Brand pill** — active brand name or "ไม่ตั้งแบรนด์" (click → /brands)
2. **Model pill** — "Gemini 2.5 Flash · ฟรี" (click → model picker; BYO key unlocks more)
3. **Streak** — "🔥 2 วันติด" (any generation counts; resets after a missed day)
4. **Credits** — "31 เครดิต" (click → /credits)
5. Theme toggle (dark default, light supported)
6. Account chip with workspace badge
Floating bottom-right on every page: **"✨ สร้างคอนเทนต์"** button (→ /studio) + chat/feedback
bubble.

### A2. Dashboard

Top→bottom:
1. Greeting "สวัสดี, {name} 👋 / พร้อมสร้าง content วันนี้แล้วหรือยัง?" + "▶ วิธีใช้งาน" link.
2. **Quick-start card**: big input, placeholder `เช่น "ครีมกันแดดสำหรับผิวมัน" หรือ "ร้านกาแฟเปิดใหม่"`,
   button label switches disabled→"พิมพ์หัวข้อก่อน ✏️" / enabled→"สร้างเลย 🚀"; submits to
   /studio with topic prefilled. Below: "หรือ: [🔥 เทรนด์ไวรัล] [💡 หาไอเดียก่อน] [✨ ตั้ง Brand]".
3. **Usage strip**: "ใช้ {n}/30 วันนี้ · {total} ทั้งหมด · {b} brands · {s} styles".
4. **Onboarding checklist** (progress "1/4 ✓", strikethrough done items):
   สร้างคอนเทนต์แรก → ให้ AI ช่วยคิดไอเดีย → ลอง Viral Studio → ตั้ง Brand Voice (each row → deep link).
   Hide card when 4/4.
5. **Brand nudge card**: "ล็อกเสียงแบรนด์ให้คอนเทนต์นิ่งขึ้น — เหมาะกับคนที่สร้าง Studio หลายงานแล้ว" → /brands.
6. **Continue-last-work card**: latest generation title + "· {n} ชม.ที่แล้ว" → reopen.
7. Two-column: **ผลงานล่าสุด** (last 4, → /history) | **เทรนด์มาแรง** (top-3 viral templates by
   usage_count with "ใช้ {n} ครั้ง · {category}").
8. **HERO OF THE WEEK** banner: admin-featured generation, shows *the actual English prompt*
   as the headline + author + category → /inspiration/[id].
9. **ผลงานเด่นวันนี้** grid: 8 example cards (title, 2-line description of how it was made,
   badges [tool, platform]) — clicking opens the template/tool prefilled ("กดที่ใบไหนได้เพื่อดูวิธีสร้าง").

### A3. Content Studio (/studio)

**Form state** (top of page, chip "✏️ เริ่มจากหัวข้อใหม่"):
- Brainstorm banner: "💡 ยังไม่รู้จะเขียนอะไร? พิมพ์หัวข้อหรือประเภทธุรกิจ แล้วให้ AI คิดไอเดียให้ →"
  (opens §C popover; selecting an idea fills topic).
- **หัวข้อ / ไอเดียที่อยากเล่า** — textarea, placeholder `เช่น "AI ช่วย SME ไทยลดต้นทุน 70%" หรือ
  "5 เคล็ดลับโพสต์ FB ที่ไม่มีคน scroll ผ่าน"`. Under it right-aligned: "💡 ขอ AI ช่วยคิดไอเดีย".
- **เทมเพลต** chips (7): Portfolio งานที่ทำ · Day in the life · เปิดตัวสินค้าใหม่ · รีวิวแบบจริงใจ ·
  Before-After · เคล็ดลับ 5 ข้อ · Promotion ลดราคา (single-select toggle).
- **ประเภทธุรกิจ / Niche (ไม่บังคับ)** — free text + 12 chips: ทั่วไป, ขายของออนไลน์, ร้านอาหาร,
  อสังหาริมทรัพย์, การเงิน-ลงทุน, สุขภาพ-ความงาม, การศึกษา-คอร์ส, ฟรีแลนซ์-บริการ, เกษตร-OTOP,
  ช่าง-รับเหมา, ท่องเที่ยว-โรงแรม, Personal Brand.
- **แพลตฟอร์มที่จะใช้** — multi-select chips: Facebook ✓(default) · Instagram · TikTok · YouTube · TTS (เสียง).
- **Brand / Style dropdowns** — "ไม่ใช้ Brand Voice" / "ไม่ใช้ Style" defaults; info line:
  "🖋 โทนการเขียน: มาตรฐาน (ไม่ใช้แบรนด์/สไตล์) — เลือกได้จาก Brand/Style ด้านบน".
- Submit: **"🚀 เริ่มสร้าง Content"** (disabled until topic non-empty). Deducts 1 daily free use.

**Result state** (below form; form collapses to summary): sections per §A schema —
Hook / Script / Visual Prompts / Hashtags — each with `[copy] [🔄 regenerate] [✏️ ปรับ]`.
- Hook: active hook box, type chips (✨ อัตโนมัติ · ? คำถาม · 🔥 FOMO · 📖 เรื่องเล่า · 📊 สถิติ-ตัวเลข),
  "▶ ดูตัวเลือกอื่น (4)" collapsible.
- Script: platform tabs; each panel labeled "CAPTION พร้อมโพสต์" + "คัดลอก caption".
- Visual Prompts: tabs `Cover / ภาพประกอบ (3) / Video (prompt) (8)`. Cover panel: aspect chip
  "2:3 → crop 4:5" + label + English prompt + safe-zone note + **Thai-text checkbox** (1cr vs
  5cr copy per §I.1) + inline generated image with [ดูเต็มจอ] [ดาวน์โหลด] [เจนใหม่]. Upsell card:
  "🎨 อยากปรับแต่งภาพแบบเต็มที่? ไป Visual Studio · 72 เทมเพลตพร้อมใช้ · ใส่ logo + รูปสินค้า +
  ตัวอักษรไทย · เลือกขนาดและรุ่น AI ได้เอง → [Visual Studio →]".
- Hashtags: per-platform tab "Facebook (5)" + chip list + "คัดลอกทั้งหมด (5)".
- Status bar: "พร้อมใช้งาน 4/4 ส่วน — Hook · Script · Visual · Hashtags" + [คัดลอกทั้งหมด].
- **Refine-all card**: "🎨 ปรับทั้งหมดในครั้งเดียว — พิมพ์รวมๆ เพื่อปรับทุก section — หรือระบุเจาะจงก็ได้"
  + textarea + [🚀 ปรับทั้งหมด].
- Reopened old kit shows banner: "📂 กำลังดู Job เก่า (ID: {jobId}) — ปรับ (refine) ได้ หรือสร้างใหม่ได้".

### A4. Viral Studio (/viral-studio)

- Header + [📋 ประวัติของฉัน] [▶ วิธีใช้งาน].
- **เทรนด์แนะนำ**: 3 large Featured cards (image, HOT badge, category badge, title, desc, usage).
- Search box "ค้นหาเทรนด์... เช่น Pixar, วอลเปเปอร์, เพลง".
- Category tabs with counts: ทั้งหมด (67) · 🎬 คลิป 3D (9) · ✨ ภาพไวรัล (37) · 🔥 เกาะกระแส (13) ·
  🛍️ สินค้าโฆษณา (6) · 🎵 เพลง AI (2). Sort chips: แนะนำ · มาใหม่ · กำลังฮิต.
- Card grid: thumbnail, badges (🔥 HOT / ✨ NEW), category, title, usage "ใช้ {n} ครั้ง".

**Template detail** (/viral-studio/[slug]):
- Title, description, output-type chip ("📝 ข้อความ / แคปชั่น · ไม่มีรูปประกอบ" or with image),
  [วิธีใช้งาน].
- Quota banner: "🔥 เหลือ {n} ครั้งวันนี้ — เพิ่ม API Key เพื่อใช้ไม่จำกัด" → /settings keys.
- Example block: hero example asset + caption "นี่คือแนวทาง … ผลของคุณจะปรับตามข้อมูลที่กรอก".
- **กรอกข้อมูล** form rendered from `template.form` (doc 02 §T) + [✨ สร้าง Output].
- Output: blocks per `output_blocks` each with copy; prompts get "ใช้ใน Visual Studio";
  footer tip "💡 Copy prompt ไปวางใน ChatGPT, Gemini, Midjourney หรือ AI ตัวไหนก็ได้".

### A5. Image Studio (/image-studio)

- Title "🎨 เจนรูปแบรนด์คุณ — พิมพ์ → โทน + รูปแบรนด์ฉีดอัตโนมัติ → ได้รูปพร้อมโพสต์".
- **Brand-kit hero card** (only while no brand kit): "ตั้งแบรนด์คุณใน 30 วินาที — ให้ AI สร้างรูปที่เป็น
  'คุณ' ทุกครั้งที่เจน · เพิ่ม โลโก้ · รูปคุณ · ป้ายร้าน · Banner → AI ใส่ลงเทมเพลตอัตโนมัติ [เริ่มตั้งค่าเลย →]".
- **Prompt composer**: [+ รูป ref] attach tile · big textarea placeholder `พิมพ์อธิบายรูปที่อยากได้...
  เช่น โปสเตอร์โปรโมชั่นร้านกาแฟ โทนอบอุ่น มีข้อความ 'ลด 50%'` · helper line
  "💡 รูปธรรมดา — เร็วและประหยัดสุด · ไม่มีข้อความไทยในรูป · ไม่ใส่รูปอ้างอิง" · control row:
  [niche chip ▾] [model ▾ "Nano-tier · 1 เครดิต" / "Pro-tier · 5 เครดิต"] [aspect ▾ 1:1]
  · right: "ใช้ 1 / เหลือ {credits}" + send button.
- **เลือกจากเทมเพลต (72)** collapsible → grid + "ดูทั้งหมด" modal with filters: business-type
  chips + [📷 ใช้รูปแบรนด์] + [🇹🇭 ข้อความไทย]. Card: preview, aspect badge, title, desc,
  [ใช้เทมเพลตนี้] → opens composer prefilled with the template's form.
- **ผลงานล่าสุด** thumbnail strip → /history filtered Visual.

### A6. Inspiration (/inspiration + detail)

- Grid of admin-curated public generations (tool badge, author, date พ.ศ.).
- Detail page: full asset, then **PROMPT box (verbatim English prompt)**, meta grid
  (โมเดล / ราคา n เครดิต / Aspect / Tier), then remix card: "อยากลองสร้างแบบนี้บ้าง? กดปุ่มเพื่อเปิด
  Visual Studio พร้อมข้อมูลกรอกให้ครบ — ปรับแต่งให้เป็นของคุณแล้วเจนใหม่ได้เลย" +
  [✨ ใช้ใน Visual Studio →] [⬇ ดาวน์โหลด] [📋 คัดลอก Prompt].

### A7. Brands, Styles

- /brands: list + "สร้าง Brand ใหม่" → 4-step wizard: ① เล่าให้ AI ฟัง (textarea + starter chips +
  [ฉันอยากกรอกเอง] | [✨ ให้ AI กรอกให้ →]) ② ตรวจ + บันทึก (editable extracted fields w/ guessed
  badges) ③ ใส่รูปแบรนด์ (logo / person / sign / banner uploads + brand colors) ④ เสร็จ.
  Header claim: "เล่าให้ AI ฟัง · AI กรอก fields ให้ครบ · บันทึกใน 3 นาที".
- /styles: "Style Cloner — โคลนสไตล์การเขียนจาก content ที่ชอบ แล้วใช้สไตล์นั้นสร้าง content ของคุณเอง".
  Empty state + [+ สร้าง Style ใหม่] → paste 1-3 samples → §SC → profile card (name, dna chips,
  sample_rewrite preview, delete/edit).

### A8. History, Collections, Calendar, Credits

- /history "ผลงานของฉัน — ทุกอย่างที่คุณสร้างไว้ — ภาพ · เนื้อหา · เทรนด์": filter chips ทั้งหมด /
  🖼 Visual / ✏️ Content / 🔥 Viral; view toggle [รายการ | ปฏิทิน]; card shows type badge, title/
  full-text preview or image, niche, timestamp "7 ก.ค. 14:49", add-to-folder icon. Click →
  reopen in its studio (?jobId=).
- /collections "โฟลเดอร์ของฉัน — จัดกลุ่มผลงานเป็นโฟลเดอร์ · ตามแคมเปญ · ลูกค้า · หรือธีมที่ชอบ";
  empty tip "จัดตามแคมเปญ ลูกค้า หรือเดือน · ค้นย้อนหลังง่ายกว่าเรียงแบบเดิม".
- /calendar "Content Calendar — จัดตาราง content รายเดือน — ลาก content เพื่อเปลี่ยนวัน": month grid
  (พ.ศ. header e.g. "กรกฎาคม 2569"), items = generation chips on their scheduled date,
  drag-and-drop between days, month nav arrows.
- /credits "เครดิตเจนรูป": balance card; pack cards เริ่มต้น 100cr ฿199 (฿1.99/cr) · คุ้มค่า 500cr
  ฿899 (฿1.80/cr · ประหยัด 10% · badge ยอดนิยม) · จัดเต็ม 1,000cr ฿1,599 (฿1.60/cr · ประหยัด 20% ·
  badge คุ้มที่สุด); **ประวัติเครดิต** ledger list ("ใช้เจนรูป · 07 ก.ค. 07:38 · ใช้กับ Image Studio /
  Viral Studio · −1"). Sidebar extras: ราคาแพ็คเกจ / เครดิตของฉัน / แจกเครดิต (gift codes, phase 2).

---

## APP B — Creator Studio (`studio.<domain>`)

### Route map

```
/dashboard        home (minutes, quick actions, notifications)
/video-editor     the 3-step editor (project auto-loads last, folder menu switches)
/gallery          finished renders
/guide            help center (own subdomain ok)
/updates          changelog
/pricing          plans
/settings         profile · API keys · Agent/MCP · Billing
/api/mcp          MCP server endpoint
```

### B1. Dashboard

- Success banner when a render finished while away: "✅ วิดีโอเรนเดอร์เสร็จแล้ว — เข้าไปแต่งซับ +
  ส่งออกได้เลย" (+ bell badge).
- "แดชบอร์ด · {PLAN}" + greeting + plan chip + "30d remaining".
- Guide box: "คุณมี {quota} นาที/เดือน สำหรับสร้างวิดีโอ · ระบบจัดการ AI (Gemini) ให้ — ไม่ต้องตั้งค่า
  key เอง ใส่แค่ Pexels/Pixabay สำหรับ B-roll · ใช้เกินโควต้านาที? ซื้อเครดิตเติมได้".
- Minutes pill "74/80 นาที". Quick cards: Video Editor (Timeline editor) · Gallery (ดู renders เก่า)
  · วิธีใช้งาน. Stat tiles: STYLES / VIDEOS counts. Business upsell footer:
  "150 นาที/เดือน • วิดีโอ 10 นาที/คลิป • เก็บวิดีโอ 14 วัน • Priority support".

### B2. Video editor — stepper `01 สคริปต์ → 02 องค์ประกอบ → 03 แต่งซับ`

Top bar: back, logo, project-folder menu (โปรเจกต์ล่าสุด / + โปรเจกต์ใหม่ / list w/ delete),
project name (inline edit), autosave dot "บันทึกแล้ว", stepper center, bell + วิธีใช้งาน + avatar.

**Step 01 สคริปต์** — mode cards: [✏️ พิมพ์สคริปต์ — ระบบสร้างเสียง + บีโรล + ซับให้ทั้งหมด] |
[🎬 ใช้คลิปที่ถ่ายเอง — อัปคลิปแนวตั้ง → ซับ + บีโรลอัตโนมัติ]. Script textarea ("Enter =
ขึ้นเซกเมนต์ใหม่ / ขึ้นบรรทัดใหม่ = แยกเซ็กเมนต์"); footer counter "{w} คำ · {n} เซ็กเมนต์ · คลิปยาว
~{m:ss} นาที" (Thai speech ≈ 2.5 words/sec baseline, tune later). Right rail "ระบบแบ่งเซ็กเมนต์ให้แล้ว
— ลากการ์ดเพื่อสลับลำดับ": draggable cards, first = type **HOOK** (violet), rest เนื้อหา n, each
with computed time range. CTA "ถัดไป: เลือกองค์ประกอบ →".

**Step 02 องค์ประกอบ** — sections:
- **บีโรล** "ภาพประกอบที่สลับทุก 3–5 วิ ระหว่างเสียงพูด": tier cards ฟรีล้วน (สต็อกฟรีทั้งหมด · 0 เครดิต)
  | ผสม AI แนะนำ (สต็อก + ภาพ AI แทรก · ~6–9 เครดิต/คลิป · เร็วๆ นี้) | AI เต็มที่ (ภาพ AI ทุกช่วง ·
  ~25–45 เครดิต/คลิป · เร็วๆ นี้) + ตั้งค่าขั้นสูง (per-segment keyword override, source toggle).
- **เสียงพากย์** "เสียง AI อ่านสคริปต์ของคุณ": provider tabs [Gemini | ElevenLabs]; voice card
  (name, gender · character, [🔊 ฟังตัวอย่าง]); "เลือกเสียงอื่น" expands voice grid; ElevenLabs tab
  requires voiceId (helper: "ต้องมี voiceId ของเสียงที่เลือก ไม่งั้นระบบใช้ Gemini เป็นค่าเริ่มต้น").
- **เพลงประกอบ** "เพลงเบา ๆ ใต้เสียงพูด (ลดเสียงอัตโนมัติ) · กดไอคอนเพื่อฟังตัวอย่าง": mood chips
  w/ inline play: Classical-Ambient-Cinematic · แนะนำ / Hip Hop-Funk-Cinematic / Electronic-Laid
  Back-Upbeat / Jazz-Ambient-Cinematic-Dramatic / Pop-Acoustic-Groovy-Playful / Soul-Groovy-Hopeful
  / ไม่ใส่เพลง + link "คลังเพลงทั้งหมด (22) · อัปโหลดเพลงของคุณ".
- **อวตารพิธีกร** "พิธีกร AI อ่านสคริปต์ให้ (คิดค่า HeyGen ตามวินาที)": [มีอวตาร | Faceless(default)]
  — faceless note "วิดีโอเสียง + บีโรล ไม่มีพิธีกร". (Avatar = phase 2; keep UI, disable behind flag.)
- Right rail: 9:16 preview placeholder "พรีวิวจะแสดงหลังเรนเดอร์" + **สรุปการตั้งค่า** table (สคริปต์ /
  บีโรล / เสียง / เพลง / อวตาร) + **[เรนเดอร์วิดีโอ]** + cost line "คลิปยาว ~{len} · ใช้ ~{m} จาก {left}
  นาทีที่เหลือ · แก้ทุกอย่างได้ทีหลัง".

**Step 03 แต่งซับ** — full caption studio per doc 04 §6 + BLUEPRINT §6 notes:
left = caption card list (time range, HOOK tag, inline edit, [รวมกับใบถัดไป] [แยกการ์ด]);
center = 9:16 preview with live overlay + on-video drag positioning; right = settings panel
(caption length presets, 4 styles, 6 effects, 11 themes, text effects, font/weight/size,
scope ทั้งคลิป/การ์ดที่เลือก, base + HOOK·CTA colors, shadow/outline, vertical position);
bottom = timeline (เสียงพูด waveform · บีโรล keyword chips · ซับไทย chips · เพลง w/ auto-duck
label) with play/undo/Snap/zoom + keyboard (Space, ←/→ 1s, Ctrl+Z).
Render banner top: "✅ เรนเดอร์เสร็จแล้ว · แก้ซับเห็นผลทันที ไม่ต้องเรนเดอร์ใหม่ | [เรนเดอร์ใหม่]
[ส่งออกวิดีโอ]" — export button becomes progress "กำลังฝังซับ {p}%".

### B3. Settings

Tabs: Profile · **API Keys** · **Agent / MCP** · Billing.
- API Keys: status banner ("✓ พร้อมสร้างวิดีโอ" / "⚠ ยังขาด key"); จำเป็น: Pexels API Key
  [ฟรี badge, link to get one, eye/test/delete, status ตั้งแล้ว/ยังไม่ตั้ง] + Pixabay same —
  helper "มี Pexels หรือ Pixabay อย่างน้อย 1 ก็พอ · ไม่มี B-roll = วิดีโอไม่มีภาพประกอบ"; collapsed
  "ขั้นสูง (ไม่บังคับ) — ไม่ใส่ก็ใช้งานได้" (own Gemini key, ElevenLabs key). [ทดสอบ] does a live
  1-result API call.
- Agent/MCP: "ต่อ Claude Code / agent ของคุณเข้ากับ HERO-style AI" — warning box "ก่อนสั่งสร้างวิดีโอ:
  ต้องตั้ง API Keys ก่อน ไม่งั้น agent ต่อติดแต่สั่งงานจะ error [ไปตั้งค่า →]"; ENDPOINT display +
  copy (`https://studio.<domain>/api/mcp`); agent picker [Claude | Claude Code | Codex] +
  [OpenClaw | Hermes Agent]; per-agent step cards (Claude: Settings → Connectors → Add custom
  connector → paste URL → Connect + OAuth login → "ไม่ต้องใช้ token — เชื่อมผ่าน Login (OAuth)");
  ACCESS TOKENS section + [+ สร้าง Token] for token agents.
- Billing: plan card "PRO เหลือ 74/80 นาที · รีเซ็ต {date พ.ศ.} [อัปเกรด →]"; [ดูแพ็กเกจทั้งหมด];
  [จัดการการสมัคร / วิธีชำระเงิน] (Stripe portal); เครดิต AI summary (เครดิตแถมเดือนนี้ / เครดิตที่ซื้อ /
  รวม) + note "เติมเครดิตเพื่อเติมนาทีเมื่อใช้เกินโควต้าแพ็ก (2 เครดิต = 1 นาที) · เครดิตที่ซื้ออยู่ถาวร
  ไม่หายแม้เปลี่ยนแผน"; packs Starter 200cr ฿199 / Popular 540cr ฿499 (+8%) / Pro 1,150cr ฿999 (+15%).

### B4. Help center (/guide)

Sections: เริ่มต้นใช้งาน · ตั้งค่าคีย์ API · สร้างวิดีโอ · ซับไทย · พิธีกร AI (Avatar) · นาที & เครดิต ·
แก้ปัญหา & FAQ. Content = the flow facts in BLUEPRINT §6 (5 steps, 2 modes, B-roll 3-5s,
voice options, tips). Searchable. "กลับแอป" button.

---

## Cross-cutting

### 8. Admin (internal, minimal)
`/admin` behind role flag: template CRUD (visual + viral, form-builder for FormFields),
feature a generation to Inspiration / Hero-of-the-week, music library upload w/ mood tags,
model_costs editor, plan/quota editor. No design polish needed.

### 9. Plans (launch values — editable in DB)

| | Free | Pro ฿399/mo | Business ฿990/mo |
|---|---|---|---|
| Content generations/day (house key) | 30 | 100 | 300 |
| Image credits granted/mo | 20 | 50 | 150 |
| Video minutes/mo | 5 | 80 | 150 |
| Max clip length | 3 min | 10 min | 10 min |
| Render retention | 7 days | 14 days | 14 days |
| BYO API keys | ✓ | ✓ | ✓ |
| MCP access | – | ✓ | ✓ |

### 10. Notifications
In-app bell (both apps): render done, export done, credit low (<10), streak reminder.
Row click deep-links. Badge count on bell.
