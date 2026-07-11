// §CAMP Campaign Mode (M15b, docs/08-content-redesign.md) — the "dramatic twist":
// one topic → a 7-day content calendar with a deliberate narrative arc (awareness →
// educate → build trust → sales close), each day tagged with a Content Recipe chip
// so it deep-links straight into the normal Content Studio flow.
import { z } from "zod";
import { Brand, PromptModule, brandBlock, OUTPUT_HYGIENE_RULES, todayTh } from "./shared";
import { TEMPLATE_CHIPS, type TemplateChip } from "./content-kit";

const TEMPLATE_KEYS = Object.keys(TEMPLATE_CHIPS) as [TemplateChip, ...TemplateChip[]];

export interface CampaignInput {
  topic: string;
  niche?: string;
  brand?: Brand;
}

export const DayPlanSchema = z.object({
  day: z.number().int().min(1).max(7),
  goal_th: z.string(), // e.g. "สร้างการรับรู้ (Awareness)"
  template: z.enum(TEMPLATE_KEYS),
  topic_line: z.string(), // the specific angle for that day — feeds Content Studio's topic box
  hook: z.string(), // a ready-to-use hook line, so the week grid has something to show immediately
});
export type DayPlan = z.infer<typeof DayPlanSchema>;

export const CampaignSchema = z.object({ days: z.array(DayPlanSchema).length(7) });
export type Campaign = z.infer<typeof CampaignSchema>;

const RECIPE_MENU = (Object.keys(TEMPLATE_CHIPS) as TemplateChip[])
  .map((k) => `- ${k}: "${TEMPLATE_CHIPS[k].name_th}" — ${TEMPLATE_CHIPS[k].structure}`)
  .join("\n");

export const campaign: PromptModule<CampaignInput, Campaign> = {
  id: "content.campaign.v1",
  model: "smart", // planning quality matters more than speed here
  temperature: 0.85,
  schema: CampaignSchema,
  system: (input) => {
    const parts = [
      `คุณคือนักวางแผนคอนเทนต์มาร์เก็ตติ้งไทยระดับซีเนียร์ ที่เชี่ยวชาญการวางแคมเปญ 7 วันให้ SME ไทย
ภารกิจ: จากหัวข้อ/สินค้าที่ผู้ใช้ให้มา วางแผนคอนเทนต์ 7 วันติดต่อกัน ที่มี "สตอรี่อาร์คชัดเจน" ไม่ใช่แค่โพสต์สุ่ม 7 อัน — คนที่ติดตามครบ 7 วันต้องรู้สึกเหมือนถูกพาเดินทางจาก "ไม่รู้จัก" ไปสู่ "อยากซื้อ"

## Story arc บังคับ (ปรับใช้ตามหัวข้อ แต่ต้องคงทิศทางนี้)
- Day 1: สร้างการรับรู้ (Awareness) — ดึงความสนใจ ยังไม่ขาย ใช้ template แนวเบื้องหลัง/เล่าเรื่อง/แซวความเชื่อผิด
- Day 2-3: ให้ความรู้ (Educate) — สอนสิ่งที่เป้าหมายอยากรู้ เชื่อมโยงกับปัญหาที่สินค้า/บริการแก้ได้ (ยังไม่ขายตรงๆ)
- Day 4-5: สร้างความเชื่อใจ (Trust) — รีวิว/เคสจริง/ก่อนหลัง ทำให้คนเชื่อว่า "ใช้ได้จริง"
- Day 6: อุ่นเครื่องก่อนขาย — เปิดตัว/ตอบคำถามที่คนสงสัยก่อนตัดสินใจซื้อ
- Day 7: ปิดการขาย (Sales close) — โพสต์ขายตรงๆ หรือโปรโมชั่น เก็บแรงจากทั้งสัปดาห์

## เมนู Content Recipe ที่เลือกได้ (ใช้ key ตรงตัวใน field "template")
${RECIPE_MENU}

## กติกา
- แต่ละวันต้องใช้ template คนละแบบกัน (ห้ามซ้ำ) และเลือกให้ตรงกับ phase ของวันนั้นในสตอรี่อาร์ค
- topic_line ต้องเจาะจงเป็นมุมของวันนั้น ไม่ใช่หัวข้อเดิมซ้ำทุกวัน (เช่น ถ้าหัวข้อคือ "เซรั่มลดสิว" วันที่ 2 อาจเป็น "3 สาเหตุที่สิวไม่หายสักที" ไม่ใช่ "เซรั่มลดสิว" ซ้ำ)
- hook ของแต่ละวันต้องแตกต่างกันจริง ทั้งมุมและคำเปิด ห้ามคล้ายกันจนอ่านแล้วรู้สึกซ้ำ
- goal_th เขียนสั้น 1 บรรทัด บอกเป้าหมายของวันนั้นเป็นภาษาไทย`,
      OUTPUT_HYGIENE_RULES,
    ];
    if (input.brand) parts.push(brandBlock(input.brand));
    parts.push(`ตอบเป็น JSON เท่านั้น ห้ามมีข้อความนอก JSON`);
    return parts.join("\n\n");
  },
  user: (input) =>
    [
      `หัวข้อ/สินค้า/บริการ: ${input.topic}`,
      input.niche ? `ประเภทธุรกิจ/Niche: ${input.niche}` : null,
      `วันนี้: ${todayTh()}`,
      `วางแผนคอนเทนต์ 7 วันตาม story arc ที่กำหนด`,
    ]
      .filter(Boolean)
      .join("\n"),
};
