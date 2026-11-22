// Préférences d'environnement, réévaluées à chaque appel (l'utilisateur peut changer de réglage)
const mq = (q) => window.matchMedia(q);
export const reduced = () => mq("(prefers-reduced-motion: reduce)").matches;
export const canHover = () => mq("(hover: hover) and (pointer: fine)").matches;
export const EASE = "expo.out"; // proche de cubic-bezier(.22,1,.36,1)
