import path from "node:path";
import { getPlatformProxy } from "wrangler";

const platformProxyKey = Symbol.for("food-preorder.platform-proxy");
const processEnvBindings = new Set([
  "ADMIN_USERNAME",
  "ADMIN_PASSWORD",
  "ADMIN_SESSION_SECRET",
]);

const persistRoot =
  process.env.WRANGLER_PERSIST_ROOT ?? path.resolve(process.cwd(), ".wrangler/state");
const configPath = path.resolve(process.cwd(), "wrangler.runtime.jsonc");

if (!globalThis[platformProxyKey]) {
  globalThis[platformProxyKey] = getPlatformProxy({
    configPath,
    envFiles: [],
    persist: { path: path.join(persistRoot, "v3") },
    remoteBindings: false,
  });
}

const platform = await globalThis[platformProxyKey];

export const env = new Proxy(platform.env, {
  get(target, property, receiver) {
    if (typeof property === "string" && processEnvBindings.has(property)) {
      return process.env[property];
    }
    return Reflect.get(target, property, receiver);
  },
});
