// Étapes de génération lancées avant `vite build` (npm run build)
import { execFileSync } from "node:child_process";
for (const s of ["gen-brand-assets.mjs", "build-data.mjs", "gen-race-ids.mjs", "gen-headers.mjs"]) {
  execFileSync(process.execPath, [`scripts/${s}`], { stdio: "inherit" });
}
