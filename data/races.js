/*
 * Base de données des courses — Île-de-France 2027
 * ------------------------------------------------
 * Sources (relevé du 21/11/2026) :
 *   - paris.fr « L'agenda des courses parisiennes 2027 » (mise à jour 19/11/2026) → dateStatus "confirmed"
 *   - sites officiels des organisateurs / presse (Marathon, Semi, EcoTrail, Grand Paris…) → "confirmed"
 *   - calendrier running.life (dates publiées) → "listed"  (badge « Date annoncée »)
 *   - déduites des éditions précédentes → "estimated"     (badge « Date estimée »)
 *
 * registration.status : "open" | "soon" | "lottery" | "closed" | "check" | "unknown"
 *   url    → lien direct d'inscription (bouton « S'inscrire »)
 *   preUrl → page de pré-inscription / alerte de l'organisateur (bouton « Pré-inscription »)
 *   info   → page de la course (organisateur ou calendrier) qui renvoie vers l'inscription
 * Si aucun lien n'est connu, le site génère un lien de recherche + l'alerte email intégrée.
 */

/* ------------------------------------------------------------------
 * 1) Les grandes courses — fiches complètes
 * ------------------------------------------------------------------ */
window.RACES = [
  {
    id: "10k-montmartre", name: "10K Montmartre", sponsor: "AG2R La Mondiale",
    date: "2027-01-24", dateStatus: "confirmed",
    city: "Paris", arr: "18e", dept: "75", lat: 48.8925, lng: 2.3445, type: "route",
    distances: [{ label: "10 km", km: 10, dplus: 110, dminus: 110, elevApprox: true }],
    registration: { status: "check", info: "https://running.life/en/event/10k-montmartre" },
    website: "https://www.paris.fr/evenements/10-k-montmartre-ag2r-la-mondiale-127618",
    tagline: "Le 10 km qui grimpe la Butte : départ mairie du 18e, pavés et vue sur tout Paris.",
    tags: ["Butte Montmartre", "Pavés"]
  },
  {
    id: "10k-champs-elysees", name: "10 km des Champs-Élysées", sponsor: "FULFIL",
    date: "2027-02-07", dateStatus: "confirmed",
    city: "Paris", arr: "8e", dept: "75", lat: 48.8698, lng: 2.3075, type: "route",
    distances: [{ label: "10 km", km: 10, dplus: 40, dminus: 40, elevApprox: true }],
    registration: { status: "open", closes: "2027-01-29", price: "38–41 €", url: "https://fr.milesrepublic.com/en/event/fulfil-10-km-des-champs-elysees-8796" },
    website: "https://www.paris.fr/evenements/les-10-kms-des-champs-elysees-29741",
    tagline: "Un 10 km roulant entre l'Arc de Triomphe et la Concorde, qualificatif pour les France.",
    tags: ["Label FFA", "Rapide"]
  },
  {
    id: "saint-valentin", name: "Course de la Saint-Valentin", sponsor: "",
    date: "2027-02-13", dateStatus: "confirmed",
    city: "Paris", arr: "19e", dept: "75", lat: 48.8809, lng: 2.3828, type: "route",
    distances: [{ label: "5 km en duo", km: 5 }, { label: "10 km solo", km: 10 }],
    registration: { status: "check", info: "https://running.life/en/event/course-de-la-saint-valentin" },
    website: "https://www.paris.fr/evenements/course-de-la-saint-valentin-98724",
    tagline: "Aux Buttes-Chaumont, en amoureux sur 5 km ou en solo sur 10 km.",
    tags: ["Duo", "Parc"]
  },
  {
    id: "tempo-urban-trail", name: "Tempo Urban Trail", sponsor: "",
    date: "2027-02-27", dateStatus: "confirmed",
    city: "Paris", arr: "19e", dept: "75", lat: 48.8938, lng: 2.3903, type: "urban",
    distances: [{ label: "Urban trail 9 km", km: 9 }],
    registration: { status: "check", info: "https://running.life/en/event/tempo-urban-trail" },
    website: "https://www.paris.fr/evenements/un-urban-trail-inedit-a-paris-126485",
    tagline: "Un urban trail inédit dans le parc de la Villette : escaliers, passerelles et recoins.",
    tags: ["Nouveau", "Urban trail"]
  },
  {
    id: "semi-paris", name: "Semi de Paris", sponsor: "HOKA",
    date: "2027-03-07", dateStatus: "confirmed",
    city: "Paris", arr: "", dept: "75", lat: 48.8350, lng: 2.4400, type: "route",
    distances: [{ label: "Semi-marathon", km: 21.0975, dplus: 90, dminus: 90, elevApprox: true }],
    registration: { status: "closed", price: "79 €", url: "https://www.semideparis.com", preUrl: "https://www.semideparis.com" },
    website: "https://www.semideparis.com",
    tagline: "Le plus grand semi de France. Le tirage au sort est clos : reste les dossards solidaires et agences.",
    tags: ["Tirage au sort", "Mythique"]
  },
  {
    id: "courir-pour-toit", name: "Courir pour Toit", sponsor: "",
    date: "2027-03-13", dateStatus: "confirmed",
    city: "Paris", arr: "16e", dept: "75", lat: 48.8620, lng: 2.2520, type: "route",
    distances: [{ label: "5 km (non chronométré)", km: 5 }, { label: "10 km", km: 10 }],
    registration: { status: "check", info: "https://running.life/en/event/courir-pour-toit" },
    website: "https://www.paris.fr/evenements/courir-pour-toit-13-mars-2027-127099",
    tagline: "Course solidaire au bois de Boulogne pour l'accès au logement.",
    tags: ["Solidaire", "Bois de Boulogne"]
  },
  {
    id: "pimarathon", name: "Pi Marathon", sponsor: "",
    date: "2027-03-14", dateStatus: "confirmed",
    city: "Paris", arr: "8e", dept: "75", lat: 48.8665, lng: 2.3160, type: "relais",
    distances: [{ label: "Relais 3 × 14 km", km: 42 }],
    registration: { status: "check", info: "https://running.life/en/event/pi-marathon" },
    website: "https://www.paris.fr/evenements/pi-marathon-127654",
    tagline: "Un marathon en relais à 3 (3 × 14 km) couru le jour de π, aux jardins des Champs-Élysées.",
    tags: ["Relais", "Fun"]
  },
  {
    id: "grand-paris-race", name: "La Grande Course du Grand Paris", sponsor: "",
    date: "2027-03-14", dateStatus: "confirmed",
    city: "Saint-Denis", arr: "", dept: "93", lat: 48.9245, lng: 2.3602, type: "route",
    distances: [
      { label: "Semi-marathon", km: 21.1, dplus: 110, dminus: 120, elevApprox: true },
      { label: "10 km", km: 10, dplus: 50, dminus: 60, elevApprox: true },
      { label: "5 km", km: 5, dplus: 20, dminus: 25, elevApprox: true }
    ],
    registration: { status: "open", url: "https://running.life/en/event/grande-course-du-grand-paris" },
    website: "https://www.sortiraparis.com/en/what-to-do-in-paris/sport-wellness/articles/135931-grand-paris-grand-run-2027-half-marathon-10km-and-5km-on-march-14",
    tagline: "Arrivée sur la piste du Stade de France. Semi, 10 km, 5 km et course enfants.",
    tags: ["Arrivée stade", "Multi-distances"]
  },
  {
    id: "ecotrail-paris", name: "EcoTrail Paris", sponsor: "Salomon",
    date: "2027-03-20", endDate: "2027-03-21", dateStatus: "confirmed",
    city: "Rambouillet → Paris", arr: "", dept: "78", lat: 48.8584, lng: 2.2945, type: "trail",
    distances: [
      { label: "Trail 120 km", km: 120, dplus: 1800, dminus: 1900, elevApprox: true },
      { label: "Trail 80 km", km: 80, dplus: 1500, dminus: 1550, elevApprox: true },
      { label: "Trail 45 km", km: 45, dplus: 800, dminus: 850, elevApprox: true },
      { label: "Trail 20 km", km: 20, dplus: 350, dminus: 380, elevApprox: true },
      { label: "Trail 10 km", km: 10, dplus: 200, dminus: 200, elevApprox: true }
    ],
    registration: { status: "open", url: "https://www.ecotrailparis.com" },
    website: "https://www.ecotrailparis.com",
    tagline: "Des forêts de l'Ouest parisien jusqu'à l'arrivée au pied de la Tour Eiffel.",
    tags: ["Ultra", "Tour Eiffel", "Nature"]
  },
  {
    id: "solirun", name: "Soli'Run", sponsor: "14e édition",
    date: "2027-03-21", dateStatus: "confirmed",
    city: "Paris", arr: "16e", dept: "75", lat: 48.8550, lng: 2.2480, type: "route",
    distances: [{ label: "5 km", km: 5 }, { label: "10 km", km: 10 }],
    registration: { status: "check", info: "https://running.life/en/event/solirun-paris" },
    website: "https://www.paris.fr/evenements/la-soli-run-la-course-pour-le-lien-social-98692",
    tagline: "La course pour le lien social, chronométrée officiellement, au bois de Boulogne.",
    tags: ["Solidaire"]
  },
  {
    id: "lions-paris-9", name: "Lions Paris 9 Run", sponsor: "",
    date: "2027-03-21", dateStatus: "confirmed",
    city: "Paris", arr: "9e", dept: "75", lat: 48.8720, lng: 2.3400, type: "route",
    distances: [{ label: "5 km", km: 5 }, { label: "10 km", km: 10 }],
    registration: { status: "check", info: "https://running.life/en/event/lions-paris-9-run" },
    website: "https://www.paris.fr/evenements/le-lions-paris-9-run-fait-son-grand-retour-au-printemps-le-21-mars-2027-126122",
    tagline: "Le retour du 10 km du 9e arrondissement, départ de la mairie.",
    tags: ["Quartier", "Solidaire"]
  },
  {
    id: "sine-qua-non", name: "Sine Qua Non Run", sponsor: "9e édition",
    date: "2027-03-27", dateStatus: "confirmed",
    city: "Paris", arr: "3e", dept: "75", lat: 48.8674, lng: 2.3636, type: "route",
    distances: [{ label: "5,5 km", km: 5.5 }, { label: "10 km", km: 10 }],
    registration: { status: "check", info: "https://running.life/en/event/sine-qua-non-run" },
    website: "https://www.paris.fr/evenements/sine-qua-non-run-la-course-qui-pietine-les-violences-sexistes-et-sexuelles-77287",
    tagline: "La course qui piétine les violences sexistes et sexuelles, place de la République.",
    tags: ["Engagée", "Nocturne"]
  },
  {
    id: "marathon-paris", name: "Marathon de Paris", sponsor: "ASICS", edition: "50e édition",
    date: "2027-04-04", dateStatus: "confirmed",
    city: "Paris", arr: "", dept: "75", lat: 48.8738, lng: 2.2950, type: "route",
    distances: [{ label: "Marathon", km: 42.195, dplus: 160, dminus: 160, elevApprox: true }],
    registration: { status: "lottery", opens: "2026-09-08", closes: "2026-09-30", price: "169 €", url: "https://www.asicsmarathondeparis.com", preUrl: "https://www.asicsmarathondeparis.com" },
    website: "https://www.asicsmarathondeparis.com",
    tagline: "50e édition, nouveau parcours. 166 000 candidats au tirage au sort, clos le 30/09. Reste les dossards associatifs.",
    tags: ["Mythique", "50 ans", "Tirage au sort"]
  },
  {
    id: "grand-paris-sud", name: "Semi & 10 km de Grand Paris Sud", sponsor: "ex-Marathon de Sénart",
    date: "2027-05-01", dateStatus: "estimated",
    city: "Sénart", arr: "", dept: "77", lat: 48.6080, lng: 2.5530, type: "route",
    distances: [{ label: "Semi-marathon", km: 21.1 }, { label: "10 km", km: 10 }],
    registration: { status: "soon", info: "https://www.finishers.com/en/event/grand-paris-sud-half-marathon-and-10k" },
    website: "https://www.finishers.com/en/event/grand-paris-sud-half-marathon-and-10k",
    tagline: "Le marathon du 1er mai devient semi + 10 km, avec musique live sur le parcours. Fin avril ou 1er mai.",
    tags: ["1er mai", "Rapide"]
  },
  {
    id: "adidas-10k-paris", name: "10K Paris", sponsor: "adidas",
    date: "2027-05-23", dateStatus: "listed",
    city: "Paris", arr: "", dept: "75", lat: 48.8606, lng: 2.3376, type: "route",
    distances: [{ label: "10 km", km: 10, dplus: 35, dminus: 35, elevApprox: true }],
    registration: { status: "soon", preUrl: "https://www.adidas10kparis.fr/en/participate/register" },
    website: "https://www.adidas10kparis.fr",
    tagline: "Le 10 km des monuments : Louvre, Concorde, Seine. ASO n'a pas encore officialisé le jour (fin mai / début juin).",
    tags: ["Monuments", "Rapide"]
  },
  {
    id: "la-parisienne", name: "La Parisienne", sponsor: "",
    date: "2027-09-12", dateStatus: "listed",
    city: "Paris", arr: "7e", dept: "75", lat: 48.8556, lng: 2.2986, type: "route",
    distances: [{ label: "7 km", km: 7, dplus: 30, dminus: 30, elevApprox: true }, { label: "10 km", km: 10 }],
    registration: { status: "soon", preUrl: "https://www.la-parisienne.net" },
    website: "https://www.la-parisienne.net",
    tagline: "La grande course 100 % féminine : festival du 10 au 12 septembre, course le dimanche.",
    tags: ["Féminine", "Solidaire"]
  },
  {
    id: "10k-lagardere", name: "10 km du Lagardère Paris Racing", sponsor: "",
    date: "2027-09-19", dateStatus: "estimated",
    city: "Paris", arr: "16e", dept: "75", lat: 48.8620, lng: 2.2520, type: "route",
    distances: [{ label: "10 km", km: 10, dplus: 60, dminus: 60, elevApprox: true }],
    registration: { status: "soon" },
    website: "",
    tagline: "Un 10 km dans le bois de Boulogne, au départ de la Croix-Catelan.",
    tags: ["Bois de Boulogne"]
  },
  {
    id: "paris-versailles", name: "Paris-Versailles", sponsor: "",
    date: "2027-09-26", dateStatus: "listed",
    city: "Paris → Versailles", arr: "", dept: "78", lat: 48.8580, lng: 2.2930, type: "route",
    distances: [{ label: "16,2 km", km: 16.2, dplus: 220, dminus: 160, elevApprox: true }],
    registration: { status: "soon", price: "≈ 34–38 €", preUrl: "https://www.parisversailles.com/site/" },
    website: "https://www.parisversailles.com/site/",
    tagline: "De la Tour Eiffel au Château de Versailles, avec la redoutable côte des Gardes. 25 000 dossards, ouverture habituelle en avril.",
    tags: ["Mythique", "Côte des Gardes"]
  },
  {
    id: "20km-paris", name: "20 km de Paris", sponsor: "Harmonie Mutuelle",
    date: "2027-10-10", dateStatus: "listed",
    city: "Paris", arr: "7e", dept: "75", lat: 48.8600, lng: 2.2920, type: "route",
    distances: [{ label: "20 km", km: 20, dplus: 70, dminus: 70, elevApprox: true }],
    registration: { status: "soon", preUrl: "https://harmonie-mutuelle.20kmparis.com" },
    website: "https://harmonie-mutuelle.20kmparis.com",
    tagline: "35 000 coureurs au départ du pont d'Iéna, le 2e dimanche d'octobre.",
    tags: ["Mythique", "Tour Eiffel"]
  },
  {
    id: "semi-boulogne", name: "Semi-marathon de Boulogne-Billancourt", sponsor: "Christian Granger",
    date: "2027-11-21", dateStatus: "estimated",
    city: "Boulogne-Billancourt", arr: "", dept: "92", lat: 48.8350, lng: 2.2400, type: "route",
    distances: [{ label: "Semi-marathon", km: 21.1, dplus: 60, dminus: 60, elevApprox: true }],
    registration: { status: "soon", preUrl: "https://www.semi-marathonbb.fr" },
    website: "https://www.semi-marathonbb.fr",
    tagline: "Un des semis les plus rapides de France, complet chaque année : surveille l'ouverture.",
    tags: ["Rapide", "Label FFA", "Complet vite"]
  },
  {
    id: "cross-figaro", name: "Cross du Figaro", sponsor: "Téléthon",
    date: "2027-11-26", endDate: "2027-11-28", dateStatus: "estimated",
    city: "Saint-Cloud", arr: "", dept: "92", lat: 48.8410, lng: 2.2120, type: "cross",
    distances: [{ label: "Nocturne 5 km", km: 5 }, { label: "10 km", km: 10 }, { label: "20 km", km: 20 }],
    registration: { status: "soon", info: "https://fr.milesrepublic.com/event/cross-du-figaro-7756" },
    website: "https://fr.milesrepublic.com/event/cross-du-figaro-7756",
    tagline: "Le cross historique du Domaine de Saint-Cloud, nocturne le vendredi, au profit du Téléthon.",
    tags: ["Cross", "Historique", "Nocturne"]
  },
  {
    id: "corrida-issy", name: "Corrida de Noël d'Issy", sponsor: "",
    date: "2027-12-12", dateStatus: "estimated",
    city: "Issy-les-Moulineaux", arr: "", dept: "92", lat: 48.8240, lng: 2.2700, type: "route",
    distances: [{ label: "5 km", km: 5 }, { label: "10 km", km: 10, dplus: 50, dminus: 50, elevApprox: true }],
    registration: { status: "soon", preUrl: "https://www.corrida-noel-issy.com" },
    website: "https://www.corrida-noel-issy.com",
    tagline: "La course des Pères Noël : on court déguisé, en clôture de saison (2e dimanche de décembre).",
    tags: ["Déguisé", "Noël"]
  }
];

/* ------------------------------------------------------------------
 * 2) Le reste du calendrier — format compact
 *    [date, fin, nom, ville, type, distances, slug running.life]
 *    type : route | trail | urban | backyard | relais | cross
 *    distances : nombres (km) ou libellés ("24h", "6h"…)
 * ------------------------------------------------------------------ */
window.CITIES = {
  "Cernay-la-Ville": ["78", 48.674, 1.974], "Beaumont-sur-Oise": ["95", 49.143, 2.287], "Massy": ["91", 48.731, 2.271],
  "Yerres": ["91", 48.717, 2.493], "Mantes-la-Jolie": ["78", 48.991, 1.717], "Cergy": ["95", 49.036, 2.063],
  "Trilport": ["77", 48.957, 2.950], "Houdan": ["78", 48.790, 1.600], "Nemours": ["77", 48.267, 2.697],
  "Cerny": ["91", 48.479, 2.330], "Saint-Brice-sous-Forêt": ["95", 48.999, 2.356], "Bouffémont": ["95", 49.044, 2.298],
  "Malakoff": ["92", 48.817, 2.297], "Igny": ["91", 48.737, 2.226], "Saint-Rémy-l'Honoré": ["78", 48.763, 1.876],
  "Les Bréviaires": ["78", 48.695, 1.823], "Vincennes": ["94", 48.847, 2.439], "Viroflay": ["78", 48.800, 2.168],
  "Sucy-en-Brie": ["94", 48.770, 2.523], "Gambais": ["78", 48.773, 1.670], "Moisson (Lavacourt)": ["78", 49.067, 1.668],
  "Saint-Germain-en-Laye": ["78", 48.898, 2.094], "Aubergenville": ["78", 48.959, 1.855], "Neuilly-sur-Marne": ["93", 48.862, 2.531],
  "Bagneaux-sur-Loing": ["77", 48.233, 2.705], "Rueil-Malmaison": ["92", 48.877, 2.180], "Auffargis": ["78", 48.700, 1.890],
  "Vélizy-Villacoublay": ["78", 48.782, 2.193], "L'Étang-la-Ville": ["78", 48.869, 2.057], "Magny-le-Hongre": ["77", 48.863, 2.815],
  "Rambouillet": ["78", 48.644, 1.830], "Sèvres": ["92", 48.823, 2.211], "La Courneuve": ["93", 48.928, 2.396],
  "Jablines": ["77", 48.913, 2.763], "Saint-Witz": ["95", 49.090, 2.567], "Évry-Courcouronnes": ["91", 48.629, 2.441],
  "Menucourt": ["95", 49.027, 1.980], "Bussy-Saint-Georges": ["77", 48.841, 2.703], "Joinville-le-Pont": ["94", 48.821, 2.473],
  "Chatou": ["78", 48.890, 2.157], "Ormesson-sur-Marne": ["94", 48.786, 2.539], "Milly-la-Forêt": ["91", 48.404, 2.470],
  "Montlignon": ["95", 49.006, 2.288], "Marcoussis": ["91", 48.640, 2.230], "Trappes": ["78", 48.776, 2.002],
  "Rochefort-en-Yvelines": ["78", 48.585, 1.990], "Guerville": ["78", 48.943, 1.735], "Longperrier": ["77", 49.048, 2.666],
  "Magny-les-Hameaux": ["78", 48.743, 2.062], "Mousseaux-lès-Bray": ["77", 48.414, 3.230], "Fontainebleau": ["77", 48.404, 2.701],
  "Vaux-sur-Seine": ["78", 49.012, 1.966], "Fontaine-le-Port": ["77", 48.487, 2.766], "Roissy-en-France": ["95", 49.003, 2.516],
  "Montry": ["77", 48.884, 2.828], "Presles-en-Brie": ["77", 48.716, 2.740], "Montfermeil": ["93", 48.898, 2.567],
  "Marly-le-Roi": ["78", 48.867, 2.093], "Jouy-le-Moutier": ["95", 49.010, 2.040], "Sénart": ["77", 48.620, 2.560],
  "Cormeilles-en-Parisis": ["95", 48.973, 2.200], "La Défense": ["92", 48.892, 2.236], "Blandy-les-Tours": ["77", 48.567, 2.783],
  "Bonnelles": ["78", 48.618, 2.031], "Marolles-en-Hurepoix": ["91", 48.563, 2.300], "Rosny-sur-Seine": ["78", 48.998, 1.632],
  "Clamart": ["92", 48.800, 2.266], "Saint-Cloud": ["92", 48.840, 2.214], "Saint-Germain-de-la-Grange": ["78", 48.833, 1.903],
  "Chamarande": ["91", 48.515, 2.217], "Dourdan": ["91", 48.529, 2.011], "Beynes": ["78", 48.856, 1.873],
  "Puteaux": ["92", 48.884, 2.238], "Buthiers": ["77", 48.290, 2.433], "Breuillet": ["91", 48.567, 2.172],
  "Orgerus": ["78", 48.838, 1.702], "Chenoise-Cucharmoy": ["77", 48.617, 3.190], "Méry-sur-Oise": ["95", 49.065, 2.188],
  "Crouy-sur-Ourcq": ["77", 49.090, 3.075], "Vauhallan": ["91", 48.733, 2.200], "Draveil": ["91", 48.685, 2.408],
  "Houilles": ["78", 48.926, 2.189], "Le Perreux-sur-Marne": ["94", 48.842, 2.504], "Boissy-sous-Saint-Yon": ["91", 48.553, 2.211],
  "Neuilly-sur-Seine": ["92", 48.885, 2.268], "Sceaux": ["92", 48.776, 2.290], "Marines": ["95", 49.145, 1.983],
  "Villejuif": ["94", 48.792, 2.363], "Annet-sur-Marne": ["77", 48.925, 2.716], "Mennecy": ["91", 48.567, 2.437],
  "Antony": ["92", 48.754, 2.297], "Étampes": ["91", 48.435, 2.162], "Deuil-la-Barre": ["95", 48.970, 2.327],
  "Paris 14e": ["75", 48.833, 2.326], "Paris 18e": ["75", 48.8865, 2.3431], "Paris 19e": ["75", 48.894, 2.390],
  "Paris 14e · Montsouris": ["75", 48.822, 2.338], "Paris 16e · Bois de Boulogne": ["75", 48.861, 2.262],
  "Paris 12e": ["75", 48.835, 2.420], "Paris 15e": ["75", 48.8417, 2.2990], "Paris": ["75", 48.8566, 2.3522],
  "Paris 7e": ["75", 48.856, 2.300], "Paris 13e": ["75", 48.829, 2.365]
};

window.RACES_COMPACT = [
  /* ---------- JANVIER ---------- */
  ["2027-01-03", "", "Challenge sur Route de France", "Cernay-la-Ville", "route", [21.1, 42.195], "challenge-sur-route-de-france"],
  ["2027-01-10", "", "Trail de Beaumont", "Beaumont-sur-Oise", "trail", [15, 30], "x-trail-run-beaumont-sur-oise"],
  ["2027-01-10", "", "La Course des Résolutions", "Massy", "route", [10], "la-course-des-resolutions-massy"],
  ["2027-01-15", "2027-01-16", "Yerres Trail by Night", "Yerres", "trail", [12, 22], "yerres-trail-by-night"],
  ["2027-01-16", "", "Trail Urbain de la Galette", "Mantes-la-Jolie", "urban", [12], "trail-urbain-de-la-galette"],
  ["2027-01-17", "", "10 km du 14e", "Paris 14e", "route", [10], "10-km-du-14eme", { status: "closed", note: "Complet" }],
  ["2027-01-17", "", "Trail des Étangs", "Cergy", "trail", [10, 18], "trail-des-etangs-cergy"],
  ["2027-01-17", "", "Trail de Trilport", "Trilport", "trail", [9, 18], "trail-de-trilport", { url: "https://www.le-sportif.com/calendrier/232533/trail-de-trilport-2027/trail-course-nature/" }],
  ["2027-01-20", "", "Backyard La Chance", "Paris 18e", "backyard", ["Backyard 6,7 km/h"], "backyard-la-chance"],
  ["2027-01-23", "", "Urban Trail de Houdan", "Houdan", "urban", [3, 6, 11], "urban-trail-houdan", { status: "closed", note: "Complet" }],
  ["2027-01-23", "", "Nocturne du Pays de Nemours", "Nemours", "route", [11], "nocturne-du-pays-de-nemours"],
  ["2027-01-23", "", "Dark Trail", "Cerny", "trail", [15], "dark-trail-cerny"],
  ["2027-01-24", "", "Trail des Marcassins", "Saint-Brice-sous-Forêt", "trail", [15, 30], "trail-des-marcassins-saint-brice-sous-foret"],
  ["2027-01-30", "2027-01-31", "Maxicross de Bouffémont", "Bouffémont", "trail", [11, 19, 52, 61], "maxicross-bouffemont"],
  ["2027-01-30", "", "Les Foulées de Malakoff", "Malakoff", "route", [5, 10], "les-foulees-de-malakoff"],
  ["2027-01-30", "", "La Trifouillette Blanche", "Igny", "trail", [10, 20], "la-trifouillette-blanche"],
  ["2027-01-31", "", "Diodurun", "Saint-Rémy-l'Honoré", "backyard", ["Backyard", 66], "diodurun", { status: "closed", note: "Complet" }],
  ["2027-01-31", "", "L'Hivernale", "Les Bréviaires", "trail", [12, 24], "lhivernale"],
  ["2027-01-31", "", "Les Foulées de Vincennes", "Vincennes", "route", [5, 10], "les-foulees-de-vincennes"],
  ["2027-01-31", "", "Cross de la Sablière", "Viroflay", "cross", [3, 6, 11], "cross-de-la-sabliere"],
  ["2027-01-31", "", "La Sagittaire", "Sucy-en-Brie", "trail", [21.1], "la-sagittaire"],

  /* ---------- FÉVRIER ---------- */
  ["2027-02-07", "", "La Trace des Wolfs", "Gambais", "trail", [10, 15, 30], "la-trace-des-wolfs"],
  ["2027-02-07", "", "Les Foulées Moissonnaises", "Moisson (Lavacourt)", "trail", [8, 14, 21.1], "les-foulees-moissonnaises"],
  ["2027-02-13", "", "Saint-Valentin Forever Run", "Saint-Germain-en-Laye", "trail", [3, 7, 26, 50], "saint-valentin-forever-run"],

  /* ---------- MARS ---------- */
  ["2027-03-06", "2027-03-07", "Broken Race", "Aubergenville", "trail", [3, 30, "24 h"], "broken-race"],
  ["2027-03-07", "", "10 km de Neuilly-sur-Marne", "Neuilly-sur-Marne", "route", [5, 10], "10km-de-neuilly"],
  ["2027-03-07", "", "Muco'Trail du Pays de Nemours", "Bagneaux-sur-Loing", "trail", [11, 22], "mucotrail-du-pays-de-nemours"],
  ["2027-03-07", "", "Foulées Mantaises", "Mantes-la-Jolie", "route", [5, 10], "foulees-mantaises"],
  ["2027-03-07", "", "Semi-marathon des Lions", "Rueil-Malmaison", "route", [10, 21.1], "semi-marathon-des-lions"],
  ["2027-03-13", "", "Trail d'Auffargis", "Auffargis", "trail", [15, 26, 46, 61], "trail-dauffargis"],
  ["2027-03-13", "", "Course des 4 Clochers", "Vélizy-Villacoublay", "trail", [18], "course-des-4-clochers"],
  ["2027-03-14", "", "Trail Bleu", "L'Étang-la-Ville", "trail", [6, 15, 25], "trail-bleu"],
  ["2027-03-14", "", "10 km de Magny-le-Hongre", "Magny-le-Hongre", "route", [10], "10km-de-magny"],
  ["2027-03-14", "", "Semi-marathon de Rambouillet", "Rambouillet", "route", [21.1], "semi-marathon-de-rambouillet"],
  ["2027-03-14", "", "Trail Urbain de Sèvres", "Sèvres", "urban", [8, 15], "trail-urbain-de-sevres"],
  ["2027-03-14", "", "Les Foulées Jazy", "La Courneuve", "route", [3, 5, 10], "les-foulees-jazy-seine-saint-denis"],
  ["2027-03-19", "2027-03-21", "Backyard77", "Jablines", "backyard", ["Backyard"], "backyard77"],
  ["2027-03-20", "", "Semi-marathon de Saint-Witz", "Saint-Witz", "route", [3, 5, 10, 21.1], "semi-marathon-de-saint-witz"],
  ["2027-03-20", "", "Évry-Courcouronnes Urban Trail", "Évry-Courcouronnes", "urban", [5, 10, 15, 20], "evry-courcouronnes-urban-trail"],
  ["2027-03-21", "", "10 km des Étoiles", "Paris", "route", [10], "10km-des-etoiles"],
  ["2027-03-21", "", "La Foulée d'Aubergenville", "Aubergenville", "route", [5, 10], "la-foulee-daubergenville"],
  ["2027-03-21", "", "Rev7 Trail", "Menucourt", "trail", [8, 13, 20], "rev7-trail-menucourt"],
  ["2027-03-21", "", "Les Foulées de Bussy", "Bussy-Saint-Georges", "route", [5, 10], "les-foulees-de-bussy"],
  ["2027-03-21", "", "Semi-marathon de Joinville", "Joinville-le-Pont", "route", [10, 21.1], "semi-marathon-de-joinville"],
  ["2027-03-21", "", "Semi-marathon Boucle de Seine", "Chatou", "route", [21.1], "semi-marathon-boucle-de-seine"],
  ["2027-03-21", "", "Trail André d'Ormesson", "Ormesson-sur-Marne", "trail", [11, 23], "trail-andre-dormesson"],
  ["2027-03-21", "", "Les Arcades de l'Aqueduc", "Milly-la-Forêt", "trail", [13, 23], "les-arcades-de-laqueduc"],
  ["2027-03-27", "2027-03-29", "Trail Tour du Massif Montmorencéen (2T2M)", "Montlignon", "trail", [7, 11, 51, 70], "trail-tour-du-massif-montmorenceen-2t2m"],
  ["2027-03-27", "", "Défi 24 h Backyard JSP", "Marcoussis", "backyard", ["Backyard 24 h"], "defi-24h-back-yard-jsp-marcoussis", { status: "closed", note: "Complet" }],
  ["2027-03-30", "", "Les Foulées Plaine Vallée", "Montlignon", "trail", [5, 10, 15], "les-foulees-plaine-vallee"],

  /* ---------- AVRIL ---------- */
  ["2027-04-02", "", "Backyard de Saint-Quentin", "Trappes", "backyard", ["Backyard"], "backyard-de-saint-quentin"],
  ["2027-04-03", "", "La Diagonale des Yvelines", "Rochefort-en-Yvelines", "trail", [12, 20, 85, 105], "la-diagonale-des-yvelines"],
  ["2027-04-03", "2027-04-04", "Backyard Jablines", "Jablines", "backyard", ["Backyard"], "backyard-jablines", { status: "closed", note: "Complet" }],
  ["2027-04-03", "2027-04-04", "Trail des Coteaux de Guerville", "Guerville", "trail", [3, 15, 31, 43], "trail-des-coteaux-de-guerville", { status: "closed", note: "Complet" }],
  ["2027-04-04", "", "La Nemourienne", "Nemours", "route", [5, 10], "la-nemourienne"],
  ["2027-04-04", "", "Foulées Longperroises", "Longperrier", "route", [5, 10], "foulees-vertes-longperroises"],
  ["2027-04-04", "", "La Méran'Trail", "Magny-les-Hameaux", "trail", [10, 20], "la-merantrail"],
  ["2027-04-04", "", "Color Run de PERPIMM", "Mousseaux-lès-Bray", "route", [5, 10], "color-run-de-perpimm"],
  ["2027-04-07", "", "Foulée Impériale de Fontainebleau", "Fontainebleau", "route", [5, 10, 21.1], "foulee-imperiale-de-fontainebleau"],
  ["2027-04-10", "", "Delta Race Paris", "Paris 14e · Montsouris", "urban", [5, 10, 15], "delta-race-paris"],
  ["2027-04-16", "", "Backyard du Val de Seine", "Vaux-sur-Seine", "backyard", ["Backyard"], "backyard-du-val-de-seine"],
  ["2027-04-17", "2027-04-18", "Ultrabellifontain 205", "Fontaine-le-Port", "trail", [205], "ubf-205-ultrabellifontain"],
  ["2027-04-18", "", "Trail de Crève-Cœur", "Nemours", "trail", [5, 11, 25], "trail-de-creve-coeur-nemours"],
  ["2027-04-18", "", "Les 10 km de l'Éducation", "Paris 14e · Montsouris", "route", [5, 10], "les-10-km-de-leducation"],
  ["2027-04-25", "", "Foulées de l'Assurance", "Paris", "route", [5, 10], "foulees-de-lassurance"],
  ["2027-04-25", "", "Ekiden de Roissy Pays de France", "Roissy-en-France", "relais", ["Ekiden 42,195 km"], "ekiden-de-roissy-pays-de-france"],
  ["2027-04-25", "", "La Dhuis en Folie", "Montry", "trail", [], "la-dhuis-en-folie"],
  ["2027-04-25", "", "La Presloise en Brie", "Presles-en-Brie", "trail", [3, 7, 17], "la-presloise-en-brie"],
  ["2027-04-25", "", "Course contre le Cancer", "Montfermeil", "route", [5, 10], "course-contre-le-cancer-montfermeil"],
  ["2027-04-25", "", "La Chevauchée de Marly", "Marly-le-Roi", "trail", [10, 18, 28, 45], "la-chevauchee-de-marly"],
  ["2027-04-30", "", "Backyard de Cergy", "Jouy-le-Moutier", "backyard", ["Backyard"], "backyard-de-cergy"],

  /* ---------- MAI ---------- */
  ["2027-05-01", "", "Les Runs de Sénart", "Sénart", "trail", [10, 23], "les-runs-de-senart"],
  ["2027-05-09", "", "Foulée Saint-Briçoise", "Saint-Brice-sous-Forêt", "route", [5, 13], "foulee-saint-bricoise"],
  ["2027-05-09", "", "La Kieffer'Run", "Cormeilles-en-Parisis", "backyard", ["2 h", "6 h"], "la-kiefferrun"],
  ["2027-05-09", "", "Wings for Life World Run", "La Défense", "route", ["Course poursuite"], "wings-for-life-world-run-paris"],
  ["2027-05-09", "", "Course du Sanglier", "Cerny", "trail", [11, 21.1], "course-du-sanglier-de-cerny"],
  ["2027-05-15", "2027-05-16", "Marathon Médiéval", "Blandy-les-Tours", "route", [5, 21.1, 42.195], "marathon-medieval"],
  ["2027-05-16", "", "10 km Paris 15", "Paris 15e", "route", [10], "10km-paris-15"],
  ["2027-05-16", "", "10 km de l'UNICEF", "Paris 16e · Bois de Boulogne", "route", [3, 5, 10], "10km-de-lunicef"],
  ["2027-05-16", "", "Courses solidaires Bleuet de France", "Paris", "route", [5, 10], "courses-solidaires-bleuet-de-france"],
  ["2027-05-16", "", "Trail de l'Orangerie", "Bonnelles", "trail", [10, 20, 43], "trail-de-lorangerie-de-bonnelles"],
  ["2027-05-16", "", "La Pyrénéenne — les 10 km", "Paris", "route", [3, 4, 10], "la-pyreneenne-les-10-km"],
  ["2027-05-22", "", "La Marollaise", "Marolles-en-Hurepoix", "trail", [], "la-marollaise"],
  ["2027-05-22", "", "Courses du Château de Sully", "Rosny-sur-Seine", "trail", [5, 10], "courses-du-chateau-de-sully"],
  ["2027-05-23", "", "Trail le Pouce", "Paris", "urban", [14], "trail-le-pouce"],
  ["2027-05-23", "", "PSG — La Course", "Saint-Germain-en-Laye", "route", [10, 20], "psg-la-course"],
  ["2027-05-23", "", "Foulée Verte de Clamart", "Clamart", "trail", [5, 10, 18, 31], "foulee-verte-de-clamart"],
  ["2027-05-23", "", "Le Relais de la SPA", "Saint-Cloud", "trail", [5, 10], "le-relais-de-la-spa"],
  ["2027-05-23", "", "La Grange Boucle", "Saint-Germain-de-la-Grange", "trail", [3, 7], "la-germanoise"],
  ["2027-05-29", "", "Les Foulées des Galopins", "Chamarande", "trail", [5, 10, 17, 32], "les-foulees-des-galopins"],
  ["2027-05-30", "", "Trail du Château de Dourdan", "Dourdan", "trail", [12, 21.1, 42.195], "trail-du-chateau-de-dourdan"],
  ["2027-05-30", "", "La Frileuse", "Beynes", "trail", [5, 10, 20], "la-frileuse"],

  /* ---------- JUIN ---------- */
  ["2027-06-03", "", "Enfants sans Cancer City", "Puteaux", "route", [5, 10], "enfants-sans-cancer-city"],
  ["2027-06-03", "", "L'Afterwork des Héros", "Sèvres", "route", [], "lafterwork-des-heros-paris"],
  ["2027-06-04", "", "Backyard de Buthiers", "Buthiers", "backyard", ["Backyard"], "backyard-de-buthiers"],
  ["2027-06-06", "", "Les Foulées du Moulin", "Breuillet", "trail", [11, 22, 32], "les-foulees-du-moulin"],
  ["2027-06-06", "", "Les Foulées d'Orgerus", "Orgerus", "trail", [10, 13, 21.1], "les-foulees-dorgerus"],
  ["2027-06-06", "", "Les Foulées de Chenoise", "Chenoise-Cucharmoy", "route", [5, 10], "les-foulees-de-chenoise"],
  ["2027-06-06", "", "La Butrail", "Méry-sur-Oise", "trail", [], "butrail-mery-sur-oise"],
  ["2027-06-06", "", "La Course des Héros", "Saint-Cloud", "trail", [5, 10], "course-des-heros-paris"],
  ["2027-06-06", "", "Trail du Pays de l'Ourcq", "Crouy-sur-Ourcq", "trail", [12, 18, 35], "trail-du-pays-de-lourcq"],
  ["2027-06-12", "", "Castor Fou", "Vauhallan", "trail", [13, 25], "castor-fou"],
  ["2027-06-13", "", "Les Foulées du 12e", "Paris 12e", "route", [5, 10], "les-foulees-du-12eme"],
  ["2027-06-13", "", "Run For Planet #7", "Draveil", "route", [5, 10], "run-for-planet-paris"],
  ["2027-06-20", "", "Ekiden du Stade Français", "Paris 16e · Bois de Boulogne", "relais", ["Ekiden 42,195 km"], "ekiden-du-stade-francais-paris"],

  /* ---------- JUILLET → AOÛT ---------- */
  ["2027-07-04", "", "Les Foulées d'Île-de-France", "Vincennes", "route", [5, 10], "les-foulees-dile-de-france-france-des-iles"],
  ["2027-08-29", "", "Semi des Quais de Seine", "Houilles", "route", [10, 21.1], "semi-des-quais-de-seine"],

  /* ---------- SEPTEMBRE ---------- */
  ["2027-09-05", "", "Course de la Rentrée", "Le Perreux-sur-Marne", "route", [5, 8, 15], "course-de-la-rentree"],
  ["2027-09-10", "", "Backyard de Torcy", "Jablines", "backyard", ["Backyard"], "backyard-de-torcy"],
  ["2027-09-11", "", "Le Tacot et la Renarde", "Boissy-sous-Saint-Yon", "trail", [12, 25], "le-tacot-et-la-renarde"],
  ["2027-09-11", "2027-09-12", "Les 24 h du Fer à Cheval", "Saint-Cloud", "trail", ["24 h"], "les-24h-du-fer-a-cheval"],
  ["2027-09-12", "", "Trail du Pays de Sully", "Rosny-sur-Seine", "trail", [11, 19, 31], "trail-du-pays-de-sully"],
  ["2027-09-18", "2027-09-19", "Memorun Paris", "Paris", "route", [5, 10], "memorun-paris-75"],
  ["2027-09-24", "", "Backyard des Boucles de Seine", "Moisson (Lavacourt)", "backyard", ["Backyard"], "backyard-des-boucles-de-seine"],
  ["2027-09-26", "", "Virade de Paris — Course du Souffle", "Neuilly-sur-Seine", "route", [4, 5, 10], "course-du-souffle"],
  ["2027-09-26", "", "Virade du Parc de Sceaux", "Sceaux", "route", [5, 10], "virade-du-parc-de-sceaux"],
  ["2027-09-26", "", "Trail des 2 Buttes", "Marines", "trail", [10, 16, 26], "trail-des-2-buttes"],
  ["2027-09-26", "", "Enfants sans Cancer", "Saint-Cloud", "route", [5, 10], "enfants-sans-cancer"],

  /* ---------- OCTOBRE ---------- */
  ["2027-10-03", "", "Corrida de Villejuif", "Villejuif", "route", [5, 10], "corrida-de-villejuif"],
  ["2027-10-15", "", "Backyard de Jablines-Annet", "Annet-sur-Marne", "backyard", ["Backyard"], "backyard-de-jablines-annet"],
  ["2027-10-17", "", "Ronde de Vélizy-Villacoublay", "Vélizy-Villacoublay", "route", [3, 5, 10], "ronde-de-velizy-villacoublay"],
  ["2027-10-17", "", "Grand Défi Solidaire", "Sceaux", "route", [5, 10], "grand-defi-solidaire"],

  /* ---------- NOVEMBRE → DÉCEMBRE ---------- */
  ["2027-11-07", "", "Cross du Val d'Essonne", "Mennecy", "cross", [3, 9], "cross-du-val-dessonne"],
  ["2027-11-12", "", "Backyard du Port aux Cerises", "Draveil", "backyard", ["Backyard"], "backyard-du-port-aux-cerises"],
  ["2027-11-14", "", "Marathon L'Automnale", "Paris 19e", "route", [42.195], "lautomnale"],
  ["2027-11-14", "", "Courses des Lions de l'Espoir", "Antony", "route", [5, 10], "courses-des-lions-de-lespoir"],
  ["2027-12-17", "", "Backyard d'Étampes", "Étampes", "backyard", ["Backyard"], "backyard-detampes"]
];
