/* =========================================================
   Construction d'un e-mail MIME brut (RFC 5322 / 2045 / 2047), sans dépendance.
   Tout ce qui va dans un en-tête passe par headerSafe() ou oneLine() : aucun \r ni \n
   ne peut y entrer (injection d'en-têtes impossible), et les valeurs non ASCII
   sont encodées en « encoded-word » UTF-8 base64. Les corps sont en base64.
   ========================================================= */

/** une seule ligne : retours chariot, tabulations et caractères de contrôle remplacés par une espace */
export const oneLine = (s) => String(s ?? "").replace(/[\u0000-\u001f\u007f\u0085\u2028\u2029]+/g, " ").replace(/ {2,}/g, " ").trim();

/** octets UTF-8 → base64 (btoa n'accepte que du latin-1) */
export function b64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
const wrap76 = (s) => s.replace(/.{1,76}/g, "$&\r\n");

/** valeur d'en-tête sûre : une ligne, encodée si elle contient autre chose que de l'ASCII imprimable */
export function headerSafe(value) {
  const v = oneLine(value);
  if (/^[\x20-\x7e]*$/.test(v)) return v;
  // encoded-words de 75 caractères au plus (RFC 2047 §2), séparés par un pli
  const enc = new TextEncoder();
  const words = [];
  let chunk = "";
  for (const ch of v) {
    if (chunk && enc.encode(chunk + ch).length > 45) { words.push(chunk); chunk = ""; }
    chunk += ch;
  }
  if (chunk) words.push(chunk);
  return words.map((w) => `=?UTF-8?B?${b64(w)}?=`).join("\r\n ");
}

/** « Nom » <adresse> — l'adresse doit déjà avoir été validée */
export const mailbox = (address, name) => (name ? `${headerSafe(name)} <${oneLine(address)}>` : `<${oneLine(address)}>`);

/** e-mail complet multipart/alternative (texte + HTML) */
export function buildMime({ from, to, replyTo, subject, text, html, domain, date = new Date(), id = crypto.randomUUID() }) {
  const boundary = `=_cr_${id.replace(/-/g, "")}`;
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    `Subject: ${headerSafe(subject)}`,
    `Date: ${date.toUTCString().replace(/GMT$/, "+0000")}`,
    `Message-ID: <${id}@${domain}>`,
    "MIME-Version: 1.0",
    "Auto-Submitted: auto-generated",
    `Content-Type: multipart/alternative; boundary="${boundary}"`
  ];
  const part = (type, body) => [`--${boundary}`, `Content-Type: ${type}; charset=UTF-8`, "Content-Transfer-Encoding: base64", "", wrap76(b64(body))].join("\r\n");
  return `${headers.join("\r\n")}\r\n\r\n${part("text/plain", text)}${part("text/html", html)}--${boundary}--\r\n`;
}
