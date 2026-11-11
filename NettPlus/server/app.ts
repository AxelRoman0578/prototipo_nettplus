import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { Store } from "./store";
import {
  createSession,
  getToken,
  hashPassword,
  initializeUsers,
  removeSession,
  sessionCookie,
  sessionUser,
  verifyPassword,
} from "./auth";
import { createDemo, emptyData } from "../src/domain/demo";
import {
  fields,
  readExcel,
  validateSheet,
  type ColumnMap,
} from "../src/services/excel";
import { commitImport, withAudit } from "../src/services/storage";
import {
  commitDocument,
  validateDocument,
} from "../src/services/sourceDocuments";
import type { AppData, DemoUser, Rules } from "../src/domain/types";

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
function send(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(data));
}
async function json(
  req: IncomingMessage,
  max = 1024 * 1024,
): Promise<Record<string, unknown>> {
  if (!req.headers["content-type"]?.startsWith("application/json"))
    throw new HttpError(415, "Utiliza un cuerpo JSON válido.");
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max)
      throw new HttpError(413, "El archivo supera el tamaño permitido.");
    chunks.push(Buffer.from(chunk));
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || Array.isArray(body) || typeof body !== "object")
      throw new Error();
    return body;
  } catch {
    throw new HttpError(400, "La solicitud no contiene JSON válido.");
  }
}
function validateRules(value: unknown): Rules {
  const r = value as Rules;
  if (
    !r ||
    typeof r.enabled !== "boolean" ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.start) ||
    !Number.isInteger(r.tolerance) ||
    r.tolerance < 0 ||
    r.tolerance > 120 ||
    !Number.isInteger(r.maxFileMB) ||
    r.maxFileMB < 1 ||
    r.maxFileMB > 50 ||
    !Array.isArray(r.weekdays) ||
    !r.weekdays.length ||
    new Set(r.weekdays).size !== r.weekdays.length ||
    r.weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
  )
    throw new HttpError(400, "Los parámetros de asistencia no son válidos.");
  return {
    enabled: r.enabled,
    start: r.start,
    tolerance: r.tolerance,
    maxFileMB: r.maxFileMB,
    weekdays: r.weekdays,
  };
}
export async function createApp(options: {
  dbPath: string;
  seed?: boolean;
  origins?: string[];
}) {
  const store = new Store(options.dbPath, options.seed);
  await initializeUsers(store);
  const origins = new Set(
    options.origins ?? [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4173",
      "http://127.0.0.1:4173",
    ],
  );
  const attempts = new Map<string, { count: number; reset: number }>();
  function dataFor(user: DemoUser) {
    const data = store.read();
    return user.role === "admin"
      ? data
      : {
          ...data,
          users: [user],
          audits: [],
          imports: data.imports.map((log) => ({ ...log, issues: [] })),
        };
  }
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url ?? "/", "http://localhost").pathname;
      const method = req.method ?? "GET";
      const mutation = !["GET", "HEAD", "OPTIONS"].includes(method);
      if (mutation && req.headers.origin && !origins.has(req.headers.origin))
        throw new HttpError(403, "Origen de solicitud no autorizado.");
      if (path === "/api/health" && method === "GET")
        return send(res, 200, { service: "nettplus-api", version: 1 });
      if (path === "/api/auth/login" && method === "POST") {
        const body = await json(req, 4096);
        const email = String(body.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(body.password ?? "");
        if (email.length > 120 || password.length > 128)
          throw new HttpError(400, "Revisa el correo y la contraseña.");
        const attemptKey = `${req.socket.remoteAddress}|${email}`;
        const now = Date.now();
        const prior = attempts.get(attemptKey);
        if (prior && prior.reset > now && prior.count >= 8)
          throw new HttpError(
            429,
            "Demasiados intentos. Vuelve a intentarlo en 15 minutos.",
          );
        const row = store.db
          .prepare("SELECT * FROM users WHERE email=? COLLATE NOCASE")
          .get(email);
        const valid = await verifyPassword(
          password,
          String(
            row?.password_hash ??
              "00000000000000000000000000000000:" + "00".repeat(64),
          ),
        );
        const latest = row
          ? store.db
              .prepare("SELECT password_hash,active FROM users WHERE id=?")
              .get(row.id)
          : null;
        if (
          !row ||
          !latest?.active ||
          latest.password_hash !== row.password_hash ||
          !valid
        ) {
          if (attempts.size > 500)
            for (const [key, value] of attempts)
              if (value.reset <= now) attempts.delete(key);
          if (attempts.size >= 1000)
            attempts.delete(attempts.keys().next().value!);
          attempts.set(attemptKey, {
            count: prior && prior.reset > now ? prior.count + 1 : 1,
            reset: prior && prior.reset > now ? prior.reset : now + 900000,
          });
          throw new HttpError(
            401,
            "El correo o la contraseña no son correctos.",
          );
        }
        attempts.delete(attemptKey);
        const user = store.users().find((u) => u.id === row.id)!;
        const token = createSession(store, user.id);
        store.save(
          withAudit(
            store.read(),
            user,
            "Inicio de sesión",
            "Acceso autenticado al servidor local.",
          ),
        );
        res.setHeader("Set-Cookie", sessionCookie(token));
        return send(res, 200, { user, data: dataFor(user) });
      }
      const user = sessionUser(store, req);
      if (!user) throw new HttpError(401, "Inicia sesión para continuar.");
      if (path === "/api/session" && method === "GET")
        return send(res, 200, { user, data: dataFor(user) });
      if (path === "/api/auth/logout" && method === "POST") {
        removeSession(store, getToken(req));
        store.save(
          withAudit(
            store.read(),
            user,
            "Cierre de sesión",
            "Sesión local finalizada.",
          ),
        );
        res.setHeader("Set-Cookie", sessionCookie(""));
        return send(res, 200, { ok: true });
      }
      if (path === "/api/data" && method === "GET")
        return send(res, 200, dataFor(user));
      if (user.role !== "admin")
        throw new HttpError(
          403,
          "Tu rol viewer permite consultas y reportes, sin modificar información.",
        );
      const max =
        path === "/api/imports"
          ? Math.ceil(store.read().rules.maxFileMB * 1024 * 1024 * 1.38) + 4096
          : 1024 * 1024;
      const body = await json(req, max);
      const checkRevision = () => {
        if (
          !Number.isInteger(body.revision) ||
          body.revision !== store.read().revision
        )
          throw new HttpError(
            409,
            "La información cambió en otra sesión. Los datos se actualizaron; revisa y vuelve a intentar.",
          );
      };
      checkRevision();
      let next: AppData;
      let accountMutation: (() => void) | undefined;
      if (path === "/api/imports" && method === "POST") {
        const filename = String(body.filename ?? "");
        if (
          !/\.xlsx$/i.test(filename) ||
          filename.length > 255 ||
          typeof body.base64 !== "string"
        )
          throw new HttpError(400, "Selecciona un archivo Excel .xlsx válido.");
        const bytes = Buffer.from(body.base64, "base64");
        if (
          bytes.length > store.read().rules.maxFileMB * 1024 * 1024 ||
          bytes[0] !== 80 ||
          bytes[1] !== 75
        )
          throw new HttpError(
            400,
            "El archivo no es un Excel válido o supera el tamaño permitido.",
          );
        const sheets = await readExcel(bytes as unknown as ArrayBuffer);
        checkRevision();
        const sheet = sheets[Number(body.sheetIndex)];
        const header = Number(body.header);
        if (
          !sheet ||
          !Number.isInteger(header) ||
          header < 0 ||
          header > 99 ||
          header >= sheet.rows.length
        )
          throw new HttpError(
            400,
            "La hoja o la fila de encabezados no es válida.",
          );
        const current = store.read();
        if (body.kind === "permits" || body.kind === "hours") {
          const validation = validateDocument(
            sheet,
            header,
            body.kind,
            current,
            String(body.month ?? ""),
          );
          if (!validation.total)
            throw new HttpError(400, "La hoja seleccionada no contiene datos.");
          next = commitDocument(
            current,
            user,
            filename,
            sheet.name,
            validation,
          );
        } else {
          const map = body.map as ColumnMap;
          if (
            !map ||
            fields.some(
              ([key]) =>
                !Number.isInteger(map[key]) || map[key] < -1 || map[key] > 149,
            )
          )
            throw new HttpError(
              400,
              "La correspondencia de columnas no es válida.",
            );
          const validation = validateSheet(sheet, header, map, current);
          if (!validation.total)
            throw new HttpError(400, "La hoja seleccionada no contiene datos.");
          next = commitImport(current, user, filename, sheet.name, validation);
        }
      } else if (path === "/api/rules" && method === "PUT") {
        next = withAudit(
          { ...store.read(), rules: validateRules(body.rules) },
          user,
          "Configuración de reglas",
          "Parámetros de demostración actualizados en el servidor local.",
        );
      } else if (path === "/api/reset" && method === "POST") {
        if (!["seed", "clear"].includes(String(body.mode)))
          throw new HttpError(400, "Operación de datos no válida.");
        const previous = store.read();
        const clean = body.mode === "seed" ? createDemo() : emptyData();
        next = withAudit(
          {
            ...clean,
            users: previous.users,
            rules: previous.rules,
            audits: previous.audits,
          },
          user,
          body.mode === "seed"
            ? "Reinicio de demostración"
            : "Limpieza de asistencia",
          "Operación confirmada por el administrador en el servidor local.",
        );
      } else if (path === "/api/users" && method === "POST") {
        const input = body.user as DemoUser;
        const password = String(body.password ?? "");
        if (
          !input ||
          typeof input.name !== "string" ||
          !input.name.trim() ||
          input.name.length > 80 ||
          typeof input.email !== "string" ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) ||
          input.email.length > 120 ||
          !["admin", "viewer"].includes(input.role) ||
          typeof input.active !== "boolean"
        )
          throw new HttpError(
            400,
            "Revisa el nombre, correo y rol del usuario.",
          );
        const existing = input.id
          ? store.users().find((u) => u.id === input.id)
          : null;
        if (input.id && !existing)
          throw new HttpError(404, "El usuario ya no está disponible.");
        if (
          (!existing && password.length < 10) ||
          (password && (password.length < 10 || password.length > 128))
        )
          throw new HttpError(
            400,
            "La contraseña debe tener entre 10 y 128 caracteres.",
          );
        if (
          existing?.id === user.id &&
          (!input.active || input.role !== "admin")
        )
          throw new HttpError(
            400,
            "No puedes desactivar ni quitar el rol de tu sesión actual.",
          );
        if (
          store
            .users()
            .some(
              (u) =>
                u.id !== existing?.id &&
                u.email.toLowerCase() === input.email.toLowerCase().trim(),
            )
        )
          throw new HttpError(409, "Este correo ya está registrado.");
        const id = existing?.id ?? crypto.randomUUID();
        const passwordHash = password
          ? await hashPassword(password)
          : String(
              store.db
                .prepare("SELECT password_hash FROM users WHERE id=?")
                .get(id)?.password_hash,
            );
        checkRevision();
        next = withAudit(
          store.read(),
          user,
          existing ? "Edición de usuario" : "Alta de usuario",
          `${input.name.trim()} · ${input.role} · ${input.active ? "activo" : "inactivo"}`,
        );
        accountMutation = () => {
          store.db
            .prepare(
              "INSERT INTO users VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,role=excluded.role,active=excluded.active,password_hash=excluded.password_hash",
            )
            .run(
              id,
              input.name.trim(),
              input.email.trim().toLowerCase(),
              input.role,
              Number(input.active),
              passwordHash,
            );
          if (
            existing &&
            (password || !input.active || existing.role !== input.role)
          )
            store.db.prepare("DELETE FROM sessions WHERE user_id=?").run(id);
        };
      } else throw new HttpError(404, "La operación solicitada no existe.");
      store.save(next, accountMutation);
      return send(res, 200, dataFor(user));
    } catch (error) {
      if (error instanceof HttpError)
        return send(res, error.status, { error: error.message });
      if (
        error instanceof Error &&
        /archivo|columna|hoja|fecha|Asigna|permiso|consolidado|Excel/i.test(
          error.message,
        )
      )
        return send(res, 400, { error: error.message });
      console.error(
        "Nettplus API:",
        error instanceof Error ? error.message : "Error inesperado",
      );
      send(res, 500, {
        error:
          "No se pudo completar la operación. Los cambios no se confirmaron.",
      });
    }
  });
  return { server, store };
}
