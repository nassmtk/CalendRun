// Outils de test : base D1 locale (Miniflare) + appels directs aux routeurs des Functions
import fs from "node:fs";
import path from "node:path";
import { getPlatformProxy } from "wrangler";
import { handleAccount } from "../functions/_lib/accounts/account.js";

export const ORIGIN = "https://calend.run";

export async function setup() {
  const proxy = await getPlatformProxy({ configPath: "tests/wrangler.test.toml", persist: false });
  const DB = proxy.env.DB;
  // migrations dans l'ordre, une instruction à la fois
  for (const f of fs.readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort()) {
    const sql = fs.readFileSync(path.join("migrations", f), "utf8").replace(/--.*$/gm, "");
    for (const stmt of sql.split(";").map((s) => s.trim()).filter(Boolean)) await DB.prepare(stmt).run();
  }
  const env = { DB, AUTH_PEPPER: "poivre-de-test-tres-long-et-aleatoire", SITE_URL: ORIGIN };
  return { env, DB, dispose: () => proxy.dispose() };
}

let ipSeq = 1;
export const freshIp = () => `10.0.${Math.floor(ipSeq / 250)}.${(ipSeq++ % 250) + 1}`;

/** un « navigateur » : garde ses cookies et son jeton CSRF */
export function client(env, handler = handleAccount, { ip = freshIp() } = {}) {
  const jar = {};
  const c = {
    jar, csrf: null, ip,
    async call(method, p, { body, origin = ORIGIN, csrf = c.csrf, headers = {}, route = handler } = {}) {
      const h = new Headers({ "cf-connecting-ip": c.ip, ...headers });
      if (origin) h.set("origin", origin);
      if (csrf) h.set("x-csrf-token", csrf);
      const cookie = Object.entries(jar).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join("; ");
      if (cookie) h.set("cookie", cookie);
      if (body !== undefined) h.set("content-type", "application/json");
      const req = new Request(ORIGIN + "/api/" + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
      const res = await route(req, env, p);
      for (const sc of res.headers.getSetCookie()) {
        const [kv] = sc.split(";");
        const i = kv.indexOf("=");
        jar[kv.slice(0, i)] = kv.slice(i + 1);
      }
      let data = null;
      try { data = await res.json(); } catch {}
      return { status: res.status, data, res, setCookies: res.headers.getSetCookie() };
    },
    async me() { const r = await c.call("GET", "me"); if (r.status === 200) c.csrf = r.data.csrf; return r; }
  };
  return c;
}

export const PW = "un-mot-de-passe-solide-42";
export async function signup(env, pseudo, opts) {
  const c = client(env, undefined, opts);
  const r = await c.call("POST", "auth/signup", { body: { pseudo, password: PW } });
  if (r.status !== 201) throw new Error(`inscription ${pseudo} : ${r.status} ${JSON.stringify(r.data)}`);
  await c.me();
  c.recoveryCode = r.data.recoveryCode;
  c.id = (await c.me()).data.user.id;
  return c;
}
