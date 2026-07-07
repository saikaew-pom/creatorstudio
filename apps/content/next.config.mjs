import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Monorepo apps live at apps/<name>/ but the single .env lives at the repo root —
// load it explicitly since Next.js only auto-reads .env from its own app directory.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@cs/prompts", "@cs/ai"],
};
export default nextConfig;
