// Service Worker Dosyası (sw.js)

const CACHE_NAME = 'tyt-countdown-cache-v1';
// Çevrimdışı çalışması için önbelleğe alınacak dosyalar.
// HTML dosyanızın adını doğru yazdığınızdan emin olun (örneğin index.html)
const urlsToCache = [
  '.', // Ana dizin (genellikle index.html'e yönlenir)
  'index.html', // Eğer HTML dosyanızın adı farklıysa burayı güncelleyin
  // CSS ve JS dosyalarınız varsa onları da ekleyebilirsiniz, 
  // ancak mevcut kodda bunlar inline veya CDN üzerinden olduğu için direkt eklemeye gerek yok.
  // Örnek: '/style.css', '/script.js'
  // CDN'den gelen font ve tailwind için runtime caching daha uygun olur ama basit tutuyoruz.
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap',
  'https://cdn.tailwindcss.com' // Tailwind CSS
];

// Yükleme (install) olayı: Cache'i açar ve dosyaları önbelleğe alır.
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('Service Worker: Cache open/addAll failed', err);
      })
  );
});

// Activate olayı: Eski cache'leri temizler.
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Yeni service worker'ın hemen kontrolü almasını sağlar
});

// Fetch olayı: İstekleri yakalar ve cache'ten sunmaya çalışır.
// Cache'te yoksa network'e gider, başarılı olursa cache'e ekler.
self.addEventListener('fetch', event => {
  console.log('Service Worker: Fetching ', event.request.url);
  // Sadece GET isteklerini cache'liyoruz
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          console.log('Service Worker: Found in cache', event.request.url);
          return response; // Cache'te varsa cache'teki yanıtı döndür
        }
        console.log('Service Worker: Not found in cache, fetching from network', event.request.url);
        // Cache'te yoksa network'ten al
        return fetch(event.request).then(
          networkResponse => {
            // İstek başarılıysa ve cache'lemek istediğimiz bir URL ise cache'e ekle
            // (Örneğin, sadece kendi domain'imizden gelenleri veya CDN'leri cache'lemek isteyebiliriz)
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && !urlsToCache.includes(event.request.url)) {
              // Tailwindcss gibi cross-origin kaynaklar type: 'opaque' olabilir, onlar için de cachleme deneyebiliriz.
              // Ancak 'basic' olmayan ve cache listesinde olmayanları direkt döndür.
              if (networkResponse.type === 'opaque' && urlsToCache.includes(event.request.url)){
                 // opaque response'u cache'e atalım.
              } else {
                return networkResponse;
              }
            }

            // Yanıtı klonla. Bir stream olduğu için bir kez kullanılabilir.
            // Birini tarayıcıya, birini cache'e göndereceğiz.
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                console.log('Service Worker: Caching new resource', event.request.url);
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        ).catch(error => {
          console.error('Service Worker: Fetch failed; returning offline page instead.', error);
          // İsteğe bağlı: Çevrimdışı bir sayfa gösterebilirsiniz
          // return caches.match('/offline.html'); 
          // Şimdilik hata durumunda bir şey döndürmüyoruz, tarayıcı normal hatayı gösterecektir.
        });
      })
  );
});
