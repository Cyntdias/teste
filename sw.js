/* Service Worker — permite instalar o app e abrir mesmo com internet ruim.
   Estratégia "rede primeiro": sempre tenta a versão mais nova e usa o cache só se estiver offline.
   As chamadas ao Make (POST, outro domínio) não passam pelo cache. */
const CACHE = 'caderneta-v2';
const ARQUIVOS = [
  './', './index.html', './style.css', './config.js', './api.js', './app.js',
  './manifest.json', './icon.svg', './icon-192.png', './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(chaves => Promise.all(chaves.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then(resp => {
        const copia = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copia));
        return resp;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});

// Ao tocar na notificação de vencidos, abre a tela de avisos
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(janelas => {
      const aberta = janelas.find(j => 'focus' in j);
      if (aberta) { aberta.navigate('./#/avisos'); return aberta.focus(); }
      return self.clients.openWindow('./#/avisos');
    })
  );
});
