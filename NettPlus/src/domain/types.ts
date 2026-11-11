export type Role = "admin" | "viewer";
export type EmployeeStatus = "Activo" | "Inactivo";
export interface Employee {
  id: string;
  name: string;
  department: string;
  status: EmployeeStatus;
  activeFrom?: string;
  activeTo?: string;
}
export interface Punch {
  id: string;
  employeeId: string;
  date: string;
  time: string;
  kind: "entrada" | "salida" | "sin clasificar";
  importId: string;
  sourceRow: number;
}
export interface ImportIssue {
  row: number;
  column: string;
  message: string;
  type: "error" | "duplicate" | "warning";
}
export interface ImportLog {
  kind?: "attendance" | "permits" | "hours";
  id: string;
  file: string;
  sheet: string;
  at: string;
  user: string;
  rows: number;
  valid: number;
  duplicates: number;
  invalid: number;
  warnings: number;
  issues: ImportIssue[];
}
export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
}
export interface AuditLog {
  id: string;
  at: string;
  user: string;
  action: string;
  detail: string;
}
export interface Rules {
  enabled: boolean;
  start: string;
  tolerance: number;
  weekdays: number[];
  maxFileMB: number;
}
export interface AppData {
  version: 1;
  revision?: number;
  dataset?: "demo" | "imported" | "mixed" | "empty";
  employees: Employee[];
  punches: Punch[];
  imports: ImportLog[];
  audits: AuditLog[];
  users: DemoUser[];
  rules: Rules;
  permits: Permit[];
  sourceHours: SourceHours[];
}
export interface Permit {
  id: string;
  employeeId: string;
  name: string;
  department: string;
  from: string;
  to: string;
  category: string;
  approval: string;
  importId: string;
  sourceRow: number;
}
export interface SourceHours {
  id: string;
  employeeId: string;
  name: string;
  department: string;
  month: string;
  supplemental: number | null;
  extra: number | null;
  night: number | null;
  importId: string;
  sourceRow: number;
}
export interface Filters {
  month: string;
  from: string;
  to: string;
  department: string;
  employeeId: string;
  status: string;
  search: string;
}
export interface AttendanceDay {
  employee: Employee;
  date: string;
  entry?: string;
  exit?: string;
  punches: Punch[];
  lateMinutes: number | null;
  incomplete: boolean;
}
export interface EmployeeSummary {
  employee: Employee;
  present: number;
  late: number | null;
  punctuality: number | null;
  absent: number | null;
  incomplete: number;
  expected: number | null;
}
