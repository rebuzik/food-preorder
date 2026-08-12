import { headers } from "next/headers";

const COOKIE_NAME = "rft_admin_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60;

export type AdminIdentity = {
  username: string;
  displayName: string;
  email: string;
};

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
  const username = runtimeEnv.ADMIN_USERNAME;
  const password = runtimeEnv.ADMIN_PASSWORD;
  const sessionSecret = runtimeEnv.ADMIN_SESSION_SECRET;
  if (!username || !password || !sessionSecret)
    throw new Error("Вход администратора ещё не настроен.");
  return { username, password, sessionSecret };
}

async function digest(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

export async function verifyAdminCredentials(
  candidateUsername: string,
  candidatePassword: string,
) {
  const { username, password } = await getSecrets();
  const [candidateUsernameDigest, usernameDigest, candidatePasswordDigest, passwordDigest] =
    await Promise.all([
      digest(candidateUsername),
      digest(username),
      digest(candidatePassword),
      digest(password),
    ]);
  return (
    constantTimeEqual(candidateUsernameDigest, usernameDigest) &&
    constantTimeEqual(candidatePasswordDigest, passwordDigest)
  );
}

export async function createAdminSession(username: string) {
  const { sessionSecret } = await getSecrets();
  const payload = encodeBase64Url(
    new TextEncoder().encode(
      JSON.stringify({
        username,
        exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
      }),
    ),
  );
  const signature = encodeBase64Url(await sign(payload, sessionSecret));
  return `${payload}.${signature}`;
}

export async function getAdminSession(): Promise<AdminIdentity | null> {
  const cookieHeader = (await headers()).get("cookie") ?? "";
  const token = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  try {
    const { username, sessionSecret } = await getSecrets();
    if (!constantTimeEqual(decodeBase64Url(signature), await sign(payload, sessionSecret))) return null;
    const data = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload))) as {
      username?: string;
      exp?: number;
    };
    if (
      typeof data.username !== "string" ||
      typeof data.exp !== "number" ||
      data.exp <= Math.floor(Date.now() / 1000) ||
      !constantTimeEqual(await digest(data.username), await digest(username))
    ) return null;
    return { username, displayName: username, email: username };
  } catch {
    return null;
  }
}

export async function hasAdminSession() {
  return Boolean(await getAdminSession());
}

export async function getAuthorizedAdmin() {
  return getAdminSession();
}

export function adminSessionCookie(token: string) {
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearAdminSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}
