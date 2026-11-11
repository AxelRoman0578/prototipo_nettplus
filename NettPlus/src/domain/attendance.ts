import type {
  AppData,
  AttendanceDay,
  Employee,
  EmployeeSummary,
  Filters,
  Punch,
  Rules,
} from "./types";

export const number = (value: number) =>
  new Intl.NumberFormat("es-EC").format(value);
export const percent = (value: number | null) =>
  value === null
    ? "Pendiente"
    : `${value.toLocaleString("es-EC", { maximumFractionDigits: 1 })}%`;
export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
export const dateLabel = (value: string, long = false) =>
  new Intl.DateTimeFormat("es-EC", {
    timeZone: "UTC",
    day: "2-digit",
    month: long ? "long" : "short",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
export const timestampLabel = (value: string) =>
  new Intl.DateTimeFormat("es-EC", {
    timeZone: "America/Guayaquil",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
export const monthLabel = (value: string) =>
  new Intl.DateTimeFormat("es-EC", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}-01T12:00:00Z`));
export const minutes = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
export const punchKey = (
  p: Pick<Punch, "employeeId" | "date" | "time" | "kind">,
) => [p.employeeId, p.date, p.time, p.kind].join("|");

export function monthBounds(month: string) {
  const [year, m] = month.split("-").map(Number);
  return {
    from: `${month}-01`,
    to: new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10),
  };
}
export function defaultFilters(data: AppData): Filters {
  const month =
    [...data.punches.map((p) => p.date.slice(0, 7))].sort().at(-1) ?? "2026-10";
  return {
    month,
    ...monthBounds(month),
    department: "",
    employeeId: "",
    status: "",
    search: "",
  };
}
export function datesBetween(from: string, to: string): string[] {
  if (!from || !to || from > to) return [];
  const dates: string[] = [];
  const end = new Date(`${to}T12:00:00Z`).getTime();
  for (
    let d = new Date(`${from}T12:00:00Z`);
    d.getTime() <= end && dates.length < 3660;
    d.setUTCDate(d.getUTCDate() + 1)
  )
    dates.push(d.toISOString().slice(0, 10));
  return dates;
}
export function filterEmployees(employees: Employee[], f: Filters) {
  const q = f.search.trim().toLocaleLowerCase("es");
  return employees.filter(
    (e) =>
      (!f.department || e.department === f.department) &&
      (!f.employeeId || e.id === f.employeeId) &&
      (!f.status || e.status === f.status) &&
      (!q || `${e.name} ${e.id}`.toLocaleLowerCase("es").includes(q)),
  );
}
export function attendanceDays(
  punches: Punch[],
  employees: Employee[],
  rules: Rules,
): AttendanceDay[] {
  const employeeMap = new Map(employees.map((e) => [e.id, e]));
  const groups = new Map<string, Punch[]>();
  for (const p of punches) {
    if (!employeeMap.has(p.employeeId)) continue;
    const key = `${p.employeeId}|${p.date}`;
    const group = groups.get(key) ?? [];
    group.push(p);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((group) => {
      const entries = group
        .filter((p) => p.kind === "entrada")
        .map((p) => p.time)
        .sort();
      const exits = group
        .filter((p) => p.kind === "salida")
        .map((p) => p.time)
        .sort();
      const entry = entries[0];
      const exit = exits.at(-1);
      return {
        employee: employeeMap.get(group[0].employeeId)!,
        date: group[0].date,
        entry,
        exit,
        punches: group,
        lateMinutes:
          rules.enabled && entry
            ? Math.max(
                0,
                minutes(entry) - minutes(rules.start) - rules.tolerance,
              )
            : null,
        incomplete: !entry || !exit,
      };
    })
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        a.employee.name.localeCompare(b.employee.name),
    );
}

export function analyze(data: AppData, f: Filters) {
  const employees = filterEmployees(data.employees, f);
  const ids = new Set(employees.map((e) => e.id));
  const punches = data.punches.filter(
    (p) => ids.has(p.employeeId) && p.date >= f.from && p.date <= f.to,
  );
  const days = attendanceDays(punches, employees, data.rules);
  const coverageFrom = data.punches.reduce(
    (min, p) => (p.date < min ? p.date : min),
    "9999-12-31",
  );
  const coverageTo = data.punches.reduce(
    (max, p) => (p.date > max ? p.date : max),
    "",
  );
  const calendar = datesBetween(
    f.from > coverageFrom ? f.from : coverageFrom,
    f.to < coverageTo ? f.to : coverageTo,
  );
  const workdays = calendar.filter((d) =>
    data.rules.weekdays.includes(new Date(`${d}T12:00:00Z`).getUTCDay()),
  );
  const summaries: EmployeeSummary[] = employees.map((employee) => {
    const personal = days.filter((d) => d.employee.id === employee.id);
    const eligible = personal.filter((d) => d.lateMinutes !== null);
    const late = data.rules.enabled
      ? eligible.filter((d) => d.lateMinutes! > 0).length
      : null;
    const expectedDates =
      employee.activeFrom && data.rules.enabled
        ? workdays.filter(
            (d) =>
              d >= employee.activeFrom! &&
              (!employee.activeTo || d <= employee.activeTo),
          )
        : null;
    const presentDates = new Set(personal.map((d) => d.date));
    return {
      employee,
      present: personal.length,
      late,
      punctuality: eligible.length
        ? (100 * (eligible.length - (late ?? 0))) / eligible.length
        : null,
      absent: expectedDates
        ? expectedDates.filter((d) => !presentDates.has(d)).length
        : null,
      incomplete: personal.filter((d) => d.incomplete).length,
      expected: expectedDates?.length ?? null,
    };
  });
  const eligibleDays = days.filter((d) => d.lateMinutes !== null);
  const absent =
    summaries.length && summaries.every((s) => s.absent !== null)
      ? summaries.reduce((n, s) => n + s.absent!, 0)
      : null;
  return {
    employees,
    punches,
    days,
    summaries,
    workdays,
    present: days.length,
    late: data.rules.enabled
      ? eligibleDays.filter((d) => d.lateMinutes! > 0).length
      : null,
    punctuality: eligibleDays.length
      ? (100 * eligibleDays.filter((d) => d.lateMinutes === 0).length) /
        eligibleDays.length
      : null,
    absent,
    incomplete: days.filter((d) => d.incomplete).length,
    timeline: datesBetween(f.from, f.to).map((date) => ({
      date,
      present: days.filter((d) => d.date === date).length,
      late: data.rules.enabled
        ? days.filter((d) => d.date === date && (d.lateMinutes ?? 0) > 0).length
        : null,
    })),
  };
}

export function assertAdmin(role: string) {
  if (role !== "admin")
    throw new Error("Solo el administrador puede modificar los datos.");
}
