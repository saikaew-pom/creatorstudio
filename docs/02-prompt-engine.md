# 02 — PROMPT ENGINE (the core of the product)

> This document specifies **every AI-powered button** in both apps: the exact system prompt,
> user prompt template, output JSON schema, model routing, temperature, and the refine loop.
> The executing model implements these **verbatim** as typed modules in `packages/prompts/`
> (see BLUEPRINT.md P1). `{{double_braces}}` = interpolated variables. Conditional blocks are
> marked `<<IF x>> ... <<END>>` — render them only when the condition holds, never send the
> markers themselves.
>
> Language law (P3): human-facing text → Thai. Image/video prompts + B-roll keywords →
> English. Literal text to appear inside an image stays in its original language inside
> double quotes.

---

## Table of contents

- [§0 Shared infrastructure](#0-shared-infrastructure)
- [§A Content Kit — the "เริ่มสร้าง Content" button](#a-content-kit)
- [§B Hook variants & hook-type regeneration](#b-hooks)
- [§C Brainstorm — "ขอ AI ช่วยคิดไอเดีย"](#c-brainstorm)
- [§R Refine loops — "ปรับ" and "ปรับทั้งหมดในครั้งเดียว"](#r-refine)
- [§V Visual prompt generation (covers, illustrations, video prompts)](#v-visual-prompts)
- [§I Image Studio — direct image generation + Thai-text mode](#i-image-studio)
- [§T Template systems — Visual templates (72) & Viral Studio (67)](#t-templates)
- [§BV Brand Voice — "ให้ AI กรอกให้"](#bv-brand-voice)
- [§SC Style Cloner](#sc-style-cloner)
- [§VD Video studio prompts (B-roll keywords, script polish, upload-mode)](#vd-video-studio)
- [§QA Quality bar & eval set](#qa-quality)

---

## §0 Shared infrastructure

### 0.1 Provider router

```ts
type ModelTier = "fast" | "smart" | "image-standard" | "image-pro" | "tts" | "stt";
// fast   → gemini-2.5-flash   (default for all generation)
// smart  → gemini-2.5-pro     (refine-all, brand analysis, style cloning)
// image-standard → cheap image model (1 credit)  — no reliable non-Latin text
// image-pro      → premium image model (5 credits) — renders Thai text correctly
```
Rules:
- JSON generations always set native structured-output / `responseMimeType: application/json`
  with the zod-derived schema.
- Retry: 1 retry on 5xx/timeout; then 1 schema-repair round (P2); then fail.
- Log `{prompt_id, model, latency, tokens, credits}` per call to `generations` table.

### 0.2 Context blocks (injected into most prompts)

**BRAND_BLOCK** — rendered only when the user selected a Brand Voice:
```
## แบรนด์ของผู้ใช้ (ต้องยึดตามนี้เสมอ)
ชื่อแบรนด์: {{brand.name}}
ธุรกิจ: {{brand.business}}
กลุ่มลูกค้าหลัก: {{brand.audience}}
โทนการพูด: {{brand.tone}}            // เช่น "อบอุ่น เป็นมิตร ไม่ทางการ"
สรรพนามที่ใช้: {{brand.pronoun}}      // เช่น "เรา" / "ผม" / "แอดมิน"
คำ/วลีที่ต้องใช้: {{brand.words_use}}
คำที่ห้ามใช้: {{brand.words_avoid}}
นโยบาย emoji: {{brand.emoji_policy}}  // none | light | medium | heavy
แฮชแท็กประจำแบรนด์: {{brand.hashtags}}
ตัวอย่างประโยคที่เป็น "เสียงของแบรนด์": {{brand.sample_lines}}
```

**STYLE_BLOCK** — rendered only when the user selected a cloned Style (see §SC for how the
profile is produced):
```
## สไตล์การเขียนที่ต้องเลียนแบบ (Style Clone)
{{style.profile_markdown}}
กติกา: เลียนแบบ "วิธีเขียน" (จังหวะประโยค คำลงท้าย อีโมจิ โครงสร้าง) — ห้ามลอกเนื้อหาหรือ
ข้อเท็จจริงจากตัวอย่างต้นฉบับ
```

**PLATFORM_SPECS** — constant, included whenever captions are generated:
```
## สเปกต่อแพลตฟอร์ม
- Facebook: แคปชันยาวได้ 3-8 ย่อหน้าสั้น เว้นบรรทัดบ่อย เล่าเรื่อง/ให้คุณค่า จบด้วย CTA ชวนคอมเมนต์
  หรือแชร์ ใช้ **ตัวหนา** ได้เฉพาะหัวข้อย่อย
- Instagram: แคปชัน 3-6 ย่อหน้า บรรทัดแรกต้องหยุดนิ้วได้ใน 1 วิ เว้นวรรคอ่านง่าย ลงท้าย CTA + ชวน save
- TikTok: เป็น "สคริปต์พูด" ไม่ใช่แคปชัน — Hook ≤ 2 วิ, ประโยคสั้น จังหวะเร็ว, ยาวรวม 30-60 วิ
  แบ่งบรรทัดละ 1 ประโยค (1 บรรทัด = ซับ 1 การ์ด), ปิดท้าย CTA ตาม goal
- YouTube: โครง intro-hook / เนื้อหาเป็นข้อ / outro-CTA + คำอธิบายวิดีโอ 2 ย่อหน้า
- TTS (เสียง): สคริปต์อ่านออกเสียง ภาษาพูดธรรมชาติ ไม่มี emoji ไม่มีสัญลักษณ์ ตัวเลขเขียนเป็นคำอ่าน
```

**SAFE_ZONE_RULE** — constant, appended to every *cover/vertical* image prompt (English):
```
Composition: keep the subject and all key elements within the central 70% of the frame.
Top 15% and bottom 15% must stay clear of critical elements, so social media UI overlays
or cropping cannot destroy the image.
```

**NO_TEXT_GUARD** — default negative for standard-model images (English):
```
Absolutely no text, no letters, no captions, no watermarks, no logos other than what is
physically printed on real products shown in the scene.
```

### 0.3 Output hygiene rules (append to every Thai copywriting system prompt)

```
## กติกาการเขียน (บังคับ)
- ภาษาไทยธรรมชาติแบบที่คนไทยพิมพ์จริง ห้ามสำนวนแปลจากอังกฤษ (ห้าม "มันคือ...ที่ซึ่ง", "อย่างไรก็ดี")
- ประโยคสั้น ย่อหน้าสั้น เว้นบรรทัดให้อ่านบนมือถือง่าย
- ห้ามใช้ markdown heading (#) ในแคปชัน — ใช้ตัวหนา **...** ได้เท่าที่จำเป็น
- emoji: ใช้เท่าที่ช่วยให้อ่านง่าย/มีชีวิต ตาม emoji policy ถ้าไม่มี policy ให้ "ปานกลาง" (2-6 ตัวทั้งโพสต์)
- ห้ามแต่งข้อเท็จจริง สถิติ หรือรีวิวปลอม ถ้าต้องใช้ตัวเลขให้เขียนแบบกลางๆ ("หลายเท่า", "จำนวนมาก")
  เว้นแต่ผู้ใช้ให้ตัวเลขมา
- ห้ามคำต้องห้ามโฆษณาไทยสายเสี่ยง (เคลมรักษาโรค, "ที่สุด" แบบไม่มีที่มา, การันตีรายได้)
```

---

## §A Content Kit — the "เริ่มสร้าง Content" button {#a-content-kit}

**Trigger**: Content Studio form submit.
**Model**: `fast` (gemini-2.5-flash), temperature 0.8, one single call returns the whole kit.
**Credits**: 1 free-quota use (text), images billed separately when user generates them.

### A.1 Input type

```ts
type ContentKitInput = {
  topic: string;                    // "หยุดคิดว่า AI จะมาแย่งงาน — 3 วิธีที่..."
  niche?: string;                   // "Personal Brand" | free text
  platforms: ("facebook"|"instagram"|"tiktok"|"youtube"|"tts")[];
  template?: TemplateChip;          // §A.4 — portfolio | day_in_life | new_product |
                                    // honest_review | before_after | five_tips | promotion
  goal?: "engagement"|"followers"|"sales"|"educate";   // default engagement
  brand?: Brand; style?: StyleProfile;                 // context blocks
}
```

### A.2 System prompt (verbatim template)

```
คุณคือ "ครีเอทีฟไดเรกเตอร์ + คอนเทนต์ครีเอเตอร์ไทย" ระดับท็อปของวงการ ที่ทำคอนเทนต์ไวรัลให้ SME
ไทยมาแล้วหลายร้อยแบรนด์ คุณเข้าใจ algorithm และพฤติกรรมคนไทยบนโซเชียลลึกซึ้ง

ภารกิจ: จากหัวข้อที่ผู้ใช้ให้มา สร้าง "ชุดคอนเทนต์พร้อมโพสต์" ที่ครบและใช้ได้ทันที โดยตอบเป็น JSON
ตาม schema ที่กำหนดเท่านั้น

{{PLATFORM_SPECS}}

## หลักการเขียน Hook (ส่วนที่สำคัญที่สุด)
สร้าง hook 5 แบบ แต่ละแบบใช้กลไกจิตวิทยาต่างกัน:
1. auto      — แบบที่คุณตัดสินว่าเหมาะกับหัวข้อ+แพลตฟอร์มที่สุด (ใส่เป็นตัวแรก และตั้ง is_recommended)
2. question  — คำถามที่แทงใจ target จนต้องหยุดอ่าน (ห้ามคำถาม yes/no จืดๆ)
3. fomo      — ความกลัวตกขบวน/เสียโอกาส ("คนอื่นเขา...กันหมดแล้ว", "ถ้ายังไม่รู้...กำลังเสียเปรียบ")
4. story     — เปิดด้วยเรื่องเล่า/สถานการณ์เห็นภาพ ("วันแรกที่ผม...", "ลูกค้าคนหนึ่งเดินมาบอกว่า...")
5. stat      — ตัวเลข/ข้อเท็จจริงที่สะดุด (ใช้ตัวเลขจากหัวข้อผู้ใช้เท่านั้น ถ้าไม่มี ใช้ตัวเลขเชิงโครงสร้าง
   เช่น "3 วิธี" "5 ข้อ" ห้ามกุสถิติ)
กติกา hook: ยาว 1-2 ประโยค อ่านแล้วต้อง "หยุดนิ้ว" ภายใน 2 วินาที ใส่ emoji ได้ 0-1 ตัว

## โครงสร้างเนื้อหา (ทุกแพลตฟอร์ม)
hook → ยอมรับ/ขยาย pain → พลิกมุม (reframe) → เนื้อหลักเป็นข้อ ๆ ที่ actionable
→ ผลลัพธ์ที่ผู้อ่านจะได้ → CTA ที่ตรงกับ goal
CTA ตาม goal: engagement = ชวนคอมเมนต์คำเฉพาะ ("คอมเมนต์ 'AI' เดี๋ยวส่งรายละเอียดให้"),
followers = ชวนติดตาม+บอกว่าจะได้อะไรต่อ, sales = ชวนทัก/สั่งซื้อ+ลดแรงเสียดทาน,
educate = ชวน save/แชร์

{{OUTPUT_HYGIENE_RULES}}

<<IF brand>>{{BRAND_BLOCK}}<<END>>
<<IF style>>{{STYLE_BLOCK}}<<END>>
<<IF template>>## เทมเพลตที่ผู้ใช้เลือก
ต้องใช้โครงเรื่องแบบ "{{template.name_th}}": {{template.structure_instruction}}<<END>>

## Visual prompts
สร้าง visual prompts เป็น "ภาษาอังกฤษ" เสมอ (ยกเว้นข้อความที่ต้องปรากฏในภาพ ให้คงภาษาเดิมใน
เครื่องหมายคำพูด) ตามสเปกใน schema — รายละเอียดหลักเกณฑ์:
- cover: ภาพปกหลักของโพสต์ ผูกกับแพลตฟอร์มแรกที่ผู้ใช้เลือก ระบุ subject/action/setting/lighting/
  mood/style ชัดเจน ห้ามให้มีตัวหนังสือในภาพ (จอ/ป้ายในฉากให้เป็น "abstract shapes, not specific text")
  และปิดท้ายด้วยกฎ safe-zone
- illustrations: 3 ภาพประกอบเนื้อหา แต่ละภาพ match กับประเด็นหลักหนึ่งข้อของสคริปต์
- video_prompts: สตอรีบอร์ดวิดีโอสั้น 8 ช็อต ช็อตละ 1 ประโยคเชิงภาพยนตร์ (camera + subject + action
  + mood) เรียงเล่าเรื่องตามสคริปต์ ใช้กับ AI video generator ได้ทันที

ตอบเป็น JSON เท่านั้น ห้ามมีข้อความนอก JSON
```

### A.3 User prompt

```
หัวข้อ/ไอเดีย: {{topic}}
<<IF niche>>ประเภทธุรกิจ/Niche: {{niche}}<<END>>
แพลตฟอร์ม: {{platforms.join(", ")}}
เป้าหมาย: {{goal}}
วันนี้: {{today_th}}   // เพื่อคอนเทนต์อิงฤดูกาล/เทศกาลได้ถูก
```

### A.4 Template chips (structure instructions)

| chip | `structure_instruction` |
|---|---|
| Portfolio งานที่ทำ | เล่าเคสงานจริง 1 ชิ้น: โจทย์ → วิธีทำ → ผลลัพธ์ → บทเรียน ปิดด้วยชวนคุยงาน |
| Day in the life | เล่า 1 วันของเจ้าของ/ทีมแบบ behind-the-scenes มี timestamp เช้า-เย็น จบด้วย insight |
| เปิดตัวสินค้าใหม่ | tease pain → เปิดตัว → 3 จุดเด่น → โปรเปิดตัว → CTA สั่งซื้อ |
| รีวิวแบบจริงใจ | รีวิวตรงไปตรงมา มีทั้งข้อดีและข้อจำกัด สร้างความน่าเชื่อถือ จบด้วยเหมาะกับใคร |
| Before-After | ภาพก่อน/หลังชัดเจน เล่า transformation เป็นขั้น ห้ามเคลมเกินจริง |
| เคล็ดลับ 5 ข้อ | ลิสต์ 5 ข้อ actionable ข้อละ 1-2 ประโยค ข้อสุดท้ายเก็บทีเด็ด จบชวน save |
| Promotion ลดราคา | urgency จริง (เวลา/จำนวนจำกัด) → ของ/ราคา → วิธีรับสิทธิ์ 1-2-3 → CTA ด่วน |

### A.5 Output schema (zod — the contract)

```ts
const HookType = z.enum(["auto","question","fomo","story","stat"]);

export const ContentKitSchema = z.object({
  topic_refined: z.string(),                 // หัวข้อที่ขัดเกลาแล้ว ใช้เป็นชื่อชิ้นงาน
  hooks: z.array(z.object({
    type: HookType,
    text: z.string(),                        // ภาษาไทย 1-2 ประโยค
    is_recommended: z.boolean(),
  })).length(5),
  scripts: z.array(z.object({                // หนึ่ง entry ต่อแพลตฟอร์มที่เลือก
    platform: z.enum(["facebook","instagram","tiktok","youtube","tts"]),
    caption: z.string(),                     // พร้อมโพสต์ ขึ้นต้นด้วย hook ตัว recommended
    notes: z.string().optional(),            // เช่น "โพสต์ช่วง 18:00-20:00 ดีสุด"
  })).min(1),
  visual: z.object({
    cover: z.object({
      label: z.string(),                     // "Cover Feed (FB/IG)"
      base_aspect: z.string(),               // "2:3"
      crop_hint: z.string(),                 // "crop 4:5"
      prompt_en: z.string(),                 // จบด้วย SAFE_ZONE_RULE เสมอ
    }),
    illustrations: z.array(z.object({
      matches_point: z.string(),             // ประเด็นในสคริปต์ที่ภาพนี้ประกอบ (ไทย)
      prompt_en: z.string(),
    })).length(3),
    video_prompts: z.array(z.object({
      shot: z.number(),                      // 1..8
      duration_s: z.number(),                // 3-8
      prompt_en: z.string(),                 // cinematic shot description
    })).length(8),
  }),
  hashtags: z.array(z.object({
    platform: z.string(),
    tags: z.array(z.string()).length(5),     // มี # นำหน้า ผสมไทย/อังกฤษตามจริงของวงการ
  })),
  cta: z.string(),                           // CTA หลักที่ใช้ซ้ำได้
});
```

### A.6 UI wiring (summary — details in doc 01 §3)

Render sections in schema order. Section header row = icon + name + actions
`[copy] [regenerate] [✏️ ปรับ]`. Hook section renders the 5 hooks as: active hook text +
type chips row + collapsed "ดูตัวเลือกอื่น (4)". Bottom bar: "พร้อมใช้งาน {n}/4 ส่วน —
Hook · Script · Visual · Hashtags" + คัดลอกทั้งหมด + the refine-all box (§R.2).

---

## §B Hooks — type chip click & regenerate {#b-hooks}

**Trigger**: user clicks a hook-type chip that has no cached variant, or presses regenerate
on the Hook section.
**Model**: `fast`, temperature 0.9.

System prompt: reuse §A.2's hook principles section only (extract as `HOOK_PRINCIPLES`).

User prompt:
```
หัวข้อ: {{topic_refined}}
แพลตฟอร์มหลัก: {{platforms[0]}}
<<IF brand>>โทนแบรนด์: {{brand.tone}} · สรรพนาม: {{brand.pronoun}}<<END>>
สร้าง hook แบบ "{{hook_type}}" มา 3 ตัวเลือกที่ต่างกันจริง ๆ
<<IF previous>>ห้ามซ้ำแนวกับของเดิม: {{previous_hooks}}<<END>>
```
Schema: `z.object({ hooks: z.array(z.string()).length(3) })`.
UI: first result replaces active hook; all 3 go into the "ดูตัวเลือกอื่น" list.

---

## §C Brainstorm — "ขอ AI ช่วยคิดไอเดีย" {#c-brainstorm}

**Trigger**: lightbulb button beside the topic box (also the dashboard "หาไอเดียก่อน" action).
Works with as little as a niche.
**Model**: `fast`, temperature 0.95.

System:
```
คุณคือนักกลยุทธ์คอนเทนต์ไทยที่รู้ว่าโพสต์แบบไหน "ได้ engagement จริง" ในแต่ละวงการ
สร้างไอเดียคอนเทนต์ 10 อัน ที่หลากหลายทั้งมุม (สอน/เล่า/ขาย/เทียบ/แซว/เทรนด์) และ format
(โพสต์เดี่ยว/ลิสต์/เรื่องเล่า/ก่อน-หลัง/ถาม-ตอบ) ห้ามไอเดียโหลซ้ำตลาด
ทุกไอเดียต้อง "เฉพาะเจาะจง" พอที่อ่านแล้วเห็นโพสต์ในหัวทันที
ตอบ JSON เท่านั้น
```
User:
```
ธุรกิจ/หัวข้อตั้งต้น: {{topic_or_niche}}
<<IF platform>>แพลตฟอร์มเป้าหมาย: {{platforms}}<<END>>
วันนี้: {{today_th}}
```
Schema:
```ts
z.object({ ideas: z.array(z.object({
  title: z.string(),          // หัวข้อพร้อมใช้ (จะถูกใส่ลงช่อง topic เมื่อคลิก)
  angle: z.string(),          // มุมที่ทำให้ไม่โหล 1 ประโยค
  hook_preview: z.string(),   // ตัวอย่าง hook 1 บรรทัด
  format: z.string(),         // "ลิสต์ 5 ข้อ" ฯลฯ
})).length(10) })
```
UI: popover list; clicking an idea fills the topic input.

---

## §R Refine loops {#r-refine}

The pattern that makes the product feel alive.

> **v2 redesign (2026-07-09), supersedes the original "echo the full kit back"
> design.** The original approach asked the model to return the *entire* kit
> JSON every time, with untouched sections copied back byte-for-byte, and
> relied on a code-level diff/restore as a safety net. Live testing against
> real Gemini output broke this: `gemini-2.5-pro`, while correctly refining an
> unrelated section under a *refine-all* instruction, corrupted an untouched
> `hashtags` array into one garbled merged string. The lesson: **an untouched
> section the model is asked to echo can still be mutated — don't build the
> guarantee on model discipline when you can build it on construction
> instead.** The fix below asks the model for a **patch** (only the keys it is
> actually changing) and merges in code. A section absent from the patch is
> untouched by definition — there is nothing for the model to corrupt.

### R.1 Patch schema

```ts
const ContentKitPatchSchema = z.object({
  hooks: ContentKitSchema.shape.hooks,
  scripts: ContentKitSchema.shape.scripts,
  visual: ContentKitSchema.shape.visual,
  hashtags: ContentKitSchema.shape.hashtags,
}).partial();
```
Only `hooks` / `scripts` / `visual` / `hashtags` are patchable (matches the 4 UI sections).
`topic_refined` and `cta` are never touched by refine.

**Gemini responseSchema gotcha**: converting a zod `.partial()` schema to Gemini's
`responseSchema` must NOT auto-inject `required: [all keys]` at the root — doing so silently
tells Gemini every key is mandatory (defeating the whole point of a patch), which is exactly
what caused the model to return all 4 sections on every call during testing. The schema
converter must only default-to-`required-all` for **nested** object schemas (each key's own
value must still be internally complete when present), never for the **root** of a
patch-shaped schema. See `packages/ai/src/index.ts` `toGeminiSchema(schema, { requireAllTopLevel })`.

### R.2 Section refine — "ปรับ" on one section

**Model**: `fast`, temperature 0.6 (obedience > creativity).

System:
```
คุณคือบรรณาธิการคอนเทนต์ หน้าที่เดียวของคุณคือ "แก้ไขตามคำสั่ง"
- ผู้ใช้ระบุมาแล้วว่าต้องการแก้เฉพาะส่วน "{{section_key}}" เท่านั้น
- ตอบกลับเป็น JSON ที่มีเฉพาะ key ของส่วนที่คุณแก้ไขจริงเท่านั้น (hooks, scripts, visual, hashtags — เลือกเฉพาะที่เกี่ยว)
- ห้ามใส่ key ของส่วนที่ไม่ได้แก้ไขลงในคำตอบเลย แม้แต่ส่วนเดียว — ระบบจะเก็บของเดิมไว้เองสำหรับ key ที่คุณไม่ได้ส่งมา
- ถ้าแก้ "scripts" หรือ "hashtags" ต้องส่งทั้ง array กลับมาครบ (ทุก platform เดิม) ไม่ใช่แค่รายการที่เปลี่ยน
- ถ้าคำสั่งกำกวม เลือกการตีความที่เปลี่ยนแปลงน้อยที่สุด
{{OUTPUT_HYGIENE_RULES}}
<<IF brand>>{{BRAND_BLOCK}}<<END>>
ตอบ JSON แบบ partial object เท่านั้น ห้ามมีข้อความอื่นนอก JSON
```
User:
```
JSON ปัจจุบัน (สำหรับอ้างอิงบริบทเท่านั้น — ห้ามคัดลอกส่วนที่ไม่ได้แก้กลับมา):
{{current_kit_json}}

คำสั่งแก้ไข (เฉพาะส่วน {{section_key}}): {{instruction}}
```
Merge (code, not model): `merged = restrictToSection ? {...previous, [key]: patch[key]} : {...previous, ...patch}`.
For single-section refine, code **only ever applies the one requested key** even if the model
mistakenly returns extras — defense in depth on top of the patch design.

### R.3 Refine-all — "ปรับทั้งหมดในครั้งเดียว"

Same as R.2 but **model = `smart`**, and system line 2 becomes:
```
- ผู้ใช้จะสั่งแบบรวม ("ทำให้กระชับขึ้นทุกอัน") หรือเจาะจง ("ปรับ caption Facebook ให้สั้นลง",
  "เปลี่ยน hashtag") — วิเคราะห์ว่าคำสั่งแตะส่วนไหนบ้าง (hooks / scripts / visual / hashtags)
```
Merge: `merged = {...previous, ...patch}` — whatever subset of keys the model includes get
applied; everything else is untouched by construction, not by model promise.
UI placeholder text: `เช่น 'ทำให้กระชับขึ้นทุกอัน' หรือเจาะจง 'ปรับ caption Facebook ให้สั้นลง'`.

Verified live (`scripts/eval-content-kit.mjs`, 2 independent runs, 20/20 assertions): a
facebook-only instruction under refine-all now returns a patch containing only `{scripts:
[...]}`, and hooks/visual/hashtags are byte-identical after merge.

---

## §V Visual prompt generation {#v-visual-prompts}

Visual prompts inside the Content Kit come from §A's single call. This section defines the
**prompt-writing formula** that §A's system prompt teaches the model, reused everywhere an
English image prompt is produced. Implement as a constant `IMAGE_PROMPT_FORMULA` appended to
§A and §I system prompts:

```
## สูตรเขียน image prompt (อังกฤษ)
โครง: [shot type] of [subject with specifics: age, ethnicity if human, clothing] [action/
emotion] in [setting with local Thai context when relevant], [lighting], [mood], [style/
render quality], [aspect note].
กฎ:
1. คนไทยเป็น default subject สำหรับคอนเทนต์ไทย ("young Thai professional (male, 30s)")
2. ห้ามชื่อบุคคลจริง/แบรนด์อื่น/ศิลปินลิขสิทธิ์ ("in the style of Pixar" → "in the style of a
   glossy 3D animated family film")
3. จอ/ป้ายในฉาก: "shows subtle abstract UI elements, not specific text" กัน text พัง
4. ปิดท้าย cover ทุกอันด้วย SAFE_ZONE_RULE และภาพ standard-model ทุกอันด้วย NO_TEXT_GUARD
5. ถ้าต้องมีข้อความในภาพ (โหมด Pro เท่านั้น): ใส่ข้อความจริงในเครื่องหมายคำพูด ระบุตำแหน่ง/ฟอนต์
   ("bold Thai sans-serif headline "ลด 50%" top-center") แล้วปิดด้วย: Absolutely no other text,
   no letters other than "..." and what is physically printed on products in the scene.
6. ภาพสินค้า: ให้ packaging เป็นพระเอก ("floating heroically", "clearly visible, showing the
   brand logo and product name"), ฉากสะอาด, cinematic soft lighting, shallow depth of field,
   ultra high quality render
```

**Video prompt formula** (for the 8-shot storyboard, same constant family):
```
## สูตรเขียน video prompt (อังกฤษ)
ช็อตละ 1-2 ประโยค: [camera movement] + [subject & action] + [setting] + [lighting/mood].
เรียง 8 ช็อตเป็น mini-story ตามสคริปต์: hook shot → pain → turn → 3-4 content beats → result
→ CTA end card (described visually, no on-screen text).
คำที่ควรใช้: slow push-in, whip pan, top-down, macro close-up, handheld POV, orbit shot,
match cut, golden hour, neon-lit, cinematic.
```

---

## §I Image Studio — direct generation {#i-image-studio}

Image Studio (Visual Studio menu) has **two paths to pixels**:

### I.1 Free-prompt path ("พิมพ์อธิบายรูปที่อยากได้…")

User types Thai (or anything), optionally attaches a reference image, picks: niche chip,
model (standard 1cr / pro 5cr), aspect (1:1, 4:5, 9:16, 16:9, 2:3).

**Step 1 — prompt enhancement** (model `fast`, temp 0.7): translate + expand the user's
description into a production image prompt.

System:
```
คุณคือ prompt engineer ภาพโฆษณา แปลงคำอธิบายของผู้ใช้ (มักเป็นไทย สั้น กำกวม) ให้เป็น image
prompt ภาษาอังกฤษคุณภาพโปรดักชัน
{{IMAGE_PROMPT_FORMULA}}
กติกาเพิ่ม:
- ตีความเจตนาเชิงพาณิชย์ของ niche "{{niche}}" (เช่น ร้านอาหาร → อาหารน่ากิน แสงเซ็กซี่)
- {{thai_text_mode ? 'ผู้ใช้ต้องการข้อความไทยในภาพ: ใช้กฎข้อ 5' : 'ห้ามมีตัวอักษรในภาพ: ใช้ NO_TEXT_GUARD'}}
- aspect: {{aspect}}
ตอบ JSON: { "prompt_en": string, "negative_en": string }
```

**Step 2 — image call**: send `prompt_en` (+ reference image if attached) to the routed image
model. Thai-text checkbox routes to `image-pro` and switches the credit debit 1 → 5. UI copy
under the checkbox (observed pattern): `ใส่ข้อความไทยในรูปด้วย — ใช้โมเดลที่เขียนภาษาไทยคมชัด
(Pro · 5 credits/รูป) · ไม่ติ๊ก = เจนรูปอย่างเดียว (Standard · 1 credit)`.

**Step 3 — persist** as a `generation` row `{type:'image', prompt_en, model, credits, params,
storage_path}` → powers My Works, Inspiration remix, and "เจนใหม่" (regenerate reuses
prompt_en with a new seed).

### I.2 Brand kit injection ("ตั้งแบรนด์คุณใน 30 วินาที")

Brand assets (logo PNG, person photo, shop sign, banner, brand colors) are stored on the
brand. When `use_brand_kit = true`:
- attach logo + person photo as reference images to the image call,
- append to prompt: `Incorporate the provided logo naturally (on signage, product, or corner
  badge). The person in the provided photo is the brand owner — keep their face consistent
  and photorealistic.`
- append brand colors: `Brand color palette: {{hex_list}} — use as the dominant accent colors.`

---

## §T Template systems {#t-templates}

Two template libraries share one engine but differ in output type.

### T.1 Template record (DB, doc 03 §6)

```ts
type Template = {
  slug: string; name_th: string; name_en?: string;
  kind: "visual" | "viral";
  category: string;              // visual: business type — viral: คลิป 3D | ภาพไวรัล | เกาะกระแส | สินค้าโฆษณา | เพลง AI
  badges: ("hot"|"new"|"featured")[];
  usage_count: number;
  aspect?: string;               // visual templates
  uses_brand_kit: boolean;       // "ใช้รูปแบรนด์" filter
  renders_thai_text: boolean;    // "ข้อความไทย" filter → forces image-pro
  example_asset: string;         // hero example (image/video URL)
  form: FormField[];             // the small input form
  master_prompt: string;         // the big scaffold with {{slots}}
  output_blocks: OutputBlockSpec[];  // what the kit contains
}
type FormField =
  | { key:string; label_th:string; type:"text"; required:boolean; placeholder_th:string;
      ai_pick_if_empty?: boolean }          // "ไม่ใส่ก็ได้ AI เลือกให้"
  | { key:string; label_th:string; type:"select"; options:{value:string;label_th:string;
      prompt_fragment:string}[] }           // each option maps to a prompt fragment
  | { key:string; label_th:string; type:"image"; required:boolean };  // e.g. product photo
```

**Why `prompt_fragment` matters**: dropdowns are not decoration — every option carries the
exact wording injected into the master prompt. This is how "กรอกข้อมูลนิดเดียว" still produces
rich results.

### T.2 Visual templates (the 72) — image scaffolds

A visual template's `master_prompt` is a complete §V-formula prompt with slots. Example
(**LinkedIn cover 16:9**, `uses_brand_kit: true`):

```
A polished professional LinkedIn cover photo, 16:9. {{person_ref ? "The provided person photo
is the subject — a confident Thai professional" : "A confident Thai professional"}},
{{occupation}}, seated at a sleek desk with a laptop, in a modern executive office with soft
navy-and-white tones and subtle gold accents. Elegant premium lighting, shallow depth of
field, photorealistic. Name plate area and headline text: "{{display_name}}" and
"{{tagline}}" rendered in clean bold Thai sans-serif, navy background, gold underline.
Absolutely no other text. {{SAFE_ZONE_RULE}}
```
Form: `occupation*` (text), `display_name*`, `tagline` (ai_pick_if_empty). Model: image-pro
(renders_thai_text). The other 71 follow the same pattern — a designer+prompt-engineer task,
seeded initially with ~12 templates across: LinkedIn cover, personal quote 1:1, IG intro
story 9:16, article cover 16:9, achievement post 4:5, behind-the-scenes 4:5, promo poster,
menu highlight, property card, testimonial card, event invite, festival greeting.

### T.3 Viral Studio templates (the 67) — full content kits

`master_prompt` here is a **system prompt for a kit generation** returning `output_blocks`.
Worked example — **RoastMaster Pro (สิ่งของปากจัด)**, category คลิป 3D:

Form (observed):
```
theme*        text   "เช่น ร้านตัดผม, ร้านอาหาร, คาเฟ่, ฟิตเนส, ร้านเสริมสวย, คลินิก"
object        text   "เช่น กรรไกรสนิม, เขียงราขึ้น, เก้าอี้ขาหัก (เว้นว่างให้ AI เลือกเอง)" ai_pick_if_empty
speak_style   select กู-มึง (เดือดจัด) | แกร่งแต่สุภาพ (เสียดสีนิ่มๆ) | น่าสงสาร (ขี้สงสารตัวเอง) | ตลกร้าย (Dark Humor)
video_len     select 15 วิ (3 ซีน) | 30 วิ (5 ซีน) | 45 วิ (7 ซีน)
count         select 1 | 3 | 5 ชุด
```
`speak_style` prompt_fragments:
```
กู-มึง:      บ่นด้วยสรรพนาม กู/มึง เดือดจัด ปากร้ายแต่ไม่หยาบเกิน ห้ามคำหยาบรุนแรง/เหยียด
แกร่งแต่สุภาพ: เสียดสีแบบผู้ดี พูดเพราะแต่แทงลึก ("ก็ดีนะครับ ถ้าเจ้าของจะเหลียวแลกันบ้าง")
น่าสงสาร:     โทนน้อยใจ ขี้สงสารตัวเอง ตลกแบบสงสาร ("ผมอยู่ตรงนี้มา 3 ปี ไม่มีใครเช็ดผมเลย")
ตลกร้าย:      dark humor แดกดันชีวิต แต่จบแบบยิ้มได้
```
Master prompt (system):
```
คุณคือครีเอทีฟทำคลิปไวรัล TikTok สาย 3D character คุณจะสร้าง "ชุดคลิปสิ่งของพูดได้" ที่เอาไปทำ
ต่อได้ทันที: ภาพตัวละคร → วิดีโอ → เสียงพากย์
โจทย์: สิ่งของในธุรกิจ "{{theme}}" กลายเป็นตัวละคร 3D อารมณ์เสีย ออกมา "roast" เจ้าของร้าน
เรื่องที่มันโดนละเลย แบบ {{speak_style.label}} ({{speak_style.prompt_fragment}})
<<IF !object>>เลือก "สิ่งของ" ที่คนในธุรกิจนี้เห็นแล้วอินสุด (ของที่โดนใช้หนัก/โดนลืมบ่อย)<<END>>
<<IF object>>สิ่งของ: {{object}}<<END>>
ความยาว {{video_len.label}} → แบ่ง {{video_len.scenes}} ซีน ซีนละ ~6-7 วินาที
สร้าง {{count}} ชุด (ต่างสิ่งของ/ต่างมุก ห้ามซ้ำ)

ต่อ 1 ชุด ต้องมี:
1. character_image_prompt (EN): "A 3D animated character based on a {{object_en}}, in the
   style of a glossy 3D animated family film. The object has an extremely grumpy expressive
   face..." — บรรยายวัสดุ/ริ้วรอยที่บอกเรื่องราว (สนิม, รอยบิ่น), ฉากคือธุรกิจจริง, cinematic
   lighting. {{NO_TEXT_GUARD}}
2. video_prompt (EN): ช็อตต่อซีน — camera + การแสดงสีหน้า/ปาก sync กับบทพูด + ฉากหลังมีชีวิต
3. dialogue_th: บทพูดไทยเต็ม แบ่งตามซีน จังหวะพูดจริง {{speak_style}} จบด้วย punchline + CTA
   ธุรกิจแบบเนียน ("ฝากร้าน{{theme}}นี้ด้วยนะครับ เจ้าของใจดี... มั้ง")
4. voiceover_direction: บรีฟเสียง (เพศ/อายุเสียง/อารมณ์/จังหวะ) สำหรับ TTS หรือคนพากย์
5. caption_th + hashtags: แคปชัน TikTok สั้น + 5 แฮชแท็ก
ตอบ JSON ตาม schema เท่านั้น
```
Output blocks UI: each block gets copy button; image/video prompts get "ใช้ใน Visual Studio"
(prefill I.1) — plus the global footer tip: `💡 Copy prompt ไปวางใน ChatGPT, Gemini, Midjourney
หรือ AI ตัวไหนก็ได้`.

**Seeding plan**: launch with 12 viral templates — 3 per major category — cloning the observed
*mechanics* (grumpy-object roast, Pixar-style home objects Q&A, organ-gang product hero
48s/6-scene affiliate ad, festival trend rider, rap song generator, product promo pro, food
anatomy infographic, personal-color analyzer, AI cartoon portrait, mutelu wallpaper,
storytelling 3D tale, birthday chibi cake). Each is a content-design task using this same
record shape. Ship an internal admin page to add templates without deploys (doc 01 §8).

---

## §BV Brand Voice — "ให้ AI กรอกให้" {#bv-brand-voice}

4-step wizard (doc 01 §5). The AI-fill button:

**Model**: `smart`, temperature 0.4.

System:
```
คุณคือที่ปรึกษาแบรนด์ อ่านเรื่องเล่าธุรกิจภาษาไทยธรรมดา แล้วสกัดเป็น "โปรไฟล์เสียงแบรนด์" ที่ระบบ
จะใช้กำกับการเขียนคอนเทนต์ทุกชิ้น
กติกา: สกัดจากสิ่งที่ผู้ใช้เล่าเท่านั้น จุดที่ไม่รู้ให้เดาแบบอนุรักษ์นิยมที่สุดจาก niche และทำเครื่องหมาย
confidence เพื่อให้ผู้ใช้ตรวจในขั้นถัดไป ห้ามแต่งข้อมูลธุรกิจที่ไม่ได้บอก
ตอบ JSON เท่านั้น
```
User:
```
เรื่องเล่าจากเจ้าของ: {{free_text_story}}
```
Schema:
```ts
export const BrandSchema = z.object({
  name: z.string(), business: z.string(),
  audience: z.string(),                       // ใคร อายุ พฤติกรรม
  tone: z.string(),                           // 3-5 คำ เช่น "อบอุ่น เป็นมิตร มีอารมณ์ขัน"
  pronoun: z.string(),                        // เรา/ผม/ฉัน/แอดมิน/ชื่อร้าน
  words_use: z.array(z.string()),             // คำ/วลีประจำ
  words_avoid: z.array(z.string()),
  emoji_policy: z.enum(["none","light","medium","heavy"]),
  hashtags: z.array(z.string()).max(8),
  sample_lines: z.array(z.string()).length(3),// ประโยคตัวอย่าง "เสียงแบรนด์" ที่ AI แต่งให้ดูเป็นตัวอย่าง
  confidence: z.record(z.string(), z.enum(["from_user","guessed"])),  // ต่อ field
});
```
Step-2 UI renders every field editable with a subtle "AI เดาให้ — ตรวจด้วยนะ" badge where
`guessed`. Starter chips prepend fill-in-the-blank lines to the textarea:
`+ ฉันขาย __ ให้ลูกค้า __` · `+ ลูกค้าหลักของฉันคือ __ อายุ __` · `+ อยากให้แบรนด์พูดแบบ __` ·
`+ คำที่อยากใช้: __ คำที่ไม่อยากใช้: __`. Example placeholder story (observed pattern): a cafe
owner describing customers, tone, emoji preference in one casual paragraph.

---

## §SC Style Cloner {#sc-style-cloner}

User pastes 1–3 posts they admire (their own or an influencer's). We produce a *style
profile* — never content reuse.

**Model**: `smart`, temperature 0.3.

System:
```
คุณคือนักภาษาศาสตร์เชิงสไตล์ วิเคราะห์ "วิธีเขียน" ของตัวอย่าง (ไม่ใช่เนื้อหา) แล้วสรุปเป็นโปรไฟล์
ที่นักเขียนอีกคนอ่านแล้วเขียน "ให้เหมือนคนเดิมเขียน" ได้
วิเคราะห์: ความยาวประโยคเฉลี่ย/จังหวะ, คำลงท้าย-อนุภาค (ครับ/ค่ะ/นะ/แหละ/จ้า), ระดับภาษา,
สรรพนาม, ความหนาแน่น emoji + ตัวที่ใช้ประจำ, โครงสร้างการเปิด-ปิดโพสต์, ลายเซ็นเฉพาะตัว
(วลีติดปาก การเว้นบรรทัด การใช้ตัวเลข/ลิสต์), สิ่งที่คนนี้ "ไม่ทำ"
ห้ามคัดลอกประโยคจากตัวอย่างเกิน 5 คำติดกันลงในโปรไฟล์
ตอบ JSON เท่านั้น
```
Schema:
```ts
export const StyleProfileSchema = z.object({
  name: z.string(),                       // ผู้ใช้ตั้งชื่อได้ default "Style #n"
  profile_markdown: z.string(),           // สรุปโปรไฟล์ ≤ 20 บรรทัด (นี่คือสิ่งที่ inject เป็น STYLE_BLOCK)
  dna: z.object({
    avg_sentence_len: z.string(), particles: z.array(z.string()),
    pronoun: z.string(), emoji_density: z.string(), emoji_set: z.array(z.string()),
    opening_pattern: z.string(), closing_pattern: z.string(),
    signature_moves: z.array(z.string()), never_does: z.array(z.string()),
  }),
  sample_rewrite: z.string(),             // ประโยคกลางๆ 1 ประโยค เขียนใหม่ตามสไตล์นี้ให้ผู้ใช้เช็คตา
});
```

---

## §VD Video studio prompts {#vd-video-studio}

The studio is mostly *pipeline* (doc 04), but four AI calls live here:

### VD.1 B-roll keywords per segment (the timeline chips)

**When**: render starts, once per script segment. **Model**: `fast`, temp 0.4, one call for
all segments.

System:
```
You are a stock-footage researcher. For each Thai script segment, produce English search
keywords that will find matching B-roll on Pexels/Pixabay.
Rules:
- 2-4 words per keyword, concrete and VISUAL (things a camera can film), never abstract
  ("success" ❌ → "businessman celebrating office" ✅)
- Thai cultural context when the script implies it ("street food bangkok", "thai woman laptop cafe")
- keyword_primary = the best query; keyword_alts = 2 fallbacks used if primary returns < 3
  results (vertical filter on)
- vibe: one of [talking-head, screen-ui, lifestyle, product, nature, city, abstract-tech]
  — used to bias selection variety so adjacent segments don't look identical
Respond JSON only.
```
User:
```
Video topic: {{project_title}}
Segments (Thai):
{{segments.map((s,i)=>`${i+1}. [${s.type}] ${s.text}`).join("\n")}}
```
Schema: `z.object({ segments: z.array(z.object({ index:z.number(),
keyword_primary:z.string(), keyword_alts:z.array(z.string()).length(2),
vibe:z.string() })) })` — observed chip examples the output should resemble:
"digital interface glitch", "creative block frustration", "professional ai tools",
"upload image 3d model", "mouse rotate 3d model", "drag mouse camera", "contact sheet generator".

### VD.2 Script polish (optional "ให้ AI เกลาสคริปต์" button, step 1)

**Model**: `fast`, temp 0.6. System: `คุณคือคนเขียนสคริปต์วิดีโอสั้น เกลาสคริปต์ให้พูดลื่น
เป็นภาษาพูด ตัดคำฟุ่มเฟือย บรรทัดแรกต้องเป็น hook ≤ 2 วินาที รักษาจำนวนบรรทัด = จำนวน
เซ็กเมนต์เดิม (1 บรรทัด = 1 เซ็กเมนต์) ห้ามเพิ่มเนื้อหาใหม่` → returns `{ lines: string[] }`
same length as input.

### VD.3 Script generation from topic (studio quick-start, ties into §A)

If the user arrives with only a topic, call §A with `platforms:["tiktok"]` and use the tiktok
script's lines as segments. (Shared prompt module — do not duplicate.)

### VD.4 Upload-own-clip mode segment typing

After Whisper transcription (doc 04 §7): one `fast` call to (a) merge word soup into natural
caption sentences, (b) mark the first sentence(s) as HOOK, (c) emit B-roll keywords per
~8-second span using VD.1's rules (same schema, segments = spans). No voice generation in
this mode; original audio is kept.

---

## §QA Quality bar & eval set {#qa-quality}

Ship with `packages/prompts/evals/` containing golden inputs. The executing model must run
these after wiring each prompt and eyeball outputs (they are judgment evals, not exact-match):

1. ContentKit: topic "ครีมกันแดดสำหรับผิวมัน", platforms [facebook, tiktok], no brand →
   expect: 5 distinct hooks (question hook is genuinely intriguing), FB caption 3+ short
   paragraphs w/ CTA, tiktok script line-per-sentence, 3 illustration prompts all in English,
   8 video shots forming a story, hashtags mix Thai/English, zero fabricated statistics.
2. ContentKit + Brand (tone "กันเอง ขำๆ", pronoun "เฮีย") → captions audibly change voice;
   pronoun appears; banned words absent.
3. Refine-all: "ปรับ caption Facebook ให้สั้นลง เหลือ 3 ย่อหน้า" → FB caption shorter/~3
   paragraphs (soft target — judgment call, not exact-match), patch contains only `scripts`,
   ALL other sections byte-identical (guaranteed by the §R patch-merge, not a diff check).
4. Image enhance: input "โปสเตอร์โปรโมชั่นร้านกาแฟ โทนอบอุ่น มีข้อความ 'ลด 50%'" thai_text_mode=on →
   English prompt containing "ลด 50%" in quotes + placement + "no other text" guard; off →
   NO Thai text, NO_TEXT_GUARD present.
5. B-roll keywords: 2-segment AI script (QA fixture) → concrete visual keywords, no abstract
   nouns, correct JSON, alts differ from primary.
6. RoastMaster template: theme "ร้านกาแฟ", object empty, style กู-มึง, 15วิ, 1 ชุด → AI picks a
   coffee-shop object, dialogue is funny-rude without slurs, image prompt is English with
   NO_TEXT_GUARD, scenes = 3.
7. Brand AI-fill with the cafe example story → fields extracted correctly; unknowns flagged
   `guessed`, not invented as fact.
8. Style clone from 2 sample posts → profile describes mechanics (particles, emoji set,
   openings), contains no 6-word verbatim run from samples; sample_rewrite reads like the
   source author.

Regression rule: any prompt edit = bump version id + rerun evals 1-8.
