// §I Image Studio — prompt enhancement (doc 02 §I)
import { z } from "zod";
import {
  PromptModule,
  IMAGE_PROMPT_FORMULA,
  NO_TEXT_GUARD,
} from "./shared";

export interface ImageEnhanceInput {
  description: string; // user's Thai (or any) description
  niche?: string;
  aspect: "1:1" | "4:5" | "9:16" | "16:9" | "2:3";
  thai_text_mode: boolean; // true → image-pro model, text-in-image rules
  has_reference_image: boolean;
  brand_kit?: {
    colors?: string[];
    has_logo?: boolean;
    has_person?: boolean;
  };
}

export const ImageEnhanceSchema = z.object({
  prompt_en: z.string(),
  negative_en: z.string(),
});
export type ImageEnhance = z.infer<typeof ImageEnhanceSchema>;

export const imageEnhance: PromptModule<ImageEnhanceInput, ImageEnhance> = {
  id: "image.enhance.v1",
  model: "fast",
  temperature: 0.7,
  schema: ImageEnhanceSchema,
  system: (i) =>
    [
      `คุณคือ prompt engineer ภาพโฆษณา แปลงคำอธิบายของผู้ใช้ (มักเป็นไทย สั้น กำกวม) ให้เป็น image prompt ภาษาอังกฤษคุณภาพโปรดักชัน`,
      IMAGE_PROMPT_FORMULA,
      `กติกาเพิ่ม:
- ตีความเจตนาเชิงพาณิชย์ของ niche "${i.niche ?? "ทั่วไป"}" (เช่น ร้านอาหาร → อาหารน่ากิน แสงเซ็กซี่)
- ${
        i.thai_text_mode
          ? "ผู้ใช้ต้องการข้อความไทยในภาพ: ใช้กฎข้อ 5 (ข้อความจริงในเครื่องหมายคำพูด + ตำแหน่ง/ฟอนต์ + no other text guard)"
          : `ห้ามมีตัวอักษรในภาพ: จบ prompt ด้วย "${NO_TEXT_GUARD}"`
      }
- aspect: ${i.aspect}${i.has_reference_image ? "\n- มีรูปอ้างอิงแนบมา: เขียน prompt ให้อ้างอิง 'the provided reference image' อย่างเหมาะสม (คงบุคคล/สินค้าในภาพอ้างอิงให้เหมือนเดิม)" : ""}`,
      `ตอบ JSON: { "prompt_en": string, "negative_en": string }`,
    ].join("\n\n"),
  user: (i) => `คำอธิบายจากผู้ใช้: ${i.description}`,
};

/** Brand-kit injection strings appended to the final image call (doc 02 §I.2) */
export function brandKitPromptSuffix(kit: NonNullable<ImageEnhanceInput["brand_kit"]>): string {
  const parts: string[] = [];
  if (kit.has_logo)
    parts.push(
      "Incorporate the provided logo naturally (on signage, product, or corner badge)."
    );
  if (kit.has_person)
    parts.push(
      "The person in the provided photo is the brand owner — keep their face consistent and photorealistic."
    );
  if (kit.colors?.length)
    parts.push(
      `Brand color palette: ${kit.colors.join(", ")} — use as the dominant accent colors.`
    );
  return parts.join(" ");
}

export const IMAGE_MODEL_CREDITS = { "image-standard": 1, "image-pro": 5 } as const;
