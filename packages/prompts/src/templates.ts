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

/**
 * Build the fully-rendered viral-kit system prompt from a template + raw form values.
 * Maps text fields → {value}, select fields → {value,label,fragment} (looking up the
 * chosen option), computes the special {{object_instruction}} slot, then runs
 * renderTemplatePrompt. This is the single source of truth for how a template's
 * form turns into a prompt — the app should call this, never hand-assemble slots.
 */
export function buildViralKitPrompt(
  template: TemplateRecord,
  formValues: Record<string, string>
): string {
  const values: Record<string, { value: string; label?: string; fragment?: string }> = {};
  for (const field of template.form) {
    const raw = (formValues[field.key] ?? "").trim();
    if (field.type === "select") {
      const opt = field.options.find((o) => o.value === raw) ?? field.options[0];
      values[field.key] = { value: opt.value, label: opt.label_th, fragment: opt.prompt_fragment };
    } else {
      values[field.key] = { value: raw };
      // {{field_clause}}: the value inline when filled, or an "AI decides" instruction
      // when empty + ai_pick_if_empty (so master_prompts can drop it into a sentence
      // regardless). This generalizes the old object_instruction special case.
      const canAiPick = field.type === "text" && field.ai_pick_if_empty;
      values[`${field.key}_clause`] = {
        value: raw ? raw : canAiPick ? `(ให้ AI คิด/เลือกให้เหมาะกับโจทย์)` : "",
      };
    }
  }
  // Back-compat alias for ROASTMASTER's {{object_instruction}} slot.
  values.object_instruction = { value: objectInstruction(formValues.object?.trim() || undefined) };
  return renderTemplatePrompt(template.master_prompt, values);
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

// ---------- More viral templates (variety across categories) ----------
export const FOOD_ANATOMY: TemplateRecord = {
  slug: "food-anatomy",
  kind: "viral",
  name_th: "แยกส่วนความอร่อย (Food Anatomy)",
  name_en: "Food Anatomy Infographic",
  category: "สินค้าโฆษณา",
  badges: ["hot"],
  uses_brand_kit: false,
  renders_thai_text: false,
  form: [
    { key: "dish", label_th: "เมนู/สินค้า", type: "text", required: true, placeholder_th: "เช่น เบอร์เกอร์เนื้อ, ชานมไข่มุก, ข้าวมันไก่" },
    { key: "usp", label_th: "จุดขายที่อยากเน้น", type: "text", required: false, placeholder_th: "เช่น เนื้อ 100%, ไข่มุกทำสด (เว้นว่างให้ AI คิด)", ai_pick_if_empty: true },
  ],
  master_prompt: `คุณคือครีเอทีฟทำคอนเทนต์อาหารสาย "แยกองค์ประกอบ" (exploded/anatomy shot) ที่ทำให้คนหยุดดูแล้วหิว
โจทย์: เมนู "{{dish}}" {{usp_clause}}
สร้าง 1 ชุด ประกอบด้วย:
1. image_prompt_en (EN): an exploded/deconstructed overhead food photography shot of the dish with every ingredient layer floating and separated, labeled visually by position, clean studio background, dramatic appetizing lighting, ultra sharp macro detail, commercial food photography. ${NO_TEXT_GUARD}
2. layer_breakdown_th: ลิสต์ชั้น/ส่วนประกอบเรียงจากบนลงล่าง อธิบายสั้นๆ ว่าแต่ละส่วนเด็ดยังไง
3. caption_th: แคปชันขายของสั้นกระชับ เน้นจุดขาย จบด้วย CTA สั่งซื้อ/ทัก
4. hashtags: 5 แฮชแท็กสายอาหาร
ตอบ JSON: { "sets": [{ "object_th": "{{dish}}", "character_image_prompt_en": <image_prompt_en>, "video_prompt_en": [{"scene":1,"prompt":<layer_breakdown as one string>}], "dialogue_th": [{"scene":1,"line":<caption_th>}], "voiceover_direction_th": "", "caption_th": <caption_th>, "hashtags": [5] }] }`,
};

export const MUTELU_WALLPAPER: TemplateRecord = {
  slug: "mutelu-wallpaper",
  kind: "viral",
  name_th: "วอลเปเปอร์สายมูเสริมดวง",
  name_en: "Mutelu Wallpaper",
  category: "ภาพไวรัล",
  badges: ["new", "hot"],
  uses_brand_kit: false,
  renders_thai_text: true,
  form: [
    { key: "wish", label_th: "อยากเสริมด้านไหน", type: "select", options: [
      { value: "money", label_th: "การเงิน-โชคลาภ", prompt_fragment: "wealth, gold coins, prosperity symbols, abundant money energy" },
      { value: "love", label_th: "ความรัก", prompt_fragment: "love, rose quartz, soft pink romantic aura, twin flames" },
      { value: "work", label_th: "การงาน-เลื่อนขั้น", prompt_fragment: "career success, rising sun, powerful auspicious dragon, upward momentum" },
      { value: "luck", label_th: "โชคลาภทั่วไป", prompt_fragment: "general fortune, lucky charms, radiant golden light, four-leaf motifs" },
    ] },
    { key: "phrase", label_th: "ข้อความมงคลบนภาพ", type: "text", required: false, placeholder_th: 'เช่น "รวยเป็นล้าน" (เว้นว่างให้ AI คิด)', ai_pick_if_empty: true },
  ],
  master_prompt: `คุณคือดีไซเนอร์วอลเปเปอร์มือถือสายมูเตลู ที่ทำภาพสวยขลังแต่โมเดิร์น
โจทย์: วอลเปเปอร์เสริมดวงด้าน {{wish.label}}
สร้าง 1 ชุด:
1. image_prompt_en (EN): a stunning vertical 9:16 mobile wallpaper, mystical auspicious aesthetic combining {{wish.fragment}}, elegant modern spiritual design, ethereal glowing light, luxurious and sacred mood, ultra high quality. Thai auspicious blessing text {{phrase_clause}} rendered as a beautiful elegant gold Thai script headline, centered, tasteful. Absolutely no other text, no letters other than that Thai blessing phrase.
2. meaning_th: อธิบายความหมาย/ความเชื่อของสัญลักษณ์ในภาพสั้นๆ
3. caption_th: แคปชันสายมู ชวนเซฟไปตั้งเป็นวอลเปเปอร์ จบด้วยคำอวยพร
4. hashtags: 5 แฮชแท็กสายมู
ตอบ JSON: { "sets": [{ "object_th": "{{wish.label}}", "character_image_prompt_en": <image_prompt_en>, "video_prompt_en": [{"scene":1,"prompt":<meaning_th>}], "dialogue_th": [{"scene":1,"line":<caption_th>}], "voiceover_direction_th": "", "caption_th": <caption_th>, "hashtags": [5] }] }`,
};

export const PRODUCT_PROMO_PRO: TemplateRecord = {
  slug: "product-promo-pro",
  kind: "viral",
  name_th: "โปรโมทสินค้าสุดปัง (Product Promo Pro)",
  name_en: "Product Promo Pro",
  category: "สินค้าโฆษณา",
  badges: ["hot"],
  uses_brand_kit: true,
  renders_thai_text: true,
  form: [
    { key: "product", label_th: "สินค้า", type: "text", required: true, placeholder_th: "เช่น ครีมกันแดด, กระเป๋าหนัง, คอร์สออนไลน์" },
    { key: "offer", label_th: "โปรโมชั่น/ข้อเสนอ", type: "text", required: false, placeholder_th: 'เช่น "ลด 50% วันนี้เท่านั้น" (เว้นว่างให้ AI คิด)', ai_pick_if_empty: true },
    { key: "mood", label_th: "อารมณ์ภาพ", type: "select", options: [
      { value: "luxury", label_th: "หรูพรีเมียม", prompt_fragment: "luxurious premium aesthetic, dark elegant background, dramatic spotlight, gold accents" },
      { value: "fresh", label_th: "สดใสมินิมอล", prompt_fragment: "bright fresh minimal aesthetic, clean pastel background, soft natural light, airy" },
      { value: "bold", label_th: "จัดจ้านสะดุดตา", prompt_fragment: "bold high-contrast aesthetic, vibrant saturated colors, dynamic composition, energetic" },
    ] },
  ],
  master_prompt: `คุณคือครีเอทีฟโฆษณาสินค้าสาย conversion สูง
โจทย์: โปสเตอร์โปรโมทสินค้า "{{product}}" {{offer_clause}} สไตล์ {{mood.label}}
สร้าง 1 ชุด:
1. image_prompt_en (EN): a hero product advertising poster, the product "{{product}}" as the clear focal point floating or displayed prominently, {{mood.fragment}}, commercial advertising photography, ultra high quality render, vertical 4:5. Put the Thai promotional offer — {{offer_clause}} — as a bold Thai sans-serif headline in the top third (write the actual Thai offer text in quotes). Absolutely no other text, no letters other than that promotional headline and what is physically printed on the product.
2. angle_th: มุมการขายที่ใช้ (pain/benefit) สั้นๆ
3. caption_th: แคปชันขายของ พร้อม CTA เร่งการตัดสินใจ
4. hashtags: 5 แฮชแท็ก
ตอบ JSON: { "sets": [{ "object_th": "{{product}}", "character_image_prompt_en": <image_prompt_en>, "video_prompt_en": [{"scene":1,"prompt":<angle_th>}], "dialogue_th": [{"scene":1,"line":<caption_th>}], "voiceover_direction_th": "", "caption_th": <caption_th>, "hashtags": [5] }] }`,
};

// ---------- More visual templates ----------
export const QUOTE_CARD: TemplateRecord = {
  slug: "quote-card",
  kind: "visual",
  name_th: "Quote ส่วนตัว",
  category: "Personal Brand",
  badges: [],
  aspect: "1:1",
  uses_brand_kit: true,
  renders_thai_text: true,
  form: [
    { key: "quote", label_th: "ข้อความ Quote", type: "text", required: true, placeholder_th: "เช่น เริ่มก่อนเสมอ ดีกว่ารอให้พร้อม" },
    { key: "author", label_th: "ชื่อผู้พูด", type: "text", required: false, placeholder_th: "เช่น มิว สมใจ", ai_pick_if_empty: false },
  ],
  master_prompt: `An elegant 1:1 personal-brand quote card, dark luxurious background with subtle gold particle accents and soft bokeh, premium minimal design. Centered bold Thai serif headline: "{{quote}}". A smaller gold Thai signature line at the bottom: "— {{author}}". Refined, aspirational, high-end aesthetic. Absolutely no other text. ${SAFE_ZONE_RULE}`,
};

export const PROMO_POSTER: TemplateRecord = {
  slug: "promo-poster",
  kind: "visual",
  name_th: "โปสเตอร์โปรโมชั่นร้าน",
  category: "ร้านอาหาร",
  badges: ["hot"],
  aspect: "4:5",
  uses_brand_kit: true,
  renders_thai_text: true,
  form: [
    { key: "shop", label_th: "ชื่อร้าน", type: "text", required: true, placeholder_th: "เช่น Cafe Smile" },
    { key: "headline", label_th: "ข้อความโปรโมชั่น", type: "text", required: true, placeholder_th: 'เช่น ลด 50% ทุกเมนู' },
    { key: "vibe", label_th: "โทน", type: "select", options: [
      { value: "warm", label_th: "อบอุ่นน่ารัก", prompt_fragment: "warm cozy inviting tones, soft golden hour light, hand-crafted feel" },
      { value: "modern", label_th: "โมเดิร์นสะอาด", prompt_fragment: "clean modern aesthetic, bright airy, minimal geometric layout" },
    ] },
  ],
  master_prompt: `A vibrant 4:5 shop promotion poster for "{{shop}}", {{vibe.fragment}}, appetizing hero imagery relevant to the shop, professional commercial design. Large bold Thai display headline: "{{headline}}", with the shop name "{{shop}}" as a secondary line. Eye-catching, share-worthy layout. Absolutely no other text beyond the headline and shop name. ${SAFE_ZONE_RULE}`,
};

/** All seed templates — single source of truth for the DB seed (scripts/seed-templates.mjs). */
export const SEED_TEMPLATES: TemplateRecord[] = [
  ROASTMASTER,
  FOOD_ANATOMY,
  MUTELU_WALLPAPER,
  PRODUCT_PROMO_PRO,
  LINKEDIN_COVER,
  QUOTE_CARD,
  PROMO_POSTER,
];
