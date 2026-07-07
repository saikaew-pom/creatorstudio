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
export const TEMPLATE_CHIPS = {
  portfolio: {
    name_th: "Portfolio งานที่ทำ",
    structure: "เล่าเคสงานจริง 1 ชิ้น: โจทย์ → วิธีทำ → ผลลัพธ์ → บทเรียน ปิดด้วยชวนคุยงาน",
  },
  day_in_life: {
    name_th: "Day in the life",
    structure: "เล่า 1 วันของเจ้าของ/ทีมแบบ behind-the-scenes มี timestamp เช้า-เย็น จบด้วย insight",
  },
  new_product: {
    name_th: "เปิดตัวสินค้าใหม่",
    structure: "tease pain → เปิดตัว → 3 จุดเด่น → โปรเปิดตัว → CTA สั่งซื้อ",
  },
  honest_review: {
    name_th: "รีวิวแบบจริงใจ",
    structure: "รีวิวตรงไปตรงมา มีทั้งข้อดีและข้อจำกัด สร้างความน่าเชื่อถือ จบด้วยเหมาะกับใคร",
  },
  before_after: {
    name_th: "Before-After",
    structure: "ภาพก่อน/หลังชัดเจน เล่า transformation เป็นขั้น ห้ามเคลมเกินจริง",
  },
  five_tips: {
    name_th: "เคล็ดลับ 5 ข้อ",
    structure: "ลิสต์ 5 ข้อ actionable ข้อละ 1-2 ประโยค ข้อสุดท้ายเก็บทีเด็ด จบชวน save",
  },
  promotion: {
    name_th: "Promotion ลดราคา",
    structure: "urgency จริง (เวลา/จำนวนจำกัด) → ของ/ราคา → วิธีรับสิทธิ์ 1-2-3 → CTA ด่วน",
  },
} as const;
export type TemplateChip = keyof typeof TEMPLATE_CHIPS;

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

// ---------- §R Refine ----------
export interface RefineInput {
  current_kit_json: string; // JSON.stringify of latest ContentKit
  instruction: string;
  section_name?: "hook" | "script" | "visual" | "hashtags"; // undefined = refine-all
  brand?: Brand;
}

export const refine: PromptModule<RefineInput, ContentKit> = {
  id: "content.refine.v1",
  model: "fast", // route to "smart" when section_name is undefined (refine-all)
  temperature: 0.6,
  schema: ContentKitSchema,
  system: (i) => {
    const scopeLine = i.section_name
      ? `- แก้เฉพาะส่วน ${i.section_name} ตามคำสั่งผู้ใช้`
      : `- ผู้ใช้จะสั่งแบบรวม ("ทำให้กระชับขึ้นทุกอัน") หรือเจาะจง ("ปรับ caption Facebook ให้สั้นลง", "เปลี่ยน hashtag") — วิเคราะห์ว่าคำสั่งแตะส่วนไหนบ้าง แก้เฉพาะส่วนเหล่านั้น`;
    return [
      `คุณคือบรรณาธิการคอนเทนต์ หน้าที่เดียวของคุณคือ "แก้ไขตามคำสั่ง" โดยแตะให้น้อยที่สุด`,
      scopeLine,
      `- รักษาโครงสร้าง JSON schema เดิมเป๊ะ
- ส่วนอื่นที่ไม่เกี่ยว: คืนค่าเดิมแบบตัวอักษรต่อตัวอักษร ห้ามแก้ ห้าม "ปรับปรุงเอง"
- ถ้าคำสั่งกำกวม เลือกการตีความที่เปลี่ยนแปลงน้อยที่สุด`,
      OUTPUT_HYGIENE_RULES,
      i.brand ? brandBlock(i.brand) : null,
      `ตอบ JSON เต็มก้อนตาม schema เดิมเท่านั้น`,
    ]
      .filter(Boolean)
      .join("\n\n");
  },
  user: (i) =>
    `JSON ปัจจุบัน:\n${i.current_kit_json}\n\nคำสั่งแก้ไข${i.section_name ? ` (เฉพาะส่วน ${i.section_name})` : ""}: ${i.instruction}`,
};
