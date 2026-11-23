-- CalendRun — comptes (pseudo + mot de passe, sans e-mail)
-- Appliquer : npx wrangler d1 migrations apply calendrun --local | --remote
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id            TEXT PRIMARY KEY,              -- aléatoire 128 bits (hex), jamais séquentiel
  pseudo        TEXT NOT NULL,                 -- tel que saisi (affichage)
  pseudo_norm   TEXT NOT NULL UNIQUE,          -- minuscules : unicité insensible à la casse
  pw_hash       TEXT NOT NULL,                 -- pbkdf2-sha256$<itérations>$<sel b64url>$<hash b64url>
  recovery_hash TEXT NOT NULL,                 -- HMAC-SHA256(poivre, code de récupération normalisé)
  visibility    TEXT NOT NULL DEFAULT 'friends' CHECK (visibility IN ('friends', 'none')),
  friend_code   TEXT NOT NULL UNIQUE,          -- code ami personnel, régénérable
  created_at    INTEGER NOT NULL,              -- secondes UNIX
  last_seen_at  INTEGER NOT NULL               -- purge des comptes inactifs depuis 3 ans
);
CREATE INDEX users_last_seen ON users(last_seen_at);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,                 -- SHA-256 du jeton (le jeton lui-même n'est jamais stocké)
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX sessions_expires ON sessions(expires_at);

-- favoris (fav) et inscriptions (reg)
CREATE TABLE user_races (
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  race_id  TEXT NOT NULL,
  kind     TEXT NOT NULL CHECK (kind IN ('fav', 'reg')),
  added_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, race_id, kind)
);
CREATE INDEX user_races_race ON user_races(race_id);

-- limitation des tentatives (connexion, récupération, inscription, demandes d'ami)
CREATE TABLE rate_limits (
  key          TEXT PRIMARY KEY,               -- ex. login-ip:1.2.3.4, login-user:pseudo
  count        INTEGER NOT NULL,
  window_start INTEGER NOT NULL,
  locked_until INTEGER NOT NULL DEFAULT 0
);
