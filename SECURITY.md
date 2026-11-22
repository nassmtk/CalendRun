# Sécurité — état et audit

## En-têtes HTTP
Générés au build par `scripts/gen-headers.mjs` → `dist/_headers` (Cloudflare Pages). La CSP n'autorise que les services réellement activés.

| En-tête | Valeur |
|---|---|
| Content-Security-Policy | `default-src 'self'` · scripts : self + Turnstile (+ Umami si activé) · styles : self, `style-src-attr 'unsafe-inline'` · polices : self · images : self, data, blob, tuiles OSM · connect : self + Turnstile (+ Umami) · frames : Turnstile · `object-src 'none'` · `base-uri 'self'` · `form-action 'self'` · `frame-ancestors 'none'` · `upgrade-insecure-requests` |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains` (ajouter `preload` seulement après inscription sur hstspreload.org) |
| X-Content-Type-Options | `nosniff` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Permissions-Policy | caméra, micro, géolocalisation, paiement, USB, capteurs, topics : tous désactivés |
| X-Frame-Options | `DENY` (doublon historique de `frame-ancestors 'none'`) |
| Cross-Origin-Opener-Policy | `same-origin` |

**Note CSP** : `style-src-attr 'unsafe-inline'` est nécessaire car le JS rend des attributs `style="--c:…"` (couleur de catégorie, variables CSS). Les **scripts** restent stricts : aucun script inline (vérifié dans `dist/*.html`), aucun `eval`.

Les réponses de `/api/*` (Functions) ne reçoivent pas `_headers` : elles posent elles-mêmes `nosniff`, `Referrer-Policy`, une CSP `default-src 'none'`, `no-store` et `noindex` (`functions/_lib/util.js`).

Vérifié localement (wrangler, copie statique de `dist`) : en-têtes présents, **aucune violation CSP** dans la console sur l'accueil, la carte, la fiche et la 404.

## Formulaire d'alerte (`/api/subscribe`)
- validation serveur (format e-mail, id de course, types d'alerte, consentement, taille du corps ≤ 4 Ko) ;
- contrôle d'origine (`SITE_URL` + `ALLOWED_ORIGINS`) ;
- limitation par IP : 5 requêtes / 10 min (KV `RATE_LIMIT`, sinon mémoire de l'isolat) ;
- champ piège (`website`) : un robot qui le remplit reçoit la réponse générique, rien n'est fait ;
- Cloudflare Turnstile vérifié côté serveur ;
- **réponse toujours générique** (« si l'adresse est valide… ») : impossible de savoir si une adresse est déjà inscrite ;
- désinscription par jeton HMAC-SHA256 (comparaison à temps constant), même redirection quel que soit le résultat.

Testé localement : 405 (GET), 400 (validation), 403 (origine), 200 générique (champ piège, envoi valide), 429 (limite atteinte).

## Secrets
Aucun secret dans le bundle front : seules `SITE_URL`, `ALERTS_ENABLED`, `TURNSTILE_SITE_KEY` (publique) et `UMAMI_*` sont injectées au build. Contrôle `grep` de `dist/` : aucune clé trouvée. Les secrets (`BREVO_API_KEY`, `TURNSTILE_SECRET_KEY`, `UNSUB_SECRET`) ne vivent que dans les variables Cloudflare (Pages + worker). `.env`, `.dev.vars` sont ignorés par git.

## Injection HTML
27 usages de `innerHTML`, tous revus :
- les données des courses passent par `esc()` (noms, villes, libellés, tags) ; les ids et types viennent du fichier de données (slugs `[a-z0-9-]`) ;
- les seules entrées utilisateur sont l'e-mail (échappé à l'affichage), la recherche (jamais réinjectée en HTML, seulement dans `input.value`) et les paramètres d'URL `view`, `dep`, `list`, `q` (listes blanches, ou valeur de champ) ;
- `#c/<id>` ne sert qu'à retrouver une course existante.

## Liens externes
Tous les liens `target="_blank"` portent `rel="noopener noreferrer"`.

## Dépendances (`npm audit`)
- **0 vulnérabilité haute ou critique.**
- 2 modérées : `fflate` via `satori` (génération des images Open Graph **au build**, sur nos propres polices, jamais livré au navigateur). La correction automatique imposerait une version de satori incompatible : risque accepté et documenté.
- Aucune dépendance inutilisée : runtime = gsap, lenis, three, leaflet, leaflet.markercluster, @fontsource/* ; dev = vite, wrangler, satori, @resvg/resvg-js, puppeteer-core, lighthouse, jsdom.
