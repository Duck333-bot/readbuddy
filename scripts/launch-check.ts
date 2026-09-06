import fs from "node:fs";
import path from "node:path";
import { configurationIssues } from "../server/config";

const production = process.argv.includes("--production") || process.env.NODE_ENV === "production";
const issues = configurationIssues();

if (production && issues.length > 0) {
  console.error(`ZhiyaAI production configuration is incomplete:\n- ${issues.join("\n- ")}`);
  process.exit(1);
}

if (production && !fs.existsSync(path.resolve("dist/public/index.html"))) {
  console.error("ZhiyaAI production build is missing. Run pnpm build first.");
  process.exit(1);
}

console.log(production ? "ZhiyaAI launch check passed." : "ZhiyaAI development launch check passed.");
