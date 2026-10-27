// ==========================================================================
// sw.js — service worker: fa funzionare l'app anche senza connessione
// ==========================================================================
//
// Strategia: "prima la rete, poi la cache".
//  - Quando c'è rete, i file vengono scaricati e la copia in cache aggiornata:
//    così gli aggiornamenti dell'app arrivano subito.
//  - Senza rete, si usa la copia in cache.
// Le chiamate a api.github.com (sincronizzazione) non passano dalla cache.
//
// Quando si pubblica una nuova versione, aumentare VERSIONE: le cache vecchie
// vengono cancellate.

const VERSIONE = 'dieta-facile-v10';

const FILE_APP = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/stile.css',
  './js/app.js',
  './js/dati.js',
  './js/stato.js',
  './js/vincoli.js',
  './js/sync.js',
  './js/impostazioni.js',
  './js/backup.js',
  './js/foglio.js',
  './js/settimana.js',
  './js/spesa.js',
  './js/ricette.js',
  './js/emoji.js',
  './js/calorie.js',
  './dati/diete.json',
  './dati/diete/mediterranea-a/dieta.json',
  './dati/diete/armonia-b/dieta.json',
  './dati/diete/armonia-b/ricette.json',
  './dati/ricette.json',
  './dati/stagioni.json',
  './dati/emoji.json',
  './dati/calorie.json',
  './icone/icona-192.png',
  './icone/icona-512.png',
  './icone/icona-180.png',
  './fonts/caprasimo-400.woff2',
  './fonts/figtree-variabile.woff2'
];

self.addEventListener('install', evento => {
  evento.waitUntil(
    caches.open(VERSIONE).then(cache => cache.addAll(FILE_APP)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', evento => {
  evento.waitUntil(
    caches.keys()
      .then(chiavi => Promise.all(chiavi.filter(k => k !== VERSIONE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', evento => {
  const richiesta = evento.request;
  if (richiesta.method !== 'GET') return;
  const url = new URL(richiesta.url);
  if (url.origin !== self.location.origin) return; // es. api.github.com: mai in cache

  evento.respondWith(
    fetch(richiesta)
      .then(risposta => {
        if (risposta && risposta.ok) {
          const copia = risposta.clone();
          caches.open(VERSIONE).then(cache => cache.put(richiesta, copia));
        }
        return risposta;
      })
      .catch(() => caches.match(richiesta, { ignoreSearch: true }).then(inCache => {
        if (inCache) return inCache;
        if (richiesta.mode === 'navigate') return caches.match('./index.html');
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      }))
  );
});
