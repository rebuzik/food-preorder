const cloudflareWorkersShimUrl = new URL("./cloudflare-workers-node.mjs", import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:workers") {
    return { url: cloudflareWorkersShimUrl, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
