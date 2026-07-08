// Seeds the templates table from @cs/prompts (single source of truth — no SQL drift).
// Idempotent upsert by slug; omits usage_count so re-seeding never resets live counts.
// Run: set -a && source ../../.env && set +a && pnpm --filter @cs/db exec tsx scripts/seed-templates.ts
import { SEED_TEMPLATES } from "@cs/prompts";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const rows = SEED_TEMPLATES.map((t) => ({
  slug: t.slug,
  kind: t.kind,
  name_th: t.name_th,
  category: t.category,
  badges: t.badges,
  aspect: t.aspect ?? null,
  uses_brand_kit: t.uses_brand_kit,
  renders_thai_text: t.renders_thai_text,
  example_asset: t.example_asset ?? null,
  form: t.form,
  master_prompt: t.master_prompt,
  is_published: true,
}));

const { error } = await db.from("templates").upsert(rows, { onConflict: "slug" });
if (error) {
  console.error("Seed failed:", error.message);
  process.exit(1);
}
console.log(`✓ Seeded ${rows.length} templates:`);
for (const t of SEED_TEMPLATES) console.log(`  - [${t.kind}] ${t.slug} (${t.category})`);
