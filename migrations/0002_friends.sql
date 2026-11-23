-- CalendRun — amis
PRAGMA foreign_keys = ON;

-- une seule ligne par paire (user_low < user_high) : « accepted » = acceptée par le destinataire,
-- donc valable dans les deux sens
CREATE TABLE friendships (
  user_low     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_high    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL CHECK (status IN ('pending', 'accepted')),
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (user_low, user_high),
  CHECK (user_low < user_high),
  CHECK (requested_by IN (user_low, user_high))
);
CREATE INDEX friendships_high ON friendships(user_high);

CREATE TABLE blocks (
  blocker    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (blocker, blocked)
);
CREATE INDEX blocks_blocked ON blocks(blocked);
