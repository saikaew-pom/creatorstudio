// §BV Brand Voice AI-fill + §SC Style Cloner (doc 02)
import { z } from "zod";
import { PromptModule, BrandSchema, StyleProfileSchema, Brand, StyleProfile } from "./shared";

// ---------- §BV Brand fill ----------
export interface BrandFillInput {
  free_text_story: string;
}

export const brandFill: PromptModule<BrandFillInput, Brand> = {
  id: "brand.fill.v2",
  model: "smart",
  temperature: 0.4,
  schema: BrandSchema,
  system: () => `คุณคือที่ปรึกษาแบรนด์ อ่านเรื่องเล่าธุรกิจภาษาไทยธรรมดา แล้วสกัดเป็น "โปรไฟล์เสียงแบรนด์" ที่ระบบจะใช้กำกับการเขียนคอนเทนต์ทุกชิ้น
กติกา: สกัดจากสิ่งที่ผู้ใช้เล่าเท่านั้น จุดที่ไม่รู้ให้เดาแบบอนุรักษ์นิยมที่สุดจาก niche ห้ามแต่งข้อมูลธุรกิจที่ไม่ได้บอก

## confidence (สำคัญมาก — ห้ามเว้นว่าง)
ต้องใส่ confidence เป็น object ที่มี key ครบทุก field ที่คุณกรอก โดยระบุว่าแต่ละ field มาจากไหน:
- "from_user" = ผู้ใช้บอกมาตรงๆ ในเรื่องเล่า
- "guessed" = คุณเดา/อนุมานเอง (ผู้ใช้ไม่ได้บอก) เพื่อให้ผู้ใช้ไปตรวจแก้ในขั้นถัดไป
ตัวอย่าง: { "name": "from_user", "tone": "from_user", "words_use": "guessed", "hashtags": "guessed", "audience": "from_user", ... }
key ที่ต้องมีใน confidence: name, business, audience, tone, pronoun, words_use, words_avoid, emoji_policy, hashtags, sample_lines
sample_lines คือประโยคตัวอย่างที่คุณแต่งให้ดูเป็นแนว จึงเป็น "guessed" เสมอ

ตอบ JSON เท่านั้น`,
  user: (i) => `เรื่องเล่าจากเจ้าของ: ${i.free_text_story}`,
};

export const BRAND_STARTER_CHIPS = [
  "ฉันขาย __ ให้ลูกค้า __",
  "ลูกค้าหลักของฉันคือ __ อายุ __",
  "อยากให้แบรนด์พูดแบบ __",
  "คำที่อยากใช้: __ คำที่ไม่อยากใช้: __",
];

// ---------- §SC Style Cloner ----------
export interface StyleCloneInput {
  samples: string[]; // 1-3 posts
}

export const styleClone: PromptModule<StyleCloneInput, StyleProfile> = {
  id: "style.clone.v1",
  model: "smart",
  temperature: 0.3,
  schema: StyleProfileSchema,
  system: () => `คุณคือนักภาษาศาสตร์เชิงสไตล์ วิเคราะห์ "วิธีเขียน" ของตัวอย่าง (ไม่ใช่เนื้อหา) แล้วสรุปเป็นโปรไฟล์ที่นักเขียนอีกคนอ่านแล้วเขียน "ให้เหมือนคนเดิมเขียน" ได้
วิเคราะห์: ความยาวประโยคเฉลี่ย/จังหวะ, คำลงท้าย-อนุภาค (ครับ/ค่ะ/นะ/แหละ/จ้า), ระดับภาษา, สรรพนาม, ความหนาแน่น emoji + ตัวที่ใช้ประจำ, โครงสร้างการเปิด-ปิดโพสต์, ลายเซ็นเฉพาะตัว (วลีติดปาก การเว้นบรรทัด การใช้ตัวเลข/ลิสต์), สิ่งที่คนนี้ "ไม่ทำ"
ห้ามคัดลอกประโยคจากตัวอย่างเกิน 5 คำติดกันลงในโปรไฟล์
profile_markdown ต้องยาวไม่เกิน 20 บรรทัด (นี่คือสิ่งที่จะถูก inject เข้า prompt อื่น)
ตอบ JSON เท่านั้น`,
  user: (i) =>
    i.samples.map((s, n) => `## ตัวอย่างที่ ${n + 1}\n${s}`).join("\n\n"),
};
