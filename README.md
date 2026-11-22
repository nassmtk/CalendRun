# Allure — courses à pied Île-de-France 2027

~150 courses de janvier à décembre 2027. Projet **Vite** (JS vanilla + GSAP + Lenis + Three.js + Leaflet).

## Lancer
```
npm install      # une seule fois
npm run dev      # → http://localhost:5173
npm run build    # version de production dans dist/
npm run preview  # tester le build
```
⚠️ Double-cliquer sur `index.html` ou lancer `npx serve .` ne fonctionne plus : passe par Vite.

## Organisation
| Fichier | Rôle |
|---|---|
| `data/races.js` | Base des courses (inchangée par la refonte) |
| `config.js` | `WAITLIST_ENDPOINT` pour les alertes email |
| `src/main.js` | Point d'entrée : charge le CSS, les données, l'app, la couche motion, puis la 3D à la demande |
| `src/app.js` | Logique : filtres, vues, fiches, liens d'inscription, alertes. Expose `window.ALLURE` (hooks `beforeRender`, `afterRender`, `afterHero`, `openSheet`, `closeSheet`) |
| `src/styles/tokens.css` | **Design tokens** : couleurs, typo, rayons, ombres, easing, durées, z-index |
| `src/styles/main.css` | Tous les styles (n'utilise que les tokens) |
| `src/motion/flow.js` | Lenis + ScrollTrigger, intro du hero, compteurs, compte à rebours roulant, mini-barre, apparitions, FLIP, pastilles glissantes, CTA magnétiques, transition carte → fiche |
| `src/motion/cards.js` | Inclinaison 3D des cartes (ressort GSAP), favori façon kudos |
| `src/hero/index.js` | Choisit la scène WebGL (desktop) ou le repli SVG (mobile / reduced-motion) |
| `src/hero/scene.js` | Scène Three.js : la saison en ligne d'horizon de janvier à décembre (chargée seulement sur desktop) |
| `src/vendor-leaflet.js` | Leaflet, chargé seulement à l'ouverture de la vue Carte |

## Ajouter / modifier une course
Voir l'en-tête de `data/races.js`. Fiabilité des dates : `confirmed` (officielle) · `listed` (annoncée) · `estimated` (estimée).

## Alertes par email
Mode démo par défaut (stockage dans le navigateur). Renseigne `WAITLIST_ENDPOINT` dans `config.js` (Formspree, Make/Zapier/n8n, Brevo…).

## Déployer
`npm run build` puis publie `dist/` (Netlify : build command `npm run build`, publish dir `dist`).
