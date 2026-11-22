// Mesure d'audience Umami (sans cookie). Chargée seulement si UMAMI_SRC et UMAMI_WEBSITE_ID sont définis.
const { src, id } = __UMAMI__;
if (src && id && !navigator.doNotTrack?.startsWith?.("1")) {
  const s = document.createElement("script");
  s.defer = true;
  s.src = src;
  s.dataset.websiteId = id;
  s.dataset.doNotTrack = "true";
  document.head.appendChild(s);
}
