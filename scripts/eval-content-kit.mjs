#!/usr/bin/env node
// Automated regression check for doc-02 §QA evals 1-3, against the LIVE Gemini API.
// Run: set -a && source .env && set +a && node scripts/eval-content-kit.mjs
import { contentKit, refine, applyContentKitPatch, ContentKitSchema } from "../packages/prompts/src/index.ts";
import { run } from "../packages/ai/src/index.ts";

let pass = 0;
let fail = 0;

function check(label, cond) {
  if (cond) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.log(`  ✗ ${label}`);
    fail++;
  }
}

console.log("\n== Eval 1: baseline content kit (no brand) ==");
{
  const r = await run(contentKit, {
    topic: "ครีมกันแดดสำหรับผิวมัน",
    platforms: ["facebook", "tiktok"],
  });
  const kit = r.output;
  check("schema valid (already guaranteed by run(), sanity re-check)", ContentKitSchema.safeParse(kit).success);
  check("5 distinct hook texts", new Set(kit.hooks.map((h) => h.text)).size === 5);
  check("exactly one is_recommended hook", kit.hooks.filter((h) => h.is_recommended).length === 1);
  check("facebook script present", kit.scripts.some((s) => s.platform === "facebook"));
  check("tiktok script present", kit.scripts.some((s) => s.platform === "tiktok"));
  check("3 illustration prompts, all English-looking", kit.visual.illustrations.length === 3 &&
    kit.visual.illustrations.every((i) => /[a-zA-Z]/.test(i.prompt_en) && !/[ก-๙]/.test(i.prompt_en)));
  check("8 video shot prompts", kit.visual.video_prompts.length === 8);
  check("cover prompt has no Thai text mixed in", !/[ก-๙]/.test(kit.visual.cover.prompt_en));
  check("hashtags cover requested platforms", kit.hashtags.some(h=>h.platform==='facebook') && kit.hashtags.some(h=>h.platform==='tiktok'));

  console.log("\n== Eval 3: refine-all (patch-based) leaves untouched sections byte-identical ==");
  const instruction = "ปรับ caption Facebook ให้สั้นลง เหลือ 3 ย่อหน้า";
  const r2 = await run(
    refine,
    { current_kit_json: JSON.stringify(kit), instruction, section_name: undefined },
    { modelOverride: "gemini-2.5-pro" }
  );
  check("patch omits keys it doesn't touch (should NOT include hashtags/visual/hooks here)",
    !("hashtags" in r2.output) && !("visual" in r2.output) && !("hooks" in r2.output));
  const merged = applyContentKitPatch(kit, r2.output);
  const fbBefore = kit.scripts.find((s) => s.platform === "facebook").caption;
  const fbAfter = merged.scripts.find((s) => s.platform === "facebook").caption;
  check("facebook caption changed", fbBefore !== fbAfter);
  const paraCount = fbAfter.split(/\n\n+/).filter(Boolean).length;
  console.log(`  i  facebook caption paragraph count after "≤3" instruction: ${paraCount} (soft target, not a hard contract)`);
  check("hooks untouched (byte-identical, guaranteed by construction)", JSON.stringify(kit.hooks) === JSON.stringify(merged.hooks));
  check("visual untouched (byte-identical, guaranteed by construction)", JSON.stringify(kit.visual) === JSON.stringify(merged.visual));
  check("hashtags untouched (byte-identical, guaranteed by construction)", JSON.stringify(kit.hashtags) === JSON.stringify(merged.hashtags));

  console.log("\n== Eval 3b: single-section refine only ever changes that section ==");
  const r3 = await run(refine, {
    current_kit_json: JSON.stringify(kit),
    instruction: "ทำให้สั้นลงและมีคำว่า WOW",
    section_name: "hook",
  });
  const merged2 = applyContentKitPatch(kit, r3.output, "hook");
  check("hooks changed", JSON.stringify(kit.hooks) !== JSON.stringify(merged2.hooks));
  check("scripts untouched", JSON.stringify(kit.scripts) === JSON.stringify(merged2.scripts));
  check("visual untouched", JSON.stringify(kit.visual) === JSON.stringify(merged2.visual));
  check("hashtags untouched", JSON.stringify(kit.hashtags) === JSON.stringify(merged2.hashtags));
}

console.log("\n== Eval 2: brand voice changes tone ==");
{
  const brand = {
    name: "เฮียก๋วยเตี๋ยว", business: "ร้านก๋วยเตี๋ยวเรือ",
    audience: "คนทำงานออฟฟิศแถวย่านธุรกิจ", tone: "กันเอง ขำๆ เป็นพี่เป็นน้อง",
    pronoun: "เฮีย", words_use: ["จ้า", "ชิมดิ"], words_avoid: ["พรีเมียม", "ครับผม"],
    emoji_policy: "medium", hashtags: ["#เฮียก๋วยเตี๋ยว"],
    sample_lines: ["หิวก็แวะมา เฮียทำให้กินฟรีๆ ไม่มีอ้วก", "จ้า มาชิมก๋วยเตี๋ยวเฮียกันเถอะ", "ลูกค้าเฮียคือครอบครัว"],
    confidence: {},
  };
  const r = await run(contentKit, {
    topic: "เปิดร้านก๋วยเตี๋ยวเรือสาขาใหม่", platforms: ["facebook"], brand,
  });
  const kit = r.output;
  const allText = JSON.stringify(kit).toLowerCase();
  check("pronoun 'เฮีย' appears in output", allText.includes("เฮีย"));
  check("no banned words leak in", !allText.includes("พรีเมียม") && !allText.includes("ครับผม"));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
