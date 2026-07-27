export async function getD1() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) {
    throw new Error("Хранилище предзаказов временно недоступно.");
  }
  return env.DB;
}
