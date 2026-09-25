export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Aquece a tradução PADRÃO (hoje a Bíblia Livre), para que a primeira
  // chamada a /api/verse não pague o parse do JSON de 4 MB (~100-200ms).
  //
  // Só ela, mesmo havendo um seletor: aquecer as duas dobraria a memória de
  // toda instância para adiantar a minoria das leituras. Quem escolheu a
  // Almeida 1911 paga o parse uma vez por instância, na primeira passagem, e
  // dali em diante lê do cache do loader como todo mundo.
  //
  // Antes daqui saíam TRÊS traduções, e nenhuma delas por escolha de ninguém:
  // eram ~8 MB lidos do disco, parseados e mantidos vivos em toda instância do
  // servidor, inclusive nas que nunca consultariam versículo nenhum. Ver
  // lib/bibles/loader.ts.
  const { loadBible } = await import("@/lib/bibles/loader");
  await loadBible();
}
