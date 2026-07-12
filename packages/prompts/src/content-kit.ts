// §A Content Kit — the "เริ่มสร้าง Content" button (doc 02 §A)
import { z } from "zod";
import {
  Brand,
  StyleProfile,
  Platform,
  PromptModule,
  brandBlock,
  styleBlock,
  PLATFORM_SPECS,
  OUTPUT_HYGIENE_RULES,
  IMAGE_PROMPT_FORMULA,
  VIDEO_PROMPT_FORMULA,
  todayTh,
} from "./shared";

// ---------- Template chips (§A.4) ----------
// topic_hint_th/en: shown as the topic textarea's placeholder once this chip is
// selected — tells the user exactly what to fill in for this recipe (presentation
// only, doesn't reach the prompt; `structure` above is what the model actually uses).
export const TEMPLATE_CHIPS = {
  portfolio: {
    name_th: "Portfolio งานที่ทำ",
    name_en: "Portfolio showcase",
    structure: "เล่าเคสงานจริง 1 ชิ้น: โจทย์ → วิธีทำ → ผลลัพธ์ → บทเรียน ปิดด้วยชวนคุยงาน",
    topic_hint_th: "งานที่ทำให้ลูกค้า — ใส่ชื่อโปรเจกต์ · โจทย์ที่ต้องแก้ · ผลลัพธ์ที่ได้",
    topic_hint_en: "A project I did for a client — name it · the problem · the result",
  },
  day_in_life: {
    name_th: "Day in the life",
    name_en: "Day in the life",
    structure: "เล่า 1 วันของเจ้าของ/ทีมแบบ behind-the-scenes มี timestamp เช้า-เย็น จบด้วย insight",
    topic_hint_th: "หนึ่งวันทำงานของฉัน — ใส่สิ่งที่ทำตั้งแต่เช้าถึงเย็น · โมเมนต์เด่นของวัน",
    topic_hint_en: "A day in my work — what I do morning to night · one standout moment",
  },
  new_product: {
    name_th: "เปิดตัวสินค้าใหม่",
    name_en: "New product launch",
    structure: "tease pain → เปิดตัว → 3 จุดเด่น → โปรเปิดตัว → CTA สั่งซื้อ",
    topic_hint_th: "เปิดตัวสินค้าใหม่ของฉัน — ใส่ชื่อสินค้า · จุดเด่น · กลุ่มลูกค้าที่ใช่",
    topic_hint_en: "My new product launch — product name · key feature · target customer",
  },
  honest_review: {
    name_th: "รีวิวแบบจริงใจ",
    name_en: "Honest review",
    structure: "รีวิวตรงไปตรงมา มีทั้งข้อดีและข้อจำกัด สร้างความน่าเชื่อถือ จบด้วยเหมาะกับใคร",
    topic_hint_th: "รีวิวสินค้า/บริการที่ฉันใช้จริง — ใส่ชื่อสินค้า · ข้อดี · ข้อจำกัด",
    topic_hint_en: "A product/service I actually used — name it · the good · the limits",
  },
  before_after: {
    name_th: "Before-After",
    name_en: "Before-After",
    structure: "ภาพก่อน/หลังชัดเจน เล่า transformation เป็นขั้น ห้ามเคลมเกินจริง",
    topic_hint_th: "การเปลี่ยนแปลงก่อน-หลังของฉัน — ใส่สภาพก่อน · สิ่งที่ทำ · ผลลัพธ์หลัง",
    topic_hint_en: "My before-after transformation — starting point · what I did · the result",
  },
  five_tips: {
    name_th: "เคล็ดลับ 5 ข้อ",
    name_en: "5 quick tips",
    structure: "ลิสต์ 5 ข้อ actionable ข้อละ 1-2 ประโยค ข้อสุดท้ายเก็บทีเด็ด จบชวน save",
    topic_hint_th: "เคล็ดลับในวงการของฉัน — ใส่หัวข้อ/ปัญหาที่คนมักเจอ",
    topic_hint_en: "Tips from my field — the topic or problem people usually run into",
  },
  promotion: {
    name_th: "Promotion ลดราคา",
    name_en: "Promotion / discount",
    structure: "urgency จริง (เวลา/จำนวนจำกัด) → ของ/ราคา → วิธีรับสิทธิ์ 1-2-3 → CTA ด่วน",
    topic_hint_th: "โปรโมชั่นของฉัน — ใส่ชื่อสินค้า · ส่วนลด/ของแถม · ระยะเวลา",
    topic_hint_en: "My promotion — product name · discount/gift · how long it runs",
  },
  // M15: added so "ขาย/Sell" has a direct sales option (the borrowed 7-chip set had none).
  sales_post: {
    name_th: "โพสต์ขายตรงๆ",
    name_en: "Direct sales post",
    structure: "hook เจ็บจริง → สินค้าแก้ยังไง (1 ย่อหน้า) → ราคา/โปรชัดเจน → ตอบ objection ที่พบบ่อย 1 ข้อ → CTA สั่งซื้อ + ช่องทางทัก",
    topic_hint_th: "โพสต์ขายของฉัน — ใส่ชื่อสินค้า · ราคา · ปัญหาที่ช่วยแก้",
    topic_hint_en: "My sales post — product name · price · the problem it solves",
  },
  flash_sale: {
    name_th: "Flash Sale ด่วน",
    name_en: "Flash sale",
    structure: "เปิดด้วยเวลาจำกัด (นับถอยหลัง) → ของมีจำนวนจำกัดเท่าไร → ราคาเดิม/ราคาใหม่ → เงื่อนไขสั้น → CTA ตอนนี้",
    topic_hint_th: "Flash Sale ของฉัน — ใส่สินค้า · ราคาลด · เวลาปิดดีล",
    topic_hint_en: "My flash sale — product · discounted price · when it ends",
  },
  customer_story: {
    name_th: "เรื่องจริงจากลูกค้า",
    name_en: "Customer story",
    structure: "quote ลูกค้า 1 ประโยคเปิด → ปัญหาก่อนใช้ → จุดเปลี่ยน → ผลลัพธ์วัดได้ → ชวนคนที่เจอปัญหาเดียวกันทัก",
    topic_hint_th: "เรื่องราวลูกค้าของฉัน — ใส่ปัญหาที่ลูกค้าเจอ · ผลลัพธ์หลังใช้",
    topic_hint_en: "A customer's story — the problem they had · the result after using it",
  },
  myth_bust: {
    name_th: "ความเชื่อผิดๆ",
    name_en: "Myth-busting",
    structure: "ยกความเชื่อผิดที่คนในวงการพูดบ่อย → ทำไมผิด (เหตุผล/ตัวเลข) → ความจริงคืออะไร → สิ่งที่ควรทำแทน",
    topic_hint_th: "ความเชื่อผิดๆ ในวงการของฉัน — ใส่ความเชื่อที่คนพูดผิด · ความจริง",
    topic_hint_en: "A myth in my industry — the false belief · what's actually true",
  },
  how_to: {
    name_th: "สอนทำทีละขั้น",
    name_en: "Step-by-step how-to",
    structure: "ผลลัพธ์ที่จะได้ (ก่อน) → ของที่ต้องมี → ขั้นตอน 3-5 ขั้นเป็นข้อ → จุดพลาดบ่อย 1 ข้อ → CTA เซฟโพสต์",
    topic_hint_th: "วิธีทำทีละขั้นของฉัน — ใส่ผลลัพธ์ที่จะได้ · ขั้นตอนหลัก",
    topic_hint_en: "My step-by-step guide — the end result · the main steps",
  },
  behind_scenes: {
    name_th: "เบื้องหลังงาน",
    name_en: "Behind the scenes",
    structure: "โชว์ขั้นตอนที่ลูกค้าไม่เคยเห็น → detail ที่ใส่ใจเป็นพิเศษ → ทำไมถึงทำแบบนี้ → เชื่อมกลับคุณภาพงาน",
    topic_hint_th: "เบื้องหลังงานของฉัน — ใส่ขั้นตอนที่ลูกค้าไม่เคยเห็น",
    topic_hint_en: "Behind the scenes of my work — the steps customers never see",
  },
  q_and_a: {
    name_th: "ตอบคำถามที่ถูกถามบ่อย",
    name_en: "FAQ answered",
    structure: "คำถามจริงจากลูกค้า 1 ข้อเป็น hook → ตอบตรงๆ ละเอียด → ตัวอย่างประกอบ → ชวนถามต่อในคอมเมนต์",
    topic_hint_th: "คำถามที่ลูกค้าถามบ่อยของฉัน — ใส่คำถามจริง · คำตอบสั้นๆ",
    topic_hint_en: "A question customers ask me a lot — the real question · a short answer",
  },
} as const;
export type TemplateChip = keyof typeof TEMPLATE_CHIPS;

// Goal groups for the "Content Recipes" UI (M15) — presentation grouping only,
// doesn't affect the prompt (TEMPLATE_CHIPS above stays the source of truth).
export const RECIPE_GROUPS: { group_th: string; group_en: string; icon: string; chips: TemplateChip[] }[] = [
  { group_th: "ขาย", group_en: "Sell", icon: "🛒", chips: ["sales_post", "promotion", "new_product", "flash_sale"] },
  { group_th: "สร้างความเชื่อใจ", group_en: "Build trust", icon: "🤝", chips: ["honest_review", "before_after", "portfolio", "customer_story"] },
  { group_th: "ให้ความรู้", group_en: "Educate", icon: "📚", chips: ["five_tips", "myth_bust", "how_to"] },
  { group_th: "สร้างตัวตน", group_en: "Personality", icon: "🎭", chips: ["day_in_life", "behind_scenes", "q_and_a"] },
];

// ---------- Input ----------
export interface ContentKitInput {
  topic: string;
  niche?: string;
  platforms: Platform[];
  template?: TemplateChip;
  goal?: "engagement" | "followers" | "sales" | "educate";
  brand?: Brand;
  style?: StyleProfile;
}

// ---------- Output schema (§A.5) ----------
const HookType = z.enum(["auto", "question", "fomo", "story", "stat"]);

export const ContentKitSchema = z.object({
  topic_refined: z.string(),
  hooks: z
    .array(
      z.object({
        type: HookType,
        text: z.string(),
        is_recommended: z.boolean(),
      })
    )
    .length(5),
  scripts: z
    .array(
      z.object({
        platform: z.enum(["facebook", "instagram", "tiktok", "youtube", "tts"]),
        caption: z.string(),
        notes: z.string().optional(),
      })
    )
    .min(1),
  visual: z.object({
    cover: z.object({
      label: z.string(),
      base_aspect: z.string(),
      crop_hint: z.string(),
      prompt_en: z.string(),
    }),
    illustrations: z
      .array(z.object({ matches_point: z.string(), prompt_en: z.string() }))
      .length(3),
    video_prompts: z
      .array(
        z.object({ shot: z.number(), duration_s: z.number(), prompt_en: z.string() })
      )
      .length(8),
  }),
  hashtags: z.array(
    z.object({ platform: z.string(), tags: z.array(z.string()).length(5) })
  ),
  cta: z.string(),
});
export type ContentKit = z.infer<typeof ContentKitSchema>;

// ---------- Hook principles (shared with §B) ----------
export const HOOK_PRINCIPLES = `## หลักการเขียน Hook (ส่วนที่สำคัญที่สุด)
สร้าง hook 5 แบบ แต่ละแบบใช้กลไกจิตวิทยาต่างกัน:
1. auto      — แบบที่คุณตัดสินว่าเหมาะกับหัวข้อ+แพลตฟอร์มที่สุด (ใส่เป็นตัวแรก และตั้ง is_recommended)
2. question  — คำถามที่แทงใจ target จนต้องหยุดอ่าน (ห้ามคำถาม yes/no จืดๆ)
3. fomo      — ความกลัวตกขบวน/เสียโอกาส ("คนอื่นเขา...กันหมดแล้ว", "ถ้ายังไม่รู้...กำลังเสียเปรียบ")
4. story     — เปิดด้วยเรื่องเล่า/สถานการณ์เห็นภาพ ("วันแรกที่ผม...", "ลูกค้าคนหนึ่งเดินมาบอกว่า...")
5. stat      — ตัวเลข/ข้อเท็จจริงที่สะดุด (ใช้ตัวเลขจากหัวข้อผู้ใช้เท่านั้น ถ้าไม่มี ใช้ตัวเลขเชิงโครงสร้าง เช่น "3 วิธี" "5 ข้อ" ห้ามกุสถิติ)
กติกา hook: ยาว 1-2 ประโยค อ่านแล้วต้อง "หยุดนิ้ว" ภายใน 2 วินาที ใส่ emoji ได้ 0-1 ตัว`;

const CTA_BY_GOAL = `CTA ตาม goal: engagement = ชวนคอมเมนต์คำเฉพาะ ("คอมเมนต์ 'AI' เดี๋ยวส่งรายละเอียดให้"), followers = ชวนติดตาม+บอกว่าจะได้อะไรต่อ, sales = ชวนทัก/สั่งซื้อ+ลดแรงเสียดทาน, educate = ชวน save/แชร์`;

// ---------- Module ----------
export const contentKit: PromptModule<ContentKitInput, ContentKit> = {
  id: "content.kit.v1",
  model: "fast",
  temperature: 0.8,
  schema: ContentKitSchema,
  system: (input) => {
    const parts = [
      `คุณคือ "ครีเอทีฟไดเรกเตอร์ + คอนเทนต์ครีเอเตอร์ไทย" ระดับท็อปของวงการ ที่ทำคอนเทนต์ไวรัลให้ SME ไทยมาแล้วหลายร้อยแบรนด์ คุณเข้าใจ algorithm และพฤติกรรมคนไทยบนโซเชียลลึกซึ้ง

ภารกิจ: จากหัวข้อที่ผู้ใช้ให้มา สร้าง "ชุดคอนเทนต์พร้อมโพสต์" ที่ครบและใช้ได้ทันที โดยตอบเป็น JSON ตาม schema ที่กำหนดเท่านั้น`,
      PLATFORM_SPECS,
      HOOK_PRINCIPLES,
      `## โครงสร้างเนื้อหา (ทุกแพลตฟอร์ม)
hook → ยอมรับ/ขยาย pain → พลิกมุม (reframe) → เนื้อหลักเป็นข้อ ๆ ที่ actionable → ผลลัพธ์ที่ผู้อ่านจะได้ → CTA ที่ตรงกับ goal
${CTA_BY_GOAL}`,
      OUTPUT_HYGIENE_RULES,
    ];
    if (input.brand) parts.push(brandBlock(input.brand));
    if (input.style) parts.push(styleBlock(input.style));
    if (input.template) {
      const t = TEMPLATE_CHIPS[input.template];
      parts.push(`## เทมเพลตที่ผู้ใช้เลือก\nต้องใช้โครงเรื่องแบบ "${t.name_th}": ${t.structure}`);
    }
    parts.push(`## Visual prompts
สร้าง visual prompts เป็น "ภาษาอังกฤษ" เสมอ (ยกเว้นข้อความที่ต้องปรากฏในภาพ ให้คงภาษาเดิมในเครื่องหมายคำพูด) ตามสเปกใน schema — รายละเอียดหลักเกณฑ์:
- cover: ภาพปกหลักของโพสต์ ผูกกับแพลตฟอร์มแรกที่ผู้ใช้เลือก ระบุ subject/action/setting/lighting/mood/style ชัดเจน ห้ามให้มีตัวหนังสือในภาพ (จอ/ป้ายในฉากให้เป็น "abstract shapes, not specific text") และปิดท้ายด้วยกฎ safe-zone
- illustrations: 3 ภาพประกอบเนื้อหา แต่ละภาพ match กับประเด็นหลักหนึ่งข้อของสคริปต์
- video_prompts: สตอรีบอร์ดวิดีโอสั้น 8 ช็อต ช็อตละ 1 ประโยคเชิงภาพยนตร์ (camera + subject + action + mood) เรียงเล่าเรื่องตามสคริปต์ ใช้กับ AI video generator ได้ทันที
${IMAGE_PROMPT_FORMULA}
${VIDEO_PROMPT_FORMULA}

ตอบเป็น JSON เท่านั้น ห้ามมีข้อความนอก JSON`);
    return parts.join("\n\n");
  },
  user: (input) =>
    [
      `หัวข้อ/ไอเดีย: ${input.topic}`,
      input.niche ? `ประเภทธุรกิจ/Niche: ${input.niche}` : null,
      `แพลตฟอร์ม: ${input.platforms.join(", ")}`,
      `เป้าหมาย: ${input.goal ?? "engagement"}`,
      `วันนี้: ${todayTh()}`,
    ]
      .filter(Boolean)
      .join("\n"),
};

// ---------- §B Hook variants ----------
export interface HookVariantsInput {
  topic_refined: string;
  primary_platform: Platform;
  hook_type: z.infer<typeof HookType>;
  previous_hooks?: string[];
  brand?: Brand;
}
export const HookVariantsSchema = z.object({ hooks: z.array(z.string()).length(3) });

export const hookVariants: PromptModule<
  HookVariantsInput,
  z.infer<typeof HookVariantsSchema>
> = {
  id: "content.hooks.v1",
  model: "fast",
  temperature: 0.9,
  schema: HookVariantsSchema,
  system: () => `${HOOK_PRINCIPLES}\n\nตอบ JSON เท่านั้น: { "hooks": [3 ตัวเลือก] }`,
  user: (i) =>
    [
      `หัวข้อ: ${i.topic_refined}`,
      `แพลตฟอร์มหลัก: ${i.primary_platform}`,
      i.brand ? `โทนแบรนด์: ${i.brand.tone} · สรรพนาม: ${i.brand.pronoun}` : null,
      `สร้าง hook แบบ "${i.hook_type}" มา 3 ตัวเลือกที่ต่างกันจริง ๆ`,
      i.previous_hooks?.length
        ? `ห้ามซ้ำแนวกับของเดิม: ${i.previous_hooks.join(" | ")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n"),
};

// ---------- §C Brainstorm ----------
export interface BrainstormInput {
  topic_or_niche: string;
  platforms?: Platform[];
}
export const BrainstormSchema = z.object({
  ideas: z
    .array(
      z.object({
        title: z.string(),
        angle: z.string(),
        hook_preview: z.string(),
        format: z.string(),
      })
    )
    .length(10),
});

export const brainstorm: PromptModule<BrainstormInput, z.infer<typeof BrainstormSchema>> = {
  id: "content.brainstorm.v1",
  model: "fast",
  temperature: 0.95,
  schema: BrainstormSchema,
  system: () => `คุณคือนักกลยุทธ์คอนเทนต์ไทยที่รู้ว่าโพสต์แบบไหน "ได้ engagement จริง" ในแต่ละวงการ
สร้างไอเดียคอนเทนต์ 10 อัน ที่หลากหลายทั้งมุม (สอน/เล่า/ขาย/เทียบ/แซว/เทรนด์) และ format (โพสต์เดี่ยว/ลิสต์/เรื่องเล่า/ก่อน-หลัง/ถาม-ตอบ) ห้ามไอเดียโหลซ้ำตลาด
ทุกไอเดียต้อง "เฉพาะเจาะจง" พอที่อ่านแล้วเห็นโพสต์ในหัวทันที
ตอบ JSON เท่านั้น`,
  user: (i) =>
    [
      `ธุรกิจ/หัวข้อตั้งต้น: ${i.topic_or_niche}`,
      i.platforms?.length ? `แพลตฟอร์มเป้าหมาย: ${i.platforms.join(", ")}` : null,
      `วันนี้: ${todayTh()}`,
    ]
      .filter(Boolean)
      .join("\n"),
};

// ---------- §R Refine (v2 — patch-based) ----------
// v1 asked the model to echo the FULL kit back with untouched sections copied
// byte-for-byte. Live testing (2026-07-09) proved this unreliable: gemini-2.5-pro
// corrupted an untouched `hashtags` array (mangled into one garbled merged string)
// while refining an unrelated section. The fix is structural, not prompt-wording:
// the model now returns ONLY the sections it is changing, as a partial object;
// code merges the patch onto the previous kit. A section the model never returns
// literally cannot be corrupted — no discipline required.
export const ContentKitPatchSchema = z
  .object({
    hooks: ContentKitSchema.shape.hooks,
    scripts: ContentKitSchema.shape.scripts,
    visual: ContentKitSchema.shape.visual,
    hashtags: ContentKitSchema.shape.hashtags,
  })
  .partial();
export type ContentKitPatch = z.infer<typeof ContentKitPatchSchema>;

const SECTION_TO_KEY = {
  hook: "hooks",
  script: "scripts",
  visual: "visual",
  hashtags: "hashtags",
} as const;

export interface RefineInput {
  current_kit_json: string; // JSON.stringify of latest ContentKit
  instruction: string;
  section_name?: "hook" | "script" | "visual" | "hashtags"; // undefined = refine-all
  brand?: Brand;
}

export const refine: PromptModule<RefineInput, ContentKitPatch> = {
  id: "content.refine.v2",
  model: "fast", // route to "smart" when section_name is undefined (refine-all)
  temperature: 0.6,
  schema: ContentKitPatchSchema,
  partialTopLevel: true, // top-level keys are genuinely optional — see toGeminiSchema
  system: (i) => {
    const scopeLine = i.section_name
      ? `- ผู้ใช้ระบุมาแล้วว่าต้องการแก้เฉพาะส่วน "${SECTION_TO_KEY[i.section_name]}" เท่านั้น`
      : `- ผู้ใช้จะสั่งแบบรวม ("ทำให้กระชับขึ้นทุกอัน") หรือเจาะจง ("ปรับ caption Facebook ให้สั้นลง", "เปลี่ยน hashtag") — วิเคราะห์ว่าคำสั่งแตะส่วนไหนบ้าง (hooks / scripts / visual / hashtags)`;
    return [
      `คุณคือบรรณาธิการคอนเทนต์ หน้าที่เดียวของคุณคือ "แก้ไขตามคำสั่ง"`,
      scopeLine,
      `- ตอบกลับเป็น JSON ที่มีเฉพาะ key ของส่วนที่คุณแก้ไขจริงเท่านั้น (hooks, scripts, visual, hashtags — เลือกเฉพาะที่เกี่ยว)
- ห้ามใส่ key ของส่วนที่ไม่ได้แก้ไขลงในคำตอบเลย แม้แต่ส่วนเดียว — ระบบจะเก็บของเดิมไว้เองสำหรับ key ที่คุณไม่ได้ส่งมา
- ถ้าแก้ "scripts" หรือ "hashtags" ต้องส่งทั้ง array กลับมาครบ (ทุก platform เดิม) ไม่ใช่แค่รายการที่เปลี่ยน
- ถ้าคำสั่งกำกวม เลือกการตีความที่เปลี่ยนแปลงน้อยที่สุด`,
      OUTPUT_HYGIENE_RULES,
      i.brand ? brandBlock(i.brand) : null,
      `ตอบ JSON แบบ partial object เท่านั้น ห้ามมีข้อความอื่นนอก JSON`,
    ]
      .filter(Boolean)
      .join("\n\n");
  },
  user: (i) =>
    `JSON ปัจจุบัน (สำหรับอ้างอิงบริบทเท่านั้น — ห้ามคัดลอกส่วนที่ไม่ได้แก้กลับมา):\n${i.current_kit_json}\n\nคำสั่งแก้ไข${i.section_name ? ` (เฉพาะส่วน ${SECTION_TO_KEY[i.section_name]})` : ""}: ${i.instruction}`,
};

/** Merge a refine patch onto the previous kit. Keys absent from the patch are
 * guaranteed untouched — by construction, not by model discipline. */
export function applyContentKitPatch(
  previous: ContentKit,
  patch: ContentKitPatch,
  restrictToSection?: "hook" | "script" | "visual" | "hashtags"
): ContentKit {
  if (restrictToSection) {
    const key = SECTION_TO_KEY[restrictToSection];
    // Defense in depth: even if the model ignored instructions and returned
    // extra keys, a single-section refine can only ever change that one key.
    return key in patch ? { ...previous, [key]: patch[key] } : previous;
  }
  return { ...previous, ...patch };
}
