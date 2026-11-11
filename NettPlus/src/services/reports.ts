import type {
  AttendanceDay,
  EmployeeSummary,
  Filters,
  ImportIssue,
  Rules,
} from "../domain/types";
import { dateLabel, percent } from "../domain/attendance";

export type ReportMode = "monthly" | "daily";
export function reportTable(
  mode: ReportMode,
  summaries: EmployeeSummary[],
  days: AttendanceDay[],
) {
  return mode === "monthly"
    ? {
        headers: [
          "Código",
          "Colaborador",
          "Departamento",
          "Asistencias",
          "Atrasos (demo)",
          "Ausencias (demo)",
          "Incompletos",
          "Puntualidad (demo)",
        ],
        rows: summaries.map((s) => [
          s.employee.id,
          s.employee.name,
          s.employee.department,
          s.present,
          s.late ?? "Pendiente",
          s.absent ?? "Pendiente",
          s.incomplete,
          percent(s.punctuality),
        ]),
      }
    : {
        headers: [
          "Fecha",
          "Código",
          "Colaborador",
          "Departamento",
          "Entrada",
          "Salida",
          "Atraso min (demo)",
          "Estado",
        ],
        rows: days.map((d) => [
          d.date,
          d.employee.id,
          d.employee.name,
          d.employee.department,
          d.entry?.slice(0, 5) ?? "Sin entrada",
          d.exit?.slice(0, 5) ?? "Sin salida",
          d.lateMinutes ?? "Pendiente",
          d.incomplete ? "Incompleto" : "Completo",
        ]),
      };
}
export async function excelReport(
  mode: ReportMode,
  summaries: EmployeeSummary[],
  days: AttendanceDay[],
  filters: Filters,
  rules: Rules,
): Promise<Uint8Array> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Nettplus";
  const sheet = workbook.addWorksheet(
    mode === "monthly" ? "Consolidado mensual" : "Resumen diario",
  );
  const table = reportTable(mode, summaries, days);
  sheet.addRow(table.headers);
  table.rows.forEach((row, index) => {
    const values: (string | number | Date)[] = [...row];
    if (mode === "monthly")
      values[7] =
        summaries[index].punctuality === null
          ? "Pendiente"
          : summaries[index].punctuality! / 100;
    else values[0] = new Date(`${days[index].date}T12:00:00Z`);
    sheet.addRow(values);
  });
  sheet.columns.forEach((col, i) => {
    col.width = i === 1 || i === 2 ? 27 : 21;
  });
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF233A84" },
    };
  });
  sheet.getRow(1).height = 28;
  if (mode === "monthly") sheet.getColumn(8).numFmt = "0.0%";
  else sheet.getColumn(1).numFmt = "dd/mm/yyyy";
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: "H1" };
  const info = workbook.addWorksheet("Criterios");
  info.columns = [{ width: 27 }, { width: 100 }];
  info.addRows([
    ["Nettplus", "Reporte de asistencia para preparación externa de nómina"],
    [
      "Modalidad",
      "Prototipo de asistencia; los indicadores estimados requieren validación de reglas.",
    ],
    ["Periodo", `${filters.from} a ${filters.to}`],
    ["Departamento", filters.department || "Todos"],
    ["Colaborador", filters.employeeId || "Todos"],
    ["Estado", filters.status || "Todos"],
    ["Búsqueda", filters.search || "Sin búsqueda"],
    [
      "Reglas",
      rules.enabled
        ? `Parámetros DEMO: entrada ${rules.start}, tolerancia ${rules.tolerance} min, días ${rules.weekdays.join(", ")}`
        : "Puntualidad y ausencias pendientes de validación",
    ],
    [
      "Asistencias",
      "Días únicos con al menos una marcación por colaborador. Incluye días incompletos.",
    ],
    [
      "Puntualidad",
      "Entradas dentro de tolerancia / días con entrada clasificada.",
    ],
    [
      "Ausencias estimadas",
      "Solo con inicio laboral conocido; días configurados sin marcación, dentro de cobertura importada y vigencia laboral. Sin calendario de feriados ni justificaciones.",
    ],
    ["Horas extra", "Pendientes de reglas aprobadas. No se calculan."],
    ["Alcance", "No calcula salarios ni realiza pagos."],
  ]);
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
export async function pdfReport(
  mode: ReportMode,
  summaries: EmployeeSummary[],
  days: AttendanceDay[],
  filters: Filters,
  rules: Rules,
): Promise<Uint8Array> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFillColor(35, 58, 132);
  doc.rect(0, 0, 297, 30, "F");
  doc.setTextColor(255);
  doc.setFontSize(18);
  doc.text("NETTPLUS | ASISTENCIA", 14, 14);
  doc.setFontSize(10);
  doc.text(
    mode === "monthly"
      ? "Consolidado mensual por colaborador"
      : "Resumen diario de marcaciones",
    14,
    23,
  );
  doc.setTextColor(42, 50, 65);
  doc.setFontSize(9);
  const metadata = [
    `Periodo: ${dateLabel(filters.from)} al ${dateLabel(filters.to)} | Departamento: ${filters.department || "Todos"} | Colaborador: ${filters.employeeId || "Todos"}`,
    `Estado: ${filters.status || "Todos"} | Busqueda: ${filters.search || "Todas"} | DEMO: ${rules.enabled ? `entrada ${rules.start}, tolerancia ${rules.tolerance} min` : "reglas pendientes de validacion"}`,
  ];
  const lines = metadata.flatMap(
    (s) => doc.splitTextToSize(s, 267) as string[],
  );
  doc.text(lines, 14, 38);
  const table = reportTable(mode, summaries, days);
  autoTable(doc, {
    head: [table.headers],
    body: table.rows,
    startY: 42 + lines.length * 4,
    margin: { bottom: 22 },
    styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
    headStyles: { fillColor: [35, 58, 132] },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.setTextColor(100, 110, 130);
      doc.text(
        "DEMO - Indicadores sujetos a reglas de prueba. Ausencias estimadas con vigencia conocida y cobertura importada.",
        14,
        194,
      );
      doc.text(
        `Apoyo a preparacion de nomina. Sin calculos monetarios ni pagos. | Pagina ${doc.getNumberOfPages()}`,
        14,
        200,
      );
    },
  });
  return new Uint8Array(doc.output("arraybuffer"));
}
export function downloadBytes(
  bytes: Uint8Array,
  filename: string,
  type: string,
) {
  const blob = new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export async function downloadIssues(issues: ImportIssue[], filename: string) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Incidencias");
  sheet.addRow(["Fila", "Columna", "Tipo", "Motivo"]);
  issues.forEach((i) => sheet.addRow([i.row, i.column, i.type, i.message]));
  sheet.columns = [{ width: 10 }, { width: 25 }, { width: 15 }, { width: 100 }];
  sheet.getRow(1).font = { bold: true };
  downloadBytes(
    new Uint8Array(await workbook.xlsx.writeBuffer()),
    filename,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}
export async function exampleWorkbook(): Promise<Uint8Array> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Entrada y salida");
  sheet.addRows([
    [
      "Código",
      "Nombre",
      "Departamento",
      "Fecha",
      "Entrada",
      "Salida",
      "Estado",
      "Inicio laboral",
    ],
    [
      "DEMO-101",
      "Alicia Prueba",
      "Tecnología",
      "2026-10-29",
      "08:25",
      "17:05",
      "Activo",
      "2026-10-01",
    ],
    [
      "DEMO-102",
      "Marcos Ejemplo",
      "Operaciones",
      "2026-10-29",
      "08:55",
      "17:10",
      "Activo",
      "2026-10-01",
    ],
    [
      "DEMO-101",
      "Alicia Prueba",
      "Tecnología",
      "2026-10-29",
      "08:25",
      "17:05",
      "Activo",
      "2026-10-01",
    ],
    [
      "DEMO-103",
      "Irene Ensayo",
      "Comercial",
      "2026-10-30",
      "08:30",
      null,
      "Activo",
      "2026-10-01",
    ],
    [
      "",
      "Sin código",
      "Comercial",
      "2026-10-30",
      "08:30",
      "17:00",
      "Activo",
      null,
    ],
    [
      "DEMO-104",
      "Pedro Muestra",
      "Finanzas",
      "31/02/2026",
      "25:15",
      "17:00",
      "Activo",
      null,
    ],
  ]);
  const events = workbook.addWorksheet("Eventos individuales");
  events.addRows([
    ["Código", "Nombre", "Departamento", "Fecha y hora", "Tipo"],
    [
      "DEMO-105",
      "Olivia Ficticia",
      "Finanzas",
      "2026-10-30 08:20:00",
      "Entrada",
    ],
    [
      "DEMO-105",
      "Olivia Ficticia",
      "Finanzas",
      "2026-10-30 17:00:00",
      "Salida",
    ],
  ]);
  const permits = workbook.addWorksheet("Permisos registrados");
  permits.addRows([
    ["Permiso"],
    [
      "ID del Empleado",
      "Nombres",
      "Apellidos",
      "Departamento",
      "Hora Entrada",
      "Hora Salida",
      "Código de pago",
      "Estado de aprobación",
    ],
    [
      "DEMO-101",
      "Alicia",
      "Prueba",
      "Tecnología",
      "2026-10-20 08:00:00",
      "2026-10-20 11:00:00",
      "Permiso personal",
      "Aprobado",
    ],
    [
      "DEMO-102",
      "Marcos",
      "Ejemplo",
      "Operaciones",
      "2026-10-22 14:00:00",
      "2026-10-22 17:00:00",
      "Permiso registrado",
      "Pendiente",
    ],
  ]);
  const hours = workbook.addWorksheet("Octubre 2026");
  hours.addRows([
    ["CONSOLIDADO MENSUAL - OCTUBRE 2026"],
    [
      "ID",
      "Nombres",
      "Apellidos",
      "Departamento",
      "Horas Suplementarias",
      "Horas Extras",
      "Horas Nocturnas",
    ],
    ["DEMO-101", "Alicia", "Prueba", "Tecnología", 30.75 / 24, 5.5 / 24, null],
    [
      "DEMO-102",
      "Marcos",
      "Ejemplo",
      "Operaciones",
      4.25 / 24,
      2 / 24,
      1.5 / 24,
    ],
  ]);
  for (const column of [5, 6, 7]) hours.getColumn(column).numFmt = "[h]:mm";
  for (const s of workbook.worksheets) {
    s.getRow(1).font = { bold: true };
    s.columns.forEach((c) => {
      c.width = 24;
    });
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

export async function tableExport(
  type: "xlsx" | "pdf",
  headers: string[],
  rows: (string | number)[][],
  title: string,
  criteria: string,
): Promise<Uint8Array> {
  if (type === "xlsx") {
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Detalle");
    sheet.addRow(headers);
    rows.forEach((r) => sheet.addRow(r));
    sheet.columns.forEach((c, i) => {
      c.width = i === 1 || i === 5 ? 32 : 24;
    });
    sheet.getRow(1).eachCell((c) => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF233A84" },
      };
    });
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    const notes = workbook.addWorksheet("Criterios");
    notes.addRows([
      ["Reporte", title],
      ["Filtros", criteria],
      [
        "Origen",
        "Valores informados por el archivo, sin aprobación ni cálculo monetario por el sistema.",
      ],
    ]);
    notes.columns = [{ width: 20 }, { width: 110 }];
    return new Uint8Array(await workbook.xlsx.writeBuffer());
  }
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFillColor(35, 58, 132);
  doc.rect(0, 0, 297, 26, "F");
  doc.setTextColor(255);
  doc.setFontSize(17);
  doc.text(`Nettplus | ${title}`, 14, 16);
  doc.setTextColor(95, 110, 135);
  doc.setFontSize(9);
  const lines = doc.splitTextToSize(criteria, 268) as string[];
  doc.text(lines, 14, 35);
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 39 + lines.length * 4,
    margin: { bottom: 22 },
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [35, 58, 132] },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(
        "Datos informados en el archivo de origen. Sin calculos monetarios ni aprobacion automatica.",
        14,
        199,
      );
    },
  });
  return new Uint8Array(doc.output("arraybuffer"));
}
