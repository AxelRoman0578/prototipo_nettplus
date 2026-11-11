import { get, set } from "idb-keyval";
import { createDemo } from "../domain/demo";
import { assertAdmin, punchKey } from "../domain/attendance";
import type { AppData, DemoUser } from "../domain/types";
import type { ValidationResult } from "./excel";

const KEY = "nettplus:demo:v1";
export async function loadData(): Promise<AppData> {
  const data = await get<AppData>(KEY);
  if (data) {
    if (
      data.version !== 1 ||
      !Array.isArray(data.punches) ||
      !Array.isArray(data.employees)
    )
      throw new Error(
        "Los datos guardados no son compatibles con esta versión.",
      );
    return {
      ...data,
      permits: data.permits ?? [],
      sourceHours: data.sourceHours ?? [],
      dataset:
        data.dataset ??
        (data.imports.some((i) => i.id.startsWith("demo-"))
          ? "mixed"
          : "imported"),
    };
  }
  const demo = createDemo();
  await set(KEY, demo);
  return demo;
}
export async function saveData(data: AppData) {
  await set(KEY, data);
}
export function withAudit(
  data: AppData,
  user: DemoUser,
  action: string,
  detail: string,
): AppData {
  return {
    ...data,
    audits: [
      {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        user: user.name,
        action,
        detail,
      },
      ...data.audits,
    ],
  };
}
export function commitImport(
  data: AppData,
  user: DemoUser,
  file: string,
  sheet: string,
  result: ValidationResult,
): AppData {
  assertAdmin(user.role);
  if (!user.active) throw new Error("El usuario está desactivado.");
  const seen = new Set(data.punches.map(punchKey));
  const id = crypto.randomUUID();
  const punches = result.punches
    .filter((p) => !seen.has(punchKey(p)))
    .map((p) => ({ ...p, importId: id }));
  if (punches.length !== result.punches.length)
    throw new Error(
      "Los datos cambiaron. Valida de nuevo el archivo antes de confirmar.",
    );
  const employees = new Map(data.employees.map((e) => [e.id, e]));
  result.employees.forEach((e) => employees.set(e.id, e));
  const log = {
    id,
    file,
    sheet,
    at: new Date().toISOString(),
    user: user.name,
    rows: result.total,
    valid: result.valid,
    duplicates: result.duplicates,
    invalid: result.invalid,
    warnings: result.incomplete,
    issues: result.issues,
  };
  return withAudit(
    {
      ...data,
      dataset:
        data.dataset === "demo" || data.dataset === "mixed"
          ? "mixed"
          : "imported",
      employees: [...employees.values()],
      punches: [...data.punches, ...punches],
      imports: [log, ...data.imports],
    },
    user,
    "Importación de Excel",
    `${file} · ${sheet} · ${result.valid} filas válidas · ${punches.length} marcaciones · ${result.invalid} rechazadas · ${result.duplicates} duplicadas.`,
  );
}
