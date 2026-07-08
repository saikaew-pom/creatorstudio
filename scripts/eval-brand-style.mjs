#!/usr/bin/env node
// doc-02 §QA evals 7 (brand fill) + 8 (style clone) against the live Gemini API.
// Run: set -a && source .env && set +a && npx tsx scripts/eval-brand-style.mjs
import { brandFill, styleClone } from "../packages/prompts/src/index.ts";
import { run } from "../packages/ai/src/index.ts";

let pass = 0, fail = 0;
const check = (label, cond) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); cond ? pass++ : fail++; };

console.log("\n== Eval 7: brand fill extracts, flags guesses, doesn't invent ==");
{
  const story = `เปิดร้านกาแฟชื่อ Cafe Smile ที่อารีย์ ลูกค้าหลักเป็นคนทำงานช่วงวันธรรมดา ชอบมานั่งทำงาน เด็กๆ มาเฉพาะวันหยุด อยากให้ tone อบอุ่น เป็นมิตร ไม่ทางการเกินไป ใช้ emoji ปานกลาง`;
  const r = await run(brandFill, { free_text_story: story });
  const b = r.output;
  console.log("   name:", b.name, "| tone:", b.tone, "| pronoun:", b.pronoun, "| emoji:", b.emoji_policy);
  check("extracted a business name (Cafe Smile from story)", /smile/i.test(b.name) || b.business.includes("กาแฟ") || b.name.includes("กาแฟ"));
  check("audience reflects weekday workers", /ทำงาน|ออฟฟิศ|วันธรรมดา/.test(b.audience));
  check("tone captures warm/friendly", /อบอุ่น|เป็นมิตร|กันเอง/.test(b.tone));
  check("emoji policy is light or medium (story said ปานกลาง)", ["light", "medium"].includes(b.emoji_policy));
  check("3 sample lines produced", b.sample_lines.length === 3);
  check("confidence map present (flags guessed vs from_user)", Object.keys(b.confidence).length > 0);
  const guessedCount = Object.values(b.confidence).filter((v) => v === "guessed").length;
  console.log("   confidence: " + Object.keys(b.confidence).length + " fields, " + guessedCount + " guessed");
}

console.log("\n== Eval 8: style clone captures mechanics, no verbatim theft ==");
{
  const samples = [
    `เพื่อนๆ รู้ยางงง 🔥 วันนี้เจอเทคนิคเด็ดมากกก ต้องรีบมาแชร์เลย!!\nคือแบบ... ปกติเราจะทำแบบเดิมๆ ใช่มั้ย\nแต่พอลองวิธีนี้ปุ๊บ เปลี่ยนชีวิตเลยจ้าาา\nใครอยากรู้ คอมเมนต์ "เอา" มาเลยย 👇`,
    `อัปเดตวันนี้! 🎯\nทำไมคนส่วนใหญ่ถึงพลาดเรื่องนี้?\nเพราะไม่มีใครบอกไง...\nเซฟโพสต์นี้ไว้เลยนะ เดี๋ยวหาไม่เจอ 💜`,
  ];
  const r = await run(styleClone, { samples });
  const s = r.output;
  console.log("   name:", s.name, "| pronoun:", s.dna.pronoun, "| emoji:", s.dna.emoji_set.join(""));
  check("profile_markdown produced (<= ~20 lines)", s.profile_markdown.length > 0 && s.profile_markdown.split("\n").length <= 25);
  check("captured emoji usage", s.dna.emoji_set.length > 0);
  check("captured particles/signature (จ้า/ปุ๊บ/ยางง style)", s.dna.particles.length > 0 || s.dna.signature_moves.length > 0);
  check("sample_rewrite produced", s.sample_rewrite.length > 0);
  // No 6-word verbatim run from samples in the profile (anti-plagiarism rule)
  const joined = samples.join(" ");
  const profileWords = s.profile_markdown.split(/\s+/);
  let verbatim = false;
  for (let i = 0; i + 6 <= profileWords.length; i++) {
    const run6 = profileWords.slice(i, i + 6).join(" ");
    if (run6.length > 15 && joined.includes(run6)) { verbatim = true; break; }
  }
  check("no 6-word verbatim run copied from samples", !verbatim);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
