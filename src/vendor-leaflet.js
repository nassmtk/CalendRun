// Leaflet + clustering, exposés en global (app.js utilise window.L). Chargés seulement à l'ouverture de la vue Carte.
import "leaflet/dist/leaflet.css";
import L from "leaflet";

window.L = L;
// le plugin s'appuie sur window.L : on le charge une fois L exposé
export const ready = import("leaflet.markercluster").then(() => L);
export default L;
