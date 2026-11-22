// Charge .env / .env.production (comme Vite) sans écraser les variables déjà définies (ex. Cloudflare)
import { loadEnv } from "vite";
const loaded = loadEnv(process.env.NODE_ENV === "development" ? "development" : "production", process.cwd(), "");
for (const [k, v] of Object.entries(loaded)) if (process.env[k] === undefined) process.env[k] = v;
