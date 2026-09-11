/* Service worker — só guarda a "casca" do app (HTML, CSS, JS) para abrir
   rápido e sobreviver a uma oscilação de sinal. Nenhum dado do Supabase é
   guardado em cache: saldo errado em cache é pior que tela em branco. */
const CACHE = "almox-v1";
const CASCA = ["./", "./index.html", "./assets/estilo.css", "./assets/app.js", "./assets/config.js", "./manifest.webmanifest"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CASCA)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;                 // gravações sempre na rede
  if (url.origin !== location.origin) return;             // Supabase e fontes: direto
  e.respondWith(
    fetch(e.request)
      .then(r => {
        const copia = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia));
        return r;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match("./index.html")))
  );
});
