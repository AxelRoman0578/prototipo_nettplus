import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createDemo, emptyData } from "../src/domain/demo";
import type { AppData, DemoUser } from "../src/domain/types";

export class Store {
  readonly db: DatabaseSync;
  constructor(path: string, seed = true) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, role TEXT NOT NULL CHECK(role IN ('admin','viewer')), active INTEGER NOT NULL, password_hash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS employees (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS imports (id TEXT PRIMARY KEY, at TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS punches (id TEXT PRIMARY KEY, employee_id TEXT NOT NULL REFERENCES employees(id), import_id TEXT NOT NULL REFERENCES imports(id), date TEXT NOT NULL, time TEXT NOT NULL, kind TEXT NOT NULL, data TEXT NOT NULL, UNIQUE(employee_id,date,time,kind));
      CREATE INDEX IF NOT EXISTS punches_date ON punches(date,employee_id);
      CREATE TABLE IF NOT EXISTS permits (id TEXT PRIMARY KEY, import_id TEXT NOT NULL REFERENCES imports(id), employee_id TEXT NOT NULL, starts TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS source_hours (id TEXT PRIMARY KEY, import_id TEXT NOT NULL REFERENCES imports(id), employee_id TEXT NOT NULL, month TEXT NOT NULL, data TEXT NOT NULL, UNIQUE(employee_id,month));
      CREATE TABLE IF NOT EXISTS audits (id TEXT PRIMARY KEY, at TEXT NOT NULL, data TEXT NOT NULL);
    `);
    if (!this.db.prepare("SELECT value FROM meta WHERE key='rules'").get())
      this.save(seed ? createDemo() : emptyData());
  }
  users(): DemoUser[] {
    return this.db
      .prepare("SELECT id,name,email,role,active FROM users ORDER BY rowid")
      .all()
      .map((row) => ({
        ...row,
        active: Boolean(row.active),
      })) as unknown as DemoUser[];
  }
  read(): AppData {
    const records = (table: string, order = "rowid") =>
      this.db
        .prepare(`SELECT data FROM ${table} ORDER BY ${order}`)
        .all()
        .map((row) => JSON.parse(String(row.data)));
    const meta = (key: string) =>
      JSON.parse(
        String(
          this.db.prepare("SELECT value FROM meta WHERE key=?").get(key)
            ?.value ?? "null",
        ),
      );
    return {
      version: 1,
      revision: meta("revision") ?? 0,
      dataset: meta("dataset") ?? "demo",
      employees: records("employees"),
      punches: records("punches"),
      imports: records("imports", "at DESC,rowid DESC"),
      audits: records("audits", "at DESC,rowid DESC"),
      permits: records("permits"),
      sourceHours: records("source_hours"),
      rules: meta("rules"),
      users: this.users(),
    };
  }
  save(data: AppData, mutateAccount?: () => void) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      mutateAccount?.();
      this.db.exec(
        "DELETE FROM punches; DELETE FROM permits; DELETE FROM source_hours; DELETE FROM employees; DELETE FROM imports; DELETE FROM audits;",
      );
      const employee = this.db.prepare("INSERT INTO employees VALUES (?,?)");
      const batch = this.db.prepare("INSERT INTO imports VALUES (?,?,?)");
      const punch = this.db.prepare(
        "INSERT INTO punches VALUES (?,?,?,?,?,?,?)",
      );
      const permit = this.db.prepare("INSERT INTO permits VALUES (?,?,?,?,?)");
      const hours = this.db.prepare(
        "INSERT INTO source_hours VALUES (?,?,?,?,?)",
      );
      const audit = this.db.prepare("INSERT INTO audits VALUES (?,?,?)");
      data.employees.forEach((e) => employee.run(e.id, JSON.stringify(e)));
      [...data.imports]
        .reverse()
        .forEach((i) => batch.run(i.id, i.at, JSON.stringify(i)));
      data.punches.forEach((p) =>
        punch.run(
          p.id,
          p.employeeId,
          p.importId,
          p.date,
          p.time,
          p.kind,
          JSON.stringify(p),
        ),
      );
      data.permits.forEach((p) =>
        permit.run(p.id, p.importId, p.employeeId, p.from, JSON.stringify(p)),
      );
      data.sourceHours.forEach((h) =>
        hours.run(h.id, h.importId, h.employeeId, h.month, JSON.stringify(h)),
      );
      [...data.audits]
        .reverse()
        .forEach((a) => audit.run(a.id, a.at, JSON.stringify(a)));
      const meta = this.db.prepare(
        "INSERT INTO meta(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      );
      meta.run("rules", JSON.stringify(data.rules));
      meta.run("dataset", JSON.stringify(data.dataset ?? "imported"));
      const revision =
        Number(
          this.db.prepare("SELECT value FROM meta WHERE key='revision'").get()
            ?.value ?? 0,
        ) + 1;
      meta.run("revision", JSON.stringify(revision));
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  close() {
    this.db.close();
  }
}
