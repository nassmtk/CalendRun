# Checklist de mise en ligne

Branche git : `launch` (lancement), puis `v3-comptes` (domaine, mobile, comptes, amis — une phase = un commit). Relevé du 23/11/2026.

## ✅ Ce qui est fait

### Phase 1 — Favoris / Inscrites
- [x] Favoris et Inscrites ignorent les filtres de la liste principale (mois, catégorie, départements, interrupteurs)
- [x] Filtres de la liste principale sauvegardés puis restaurés à l'identique en revenant sur « Toutes les courses »
- [x] Filtres locaux possibles dans Favoris / Inscrites, remis à zéro à chaque entrée
- [x] État vide intelligent : « N courses masquées par tes filtres » + « Tout afficher »
- [x] À venir d'abord, « Terminées » repliées
- [x] Autres vues pouvant finir vides vérifiées (recherche, départements de l'URL, mois + dates officielles) : même état vide intelligent

### Phase 2 — Marque & hero
- [x] `brand.config.js` : SITE_NAME, TAGLINE (« Cours où tu veux en Île-de-France. »), SUBTAGLINE (« {count} courses. Un seul calendrier. »), couleurs du logo ; `SITE_URL` via variable d'env
- [x] Plus aucun nom de marque en dur (titre, header, footer, meta, OG, manifest, e-mails, .ics)
- [x] Hero : 12 barres (1 par mois) empilées par catégorie, caméra quasi fixe figée au survol, zones de survol élargies, info-bulle ancrée « Mars · 34 courses » + répartition, clic = filtre du mois + défilement, 12 boutons focusables (Entrée = clic)
- [x] Mobile / hover:none / reduced-motion : version décorative SVG sans interaction ; Three.js n'est même pas téléchargé
- [x] Pause hors écran, DPR ≤ 1,5, chargement différé ; nouvelle légende

### Phase 3 — Légal & RGPD
- [x] `/mentions-legales` et `/confidentialite` complétées (éditeur particulier, art. 1-1 LCEN, hébergeur Cloudflare, conservation 12 mois, Umami UE) — valeurs dans `brand.config.js`
- [x] Purge RGPD automatique : le worker de rappels supprime les contacts 12 mois après leur dernière course ; la désinscription supprime le contact
- [x] « Proposer une course » + « Signaler une erreur » (fiche et page course) : mailto pré-remplis, adresses assemblées en JS (jamais en clair dans le HTML)
- [x] Nouveau logo calendrier + coureur (favicons, manifest, OG régénérés)
- [x] Bouton jour / nuit (thème clair complet, contrastes AA, choix mémorisé, sans flash au chargement)
- [x] Page `/contact/` : formulaire → `/api/contact` (Brevo), champ piège, Turnstile, limitation IP ; repli e-mail pré-rédigé tant que Brevo n'est pas branché
- [x] Case de consentement non pré-cochée, double opt-in, désinscription en un clic dans chaque e-mail
- [x] Favoris / inscrits en localStorage uniquement, sans compte, sans pistage
- [x] Umami (sans cookie) branché, activé seulement si `UMAMI_*` est défini → **pas de bandeau cookies**
- [x] **Aucun cookie** déposé par le site (Google Fonts supprimé, polices auto-hébergées)
- [x] Footer : liens légaux + « Dates et infos indicatives — vérifie toujours sur le site officiel de l'organisateur »
- [x] `LINKS_AUDIT.md` : liens vers des agrégateurs (lecture seule)

### Phase 4 — Alertes mail
- [x] `/api/subscribe` (Cloudflare Pages Function) → Brevo double opt-in ; `/api/unsubscribe` signé HMAC
- [x] Worker planifié `workers/reminders` : rappel J-7 + alerte d'ouverture (si la date d'ouverture est connue)
- [x] `ALERTS_ENABLED=false` par défaut : **aucun faux formulaire** en production
- [x] Config DNS SPF / DKIM / DMARC documentée ([docs/ALERTES.md](docs/ALERTES.md))

### Phase 5 — Sécurité
- [x] `_headers` : CSP stricte (calculée selon les services actifs), HSTS, nosniff, Referrer-Policy, Permissions-Policy, `frame-ancestors 'none'`, COOP
- [x] Formulaire : validation serveur, limitation par IP, champ piège, Turnstile, réponses génériques (testé : 400 / 403 / 405 / 429 / 200 générique)
- [x] Aucun secret dans le bundle (vérifié), `rel="noopener noreferrer"` partout, `innerHTML` revus, `npm audit` : 0 haute/critique
- [x] Détails : [SECURITY.md](SECURITY.md)

### Phase 6 — SEO
- [x] 149 pages statiques `/courses/{slug}-2027/` : title/description uniques, canonical, JSON-LD `SportsEvent`
- [x] La fiche du site utilise cette URL (partageable)
- [x] Images Open Graph par course + accueil, `sitemap.xml` (152 URL), `robots.txt`, `lang="fr"`
- [x] Page 404 avec recherche et lien vers le calendrier
- [x] Favicons SVG + PNG, apple-touch-icon, manifest

### Phase 7 — Perf, accessibilité, QA
- [x] Polices auto-hébergées (sous-ensemble latin) + preload ; 3D et carte chargées en différé
- [x] Contraste AA, focus visibles, clavier complet (barre du haut, hero, filtres, onglets, cartes), `aria-label` sur les boutons en icône seule
- [x] QA visuelle 1440 / 1024 / 390 px : accueil, filtres + changement de vue, Favoris/Inscrites avec un mois sélectionné, fiche, page course, 404, pages légales, formulaire d'alerte — **aucune erreur console**

### Phase 8 — Déploiement
- [x] `wrangler.toml`, `_headers`, `_redirects`, `.env.example`, README (local, variables, déploiement, domaine, DNS mail, données)
- [x] `SITE_URL` unique pour canonical, sitemap, OG, e-mails (repli automatique sur l'URL `*.pages.dev` si oublié)

---

### v3 — Domaine calend.run, mobile, comptes & amis (branche `v3-comptes`)
- [x] Domaine `calend.run` partout (config, Functions, worker, docs) ; adresses `contact@` / `courses@` / `alertes@calend.run` issues de `brand.config.js`, jamais en clair dans le build (`scripts/test-domain.mjs`)
- [x] `Origin` désormais obligatoire sur toutes les requêtes qui modifient des données
- [x] Bug mobile des départements corrigé (tiroir piégé dans le `transform` de la barre du haut) : bottom sheet 2 colonnes, cibles ≥ 44 px, « Effacer » / « Voir les X courses », glisser / fond / Échap, scroll bloqué puis rendu
- [x] Barre du haut mobile sur une ligne : logo, Départements, « J-41 », menu compact (Favoris, Inscrites, Contact, thème, compte) — QA Playwright iOS Safari + Android Chrome à 360 / 390 / 430 px (`npm run qa:mobile`)
- [x] Comptes pseudo + mot de passe sans e-mail (D1), code de récupération, sessions `__Host-`, CSRF, rate limit, Mon compte (mot de passe, code, visibilité, export JSON, suppression réelle), confidentialité mise à jour — [docs/COMPTES.md](docs/COMPTES.md)
- [x] Amis : demandes par pseudo exact ou lien d'invitation, accepter / refuser / retirer / bloquer, visibilité contrôlée côté serveur, avatars sur les cartes et les fiches, filtre « Courses de mes potes », profil d'un ami
- [x] Tests : 23 tests d'API sur D1 locale (dont IDOR, blocage, cascade, purge) + QA navigateur comptes (29) et amis (24) ; QA visuelle 1440 / 1024 / 390 / 360 px, aucune erreur console
- [ ] `npm audit` : 2 failles modérées connues dans `satori` → `fflate` (outil de build des images OG, n'ouvre aucun fichier externe). Le correctif proposé rétrograde `satori` (changement cassant) : à revoir quand `satori` publie une version corrigée

## 🧑‍💻 Ce que TU dois faire à la main

### Comptes & amis (docs/COMPTES.md)
- [x] **Créer la base D1** : `npx wrangler login` puis `npx wrangler d1 create calendrun` → noter le `database_id`
- [x] **Ajouter le binding `DB`** (production + préproduction, `wrangler.toml`) : décommenter le bloc `[[d1_databases]]` de `wrangler.toml` et y coller le `database_id` (ou *Pages > Settings > Bindings > D1*, variable `DB`, Production + Preview, si le tableau de bord le permet)
- [x] **Appliquer les migrations** : `npx wrangler d1 migrations apply calendrun --remote` (et `--local` pour le dev). À refaire à chaque nouveau fichier dans `/migrations`, avant le déploiement
- [ ] **Secrets `AUTH_PEPPER` et `TURNSTILE_SECRET_KEY`** (tableau de bord Pages, Production + Preview — jamais dans le code) : `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. ⚠️ Ne jamais le changer ensuite ; en garder une copie dans ton gestionnaire de mots de passe
- [x] **`ACCOUNTS_ENABLED=true`** et `TURNSTILE_SITE_KEY` : `wrangler.toml` (`[vars]` + `[env.preview.vars]`) avec repli dans `brand.config.js` pour le build
- [ ] **Turnstile** : si `TURNSTILE_SECRET_KEY` est défini, l'inscription l'exige → vérifier que `TURNSTILE_SITE_KEY` est bien défini aussi (sinon personne ne peut s'inscrire)
- [ ] **Worker de rappels** : décommenter le binding D1 dans `workers/reminders/wrangler.toml` (même `database_id`) et redéployer → purge quotidienne des comptes inactifs depuis 3 ans
- [ ] Test en production : créer un compte, noter le code, se déconnecter, « Mot de passe oublié » avec le code, ajouter un ami depuis un 2ᵉ navigateur, vérifier les avatars sur la carte de course, supprimer les comptes de test

### Avant la mise en ligne
- [ ] **Créer les boîtes `contact@calend.run`, `courses@calend.run` (et l'expéditeur `alertes@calend.run` dans Brevo)** — voir « Tester les e-mails » ci-dessous
- [ ] **Communiquer tes éléments d'identification à Cloudflare** (nom, adresse, téléphone dans le profil du compte) : c'est la condition de l'adresse « non publiée » (art. 1-1 LCEN)
- [ ] **Formulaire de contact** : il fonctionne dès que `BREVO_API_KEY` et `SENDER_EMAIL` sont définis dans Cloudflare Pages (compte Brevo + domaine expéditeur vérifié, voir docs/ALERTES.md étapes 1, 4, 5). Avant ça, il propose l'envoi par e-mail
- [ ] **Umami Cloud** : choisir la région **UE** à la création du site (la politique de confidentialité l'annonce)
- [ ] À chaque modification des pages légales : mettre à jour `LEGAL_UPDATED_AT` dans `brand.config.js`
- [x] Nom de domaine : **calend.run**
- [ ] Définir `SITE_URL=https://calend.run` dans Cloudflare Pages (Production **et** Preview) et `ALLOWED_ORIGINS=https://calendrun.pages.dev` pendant la transition
- [ ] **Brancher le domaine** `calend.run` + `www.calend.run` (README §4)
- [ ] **Redirect Rule** `www.calend.run` → `calend.run` en 301 (README §4.4) — vérifier : `curl -sI https://www.calend.run/carte` → `301` + `location: https://calend.run/carte`
- [ ] **Bulk Redirect** `calendrun.pages.dev` → `calend.run` en 301 (README §4.5) — vérifier : `curl -sI https://calendrun.pages.dev/mentions-legales/` → `301`
- [ ] Google Search Console : déclarer `calend.run` (pas l'URL `pages.dev`)
- [ ] Vérifier les **liens d'inscription** (section ci-dessous)

### Pour activer les alertes e-mail (optionnel au lancement)
- [ ] Compte **Brevo** : liste « Alertes », attributs `ALERT_RACES` + `CONSENT_AT`, template double opt-in, clé API
- [ ] **DNS mail** du domaine : code Brevo, SPF, DKIM (×2), DMARC (`p=none` au départ) — [docs/ALERTES.md](docs/ALERTES.md)
- [ ] **Turnstile** : créer le widget → `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`
- [ ] **KV** `RATE_LIMIT` (limitation par IP) lié au projet Pages
- [ ] `UNSUB_SECRET` (aléatoire, identique Pages + worker), `ALERTS_ENABLED=true`, redéployer
- [ ] Déployer le **worker de rappels** (`workers/reminders/wrangler.toml` : `SITE_URL`, `BREVO_LIST_ID`, `SENDER_EMAIL`, secrets)
- [ ] Tester le parcours complet avec ta propre adresse : inscription → mail de confirmation → désinscription

### Après la mise en ligne
- [ ] **Umami Cloud** : créer le site → `UMAMI_SRC` + `UMAMI_WEBSITE_ID`, redéployer
- [ ] **Google Search Console** : ajouter le domaine (vérification DNS), soumettre `https://calend.run/sitemap.xml`
- [ ] (optionnel) Bing Webmaster Tools, même sitemap
- [ ] Tester les en-têtes sur https://securityheaders.com et les aperçus de partage (Open Graph) sur un réseau social
- [ ] Relancer Lighthouse sur l'URL de production
- [ ] Fusionner la branche `launch` dans `main` et pousser sur GitHub

---

### 📬 Tester les e-mails
1. Cloudflare > zone `calend.run` > **Email > Email Routing** > *Enable* (Cloudflare ajoute les enregistrements MX et SPF : accepter).
2. *Destination addresses* > ajouter ta boîte perso, puis cliquer le lien de vérification reçu.
3. *Routing rules* > créer `contact@calend.run` et `courses@calend.run` → ta boîte vérifiée (statut *Active*).
4. Depuis une adresse **externe** (ex. un autre fournisseur que ta boîte de destination), envoyer un mail de test à chacune des deux adresses → vérifier qu'il arrive (et pas en spam).
5. Sur **ordinateur puis téléphone**, cliquer chaque bouton mailto du site et vérifier que le mail s'ouvre vers la bonne adresse, avec le bon objet et le bon corps, puis qu'il arrive :
   - [ ] pied de page « Contact » → `contact@calend.run` (sans objet)
   - [ ] mentions légales / confidentialité (adresse affichée) → `contact@calend.run`
   - [ ] « Proposer une course » (bas de l'accueil) → `courses@calend.run`, objet « Proposer une course — [nom] », corps avec Nom / Date / Ville / Distances / Lien / Organisateur
   - [ ] fiche d'une course > « Signaler une erreur » → `courses@calend.run`, objet « Signaler une erreur — <nom de la course> », corps avec le lien de la fiche
   - [ ] page course statique (`/course/…`) > « Signaler une erreur » → idem
   - [ ] page Contact, repli « envoyer par e-mail » (tant que Brevo n'est pas branché) → `contact@calend.run`
6. Brevo : l'expéditeur `alertes@calend.run` doit être vérifié (domaine authentifié, docs/ALERTES.md) avant d'activer les alertes et le formulaire de contact.

## 🔗 Liens à vérifier
1. **140 / 149 courses** ont un lien principal vers un agrégateur (135 vers running.life) au lieu du site de l'organisateur. Liste complète : **[LINKS_AUDIT.md](LINKS_AUDIT.md)**.
2. Liens officiels des grandes courses repérés en recherche mais **pas ouverts un par un** — à cliquer avant le lancement :
   - Marathon de Paris : https://www.asicsmarathondeparis.com
   - Semi de Paris : https://www.semideparis.com
   - EcoTrail Paris : https://www.ecotrailparis.com
   - Paris-Versailles : https://www.parisversailles.com/site/
   - 20 km de Paris : https://harmonie-mutuelle.20kmparis.com
   - 10K Paris (adidas) : https://www.adidas10kparis.fr/en/participate/register
   - La Parisienne : https://www.la-parisienne.net
   - Semi de Boulogne : https://www.semi-marathonbb.fr
   - Corrida de Noël d'Issy : https://www.corrida-noel-issy.com
3. Dates **estimées** à reconfirmer quand les organisateurs publient : Grand Paris Sud, 10 km Lagardère, semi de Boulogne, Cross du Figaro, Corrida d'Issy.

---

## 📊 Scores Lighthouse (mobile, médiane de plusieurs passages, build de production servi en local)

| Page | Performance | Accessibilité | Bonnes pratiques | SEO |
|---|---|---|---|---|
| Accueil — **avant** (début de l'itération) | 56 | 85 | 100 | 91 |
| Accueil — **après** | **88** | 100 | 100 | 100 |
| Page course (`/courses/paris-versailles-2027/`) — après | 100 | 100 | 100 | 100 |

Métriques de l'accueil après : FCP 0,79 s · LCP 0,79 s · TBT 0,48 s · CLS 0 · Speed Index 2,3 s (avant : FCP/LCP 2,9 s, Speed Index 5,4 s).

Notes :
- « avant » : TBT ≈ 160 s mesuré (travail continu du thread principal causé par les 149 cartes), CLS 0,005 ; le SEO perdait des points faute de `robots.txt`.
- Les mesures locales varient d'une série à l'autre (charge de la machine) : la performance de l'accueil a oscillé entre **84 et 93** selon les séries ; la dernière série (5 passages) donne 88. **L'objectif ≥ 90 n'est donc pas garanti sur l'accueil** : à remesurer sur l'URL de production (CDN Cloudflare, sans les serveurs de dev en parallèle).
- Le poste restant est le temps de blocage au démarrage (TBT ≈ 0,3–0,6 s en CPU mobile simulé) : la couche d'animation est déjà chargée après le premier affichage (25 Ko de JS critique compressé).
