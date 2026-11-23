# Comptes utilisateurs et amis

Comptes **pseudo + mot de passe, sans e-mail**, stockés dans **Cloudflare D1** (SQLite) et servis par les **Pages Functions** (`functions/api/auth`, `functions/api/me`, `functions/api/friends`). Le tout tient dans le **plan gratuit** de Cloudflare.

Sans compte, le site marche exactement comme avant (localStorage) et **ne fait aucun appel d'API**.

---

## 1. Mise en place (une seule fois)

### 1.1 Créer la base
```bash
npx wrangler login
npx wrangler d1 create calendrun
```
Wrangler affiche un `database_id` (UUID). Il n'est pas secret.

### 1.2 Lier la base au projet Pages (binding `DB`)
Le `wrangler.toml` du dépôt contient `pages_build_output_dir` : **c'est lui qui fait foi pour la configuration de production**. Le binding se déclare donc là :

1. Dans `wrangler.toml`, décommenter le bloc `[[d1_databases]]` et coller le `database_id`.
2. Commit + push : le prochain déploiement crée le binding.

> Alternative tableau de bord : *Workers & Pages > calendrun-idf > Settings > Bindings > Add > D1 database*, nom de variable **`DB`**, base **`calendrun`**, pour **Production et Preview**, puis redéployer. Si le tableau de bord indique que la configuration est gérée par le fichier Wrangler, utilise la méthode ci-dessus.

### 1.3 Appliquer les migrations
Les migrations versionnées sont dans [`/migrations`](../migrations) (`0001_accounts.sql`, `0002_friends.sql`…). Wrangler garde la trace de celles déjà appliquées (table `d1_migrations`).

```bash
# en local (base de développement dans .wrangler/state)
npx wrangler d1 migrations apply calendrun --local
# en production
npx wrangler d1 migrations apply calendrun --remote
# vérifier
npx wrangler d1 execute calendrun --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
```
À refaire à chaque nouvelle migration, **avant** de déployer le code qui l'utilise.

### 1.4 Variables et secrets (Pages > Settings > Variables and secrets, Production **et** Preview)
| Nom | Type | Valeur |
|---|---|---|
| `AUTH_PEPPER` | **secret** | 64 caractères aléatoires : `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. ⚠️ **Ne jamais le changer** une fois des comptes créés : tous les mots de passe et codes de récupération deviendraient invalides. Garde-en une copie hors de Cloudflare (gestionnaire de mots de passe). |
| `ACCOUNTS_ENABLED` | variable | `true` : affiche « Connexion » dans la barre du haut (lue au build → redéployer). |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | variable / secret | déjà utilisés par les alertes et le contact. Si le secret est défini, **l'inscription exige Turnstile**. |

### 1.5 Purge des comptes inactifs (3 ans)
Le worker planifié `workers/reminders` (cron quotidien) supprime les comptes sans activité depuis 3 ans et nettoie les sessions expirées et les compteurs de tentatives. Il a besoin du même binding :
décommenter le bloc `[[d1_databases]]` de `workers/reminders/wrangler.toml` (même `database_id`), puis
`npx wrangler deploy --config workers/reminders/wrangler.toml`.

### 1.6 Développement local
```bash
npx wrangler d1 migrations apply calendrun --local
# .dev.vars (non versionné) : AUTH_PEPPER=un-poivre-de-dev  ACCOUNTS_ENABLED=true
ACCOUNTS_ENABLED=true npm run pages:dev
```
Les cookies `Secure` fonctionnent sur `http://localhost` (contexte sécurisé pour Chrome, Firefox et Safari).

---

## 2. Choix techniques

### Mots de passe
- **PBKDF2-HMAC-SHA256, 30 000 itérations**, sel aléatoire de 16 octets par utilisateur, **+ poivre** (`AUTH_PEPPER`) appliqué en HMAC avant PBKDF2.
- **Pourquoi pas Argon2id** : il n'existe pas dans WebCrypto, et sa version WASM dépasse la limite de **10 ms de CPU par requête** du plan gratuit dès qu'on lui donne une mémoire utile.
- **Pourquoi 30 000 itérations** : mesuré à ≈ 4,5 ms de CPU, ce qui laisse de la marge sous les 10 ms. Workers accepte jusqu'à 100 000 itérations (≈ 15 ms, donc hors plan gratuit).
- **Le poivre compense** le nombre d'itérations modeste : il n'est pas en base, donc une copie de la base seule ne permet pas d'attaquer les mots de passe.
- Le format stocké (`pbkdf2-sha256$<itérations>$<sel>$<hash>`) permet d'**augmenter les itérations plus tard** (passage au plan payant) : les mots de passe sont re-hachés automatiquement à la connexion suivante.
- 12 caractères minimum, 128 maximum (borne de coût), refus des mots de passe trop répétitifs, trop courants ou contenant le pseudo.

### Récupération sans e-mail
- À l'inscription, un **code de récupération** de 20 caractères (100 bits) est affiché **une seule fois** (copier / télécharger en .txt). Seul son HMAC est stocké.
- `/compte/oubli/` = pseudo + code + nouveau mot de passe. Après usage : nouveau code affiché, ancien code invalide, **toutes les sessions fermées**.
- Le code peut être régénéré depuis Mon compte (mot de passe exigé).

### Sessions
- Jeton aléatoire de **256 bits** ; seul son SHA-256 est en base. Expiration **30 jours glissants** (prolongée au plus une fois par jour).
- Cookie `__Host-cr_session` : `HttpOnly; Secure; SameSite=Lax; Path=/`, sans `Domain`.
- Cookie `cr_auth=1` lisible en JS, **sans aucune donnée** : il dit seulement au front qu'une session existe. Sans lui, **aucun appel d'API**.
- Déconnexion = suppression de la session en base. « Déconnecter tous mes appareils » = suppression de toutes ses sessions.

### Sécurité
- **Rate limiting** dans D1 (table `rate_limits`) :
  - connexion et récupération : 30 échecs / 15 min **par IP**, et **par pseudo** un délai croissant après 5 échecs (2 s, 4 s, 8 s… jusqu'à 15 min) ;
  - inscription : 5 / heure par IP ;
  - demandes d'ami : 20 / heure par compte.
- **Messages génériques** : « Pseudo ou mot de passe incorrect. ». Le calcul est le même que le pseudo existe ou non (hash factice), pour qu'on ne puisse pas le deviner au temps de réponse.
- **CSRF** :
  - en-tête `Origin` **obligatoire** et dans `SITE_URL` + `ALLOWED_ORIGINS` sur toute requête qui modifie des données ;
  - une fois connecté, en plus, `X-CSRF-Token` = HMAC(poivre, jeton de session), renvoyé par `GET /api/me`.
- SQL **uniquement paramétré** (`prepare().bind()`). Toutes les entrées sont validées côté serveur. Les identifiants de course sont contrôlés contre la liste réelle (`functions/_lib/race-ids.js`, générée au build).
- Pseudos toujours affichés via `textContent` ou échappés.
- **Suppression du compte** : `DELETE FROM users`. Les clés étrangères `ON DELETE CASCADE` effacent sessions, favoris, inscriptions, amitiés et blocages.

### Amis : contrôle d'accès
- Les données d'un utilisateur B ne sont envoyées à A que si **toutes** ces conditions sont vraies, vérifiées en SQL côté serveur (`functions/_lib/accounts/friends.js`, fonction `canView`) :
  1. une amitié **acceptée** existe entre A et B ;
  2. aucun blocage, dans un sens ou dans l'autre ;
  3. le réglage de B est « Mes amis ».
- Sinon : **404** (on ne révèle même pas l'existence du compte).
- Ajout par **pseudo exact** uniquement (pas de recherche partielle), ou par **code ami / lien d'invitation** régénérable. La réponse est identique, que le pseudo existe ou non.

### Coûts (plan gratuit)
D1 gratuit : 5 M lectures/jour, 100 000 écritures/jour, 5 Go. Un visiteur sans compte ne coûte **rien**. Un utilisateur connecté coûte ~1 lecture groupée par page et 1 écriture par lot de clics.

---

## 3. Tests
```bash
npm test          # logique + rappels + domaine + API comptes et amis (D1 locale en mémoire)
```
Les tests d'API (`tests/*.test.mjs`) utilisent `getPlatformProxy()` de Wrangler (vraie base D1 locale, migrations appliquées) et appellent directement les routeurs des Functions.
