/* =========================================================
   Limitation des tentatives, stockée dans D1 (table rate_limits)
   - fenêtre fixe : `limit` actions par `windowSec`, puis blocage `lockSec`
   - délai croissant (connexion par pseudo) : après `freeFails` échecs,
     blocage de 2^(n - freeFails) secondes, plafonné à `maxLockSec`
   D1 plutôt que KV : KV n'est cohérent qu'à terme et limite les écritures.
   ========================================================= */
const now = () => Math.floor(Date.now() / 1000);

/** secondes restantes de blocage (0 = autorisé) */
export async function lockedFor(db, key) {
  const row = await db.prepare("SELECT locked_until FROM rate_limits WHERE key = ?").bind(key).first();
  return row ? Math.max(0, row.locked_until - now()) : 0;
}

/**
 * Compte une action (ou un échec). Renvoie les secondes de blocage qui en résultent (0 si aucun).
 * opts : { limit, windowSec, lockSec } (fenêtre) ou { freeFails, maxLockSec, windowSec } (délai croissant)
 */
export async function hit(db, key, { limit = 10, windowSec = 900, lockSec = 900, freeFails = null, maxLockSec = 900 } = {}) {
  const t = now();
  const row = await db.prepare("SELECT count, window_start, locked_until FROM rate_limits WHERE key = ?").bind(key).first();
  let count = 1, start = t;
  if (row && t - row.window_start < windowSec) { count = row.count + 1; start = row.window_start; }
  let lock = 0;
  if (freeFails !== null) {
    if (count > freeFails) lock = Math.min(maxLockSec, 2 ** (count - freeFails));
  } else if (count > limit) lock = lockSec;
  const until = lock ? t + lock : (row?.locked_until || 0);
  await db.prepare(
    "INSERT INTO rate_limits (key, count, window_start, locked_until) VALUES (?1, ?2, ?3, ?4) " +
    "ON CONFLICT(key) DO UPDATE SET count = ?2, window_start = ?3, locked_until = ?4"
  ).bind(key, count, start, until).run();
  return lock;
}

export const reset = (db, key) => db.prepare("DELETE FROM rate_limits WHERE key = ?").bind(key).run();

/** ménage occasionnel des entrées expirées (appelé par le worker planifié) */
export const purgeRateLimits = (db) => db.prepare("DELETE FROM rate_limits WHERE window_start < ? AND locked_until < ?").bind(now() - 86400, now()).run();
