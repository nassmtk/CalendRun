/* =========================================================
   Liens e-mail anti-spam
   Le HTML statique ne contient jamais d'adresse : seulement
   <a href="/mentions-legales/#contact" data-mail="contact|courses" [data-mail-tpl] [data-mail-show]>.
   Ici, l'adresse est assemblée (parties inversées fournies par virtual:brand),
   puis le lien devient un vrai mailto (objet + corps pré-remplis selon le modèle).
   Les liens ajoutés plus tard (fiche course) sont traités au survol, au focus et au clic.
   ========================================================= */
import { BRAND, MAIL } from "virtual:brand";

const rev = (s) => [...s].reverse().join("");
const address = (key) => (MAIL[key] ? MAIL[key].map(rev).join("@") : "");

const TEMPLATES = {
  propose: () => ({
    subject: "Proposer une course — [nom]",
    body: [
      "Bonjour,", "", `Je vous propose une course à ajouter sur ${BRAND.SITE_NAME} :`, "",
      "Nom de la course : ",
      "Date : ",
      "Ville + département : ",
      "Distances : ",
      "Lien officiel : ",
      "Organisateur : ", "", "Merci !"
    ].join("\n")
  }),
  error: (el) => ({
    subject: `Signaler une erreur — ${el.dataset.name || "fiche course"}`,
    body: [
      "Bonjour,", "", "Je signale une erreur sur cette fiche :", "",
      `Course : ${el.dataset.name || ""}`,
      `Fiche : ${el.dataset.url || location.href}`, "",
      "Ce qui est faux ou manquant : ", "",
      "La bonne information (et sa source si possible) : ", ""
    ].join("\n")
  }),
  "error-general": () => ({
    subject: `Signaler une erreur — ${BRAND.SITE_NAME}`,
    body: ["Bonjour,", "", "Page ou course concernée : ", "", "Ce qui est faux ou manquant : ", ""].join("\n")
  })
};

export function hydrateMail(el) {
  if (!el || el.dataset.mailReady) return;
  const to = address(el.dataset.mail);
  if (!to) return;
  const tpl = TEMPLATES[el.dataset.mailTpl];
  const t = tpl ? tpl(el) : null;
  const q = t ? `?subject=${encodeURIComponent(t.subject)}&body=${encodeURIComponent(t.body)}` : "";
  el.href = `mailto:${to}${q}`;
  if (el.hasAttribute("data-mail-show")) el.textContent = to;
  el.dataset.mailReady = "1";
}

export function hydrateAll(root = document) {
  root.querySelectorAll("a[data-mail]").forEach(hydrateMail);
}

// liens présents au chargement
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => hydrateAll(), { once: true });
else hydrateAll();

// liens injectés ensuite (fiche course) : avant que le navigateur suive le lien
const late = (e) => {
  const a = e.target instanceof Element ? e.target.closest("a[data-mail]") : null;
  if (a) hydrateMail(a);
};
["pointerover", "focusin", "click"].forEach((t) => document.addEventListener(t, late, true));
