import type { AppData, Employee, Punch } from "./types";

export const defaultRules = {
  enabled: true,
  start: "08:30",
  tolerance: 10,
  weekdays: [1, 2, 3, 4, 5],
  maxFileMB: 20,
};
export const demoUsers = [
  {
    id: "admin-demo",
    name: "Administración demo",
    email: "admin@nettplus.example",
    role: "admin" as const,
    active: true,
  },
  {
    id: "viewer-demo",
    name: "Consulta demo",
    email: "viewer@nettplus.example",
    role: "viewer" as const,
    active: true,
  },
];
export function emptyData(): AppData {
  return {
    version: 1,
    dataset: "empty",
    employees: [],
    punches: [],
    imports: [],
    audits: [],
    permits: [],
    sourceHours: [],
    users: demoUsers.map((u) => ({ ...u })),
    rules: { ...defaultRules, weekdays: [...defaultRules.weekdays] },
  };
}
export function createDemo(): AppData {
  const data = emptyData();
  data.dataset = "demo";
  const names = [
    "Elena Solís",
    "Mateo Valverde",
    "Lucía Campos",
    "Nicolás Paredes",
    "Isabel Cedeño",
    "Samuel Vega",
    "Camila Rosales",
    "Daniel Lema",
    "Valentina Paz",
    "Gabriel Molina",
    "Emilia Bravo",
    "Julián Acosta",
    "Renata Arias",
    "Tomás Villalba",
    "Paula Salcedo",
    "Sebastián Luna",
    "Clara Benítez",
    "Adrián Cobo",
    "Sofía Naranjo",
    "Diego Cabrera",
    "Martina Lucero",
    "Felipe Dávila",
    "Alma Rivera",
    "Bruno Tapia",
  ];
  const departments = [
    "Operaciones",
    "Comercial",
    "Tecnología",
    "Finanzas",
    "Recursos Humanos",
  ];
  data.employees = names.map((name, i): Employee => ({
    id: `NP-${String(i + 1).padStart(4, "0")}`,
    name,
    department: departments[i % departments.length],
    status: i === 23 ? "Inactivo" : "Activo",
    activeFrom: "2026-09-01",
    ...(i === 23 ? { activeTo: "2026-10-15" } : {}),
  }));
  for (const month of [9, 10]) {
    const importId = `demo-${month}`;
    const records: Punch[] = [];
    for (let day = 1; day <= (month === 9 ? 30 : 30); day++) {
      const date = `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
      if (weekday === 0 || weekday === 6) continue;
      data.employees.forEach((e, i) => {
        if (
          (e.activeTo && date > e.activeTo) ||
          (day + i * 3 + month) % 31 === 0
        )
          return;
        const late = (day + i * 7 + month) % 13 === 0;
        const time = late
          ? `08:${45 + (i % 12)}:00`
          : `08:${String(10 + ((i + day) % 25)).padStart(2, "0")}:00`;
        records.push({
          id: `${importId}-${i}-${day}-e`,
          employeeId: e.id,
          date,
          time,
          kind: "entrada",
          importId,
          sourceRow: day * 24 + i,
        });
        if ((day * 3 + i + month) % 47 !== 0)
          records.push({
            id: `${importId}-${i}-${day}-s`,
            employeeId: e.id,
            date,
            time: `17:${String((i + day) % 25).padStart(2, "0")}:00`,
            kind: "salida",
            importId,
            sourceRow: day * 24 + i,
          });
      });
    }
    data.punches.push(...records);
    data.imports.unshift({
      id: importId,
      file: `Asistencia_DEMO_${month === 9 ? "Septiembre" : "Octubre"}_2026.xlsx`,
      sheet: "Marcaciones",
      at: `2026-${String(month).padStart(2, "0")}-30T22:30:00Z`,
      user: "Administración demo",
      rows: records.length,
      valid: records.length,
      duplicates: 0,
      invalid: 0,
      warnings: 0,
      issues: [],
    });
  }
  data.audits = [
    {
      id: "demo-seed",
      at: new Date().toISOString(),
      user: "Administración demo",
      action: "Datos de demostración",
      detail: `${data.employees.length} colaboradores ficticios y ${data.punches.length} marcaciones cargados.`,
    },
  ];
  data.permits = [
    {
      id: "demo-permiso-1",
      employeeId: "NP-0001",
      name: names[0],
      department: departments[0],
      from: "2026-10-15T08:00:00",
      to: "2026-10-15T11:00:00",
      category: "Permiso personal",
      approval: "Aprobado",
      importId: "demo-permisos",
      sourceRow: 3,
    },
    {
      id: "demo-permiso-2",
      employeeId: "NP-0003",
      name: names[2],
      department: departments[2],
      from: "2026-10-19T08:00:00",
      to: "2026-10-19T18:00:00",
      category: "Permiso registrado",
      approval: "Aprobado",
      importId: "demo-permisos",
      sourceRow: 4,
    },
    {
      id: "demo-permiso-3",
      employeeId: "NP-0005",
      name: names[4],
      department: departments[4],
      from: "2026-10-22T12:00:00",
      to: "2026-10-22T15:00:00",
      category: "Permiso personal",
      approval: "Pendiente",
      importId: "demo-permisos",
      sourceRow: 5,
    },
  ];
  data.sourceHours = data.employees.slice(0, 8).map((e, i) => ({
    id: `demo-horas-${i}`,
    employeeId: e.id,
    name: e.name,
    department: e.department,
    month: "2026-10",
    supplemental: (i + 1) * 45,
    extra: i * 30,
    night: i % 2 ? 90 : 0,
    importId: "demo-horas",
    sourceRow: i + 3,
  }));
  data.imports.push(
    ...[
      {
        id: "demo-permisos",
        kind: "permits" as const,
        file: "Permisos_DEMO_Octubre.xlsx",
        valid: 3,
      },
      {
        id: "demo-horas",
        kind: "hours" as const,
        file: "Horas_DEMO_Octubre.xlsx",
        valid: 8,
      },
    ].map((log) => ({
      ...log,
      sheet: "Octubre 2026",
      at: "2026-10-29T20:00:00Z",
      user: "Administración demo",
      rows: log.valid,
      duplicates: 0,
      invalid: 0,
      warnings: 0,
      issues: [],
    })),
  );
  return data;
}
