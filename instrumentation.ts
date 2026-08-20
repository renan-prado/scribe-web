export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Warm the three most-used translations so the first /api/verse call
  // doesn't pay the 4MB JSON parse cost (~100-200ms per file).
  const { loadBible } = await import("@/lib/bibles/loader");
  await Promise.all([loadBible("NVI"), loadBible("NVT"), loadBible("ARC")]);
}
