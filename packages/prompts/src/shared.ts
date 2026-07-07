// §0 Shared infrastructure — constants & context blocks (doc 02)
import { z } from "zod";

export type ModelTier =
  | "fast"
  | "smart"
  | "image-standard"
  | "image-pro"
  | "tts"
  | "stt";

export type Platform = "facebook" | "instagram" | "tiktok" | "youtube" | "tts";

// ---------- Brand & Style types ----------
export const BrandSchema = z.object({
  name: z.string(),
  business: z.string(),
  audience: z.string(),
  tone: z.string(),
  pronoun: z.string(),
  words_use: z.array(z.string()),
  words_avoid: z.array(z.string()),
  emoji_policy: z.enum(["none", "light", "medium", "heavy"]),
  hashtags: z.array(z.string()).max(8),
  sample_lines: z.array(z.string()).length(3),
  confidence: z.record(z.string(), z.enum(["from_user", "guessed"])),
});
export type Brand = z.infer<typeof BrandSchema>;

export const StyleProfileSchema = z.object({
  name: z.string(),
  profile_markdown: z.string(),
  dna: z.object({
    avg_sentence_len: z.string(),
    particles: z.array(z.string()),
    pronoun: z.string(),
    emoji_density: z.string(),
    emoji_set: z.array(z.string()),
    opening_pattern: z.string(),
    closing_pattern: z.string(),
    signature_moves: z.array(z.string()),
    never_does: z.array(z.string()),
  }),
  sample_rewrite: z.string(),
});
export type StyleProfile = z.infer<typeof StyleProfileSchema>;

// ---------- Context blocks ----------
export function brandBlock(b: Brand): string {
  return `## แบรนด์ของผู้ใช้ (ต้องยึดตามนี้เสมอ)
ชื่อแบรนด์: ${b.name}
ธุรกิจ: ${b.business}
กลุ่มลูกค้าหลัก: ${b.audience}
โทนการพูด: ${b.tone}
สรรพนามที่ใช้: ${b.pronoun}
คำ/วลีที่ต้องใช้: ${b.words_use.join(", ")}
คำที่ห้ามใช้: ${b.words_avoid.join(", ")}
นโยบาย emoji: ${b.emoji_policy}
แฮชแท็กประจำแบรนด์: ${b.hashtags.join(" ")}
ตัวอย่างประโยคที่เป็น "เสียงของแบรนด์":
${b.sample_lines.map((l) => `- ${l}`).join("\n")}`;
}

export function styleBlock(s: StyleProfile): string {
  return `## สไตล์การเขียนที่ต้องเลียนแบบ (Style Clone)
${s.profile_markdown}
กติกา: เลียนแบบ "วิธีเขียน" (จังหวะประโยค คำลงท้าย อีโมจิ โครงสร้าง) — ห้ามลอกเนื้อหาหรือข้อเท็จจริงจากตัวอย่างต้นฉบับ`;
}

export const PLATFORM_SPECS = `## สเปกต่อแพลตฟอร์ม
- Facebook: แคปชันยาวได้ 3-8 ย่อหน้าสั้น เว้นบรรทัดบ่อย เล่าเรื่อง/ให้คุณค่า จบด้วย CTA ชวนคอมเมนต์หรือแชร์ ใช้ **ตัวหนา** ได้เฉพาะหัวข้อย่อย
- Instagram: แคปชัน 3-6 ย่อหน้า บรรทัดแรกต้องหยุดนิ้วได้ใน 1 วิ เว้นวรรคอ่านง่าย ลงท้าย CTA + ชวน save
- TikTok: เป็น "สคริปต์พูด" ไม่ใช่แคปชัน — Hook ≤ 2 วิ, ประโยคสั้น จังหวะเร็ว, ยาวรวม 30-60 วิ แบ่งบรรทัดละ 1 ประโยค (1 บรรทัด = ซับ 1 การ์ด), ปิดท้าย CTA ตาม goal
- YouTube: โครง intro-hook / เนื้อหาเป็นข้อ / outro-CTA + คำอธิบายวิดีโอ 2 ย่อหน้า
- TTS (เสียง): สคริปต์อ่านออกเสียง ภาษาพูดธรรมชาติ ไม่มี emoji ไม่มีสัญลักษณ์ ตัวเลขเขียนเป็นคำอ่าน`;

export const SAFE_ZONE_RULE = `Composition: keep the subject and all key elements within the central 70% of the frame. Top 15% and bottom 15% must stay clear of critical elements, so social media UI overlays or cropping cannot destroy the image.`;

export const NO_TEXT_GUARD = `Absolutely no text, no letters, no captions, no watermarks, no logos other than what is physically printed on real products shown in the scene.`;

export const OUTPUT_HYGIENE_RULES = `## กติกาการเขียน (บังคับ)
- ภาษาไทยธรรมชาติแบบที่คนไทยพิมพ์จริง ห้ามสำนวนแปลจากอังกฤษ (ห้าม "มันคือ...ที่ซึ่ง", "อย่างไรก็ดี")
- ประโยคสั้น ย่อหน้าสั้น เว้นบรรทัดให้อ่านบนมือถือง่าย
- ห้ามใช้ markdown heading (#) ในแคปชัน — ใช้ตัวหนา **...** ได้เท่าที่จำเป็น
- emoji: ใช้เท่าที่ช่วยให้อ่านง่าย/มีชีวิต ตาม emoji policy ถ้าไม่มี policy ให้ "ปานกลาง" (2-6 ตัวทั้งโพสต์)
- ห้ามแต่งข้อเท็จจริง สถิติ หรือรีวิวปลอม ถ้าต้องใช้ตัวเลขให้เขียนแบบกลางๆ ("หลายเท่า", "จำนวนมาก") เว้นแต่ผู้ใช้ให้ตัวเลขมา
- ห้ามคำต้องห้ามโฆษณาไทยสายเสี่ยง (เคลมรักษาโรค, "ที่สุด" แบบไม่มีที่มา, การันตีรายได้)`;

export const IMAGE_PROMPT_FORMULA = `## สูตรเขียน image prompt (อังกฤษ)
โครง: [shot type] of [subject with specifics: age, ethnicity if human, clothing] [action/emotion] in [setting with local Thai context when relevant], [lighting], [mood], [style/render quality], [aspect note].
กฎ:
1. คนไทยเป็น default subject สำหรับคอนเทนต์ไทย ("young Thai professional (male, 30s)")
2. ห้ามชื่อบุคคลจริง/แบรนด์อื่น/ศิลปินลิขสิทธิ์ ("in the style of Pixar" → "in the style of a glossy 3D animated family film")
3. จอ/ป้ายในฉาก: "shows subtle abstract UI elements, not specific text" กัน text พัง
4. ปิดท้าย cover ทุกอันด้วย safe-zone rule และภาพ standard-model ทุกอันด้วย no-text guard
5. ถ้าต้องมีข้อความในภาพ (โหมด Pro เท่านั้น): ใส่ข้อความจริงในเครื่องหมายคำพูด ระบุตำแหน่ง/ฟอนต์ ("bold Thai sans-serif headline \\"ลด 50%\\" top-center") แล้วปิดด้วย: Absolutely no other text, no letters other than "..." and what is physically printed on products in the scene.
6. ภาพสินค้า: ให้ packaging เป็นพระเอก ("floating heroically", "clearly visible, showing the brand logo and product name"), ฉากสะอาด, cinematic soft lighting, shallow depth of field, ultra high quality render

Safe-zone rule (แนบท้าย cover): ${SAFE_ZONE_RULE}
No-text guard (แนบท้ายภาพ standard): ${NO_TEXT_GUARD}`;

export const VIDEO_PROMPT_FORMULA = `## สูตรเขียน video prompt (อังกฤษ)
ช็อตละ 1-2 ประโยค: [camera movement] + [subject & action] + [setting] + [lighting/mood].
เรียง 8 ช็อตเป็น mini-story ตามสคริปต์: hook shot → pain → turn → 3-4 content beats → result → CTA end card (described visually, no on-screen text).
คำที่ควรใช้: slow push-in, whip pan, top-down, macro close-up, handheld POV, orbit shot, match cut, golden hour, neon-lit, cinematic.`;

export interface PromptModule<I, O> {
  id: string;
  model: ModelTier;
  temperature: number;
  system: (input: I) => string;
  user: (input: I) => string;
  schema: z.ZodType<O>;
}

export const todayTh = (d = new Date()): string =>
  d.toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
