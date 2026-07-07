// §T Template systems — record shape + viral kit generation + seed example (doc 02 §T)
import { z } from "zod";
import { PromptModule, NO_TEXT_GUARD, SAFE_ZONE_RULE } from "./shared";

// ---------- Record shapes ----------
export type FormField =
  | {
      key: string;
      label_th: string;
      type: "text";
      required: boolean;
      placeholder_th: string;
      ai_pick_if_empty?: boolean;
    }
  | {
      key: string;
      label_th: string;
      type: "select";
      options: { value: string; label_th: string; prompt_fragment: string }[];
    }
  | { key: string; label_th: string; type: "image"; required: boolean };

export interface TemplateRecord {
  slug: string;
  kind: "visual" | "viral";
  name_th: string;
  name_en?: string;
  category: string;
  badges: ("hot" | "new" | "featured")[];
  aspect?: string;
  uses_brand_kit: boolean;
  renders_thai_text: boolean;
  form: FormField[];
  master_prompt: string; // with {{slots}}
}

/** Render {{slot}} placeholders from form values; select fields expose .label / .fragment */
export function renderTemplatePrompt(
  master: string,
  values: Record<string, { value: string; label?: string; fragment?: string }>
): string {
  return master.replace(/\{\{(\w+)(?:\.(\w+))?\}\}/g, (_, key, sub) => {
    const v = values[key];
    if (!v) return "";
    if (sub === "label") return v.label ?? v.value;
    if (sub === "fragment") return v.fragment ?? "";
    return v.value;
  });
}

// ---------- Viral kit output schema (RoastMaster-family) ----------
export const ViralKitSchema = z.object({
  sets: z.array(
    z.object({
      object_th: z.string(),
      character_image_prompt_en: z.string(),
      video_prompt_en: z.array(z.object({ scene: z.number(), prompt: z.string() })),
      dialogue_th: z.array(z.object({ scene: z.number(), line: z.string() })),
      voiceover_direction_th: z.string(),
      caption_th: z.string(),
      hashtags: z.array(z.string()).length(5),
    })
  ),
});
export type ViralKit = z.infer<typeof ViralKitSchema>;

export interface ViralKitInput {
  system_prompt: string; // fully rendered master_prompt
}

export const viralKit: PromptModule<ViralKitInput, ViralKit> = {
  id: "viral.kit.v1",
  model: "fast",
  temperature: 0.9,
  schema: ViralKitSchema,
  system: (i) => i.system_prompt,
  user: () => "สร้างตาม system prompt ตอบ JSON เท่านั้น",
};

// ---------- Seed: RoastMaster Pro (worked example, doc 02 §T.3) ----------
export const ROASTMASTER: TemplateRecord = {
  slug: "roastmaster-pro",
  kind: "viral",
  name_th: "สิ่งของปากจัด (RoastMaster Pro)",
  name_en: "RoastMaster Pro",
  category: "คลิป 3D",
  badges: ["hot", "featured"],
  uses_brand_kit: false,
  renders_thai_text: false,
  form: [
    {
      key: "theme",
      label_th: "ธีม/ประเภทธุรกิจ",
      type: "text",
      required: true,
      placeholder_th: "เช่น ร้านตัดผม, ร้านอาหาร, คาเฟ่, ฟิตเนส, ร้านเสริมสวย, คลินิก",
    },
    {
      key: "object",
      label_th: "สิ่งของที่ต้องการปลุกเสก (ไม่ใส่ก็ได้ AI เลือกให้)",
      type: "text",
      required: false,
      placeholder_th: "เช่น กรรไกรสนิม, เขียงราขึ้น, เก้าอี้ขาหัก (เว้นว่างให้ AI เลือกเอง)",
      ai_pick_if_empty: true,
    },
    {
      key: "speak_style",
      label_th: "สไตล์การพูด",
      type: "select",
      options: [
        {
          value: "gu_mueng",
          label_th: "กู-มึง (เดือดจัด)",
          prompt_fragment:
            "บ่นด้วยสรรพนาม กู/มึง เดือดจัด ปากร้ายแต่ไม่หยาบเกิน ห้ามคำหยาบรุนแรง/เหยียด",
        },
        {
          value: "polite_savage",
          label_th: "แกร่งแต่สุภาพ (เสียดสีนิ่มๆ)",
          prompt_fragment:
            'เสียดสีแบบผู้ดี พูดเพราะแต่แทงลึก ("ก็ดีนะครับ ถ้าเจ้าของจะเหลียวแลกันบ้าง")',
        },
        {
          value: "pitiful",
          label_th: "น่าสงสาร (ขี้สงสารตัวเอง)",
          prompt_fragment:
            'โทนน้อยใจ ขี้สงสารตัวเอง ตลกแบบสงสาร ("ผมอยู่ตรงนี้มา 3 ปี ไม่มีใครเช็ดผมเลย")',
        },
        {
          value: "dark_humor",
          label_th: "ตลกร้าย (Dark Humor)",
          prompt_fragment: "dark humor แดกดันชีวิต แต่จบแบบยิ้มได้",
        },
      ],
    },
    {
      key: "video_len",
      label_th: "ความยาววิดีโอ",
      type: "select",
      options: [
        { value: "15", label_th: "15 วิ (3 ซีน)", prompt_fragment: "3" },
        { value: "30", label_th: "30 วิ (5 ซีน)", prompt_fragment: "5" },
        { value: "45", label_th: "45 วิ (7 ซีน)", prompt_fragment: "7" },
      ],
    },
    {
      key: "count",
      label_th: "จำนวนคอนเทนต์",
      type: "select",
      options: [
        { value: "1", label_th: "1 ชุด", prompt_fragment: "1" },
        { value: "3", label_th: "3 ชุด", prompt_fragment: "3" },
        { value: "5", label_th: "5 ชุด", prompt_fragment: "5" },
      ],
    },
  ],
  master_prompt: `คุณคือครีเอทีฟทำคลิปไวรัล TikTok สาย 3D character คุณจะสร้าง "ชุดคลิปสิ่งของพูดได้" ที่เอาไปทำต่อได้ทันที: ภาพตัวละคร → วิดีโอ → เสียงพากย์
โจทย์: สิ่งของในธุรกิจ "{{theme}}" กลายเป็นตัวละคร 3D อารมณ์เสีย ออกมา "roast" เจ้าของร้านเรื่องที่มันโดนละเลย แบบ {{speak_style.label}} ({{speak_style.fragment}})
{{object_instruction}}
ความยาว {{video_len.label}} → แบ่ง {{video_len.fragment}} ซีน ซีนละ ~6-7 วินาที
สร้าง {{count.fragment}} ชุด (ต่างสิ่งของ/ต่างมุก ห้ามซ้ำ)

ต่อ 1 ชุด ต้องมี:
1. character_image_prompt_en (EN): "A 3D animated character based on a [object], in the style of a glossy 3D animated family film. The object has an extremely grumpy expressive face..." — บรรยายวัสดุ/ริ้วรอยที่บอกเรื่องราว (สนิม, รอยบิ่น), ฉากคือธุรกิจจริง, cinematic lighting. จบด้วย: ${NO_TEXT_GUARD}
2. video_prompt_en: ช็อตต่อซีน — camera + การแสดงสีหน้า/ปาก sync กับบทพูด + ฉากหลังมีชีวิต
3. dialogue_th: บทพูดไทยเต็ม แบ่งตามซีน จังหวะพูดจริง ตามสไตล์ที่เลือก จบด้วย punchline + CTA ธุรกิจแบบเนียน ("ฝากร้าน{{theme}}นี้ด้วยนะครับ เจ้าของใจดี... มั้ง")
4. voiceover_direction_th: บรีฟเสียง (เพศ/อายุเสียง/อารมณ์/จังหวะ) สำหรับ TTS หรือคนพากย์
5. caption_th + hashtags: แคปชัน TikTok สั้น + 5 แฮชแท็ก
ตอบ JSON ตาม schema เท่านั้น`,
};

/** object_instruction slot helper for templates with ai_pick_if_empty */
export function objectInstruction(object?: string): string {
  return object
    ? `สิ่งของ: ${object}`
    : `เลือก "สิ่งของ" ที่คนในธุรกิจนี้เห็นแล้วอินสุด (ของที่โดนใช้หนัก/โดนลืมบ่อย)`;
}

// ---------- Seed: one visual template example (LinkedIn cover) ----------
export const LINKEDIN_COVER: TemplateRecord = {
  slug: "linkedin-cover",
  kind: "visual",
  name_th: "ภาพปก LinkedIn",
  category: "Personal Brand",
  badges: [],
  aspect: "16:9",
  uses_brand_kit: true,
  renders_thai_text: true,
  form: [
    {
      key: "occupation",
      label_th: "อาชีพ/ตำแหน่ง",
      type: "text",
      required: true,
      placeholder_th: "เช่น นักการตลาดออนไลน์, Business Coach",
    },
    {
      key: "display_name",
      label_th: "ชื่อที่จะแสดง",
      type: "text",
      required: true,
      placeholder_th: "เช่น มิว สมใจ",
    },
    {
      key: "tagline",
      label_th: "แท็กไลน์",
      type: "text",
      required: false,
      placeholder_th: "เช่น Personal Brand Strategy",
      ai_pick_if_empty: true,
    },
  ],
  master_prompt: `A polished professional LinkedIn cover photo, 16:9. {{person_clause}}, {{occupation}}, seated at a sleek desk with a laptop, in a modern executive office with soft navy-and-white tones and subtle gold accents. Elegant premium lighting, shallow depth of field, photorealistic. Name plate area and headline text: "{{display_name}}" and "{{tagline}}" rendered in clean bold Thai sans-serif, navy background, gold underline. Absolutely no other text. ${SAFE_ZONE_RULE}`,
};
