// Service worker do Scriba. Ele faz QUATRO coisas:
//
// 1. Existir. É requisito do navegador para nos tratar como PWA instalável
//    (Android/Chrome/Edge).
// 2. Servir uma tela própria quando uma navegação falha por falta de rede, em
//    vez do dinossauro do Chrome.
// 3. Guardar a CASCA do app — os arquivos de `/_next/static/`, a marca e os
//    ícones — para que abrir sem rede não dependa de o navegador ainda ter
//    aquilo no cache HTTP dele.
// 4. Guardar a última resposta das DUAS telas que a tela offline oferece como
//    atalho (`/home` e `/recording`), para que "abrir minhas notas" e "gravar
//    agora" sejam botões de verdade e não uma volta ao aviso de sempre.
//
// **O que continua fora do cache é o CONTEÚDO**, e isso não mudou: nenhuma
// resposta de `/api/*`, nenhuma tela de sessão (`/summary/:id`,
// `/escrever/:id`), nada que carregue transcrição, feed ou saldo. Um cache
// velho ali não apareceria como bug de cache: apareceria como uma sessão que
// perdeu texto. Quem guarda ESTADO é o TanStack Query, no IndexedDB, porque ele
// sabe revalidar o que guardou; o service worker só guarda o que é casca.
//
// **As duas telas do item 4 são a exceção, e ela é estreita de propósito.** O
// que se guarda é o HTML da moldura, servido SÓ quando a rede falhou, e
// descartado no logout e na troca de conta (ver `PAGE_CACHE` abaixo). Sem isso
// os atalhos da tela offline seriam botões que levam de volta a ela.
//
// Registrado por `src/shared/components/PwaBootstrap.tsx`, nunca em dev.

/** A casca da tela offline. Estática, e a única coisa PRÉ-cacheada. */
const SHELL_CACHE = "scriba-shell-v2";
/** Os arquivos da casca do app, guardados conforme vão sendo pedidos. */
const ASSET_CACHE = "scriba-assets-v2";
/** O HTML das telas de atalho. É o único cache com dado de CONTA dentro. */
const PAGE_CACHE = "scriba-pages-v2";
const KEEP = [SHELL_CACHE, ASSET_CACHE, PAGE_CACHE];

const OFFLINE_URL = "/offline.html";
// A pena, que a página offline pinta por máscara CSS. Sem ela no cache, a
// única imagem da tela offline seria justamente a que não carrega.
const OFFLINE_ASSETS = [OFFLINE_URL, "/brand/pena.svg"];

// As telas que a tela offline oferece como atalho. Mexeu aqui? Mexa no
// `SHELL_ROUTES` de `public/offline.html`, que decide quais botões desenhar.
const SHELL_ROUTES = ["/home", "/recording"];

// O teto do cache de assets. Os arquivos de `/_next/static/` levam o hash do
// build no caminho, então um deploy novo nunca sobrescreve o anterior: sem teto
// o cache cresceria um app inteiro por release até o navegador despejar tudo de
// uma vez. `keys()` devolve na ordem de inserção, então cortar do começo tira
// os mais antigos, que são os dos builds que já saíram do ar.
const ASSET_MAX_ENTRIES = 240;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // `cache: "reload"` pula o cache HTTP: sem isso o SW poderia guardar uma
      // versão velha da tela offline que o navegador tivesse em mãos.
      .then((cache) =>
        cache.addAll(OFFLINE_ASSETS.map((url) => new Request(url, { cache: "reload" })))
      )
      // A instalação NÃO pode falhar por causa disto. Um SW que não instala é
      // um app que deixa de ser instalável, trocar a tela offline pelo
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
      await Promise.all(keys.filter((key) => !KEEP.includes(key)).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

// O `PAGE_CACHE` guarda HTML de uma conta logada, então ele precisa de um jeito
// de ser apagado de fora. Quem manda a mensagem é o `CacheOwner` quando o dono
// do aparelho muda — inclusive quando a sessão expira sozinha, que é o caso que
// o logout explícito abaixo não cobre.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "scriba:purge-private") {
    event.waitUntil(caches.delete(PAGE_CACHE));
  }
});

// A notificação de "Gravando áudio em background…" (ver
// `src/app/(app)/(barra)/recording/useRecordingPresence.ts`). O toque nela tem
// UM trabalho: trazer de volta a aba que está com o microfone aberto. Por isso
// ele procura QUALQUER janela do Scriba antes de abrir uma nova — abrir outra
// durante uma gravação daria duas abas disputando o microfone, que é o mesmo
// motivo do `launch_handler` do manifest.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/recording";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })()
  );
});

/** Vale a pena guardar esta resposta? Redirecionada, não: o que voltou foi a
 *  tela de login, e guardá-la sob `/home` seria servir o login sem rede. */
function isStorable(response) {
  return Boolean(
    response && response.ok && response.status === 200 && !response.redirected && !response.bodyUsed
  );
}

async function trimCache(cache, max) {
  const keys = await cache.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map((key) => cache.delete(key)));
}

/** Imutável de verdade: o caminho carrega o hash do build. */
function isHashedAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

/** Estático, mas sem hash no nome: marca e glifos. Vale servir do cache e
 *  conferir atrás, porque um deploy pode trocar o arquivo sem trocar a URL. */
function isStaticAsset(url) {
  return url.pathname.startsWith("/brand/") || url.pathname.startsWith("/icons/");
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (isStorable(response)) {
    await cache.put(request, response.clone());
    await trimCache(cache, ASSET_MAX_ENTRIES);
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);
  const fresh = fetch(request)
    .then(async (response) => {
      if (isStorable(response)) {
        await cache.put(request, response.clone());
        await trimCache(cache, ASSET_MAX_ENTRIES);
      }
      return response;
    })
    .catch(() => null);
  if (hit) return hit;
  const response = await fresh;
  return response ?? Response.error();
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  // Nada de outra origem passa por aqui: o Supabase, o Stripe e o GA4 falam
  // direto com a rede, e um cache nosso no meio deles só criaria uma segunda
  // explicação para uma resposta velha.
  if (url.origin !== self.location.origin) return;

  if (request.method !== "GET") {
    // O logout é um `<form method="post">`. Ele passa direto — responder a um
    // POST com a tela offline esconderia o erro real de um envio que talvez
    // tenha chegado —, mas é a deixa para apagar o HTML da conta que sai.
    if (url.pathname === "/auth/sign-out") {
      event.waitUntil(caches.delete(PAGE_CACHE));
    }
    return;
  }

  if (request.mode === "navigate") {
    const shellPath = SHELL_ROUTES.includes(url.pathname) ? url.pathname : null;
    event.respondWith(
      (async () => {
        try {
          const preloaded = await event.preloadResponse;
          const response = preloaded || (await fetch(request));
          // A chave é o CAMINHO, sem query: `/home?pasta=x` e `/home` desenham
          // a mesma moldura, e guardar uma entrada por filtro encheria o cache
          // de cópias da mesma casca.
          if (shellPath && isStorable(response)) {
            const copy = response.clone();
            event.waitUntil(
              caches.open(PAGE_CACHE).then((cache) => cache.put(shellPath, copy))
            );
          }
          return response;
        } catch {
          // Só se chega aqui SEM REDE. Erro do servidor (500, 404) devolve uma
          // resposta normal e nem passa por este catch, a tela offline mentiria.
          if (shellPath) {
            const page = await caches.open(PAGE_CACHE).then((cache) => cache.match(shellPath));
            if (page) return page;
          }
          const shell = await caches.open(SHELL_CACHE);
          const cached = await shell.match(OFFLINE_URL);
          return cached ?? Response.error();
        }
      })()
    );
    return;
  }

  if (isHashedAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
