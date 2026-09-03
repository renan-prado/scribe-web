export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Aquece a NVI — a única tradução que a aplicação lê — para que a primeira
  // chamada a /api/verse não pague o parse do JSON de 4 MB (~100-200ms).
  //
  // Antes daqui saíam TRÊS traduções (NVI, NVT, ARC). Só a NVI tem consumidor
  // no código: as outras duas eram ~8 MB lidos do disco, parseados e mantidos
  // vivos em toda instância do servidor — inclusive nas que só iam servir
  // /feed — sem nunca serem consultadas. Ver lib/bibles/loader.ts.
  const { loadBible } = await import("@/lib/bibles/loader");
  await loadBible();
}
