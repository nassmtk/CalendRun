# Alertes e-mail — Brevo + Cloudflare

## Fonctionnement
```
Formulaire (fiche course)  ──POST /api/subscribe──▶  Pages Function
  case de consentement            validation serveur, champ piège, limitation IP (KV),
  Turnstile                       Turnstile, réponse toujours générique
                                       │
                                       ▼
                              Brevo — double opt-in : e-mail de confirmation (template DOI)
                              → le contact rejoint la liste « Alertes » une fois confirmé
                                attribut ALERT_RACES = "paris-versailles:opening+reminder,…"

Worker « calendrun-reminders » (cron quotidien 7h UTC)
  lit {SITE_URL}/races.json + les contacts confirmés de la liste
  → J-7 : rappel avant la course
  → jour J d'ouverture des inscriptions (si `registration.opens` est connu dans les données)
  chaque e-mail : lien de désinscription en un clic + en-têtes List-Unsubscribe (RFC 8058)

  → purge RGPD : supprime de Brevo les contacts 12 mois après la date de leur dernière course
    (ou 12 mois après CONSENT_AT si la course n'existe plus) — tourne même si ALERTS_ENABLED=false

Lien de désinscription  ──GET/POST /api/unsubscribe?e=…&t=HMAC──▶ suppression du contact dans Brevo
```
Les alertes « ouverture des inscriptions » pour les courses dont la date d'ouverture n'est pas
dans les données restent à envoyer **à la main** (campagne Brevo ciblée sur l'attribut `ALERT_RACES`).

Tant que `ALERTS_ENABLED` n'est pas à `true`, la cloche et le formulaire sont **masqués** du site
et `/api/subscribe` répond 503 : aucun faux formulaire en production.

## Mise en place (une fois)
1. **Compte Brevo** (gratuit : 300 e-mails/jour) → *Contacts > Listes* : créer une liste « Alertes » → noter son id (`BREVO_LIST_ID`).
2. *Contacts > Paramètres > Attributs* : créer `ALERT_RACES` (texte) et `CONSENT_AT` (texte).
3. *Templates* : créer un template de **double opt-in** (bouton contenant la balise `{{ doubleoptin }}`) → noter son id (`BREVO_DOI_TEMPLATE_ID`).
4. *SMTP & API > Clés API* : créer une clé → `BREVO_API_KEY` (secret).
5. **Domaine expéditeur** : *Expéditeurs, domaines et IP dédiées > Domaines* → ajouter ton domaine et créer les enregistrements DNS ci-dessous. Ajouter l'expéditeur `SENDER_EMAIL` (ex. `alertes@ton-domaine.fr`).
6. **Turnstile** (tableau de bord Cloudflare > Turnstile) : ajouter le domaine → `TURNSTILE_SITE_KEY` (public) et `TURNSTILE_SECRET_KEY` (secret).
7. **KV** (recommandé, limitation par IP) : `npx wrangler kv namespace create RATE_LIMIT` puis lier le namespace au projet Pages sous le nom `RATE_LIMIT` (*Settings > Functions > KV namespace bindings*).
8. `UNSUB_SECRET` : une longue chaîne aléatoire (ex. `openssl rand -hex 32`), **identique** côté Pages et côté worker.
9. Passer `ALERTS_ENABLED=true` (Pages **et** worker), redéployer.
10. Worker de rappels :
    ```
    npx wrangler secret put BREVO_API_KEY --config workers/reminders/wrangler.toml
    npx wrangler secret put UNSUB_SECRET  --config workers/reminders/wrangler.toml
    # renseigner SITE_URL, BREVO_LIST_ID, SENDER_EMAIL, ALERTS_ENABLED dans workers/reminders/wrangler.toml
    npx wrangler deploy --config workers/reminders/wrangler.toml
    ```

## DNS du domaine d'envoi (SPF, DKIM, DMARC)
Les **valeurs exactes** sont affichées par Brevo à l'étape 5 : copie-les telles quelles chez ton registrar / dans Cloudflare DNS.

| Type | Nom | Valeur (exemple — prends celle de Brevo) | Rôle |
|---|---|---|---|
| TXT | `@` | `brevo-code:xxxxxxxxxxxxxxxx` | preuve de propriété du domaine |
| TXT | `@` | `v=spf1 include:spf.brevo.com ~all` | **SPF** : autorise Brevo à envoyer pour ton domaine. ⚠️ un seul enregistrement SPF par domaine : si tu en as déjà un, ajoute seulement `include:spf.brevo.com` dedans |
| CNAME | `brevo1._domainkey` | `b1.ton-domaine-fr.dkim.brevo.com` | **DKIM** : signature des e-mails |
| CNAME | `brevo2._domainkey` | `b2.ton-domaine-fr.dkim.brevo.com` | **DKIM** (clé de rotation) |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@ton-domaine.fr` | **DMARC** : obligatoire pour Gmail/Yahoo. Commence en `p=none`, passe à `p=quarantine` après 2–4 semaines de rapports propres |

Vérifie ensuite dans Brevo que le domaine est « authentifié », puis envoie-toi un test et contrôle les en-têtes (`spf=pass`, `dkim=pass`, `dmarc=pass`).

## Tester en local
```
cp .env.example .dev.vars   # remplir avec des valeurs de test
npm run pages:dev           # site + fonctions sur http://127.0.0.1:8788
node scripts/test-reminders.mjs
```
Clés de test Turnstile (toujours valides) : site key `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`.
