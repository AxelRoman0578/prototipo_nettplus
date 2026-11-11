import type { AppData, Employee, ImportIssue, Punch } from "../domain/types";
import { punchKey } from "../domain/attendance";

export type Cell = string | number | Date | null;
export interface SheetData {
  name: string;
  rows: Cell[][];
}
export const fields = [
  ["code", "Código biométrico *"],
  ["name", "Nombre *"],
  ["department", "Departamento"],
  ["date", "Fecha *"],
  ["entry", "Hora de entrada"],
  ["exit", "Hora de salida"],
  ["datetime", "Fecha y hora de evento"],
  ["time", "Hora de evento"],
  ["kind", "Tipo de evento"],
  ["status", "Estado laboral"],
  ["activeFrom", "Inicio laboral"],
  ["activeTo", "Fin laboral"],
] as const;
export type Field = (typeof fields)[number][0];
export type ColumnMap = Record<Field, number>;
export interface ValidationResult {
  employees: Employee[];
  punches: Omit<Punch, "importId">[];
  issues: ImportIssue[];
  total: number;
  valid: number;
  duplicates: number;
  invalid: number;
  incomplete: number;
}
const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const aliases: Record<Field, string[]> = {
  code: [
    "codigo",
    "codigobiometrico",
    "id",
    "employeeid",
    "idcolaborador",
    "iddelempleado",
    "idempleado",
    "numeroempleado",
    "personnelid",
    "userid",
    "legajo",
  ],
  name: [
    "nombre",
    "nombres",
    "nombrecompleto",
    "colaborador",
    "empleado",
    "name",
    "employeename",
  ],
  department: ["departamento", "department", "area", "departamentoempleado"],
  date: ["fecha", "date", "dia"],
  entry: ["entrada", "horaentrada", "checkin", "ingreso"],
  exit: ["salida", "horasalida", "checkout"],
  datetime: [
    "fechahora",
    "fechayhora",
    "marcacion",
    "datetime",
    "punch time",
    "punchtime",
    "timestamp",
    "tiempo",
  ],
  time: ["hora", "time", "horadeevento", "horaevento", "horamarcacion"],
  kind: [
    "tipo",
    "tipomarcacion",
    "tipodemarcacion",
    "tipodeevento",
    "estadoasistencia",
    "punchstate",
    "tipoevento",
    "checktype",
  ],
  status: ["estado", "estadolaboral", "status"],
  activeFrom: ["iniciolaboral", "fechaingreso", "fechainicio"],
  activeTo: ["finlaboral", "fecharetiro", "fechafin"],
};
export function detectColumns(headers: Cell[]): ColumnMap {
  return Object.fromEntries(
    fields.map(([key]) => [
      key,
      headers.findIndex((h) =>
        aliases[key].map(normalize).includes(normalize(h)),
      ),
    ]),
  ) as ColumnMap;
}
export function mappingErrors(map: ColumnMap): string[] {
  const errors: string[] = [];
  if (map.code < 0) errors.push("Asigna la columna de código biométrico.");
  if (map.name < 0) errors.push("Asigna la columna de nombre.");
  if (map.datetime < 0 && map.date < 0)
    errors.push("Asigna una fecha o una fecha y hora de evento.");
  if (map.datetime < 0 && map.time < 0 && map.entry < 0 && map.exit < 0)
    errors.push(
      "Asigna entrada, salida, hora de evento o fecha y hora de evento.",
    );
  if ((map.datetime >= 0 || map.time >= 0) && (map.entry >= 0 || map.exit >= 0))
    errors.push(
      "Elige eventos individuales o entrada/salida separadas; no combines ambos formatos.",
    );
  if (map.datetime >= 0 && map.time >= 0)
    errors.push(
      "Usa fecha y hora juntas, o fecha y hora de evento en columnas separadas.",
    );
  const columns = Object.values(map).filter((c) => c >= 0);
  if (new Set(columns).size !== columns.length)
    errors.push("Una columna no puede representar dos campos diferentes.");
  return errors;
}
export function parseDate(value: Cell): string | null {
  if (value instanceof Date)
    return Number.isFinite(value.getTime())
      ? value.toISOString().slice(0, 10)
      : null;
  if (typeof value === "number" && value >= 1 && value <= 2958465)
    return new Date(Math.floor(value - 25569) * 86400000)
      .toISOString()
      .slice(0, 10);
  const str = String(value ?? "").trim();
  let m = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s]|$)/);
  let year: number, month: number, day: number;
  if (m) [, year, month, day] = m.map(Number);
  else {
    m = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[T\s]|$)/);
    if (!m) return null;
    [, day, month, year] = m.map(Number);
  }
  if (year < 1900 || year > 2100) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date.toISOString().slice(0, 10)
    : null;
}
export function parseTime(value: Cell): string | null {
  if (value instanceof Date)
    return Number.isFinite(value.getTime())
      ? value.toISOString().slice(11, 19)
      : null;
  if (typeof value === "number" && value >= 0 && value < 1) {
    const seconds = Math.round((value % 1) * 86400) % 86400;
    return `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }
  const str = String(value ?? "").trim();
  const m = str.match(/(?:^|[T\s])(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const sec = Number(m[3] ?? 0);
  if (m[4]) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (m[4].toUpperCase() === "PM" ? 12 : 0);
  }
  return h <= 23 && min <= 59 && sec <= 59
    ? [h, min, sec].map((n) => String(n).padStart(2, "0")).join(":")
    : null;
}
export async function readExcel(buffer: ArrayBuffer): Promise<SheetData[]> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  if (!workbook.worksheets.length)
    throw new Error("El archivo no contiene hojas de cálculo.");
  if (
    workbook.worksheets.some((s) => s.rowCount > 100001 || s.columnCount > 150)
  )
    throw new Error(
      "El archivo supera el límite de 100.000 filas o 150 columnas por hoja.",
    );
  return workbook.worksheets.map((sheet) => {
    const rows: Cell[][] = [];
    for (let i = 1; i <= sheet.rowCount; i++) {
      const row: Cell[] = [];
      for (let j = 1; j <= sheet.columnCount; j++) {
        const cell = sheet.getCell(i, j);
        let value = cell.value;
        if (
          value instanceof Date &&
          /^(?:\[h{1,2}\]|h{1,2}):mm/i.test(cell.numFmt ?? "")
        ) {
          const epoch = workbook.properties.date1904
            ? Date.UTC(1904, 0, 1)
            : Date.UTC(1899, 11, 30);
          value = (value.getTime() - epoch) / 86400000;
        }
        if (value && typeof value === "object" && !(value instanceof Date)) {
          if ("formula" in value || "sharedFormula" in value) {
            row.push(null);
            continue;
          }
          if ("richText" in value)
            value = value.richText.map((t) => t.text).join("");
          else if ("text" in value) value = String(value.text);
          else {
            row.push(null);
            continue;
          }
        }
        if (typeof value === "number" && /^0{2,}$/.test(cell.numFmt ?? ""))
          value = String(value).padStart(cell.numFmt.length, "0");
        row.push(
          value instanceof Date ||
            typeof value === "string" ||
            typeof value === "number"
            ? value
            : null,
        );
      }
      rows.push(row);
    }
    return { name: sheet.name, rows };
  });
}
export function validateSheet(
  sheet: SheetData,
  headerRow: number,
  map: ColumnMap,
  data: AppData,
): ValidationResult {
  const errors = mappingErrors(map);
  if (errors.length) throw new Error(errors.join(" "));
  const result: ValidationResult = {
    employees: [],
    punches: [],
    issues: [],
    total: 0,
    valid: 0,
    duplicates: 0,
    invalid: 0,
    incomplete: 0,
  };
  const employees = new Map(data.employees.map((e) => [e.id, e]));
  const seen = new Set(data.punches.map(punchKey));
  const timestampKinds = new Map(
    data.punches.map((p) => [`${p.employeeId}|${p.date}|${p.time}`, p.kind]),
  );
  const hasValue = (v: Cell | undefined) =>
    v !== null && v !== undefined && String(v).trim() !== "";
  for (let index = headerRow + 1; index < sheet.rows.length; index++) {
    const row = sheet.rows[index];
    if (!row.some(hasValue)) continue;
    result.total++;
    const rowNumber = index + 1;
    const get = (key: Field): Cell =>
      map[key] < 0 ? null : (row[map[key]] ?? null);
    const str = (key: Field) => String(get(key) ?? "").trim();
    const issues: ImportIssue[] = [];
    const error = (column: string, message: string) =>
      issues.push({ row: rowNumber, column, message, type: "error" });
    const id = str("code");
    const name = str("name");
    if (!id) error("Código", "Falta el identificador único del biométrico.");
    if (!name) error("Nombre", "Falta el nombre del colaborador.");
    const existing = employees.get(id);
    const department =
      str("department") || existing?.department || "Sin asignar";
    if (
      existing &&
      (normalize(existing.name) !== normalize(name) ||
        (str("department") && existing.department !== department))
    )
      error(
        "Colaborador",
        "El código ya pertenece a otro nombre o departamento. Revisa la correspondencia.",
      );
    const status = str("status");
    if (status && !["activo", "inactivo"].includes(status.toLowerCase()))
      error("Estado", "Usa Activo o Inactivo.");
    const activeFrom = hasValue(get("activeFrom"))
      ? parseDate(get("activeFrom"))
      : existing?.activeFrom;
    const activeTo = hasValue(get("activeTo"))
      ? parseDate(get("activeTo"))
      : existing?.activeTo;
    if (hasValue(get("activeFrom")) && !activeFrom)
      error("Inicio laboral", "Fecha inválida. Usa AAAA-MM-DD o DD/MM/AAAA.");
    if (hasValue(get("activeTo")) && !activeTo)
      error("Fin laboral", "Fecha inválida. Usa AAAA-MM-DD o DD/MM/AAAA.");
    if (activeFrom && activeTo && activeFrom > activeTo)
      error("Fin laboral", "Debe ser igual o posterior al inicio laboral.");
    if (
      existing &&
      ((hasValue(get("activeFrom")) &&
        existing.activeFrom &&
        activeFrom !== existing.activeFrom) ||
        (hasValue(get("activeTo")) &&
          existing.activeTo &&
          activeTo !== existing.activeTo) ||
        (status && normalize(status) !== normalize(existing.status)))
    )
      error(
        "Estado laboral",
        "Los datos laborales difieren del colaborador existente; revisa el archivo antes de importarlo.",
      );
    const events: { date: string; time: string; kind: Punch["kind"] }[] = [];
    if (map.datetime >= 0 || map.time >= 0) {
      const rawDatetime = get("datetime");
      const date = parseDate(map.datetime >= 0 ? rawDatetime : get("date"));
      const time = parseTime(
        map.time >= 0
          ? get("time")
          : typeof rawDatetime === "number"
            ? rawDatetime % 1
            : rawDatetime,
      );
      if (!date || !time)
        error(
          "Fecha y hora",
          "Marcación inválida. Incluye fecha y hora completas.",
        );
      const rawKind = normalize(str("kind"));
      const kind = ["entrada", "ingreso", "checkin", "in", "0"].includes(
        rawKind,
      )
        ? "entrada"
        : ["salida", "checkout", "out", "1"].includes(rawKind)
          ? "salida"
          : "sin clasificar";
      if (kind === "sin clasificar")
        issues.push({
          row: rowNumber,
          column: "Tipo",
          message:
            "Evento sin clasificar; se conserva sin inferir entrada ni salida.",
          type: "warning",
        });
      if (date && time) events.push({ date, time, kind });
    } else {
      const date = parseDate(get("date"));
      if (!date) error("Fecha", "Fecha inválida. Usa AAAA-MM-DD o DD/MM/AAAA.");
      const entry = hasValue(get("entry")) ? parseTime(get("entry")) : null;
      const exit = hasValue(get("exit")) ? parseTime(get("exit")) : null;
      if (hasValue(get("entry")) && !entry)
        error("Entrada", "Hora inválida. Usa HH:MM o HH:MM:SS.");
      if (hasValue(get("exit")) && !exit)
        error("Salida", "Hora inválida. Usa HH:MM o HH:MM:SS.");
      if (!entry && !exit)
        error(
          "Marcaciones",
          "Falta al menos una hora válida de entrada o salida.",
        );
      if (entry && exit && exit <= entry)
        error(
          "Salida",
          "Debe ser posterior a la entrada. Para turnos nocturnos, usa eventos con su fecha individual.",
        );
      if (date && entry) events.push({ date, time: entry, kind: "entrada" });
      if (date && exit) events.push({ date, time: exit, kind: "salida" });
      if ((entry && !exit) || (!entry && exit))
        issues.push({
          row: rowNumber,
          column: entry ? "Salida" : "Entrada",
          message: `Falta hora de ${entry ? "salida" : "entrada"}. Se conserva la marcación disponible.`,
          type: "warning",
        });
    }
    for (const e of events) {
      if (
        (activeFrom && e.date < activeFrom) ||
        (activeTo && e.date > activeTo)
      )
        error("Fecha", "Marcación fuera del periodo laboral informado.");
      const priorKind = timestampKinds.get(`${id}|${e.date}|${e.time}`);
      if (priorKind && priorKind !== e.kind)
        error("Tipo", "La misma hora ya existe con otro tipo de marcación.");
    }
    if (issues.some((i) => i.type === "error")) {
      result.invalid++;
      result.issues.push(...issues.filter((i) => i.type === "error"));
      continue;
    }
    const fresh = events.filter(
      (e) => !seen.has(punchKey({ ...e, employeeId: id })),
    );
    if (fresh.length < events.length)
      issues.push({
        row: rowNumber,
        column: "Marcaciones",
        message: `${events.length - fresh.length} marcación(es) ya existe(n) y se omitirán.`,
        type: "duplicate",
      });
    if (!fresh.length) result.duplicates++;
    else {
      result.valid++;
      if (issues.some((i) => i.type === "warning")) result.incomplete++;
      const employee: Employee = {
        id,
        name,
        department,
        status:
          status.toLowerCase() === "inactivo"
            ? "Inactivo"
            : (existing?.status ?? "Activo"),
        ...(activeFrom ? { activeFrom } : {}),
        ...(activeTo ? { activeTo } : {}),
      };
      employees.set(id, employee);
      const employeeIndex = result.employees.findIndex((e) => e.id === id);
      if (employeeIndex < 0) result.employees.push(employee);
      else result.employees[employeeIndex] = employee;
      fresh.forEach((e) => {
        const key = punchKey({ ...e, employeeId: id });
        seen.add(key);
        timestampKinds.set(`${id}|${e.date}|${e.time}`, e.kind);
        result.punches.push({
          ...e,
          id: crypto.randomUUID(),
          employeeId: id,
          sourceRow: rowNumber,
        });
      });
    }
    result.issues.push(...issues);
  }
  return result;
}
