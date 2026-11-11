import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import type { AddressInfo } from "node:net";
import { createApp } from "../server/app";
import { detectColumns } from "../src/services/excel";
import { emptyData } from "../src/domain/demo";
import { hashPassword, verifyPassword } from "../server/auth";

describe("Backend local autenticado", () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let root: string;
  let base: string;
  let adminCookie: string;
  let viewerCookie: string;
  async function call(
    path: string,
    method = "GET",
    body?: unknown,
    cookie?: string,
    origin = "http://localhost:5173",
  ) {
    return fetch(`${base}/api${path}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        Origin: origin,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }
  async function login(email: string, password: string) {
    const response = await call("/auth/login", "POST", { email, password });
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    return response.headers.get("set-cookie")!.split(";")[0];
  }
  async function start() {
    app = await createApp({
      dbPath: resolve(root, "test.sqlite"),
      seed: false,
    });
    await new Promise<void>((resolve) =>
      app.server.listen(0, "127.0.0.1", resolve),
    );
    base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  }
  async function stop() {
    await new Promise<void>((resolve, reject) =>
      app.server.close((error) => (error ? reject(error) : resolve())),
    );
    app.store.close();
  }
  beforeAll(async () => {
    root = await mkdtemp(resolve(".reference/backend-"));
    await start();
    adminCookie = await login("admin@nettplus.local", "NettplusDemo2026!");
    viewerCookie = await login("viewer@nettplus.local", "ConsultaDemo2026!");
  }, 30000);
  afterAll(async () => {
    if (app) await stop();
    const allowed = resolve(".reference") + sep;
    if (root?.startsWith(allowed))
      await rm(root, { recursive: true, force: true });
  });
  it("protege las contraseñas con sal y comprueba el acceso", async () => {
    const hash = await hashPassword("UnaClaveDePrueba2026!");
    expect(hash).not.toContain("UnaClaveDePrueba");
    expect(await verifyPassword("UnaClaveDePrueba2026!", hash)).toBe(true);
    expect(await verifyPassword("Incorrecta", hash)).toBe(false);
    expect(
      (
        await call("/auth/login", "POST", {
          email: "admin@nettplus.local",
          password: "incorrecta",
        })
      ).status,
    ).toBe(401);
    expect((await call("/data")).status).toBe(401);
  });
  it("impide modificaciones de viewer también por HTTP y limita datos administrativos", async () => {
    const response = await call("/data", "GET", undefined, viewerCookie);
    const data = await response.json();
    expect(data.audits).toEqual([]);
    expect(data.users).toHaveLength(1);
    expect(data.users[0].role).toBe("viewer");
    for (const route of ["/imports", "/rules", "/users", "/reset"])
      expect(
        (
          await call(
            route,
            route === "/rules" ? "PUT" : "POST",
            { revision: data.revision },
            viewerCookie,
          )
        ).status,
      ).toBe(403);
    expect(
      (
        await call(
          "/reset",
          "POST",
          { revision: data.revision, mode: "clear" },
          adminCookie,
          "https://otro.example",
        )
      ).status,
    ).toBe(403);
  });
  it("valida el Excel en el servidor, guarda marcaciones y evita duplicados", async () => {
    const { default: ExcelJS } = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("20261019");
    const headers = [
      "Id del Empleado",
      "Nombres",
      "Departamento",
      "Fecha",
      "Hora",
      "Tipo de Marcación",
      "Tipo",
    ];
    sheet.addRows([
      ["Reporte de Marcaciones"],
      headers,
      [
        "T-01",
        "Persona de Prueba",
        "Área de prueba",
        "12-10-2026",
        "07:58",
        "Entrada",
        "Dato que no se almacena",
      ],
      [
        "T-01",
        "Persona de Prueba",
        "Área de prueba",
        "12-10-2026",
        "12:02",
        "Salida",
        "Dato que no se almacena",
      ],
    ]);
    const base64 = Buffer.from(await wb.xlsx.writeBuffer()).toString("base64");
    let data = await (
      await call("/data", "GET", undefined, adminCookie)
    ).json();
    const payload = {
      filename: "prueba.xlsx",
      base64,
      sheetIndex: 0,
      header: 1,
      kind: "attendance",
      map: detectColumns(headers),
      revision: data.revision,
    };
    let response = await call("/imports", "POST", payload, adminCookie);
    expect(response.status).toBe(200);
    data = await response.json();
    expect(data.punches).toHaveLength(2);
    expect(data.punches.map((p: { kind: string }) => p.kind)).toEqual([
      "entrada",
      "salida",
    ]);
    expect(data.imports[0].user).toBe("Administración Nettplus");
    response = await call(
      "/imports",
      "POST",
      { ...payload, revision: data.revision },
      adminCookie,
    );
    data = await response.json();
    expect(data.punches).toHaveLength(2);
    expect(data.imports[0].duplicates).toBe(2);
    expect(data.imports[0].valid).toBe(0);
  }, 30000);
  it("rechaza cambios con una revisión obsoleta y conserva la auditoría", async () => {
    const data = await (
      await call("/data", "GET", undefined, adminCookie)
    ).json();
    expect(
      (
        await call(
          "/rules",
          "PUT",
          { rules: emptyData().rules, revision: data.revision },
          adminCookie,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await call(
          "/reset",
          "POST",
          { mode: "clear", revision: data.revision },
          adminCookie,
        )
      ).status,
    ).toBe(409);
    const updated = await (
      await call("/data", "GET", undefined, adminCookie)
    ).json();
    expect(
      updated.audits.some(
        (a: { action: string }) => a.action === "Configuración de reglas",
      ),
    ).toBe(true);
    expect(updated.punches).toHaveLength(2);
  });
  it("conserva datos y cuentas al reiniciar y revoca la sesión al salir", async () => {
    await stop();
    await start();
    const data = await (
      await call("/data", "GET", undefined, adminCookie)
    ).json();
    expect(data.punches).toHaveLength(2);
    expect(data.users).toHaveLength(2);
    expect(
      (await call("/auth/logout", "POST", undefined, viewerCookie)).status,
    ).toBe(200);
    expect((await call("/data", "GET", undefined, viewerCookie)).status).toBe(
      401,
    );
  });
  it("crea cuentas con contraseña y revoca su acceso al desactivarlas", async () => {
    let data = await (
      await call("/data", "GET", undefined, adminCookie)
    ).json();
    let response = await call(
      "/users",
      "POST",
      {
        revision: data.revision,
        user: {
          name: "Consulta Prueba",
          email: "consulta@prueba.example",
          role: "viewer",
          active: true,
        },
        password: "PruebaAcceso2026!",
      },
      adminCookie,
    );
    expect(response.status).toBe(200);
    data = await response.json();
    expect(JSON.stringify(data.users)).not.toContain("PruebaAcceso2026");
    const account = data.users.find(
      (u: { email: string }) => u.email === "consulta@prueba.example",
    );
    const cookie = await login("consulta@prueba.example", "PruebaAcceso2026!");
    data = await (await call("/data", "GET", undefined, adminCookie)).json();
    response = await call(
      "/users",
      "POST",
      { revision: data.revision, user: { ...account, active: false } },
      adminCookie,
    );
    expect(response.status).toBe(200);
    expect((await call("/data", "GET", undefined, cookie)).status).toBe(401);
  });
});
