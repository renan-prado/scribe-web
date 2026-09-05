// Service worker do Scriba. Ele faz DUAS coisas, e nenhuma delas é cachear o
// app:
//
// 1. Existir. É requisito do navegador para nos tratar como PWA instalável
//    (Android/Chrome/Edge).
// 2. Servir uma tela própria quando uma navegação falha por falta de rede, em
//    vez do dinossauro do Chrome.
//
// **O app continua SEM cache de conteúdo, de propósito.** Ele é feito de dados
// que mudam a cada segundo — transcrição, feed, saldo de moedas — e um cache
// velho aqui não apareceria como bug de cache: apareceria como uma sessão que
// perdeu texto. O único cache que existe é a casca da página offline, que é
// estática e não fala com o servidor.
//
// Registrado por `src/shared/components/PwaBootstrap.tsx`, nunca em dev.

const CACHE = "scriba-offline-v1";
const OFFLINE_URL = "/offline.html";
// A pena, que a página offline pinta por máscara CSS. Sem ela no cache, a
// única imagem da tela offline seria justamente a que não carrega.
const OFFLINE_ASSETS = [OFFLINE_URL, "/brand/pena.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // `cache: "reload"` pula o cache HTTP: sem isso o SW poderia guardar uma
      // versão velha da tela offline que o navegador tivesse em mãos.
      .then((cache) =>
        cache.addAll(OFFLINE_ASSETS.map((url) => new Request(url, { cache: "reload" })))
      )
      // A instalação NÃO pode falhar por causa disto. Um SW que não instala é
      // um app que deixa de ser instalável — trocar a tela offline pelo
      // dinossauro é um preço muito menor.
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Navigation preload: como o handler de fetch abaixo intercepta toda
      // navegação, sem isto o navegador esperaria o SW acordar para só então
      // começar a requisição. Com ele as duas coisas acontecem em paralelo.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable().catch(() => {});
      }
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  // Só navegação, e só GET. Um POST de navegação (o formulário de
  // `/auth/sign-out`) passa direto: responder a ele com a tela offline
  // esconderia o erro real de um envio que talvez tenha chegado.
  if (request.method !== "GET" || request.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      try {
        const preloaded = await event.preloadResponse;
        if (preloaded) return preloaded;
        return await fetch(request);
      } catch {
        // Só se chega aqui SEM REDE. Erro do servidor (500, 404) devolve uma
        // resposta normal e nem passa por este catch — a tela offline mentiria.
        const cache = await caches.open(CACHE);
        const cached = await cache.match(OFFLINE_URL);
        return cached ?? Response.error();
      }
    })()
  );
});
