# calendrun-mailer

Worker qui envoie les messages du formulaire `/contact/` vers `calendrun@gmail.com`
via **Cloudflare Email Routing** (binding `send_email`, gratuit).

Pourquoi un Worker séparé : les Pages Functions ne gèrent pas le binding `send_email`.
`functions/api/contact.js` (Origin, limitation IP, champ piège, validation, Turnstile) appelle
ce Worker par le service binding `MAILER` déclaré dans le `wrangler.toml` racine.

```
navigateur → POST /api/contact (Pages Function) → env.MAILER.fetch("/contact") → ce Worker → send_email → Gmail
```

- Expéditeur : `formulaire@calend.run` (Email Routing doit être actif sur le domaine ; aucune boîte à créer).
- Destinataire : `calendrun@gmail.com`, figé par `destination_address`, et qui doit être **vérifié** dans Email Routing.
- `Reply-To` = l'adresse du visiteur : « Répondre » dans Gmail lui écrit directement.
- Aucune URL publique (`workers_dev = false`) : seul le site peut l'appeler.
- Le Worker revalide les champs et n'écrit jamais `\r` / `\n` dans un en-tête (`mime.js`).

## Déployer

```sh
npx wrangler login                                        # une fois
npx wrangler deploy --config workers/mailer/wrangler.toml
```

Puis redéployer le site pour que le service binding `MAILER` soit pris en compte
(le Worker doit exister avant).

## Tester

`node --test tests/contact.test.mjs` (inclus dans `npm test`). Après déploiement : envoyer un
message depuis https://calend.run/contact/ et regarder les logs avec
`npx wrangler tail calendrun-mailer`.
