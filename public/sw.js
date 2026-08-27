/* ===========================================================
   Trabajador de fondo · El Alpendre
   -----------------------------------------------------------
   Sirve para dos cosas:
     · que la app se pueda instalar en el móvil como una app más
     · que abra aunque no haya internet (con lo último que se vio)

   Regla: los datos (/api/...) NUNCA se guardan en caché, porque
   tienen que ser siempre los de verdad. Los archivos de la app sí,
   pero se pide primero la versión nueva y la caché es el respaldo.
   =========================================================== */
const CACHE = "alpendre-v1";
const BASICOS = [
  "/", "/index.html", "/sync.js", "/manifest.json",
  "/icono-192.png", "/icono-512.png", "/apple-touch-icon.png", "/favicon.png"
];

self.addEventListener("install", ev => {
  ev.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(BASICOS).catch(() => {}))   /* si falla alguno, no se cae la instalación */
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", ev => {
  ev.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", ev => {
  const req = ev.request;
  if(req.method !== "GET") return;

  let url;
  try{ url = new URL(req.url); }catch(e){ return; }
  if(url.origin !== self.location.origin) return;

  /* los datos siempre del servidor, nunca de la caché */
  if(url.pathname.startsWith("/api/")) return;

  /* lo demás: primero la red, y si no hay, lo último que se guardó */
  ev.respondWith(
    fetch(req)
      .then(r => {
        if(r && r.ok){
          const copia = r.clone();
          caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
        }
        return r;
      })
      .catch(() =>
        caches.match(req).then(c =>
          c || (req.mode === "navigate" ? caches.match("/index.html") : undefined)
        )
      )
  );
});
