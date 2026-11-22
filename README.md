# CalendRun — courses à pied en Île-de-France 2027

Calendrier des ~150 courses à pied de Paris et d'Île-de-France en 2027 : dates, formats, liens d'inscription, favoris, courses inscrites, alertes e-mail.

**Stack** : Vite 6 · JavaScript vanilla · GSAP + Lenis (motion) · Three.js (hero, desktop) · Leaflet + markercluster (vue Carte) · Cloudflare Pages + Pages Functions · Brevo (e-mails) · Turnstile (anti-robot) · Umami (audience sans cookie).

---

## 1. Lancer en local
```bash
npm install
npm run dev            # http://127.0.0.1:5173 (ouvre le navigateur)
```
Autres commandes :

| Commande | Rôle |
|---|---|
| `npm run build` | build de production dans `dist/` (prebuild → vite build → postbuild) |
| `npm run preview` | sert `dist/` sur http://127.0.0.1:4173 |
| `npm run pages:dev` | build + site **et** fonctions serveur en local via Wrangler (http://127.0.0.1:8788) |
| `npm test` | tests de non-régression (filtres, vues, favoris/inscrites, liens, URL) |
| `npm run audit:links` | régénère `LINKS_AUDIT.md` (liens qui pointent vers un agrégateur) |
| `npm run qa:shots` | captures d'écran 1440 / 1024 / 390 px dans `qa/shots/` |
| `node scripts/qa-lighthouse.mjs <url> 5` | Lighthouse mobile ×5 (médiane) |

Ce que fait `npm run build` :
1. **prebuild** : favicons + manifest (depuis `brand.config.js`), `races.json`, `_headers` (CSP calculée selon les services actifs) ;
2. **vite build** : site, pages légales, 404, gabarit des pages course ;
3. **postbuild** : 149 pages `/courses/{slug}-2027/` (SEO + JSON-LD), images Open Graph, `sitemap.xml`, `robots.txt`.

---

## 2. Variables d'environnement
Modèle complet : [`.env.example`](.env.example). En local : `.env` (build) et `.dev.vars` (fonctions, `npm run pages:dev`). En production : *Cloudflare Pages > Settings > Environment variables* (Production **et** Preview).

| Variable | Où | Rôle |
|---|---|---|
| `SITE_URL` | build + fonctions | **domaine public** (sans `/` final) : canonical, sitemap, Open Graph, liens des e-mails. Changer de domaine = changer cette seule variable (+ la même dans le worker de rappels). |
| `ALERTS_ENABLED` | build + fonctions | `true` pour afficher et activer les alertes. Sinon : cloche et formulaire masqués, API en 503. |
| `TURNSTILE_SITE_KEY` | build | clé **publique** Turnstile |
| `UMAMI_SRC`, `UMAMI_WEBSITE_ID` | build | mesure d'audience Umami (vide = désactivée ; la CSP s'adapte) |
| `BREVO_API_KEY` 🔒 | fonctions + worker | clé API Brevo |
| `BREVO_LIST_ID`, `BREVO_DOI_TEMPLATE_ID` | fonctions + worker | liste « Alertes » et template double opt-in |
| `TURNSTILE_SECRET_KEY` 🔒 | fonctions | vérification Turnstile côté serveur |
| `UNSUB_SECRET` 🔒 | fonctions + worker | signature des liens de désinscription (même valeur des deux côtés) |
| `SENDER_EMAIL` | worker | expéditeur vérifié dans Brevo |
| `CONTACT_TO` | fonctions | destinataire du formulaire `/contact/` (défaut : `CONTACT_EMAIL`). Le formulaire a besoin de `BREVO_API_KEY` + `SENDER_EMAIL` ; sinon il propose d'envoyer le message par e-mail |
| `ALLOWED_ORIGINS` | fonctions | origines en plus de `SITE_URL` (ex. l'URL `*.pages.dev` de préproduction) |

🔒 = secret : à définir comme **secret chiffré**, jamais dans le code ni dans une variable lue au build.

---

## 3. Déployer (Cloudflare Pages)
1. Pousser le dépôt sur GitHub.
2. Cloudflare > *Workers & Pages > Create > Pages > Connect to Git* → choisir le dépôt.
3. Réglages de build : **Framework preset** `None` · **Build command** `npm run build` · **Output directory** `dist` · variable `NODE_VERSION` = `22`.
4. Définir les variables d'environnement (section 2). Au minimum : `SITE_URL`.
5. Déployer. Les fonctions de `functions/` (`/api/subscribe`, `/api/unsubscribe`) sont déployées automatiquement ; `_headers` et `_redirects` sont appliqués.
6. (recommandé) Namespace KV `RATE_LIMIT` pour la limitation par IP : voir [docs/ALERTES.md](docs/ALERTES.md).

Alternative en ligne de commande : `npx wrangler login` puis `npm run deploy`.

## 4. Brancher le domaine
1. *Pages > ton projet > Custom domains > Set up a domain* → saisir `ton-domaine.fr` (et `www.ton-domaine.fr`).
2. Si le domaine est géré par Cloudflare DNS, les enregistrements sont créés automatiquement ; sinon, ajouter chez le registrar le `CNAME` indiqué (vers `<projet>.pages.dev`).
3. Mettre `SITE_URL=https://ton-domaine.fr` puis **redéployer** (le sitemap, les canonical et les images OG sont générés au build).
4. Rediriger `www` → apex (ou l'inverse) via *Rules > Redirect rules* pour n'avoir qu'une URL canonique.
5. HTTPS est automatique. Le HSTS est envoyé par `_headers` (sans `preload` : à ajouter seulement après inscription sur hstspreload.org).

## 5. Alertes e-mail et DNS (SPF, DKIM, DMARC)
Tout est décrit dans **[docs/ALERTES.md](docs/ALERTES.md)** : compte Brevo, liste, template double opt-in, Turnstile, KV, worker de rappels (`workers/reminders`), enregistrements DNS SPF / DKIM / DMARC et vérification.

## 6. Mettre à jour les courses
Toutes les données sont dans [`data/races.js`](data/races.js) :
- **grandes courses** (`window.RACES`) : fiche complète (dénivelé, prix, liens, tagline) ;
- **reste du calendrier** (`window.RACES_COMPACT`) : une ligne par course `[date, dateFin, nom, ville, type, distances, slug, options]` ; la ville doit exister dans `window.CITIES`.

Champs utiles :
- `dateStatus` : `confirmed` (date officielle) · `listed` (annoncée par les calendriers) · `estimated` (déduite) ;
- `registration.status` : `open` · `soon` · `lottery` · `closed` · `check` ;
- `registration.url` (inscription directe), `preUrl` (pré-inscription), `info` (page de la course), `opens` / `closes` (`AAAA-MM-JJ` : le statut se met à jour seul, et l'alerte d'ouverture part ce jour-là).

Après modification : `npm test` puis `npm run audit:links`, commit, push → Cloudflare redéploie. L'`id` d'une course définit son URL publique (`/courses/{id}-2027/`) : **ne le change pas** une fois en ligne (ou ajoute une redirection dans `public/_redirects`).

## 7. Marque
Nom, accroche, sous-titre (`{count}` calculé), couleurs et pictogramme du logo (`logoSvg`), éditeur (`PUBLISHER_NAME`), adresses `CONTACT_EMAIL` / `COURSES_EMAIL`, date de mise à jour des pages légales (`LEGAL_UPDATED_AT`) : **[`brand.config.js`](brand.config.js)**. Les adresses e-mail ne sont jamais écrites en clair dans le HTML ni le JS : elles sont assemblées au chargement par `src/mail.js`. Les couleurs et typos du site : `src/styles/tokens.css` (thème sombre dans `:root`, thème clair dans `:root[data-theme="light"]`, bouton jour / nuit : `src/theme.js`).

## Organisation
```
brand.config.js        config de marque (source unique)
data/races.js          données des courses
index.html             accueil · mentions-legales/ · confidentialite/ · 404.html · alertes/ · course-template.html
src/app.js             logique : filtres, vues, fiches, favoris, inscrites, alertes, URL
src/motion/            animations (GSAP, Lenis), cartes 3D, compte à rebours partagé
src/hero/              hero : barres 3D (Three.js) ou repli SVG
src/ui/drawer.js       tiroirs mobiles, menu des départements
src/styles/            tokens, styles, pages secondaires, polices
functions/             Cloudflare Pages Functions (/api/subscribe, /api/unsubscribe, /api/contact)
workers/reminders/     worker planifié d'envoi des alertes
scripts/               build (prebuild/postbuild, OG, headers) + QA (tests, captures, Lighthouse)
docs/ALERTES.md        alertes e-mail + DNS
SECURITY.md            en-têtes, audit sécurité
LINKS_AUDIT.md         liens d'inscription vers des agrégateurs
LAUNCH_CHECKLIST.md    ce qui est fait / ce qu'il reste à faire avant la mise en ligne
```
