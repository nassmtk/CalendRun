import "./lib/env.mjs";
// Publie public/races.json : données minimales des courses, lues par le worker d'alertes
import fs from "node:fs";
import { loadRaces, primaryLink } from "./lib/races.mjs";

const races = loadRaces().map((r) => ({
  id: r.id, name: r.name, date: r.date, endDate: r.endDate || null,
  dateLong: r._dateLong, place: r._place, dept: r.dept,
  opens: (r.registration && r.registration.opens) || null,
  link: primaryLink(r)
}));
fs.mkdirSync("public", { recursive: true });
fs.writeFileSync("public/races.json", JSON.stringify(races));
console.log(`races.json : ${races.length} courses`);
