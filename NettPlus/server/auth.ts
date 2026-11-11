import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { IncomingMessage } from "node:http";
import type { DemoUser } from "../src/domain/types";
import type { Store } from "./store";

const derive = promisify(scrypt);
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await derive(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const hash = (await derive(password, salt, 64)) as Buffer;
  const buffer = Buffer.from(expected, "hex");
  return buffer.length === hash.length && timingSafeEqual(buffer, hash);
}
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function getToken(req: IncomingMessage) {
  return (
    req.headers.cookie
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("nettplus_session="))
      ?.slice("nettplus_session=".length) ?? ""
  );
}
export function sessionUser(
  store: Store,
  req: IncomingMessage,
): DemoUser | null {
  const token = getToken(req);
  if (!token) return null;
  const row = store.db
    .prepare(
      "SELECT u.id,u.name,u.email,u.role,u.active FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>? AND u.active=1",
    )
    .get(digest(token), Date.now());
  return row ? ({ ...row, active: true } as unknown as DemoUser) : null;
}
export function createSession(store: Store, userId: string) {
  const token = randomBytes(32).toString("hex");
  store.db.prepare("DELETE FROM sessions WHERE expires<=?").run(Date.now());
  store.db
    .prepare("INSERT INTO sessions VALUES (?,?,?)")
    .run(digest(token), userId, Date.now() + 8 * 60 * 60 * 1000);
  return token;
}
export function removeSession(store: Store, token: string) {
  store.db
    .prepare("DELETE FROM sessions WHERE token_hash=?")
    .run(digest(token));
}
export function sessionCookie(token: string) {
  return `nettplus_session=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${token ? 28800 : 0}${process.env.NETTPLUS_COOKIE_SECURE === "true" ? "; Secure" : ""}`;
}
export async function initializeUsers(store: Store) {
  if (store.users().length) return;
  const adminPassword =
    process.env.NETTPLUS_ADMIN_PASSWORD || "NettplusDemo2026!";
  const viewerPassword =
    process.env.NETTPLUS_VIEWER_PASSWORD || "ConsultaDemo2026!";
  if (adminPassword.length < 10 || viewerPassword.length < 10)
    throw new Error(
      "Las contraseñas iniciales deben tener al menos 10 caracteres.",
    );
  const insert = store.db.prepare("INSERT INTO users VALUES (?,?,?,?,?,?)");
  insert.run(
    "admin-local",
    "Administración Nettplus",
    process.env.NETTPLUS_ADMIN_EMAIL || "admin@nettplus.local",
    "admin",
    1,
    await hashPassword(adminPassword),
  );
  insert.run(
    "viewer-local",
    "Consulta de asistencia",
    process.env.NETTPLUS_VIEWER_EMAIL || "viewer@nettplus.local",
    "viewer",
    1,
    await hashPassword(viewerPassword),
  );
}
