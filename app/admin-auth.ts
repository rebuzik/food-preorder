import { headers } from "next/headers";
import { getChatGPTUser, type ChatGPTUser } from "./chatgpt-auth";

const COOKIE_NAME = "rft_admin_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60;

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function getSecrets() {
  const { env } = await import("cloudflare:workers");
  const runtimeEnv = env as unknown as Record<string, string | undefined>;
  const password = runtimeEnv.ADMIN_PASSWORD;
  const sessionSecret = runtimeEnv.ADMIN_SESSION_SECRET;
  if (!password || !sessionSecret) throw new Error("Вход администратора ещё не настроен.");
  return { password, sessionSecret };
}

async function digest(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

export async function verifyAdminPassword(candidate: string) {
  const { password } = await getSecrets();
  return constantTimeEqual(await digest(candidate), await digest(password));
}

export async function createAdminSession(email: string) {
  const { sessionSecret } = await getSecrets();
  const payload = encodeBase64Url(new TextEncoder().encode(JSON.stringify({ email, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS })));
  const signature = encodeBase64Url(await sign(payload, sessionSecret));
  return `${payload}.${signature}`;
}

export async function hasAdminSession(email: string) {
  const cookieHeader = (await headers()).get("cookie") ?? "";
  const token = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!token) return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;
  try {
    const { sessionSecret } = await getSecrets();
    if (!constantTimeEqual(decodeBase64Url(signature), await sign(payload, sessionSecret))) return false;
    const data = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload))) as { email?: string; exp?: number };
    return data.email === email && typeof data.exp === "number" && data.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export async function getAuthorizedAdmin(): Promise<ChatGPTUser | null> {
  const user = await getChatGPTUser();
  if (!user || !(await hasAdminSession(user.email))) return null;
  return user;
}

export function adminSessionCookie(token: string) {
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearAdminSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}
