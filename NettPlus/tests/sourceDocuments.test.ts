import { describe, expect, it } from "vitest";
import { emptyData } from "../src/domain/demo";
import { readExcel, type SheetData } from "../src/services/excel";
import {
  commitDocument,
  detectDocument,
  durationLabel,
  parseDuration,
  sourceMonth,
  validateDocument,
} from "../src/services/sourceDocuments";

describe("Reportes complementarios", () => {
  it("detecta permisos y conserva solo los campos necesarios sin detalles personales", () => {
    const sheet: SheetData = {
      name: "20261026",
      rows: [
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
          "Motivo de Aprobación",
        ],
        [
          "P-01",
          "Persona",
          "Ejemplo",
          "Pruebas",
          "2026-07-06 08:00:00",
          "2026-07-09 18:00:00",
          "Permiso registrado",
          "Aprobado",
          "Detalle que debe omitirse",
        ],
        [
          "P-01",
          "Persona",
          "Ejemplo",
          "Pruebas",
          "2026-07-06 08:00:00",
          "2026-07-09 18:00:00",
          "Permiso registrado",
          "Aprobado",
          "Detalle diferente",
        ],
        [
          "P-02",
          "Otra",
          "Persona",
          "Pruebas",
          "2026-07-10 18:00:00",
          "2026-07-10 08:00:00",
          "Personal",
          "Aprobado",
          "No importar",
        ],
      ],
    };
    expect(detectDocument(sheet)).toEqual({ kind: "permits", header: 1 });
    const result = validateDocument(sheet, 1, "permits", emptyData());
    expect(result).toMatchObject({
      total: 3,
      valid: 1,
      duplicates: 1,
      invalid: 1,
    });
    expect(JSON.stringify(result.permits)).not.toContain("Detalle");
    const saved = commitDocument(
      emptyData(),
      emptyData().users[0],
      "permisos.xlsx",
      sheet.name,
      result,
    );
    expect(saved.punches).toHaveLength(0);
    expect(saved.employees).toHaveLength(0);
    expect(saved.permits).toHaveLength(1);
  });
  it("conserva duraciones mayores de 24 horas y detecta el periodo en español", async () => {
    const { default: ExcelJS } = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("Julio 2026");
    sheet.addRows([
      ["CONSOLIDADO MENSUAL - JULIO 2026"],
      [
        "ID",
        "Nombres",
        "Departamento",
        "Horas Suplementarias",
        "Horas Extras",
        "Horas Nocturnas",
      ],
      ["H-01", "Persona Horas", "Pruebas", 30.75 / 24, "29:00:00", 0],
      ["H-02", "Error Horas", "Pruebas", "25:77", "01:00", 0],
    ]);
    sheet.getCell("D3").numFmt = "[h]:mm:ss";
    const [read] = await readExcel(
      (await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer,
    );
    expect(sourceMonth(read)).toBe("2026-07");
    expect(detectDocument(read).kind).toBe("hours");
    const result = validateDocument(
      read,
      1,
      "hours",
      emptyData(),
      sourceMonth(read)!,
    );
    expect(result.valid).toBe(1);
    expect(result.invalid).toBe(1);
    expect(durationLabel(result.sourceHours[0].supplemental)).toBe("30:45");
    expect(result.sourceHours[0].extra).toBe(1740);
    expect(parseDuration("190:30")).toBe(11430);
    expect(parseDuration("4:99")).toBeNull();
  }, 30000);
});
