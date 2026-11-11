import type {
  AppData,
  ImportIssue,
  Permit,
  SourceHours,
} from "../domain/types";
import { parseDate, parseTime, type Cell, type SheetData } from "./excel";
import { withAudit } from "./storage";
import { assertAdmin } from "../domain/attendance";
import type { DemoUser } from "../domain/types";

export type DocumentKind = "attendance" | "permits" | "hours";
export interface DocumentValidation {
  kind: "permits" | "hours";
  permits: Permit[];
  sourceHours: SourceHours[];
  total: number;
  valid: number;
  duplicates: number;
  invalid: number;
  incomplete: number;
  issues: ImportIssue[];
}
const key = (value: Cell) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
export function detectDocument(sheet: SheetData): {
  kind: DocumentKind;
  header: number;
} {
  for (let i = 0; i < Math.min(30, sheet.rows.length); i++) {
    const row = sheet.rows[i].map(key);
    if (row.includes("estadodeaprobacion") && row.includes("codigodepago"))
      return { kind: "permits", header: i };
    if (row.includes("horassuplementarias") && row.includes("horasextras"))
      return { kind: "hours", header: i };
    if (
      row.some((h) =>
        ["id", "codigo", "iddelempleado", "employeeid"].includes(h),
      ) &&
      row.some((h) => ["fecha", "fechayhora", "datetime"].includes(h))
    )
      return { kind: "attendance", header: i };
  }
  return { kind: "attendance", header: 0 };
}
export function sourceMonth(sheet: SheetData): string | null {
  const text =
    `${sheet.name} ${sheet.rows.slice(0, 2).flat().join(" ")}`.toLowerCase();
  const explicit = text.match(/(20\d{2})[-/](0[1-9]|1[0-2])/);
  if (explicit) return `${explicit[1]}-${explicit[2]}`;
  const months = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  const year = text.match(/20\d{2}/)?.[0];
  const month = months.findIndex((m) => text.includes(m));
  return year && month >= 0
    ? `${year}-${String(month + 1).padStart(2, "0")}`
    : null;
}
export function parseDuration(value: Cell): number | null {
  if (value === null || value === "") return null;
  if (typeof value === "number")
    return Number.isFinite(value) && value >= 0 && value <= 366
      ? Math.round(value * 1440)
      : null;
  if (value instanceof Date) return null;
  const m = String(value)
    .trim()
    .match(/^(\d{1,4}):(\d{2})(?::(\d{2}))?$/);
  if (!m || Number(m[2]) > 59 || Number(m[3] ?? 0) > 59) return null;
  return Math.round(Number(m[1]) * 60 + Number(m[2]) + Number(m[3] ?? 0) / 60);
}
export const durationLabel = (minutes: number | null) =>
  minutes === null
    ? "No informado"
    : `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
export const permitKey = (
  p: Pick<Permit, "employeeId" | "from" | "to" | "category" | "approval">,
) => [p.employeeId, p.from, p.to, p.category, p.approval].join("|");
export const hoursKey = (h: Pick<SourceHours, "employeeId" | "month">) =>
  `${h.employeeId}|${h.month}`;

export function validateDocument(
  sheet: SheetData,
  header: number,
  kind: "permits" | "hours",
  data: AppData,
  month?: string,
): DocumentValidation {
  const headers = (sheet.rows[header] ?? []).map(key);
  const find = (...names: string[]) =>
    headers.findIndex((h) => names.includes(h));
  const columns = {
    code: find("id", "iddelempleado", "idempleado", "codigo"),
    name: find("nombres", "nombre"),
    surname: find("apellidos"),
    department: find("departamento", "department"),
    from: find("horaentrada"),
    to: find("horasalida"),
    category: find("codigodepago"),
    approval: find("estadodeaprobacion"),
    supplemental: find("horassuplementarias"),
    extra: find("horasextras"),
    night: find("horasnocturnas"),
  };
  if (columns.code < 0 || columns.name < 0)
    throw new Error(
      "No se encontraron las columnas ID y Nombres en la fila seleccionada.",
    );
  if (
    kind === "permits" &&
    [columns.from, columns.to, columns.category, columns.approval].some(
      (c) => c < 0,
    )
  )
    throw new Error(
      "El reporte de permisos requiere Hora Entrada, Hora Salida, Código de pago y Estado de aprobación.",
    );
  if (
    kind === "hours" &&
    (columns.supplemental < 0 ||
      columns.extra < 0 ||
      !month ||
      !/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))
  )
    throw new Error(
      "Asigna un mes válido y utiliza las columnas Horas Suplementarias y Horas Extras.",
    );
  const result: DocumentValidation = {
    kind,
    permits: [],
    sourceHours: [],
    total: 0,
    valid: 0,
    duplicates: 0,
    invalid: 0,
    incomplete: 0,
    issues: [],
  };
  const seen = new Set(
    kind === "permits"
      ? data.permits.map(permitKey)
      : data.sourceHours.map(hoursKey),
  );
  for (let i = header + 1; i < sheet.rows.length; i++) {
    const row = sheet.rows[i];
    if (!row.some((v) => v !== null && String(v).trim())) continue;
    result.total++;
    const cell = (column: keyof typeof columns): Cell =>
      row[columns[column]] ?? null;
    const str = (column: keyof typeof columns) =>
      String(cell(column) ?? "").trim();
    const employeeId = str("code");
    const name = [str("name"), str("surname")]
      .filter((s) => s && !/^\.+$/.test(s))
      .join(" ");
    const department = str("department") || "Sin asignar";
    const issue = (column: string, message: string) =>
      result.issues.push({ row: i + 1, column, message, type: "error" });
    if (!employeeId || !name) {
      issue(
        "ID / Nombres",
        "Falta código o nombre. No se importan filas de totales o notas.",
      );
      result.invalid++;
      continue;
    }
    if (kind === "permits") {
      const fromDate = parseDate(cell("from"));
      const fromTime = parseTime(cell("from"));
      const toDate = parseDate(cell("to"));
      const toTime = parseTime(cell("to"));
      const from = fromDate && fromTime ? `${fromDate}T${fromTime}` : "";
      const to = toDate && toTime ? `${toDate}T${toTime}` : "";
      if (!from || !to || to <= from) {
        issue(
          "Hora Entrada / Hora Salida",
          "El permiso debe tener inicio y fin válidos, con fin posterior al inicio.",
        );
        result.invalid++;
        continue;
      }
      if (!str("category") || !str("approval")) {
        issue(
          "Categoría / Aprobación",
          "Falta categoría o estado de aprobación del permiso.",
        );
        result.invalid++;
        continue;
      }
      const record: Permit = {
        id: crypto.randomUUID(),
        employeeId,
        name,
        department,
        from,
        to,
        category: str("category"),
        approval: str("approval"),
        sourceRow: i + 1,
        importId: "",
      };
      const fingerprint = permitKey(record);
      if (seen.has(fingerprint)) {
        result.duplicates++;
        result.issues.push({
          row: i + 1,
          column: "Permiso",
          message: "El mismo permiso ya está registrado y se omitirá.",
          type: "duplicate",
        });
        continue;
      }
      seen.add(fingerprint);
      result.permits.push(record);
    } else {
      const values = [
        parseDuration(cell("supplemental")),
        parseDuration(cell("extra")),
        parseDuration(cell("night")),
      ];
      if (
        values.some(
          (v, index) =>
            v === null &&
            cell((["supplemental", "extra", "night"] as const)[index]) !==
              null &&
            String(
              cell((["supplemental", "extra", "night"] as const)[index]),
            ).trim() !== "",
        )
      ) {
        issue(
          "Horas",
          "Duración inválida. Usa horas acumuladas HHH:MM o una duración numérica de Excel.",
        );
        result.invalid++;
        continue;
      }
      const record: SourceHours = {
        id: crypto.randomUUID(),
        employeeId,
        name,
        department,
        month: month!,
        supplemental: values[0]!,
        extra: values[1]!,
        night: values[2]!,
        sourceRow: i + 1,
        importId: "",
      };
      const fingerprint = hoursKey(record);
      if (seen.has(fingerprint)) {
        result.duplicates++;
        result.issues.push({
          row: i + 1,
          column: "ID / Periodo",
          message:
            "Ya existe un consolidado de esta persona para el mismo mes. Se conserva el registro anterior.",
          type: "duplicate",
        });
        continue;
      }
      seen.add(fingerprint);
      result.sourceHours.push(record);
    }
    result.valid++;
  }
  return result;
}
export function commitDocument(
  data: AppData,
  user: DemoUser,
  file: string,
  sheet: string,
  result: DocumentValidation,
): AppData {
  assertAdmin(user.role);
  const id = crypto.randomUUID();
  const log = {
    id,
    kind: result.kind,
    file,
    sheet,
    at: new Date().toISOString(),
    user: user.name,
    rows: result.total,
    valid: result.valid,
    duplicates: result.duplicates,
    invalid: result.invalid,
    warnings: 0,
    issues: result.issues,
  };
  return withAudit(
    {
      ...data,
      dataset:
        data.dataset === "demo" || data.dataset === "mixed"
          ? "mixed"
          : "imported",
      imports: [log, ...data.imports],
      permits: [
        ...data.permits,
        ...result.permits.map((p) => ({ ...p, importId: id })),
      ],
      sourceHours: [
        ...data.sourceHours,
        ...result.sourceHours.map((h) => ({ ...h, importId: id })),
      ],
    },
    user,
    result.kind === "permits"
      ? "Importación de permisos"
      : "Importación de horas informadas",
    `${file} · ${result.valid} registros válidos · ${result.duplicates} duplicados · ${result.invalid} rechazados.`,
  );
}
