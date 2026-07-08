#!/usr/bin/env node
// doc-02 §QA eval 6 — RoastMaster viral template end-to-end (form → prompt → kit).
// Run: set -a && source .env && set +a && npx tsx scripts/eval-viral-kit.mjs
import { ROASTMASTER, buildViralKitPrompt, viralKit } from "../packages/prompts/src/index.ts";
import { run } from "../packages/ai/src/index.ts";

let pass = 0, fail = 0;
const check = (label, cond) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); cond ? pass++ : fail++; };

console.log("\n== Eval 6: RoastMaster (theme=ร้านกาแฟ, object empty→AI picks, กู-มึง, 15s, 1 set) ==");
const prompt = buildViralKitPrompt(ROASTMASTER, {
  theme: "ร้านกาแฟ",
  object: "", // empty → AI should pick a coffee-shop object
  speak_style: "gu_mueng",
  video_len: "15",
  count: "1",
});
// Sanity: the rendered prompt should have resolved all slots (no leftover {{...}}).
check("no unresolved {{slots}} in rendered prompt", !/\{\{[^}]+\}\}/.test(prompt));
check("prompt injected the theme", prompt.includes("ร้านกาแฟ"));
check("prompt injected the กู-มึง style fragment", prompt.includes("กู/มึง"));
check("prompt tells AI to pick the object (empty object path)", prompt.includes("เลือก") && prompt.includes("อินสุด"));

const r = await run(viralKit, { system_prompt: prompt });
const kit = r.output;
check("produced exactly 1 set (count=1)", kit.sets.length === 1);
const s = kit.sets[0];
if (s) {
  console.log("   object AI picked:", s.object_th);
  console.log("   scenes:", s.video_prompt_en.length, "| dialogue lines:", s.dialogue_th.length);
  check("AI picked a coffee-shop object", s.object_th.length > 0);
  check("15s → 3 scenes in video prompt", s.video_prompt_en.length === 3);
  check("dialogue has lines", s.dialogue_th.length > 0);
  check("character image prompt is English + has no-text guard", /[a-zA-Z]/.test(s.character_image_prompt_en) && /no text|no letters/i.test(s.character_image_prompt_en));
  check("caption + 5 hashtags", s.caption_th.length > 0 && s.hashtags.length === 5);
  check("voiceover direction present", s.voiceover_direction_th.length > 0);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
