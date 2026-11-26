// Worker « calendrun-mailer » : envoie les messages du formulaire de contact via
// Cloudflare Email Routing (binding send_email). Voir README.md de ce dossier.
import { EmailMessage } from "cloudflare:email";
import { createHandler } from "./handler.js";

export default { fetch: createHandler(EmailMessage) };
