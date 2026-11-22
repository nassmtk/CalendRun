/*
 * Configuration du site
 * ---------------------
 * WAITLIST_ENDPOINT : URL qui reçoit les inscriptions aux alertes (POST JSON).
 *   Compatible tel quel avec Formspree (https://formspree.io/f/xxxx), un webhook Make/Zapier/n8n,
 *   une Edge Function Supabase, etc. Payload envoyé :
 *   { email, raceId, raceName, raceDate, alerts: ["opening","reminder"], createdAt }
 *
 *   Laisse vide → mode démo : les alertes sont stockées dans le navigateur (localStorage) uniquement.
 */
window.SITE_CONFIG = {
  WAITLIST_ENDPOINT: "",
  SITE_NAME: "Allure",
  YEAR: 2027
};
