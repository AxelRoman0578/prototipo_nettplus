import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  RotateCcw,
  Save,
  Settings2,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { assertAdmin, timestampLabel } from "../domain/attendance";
import { createDemo, emptyData } from "../domain/demo";
import { withAudit } from "../services/storage";
import type { DemoUser, Role, Rules } from "../domain/types";
import {
  Badge,
  Card,
  Confirm,
  Empty,
  Modal,
  PageHeading,
  Pagination,
  usePagination,
} from "../components/ui";

export function Settings() {
  const { data, update, setFilters, saving, mode } = useApp();
  const [rules, setRules] = useState<Rules>({
    ...data.rules,
    weekdays: [...data.rules.weekdays],
  });
  const [confirm, setConfirm] = useState<"save" | "seed" | "clear" | null>(
    null,
  );
  const dirty = JSON.stringify(rules) !== JSON.stringify(data.rules);
  const labels = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ];
  async function apply() {
    if (confirm === "save")
      await update(
        (d, u) => {
          assertAdmin(u.role);
          return withAudit(
            { ...d, rules },
            u,
            "Configuración de reglas demo",
            `Entrada ${rules.start} · tolerancia ${rules.tolerance} min · días ${rules.weekdays.join(", ")} · estimaciones ${rules.enabled ? "activadas" : "desactivadas"}`,
          );
        },
        "Parámetros guardados. Los indicadores se han recalculado.",
        { type: "rules", rules },
      );
    else {
      await update(
        (d, u) => {
          assertAdmin(u.role);
          const next = confirm === "seed" ? createDemo() : emptyData();
          return withAudit(
            { ...next, users: d.users, rules: d.rules, audits: d.audits },
            u,
            confirm === "seed"
              ? "Reinicio de demostración"
              : "Limpieza de datos",
            confirm === "seed"
              ? `${next.employees.length} colaboradores ficticios cargados.`
              : "Se eliminaron colaboradores, marcaciones e importaciones de este navegador.",
          );
        },
        confirm === "seed"
          ? "Datos de demostración restaurados."
          : "Datos de asistencia eliminados.",
        { type: "reset", mode: confirm === "seed" ? "seed" : "clear" },
      );
      const { defaultFilters } = await import("../domain/attendance");
      setFilters(
        defaultFilters(confirm === "seed" ? createDemo() : emptyData()),
      );
    }
  }
  return (
    <>
      <PageHeading
        title="Configuración"
        subtitle="Parámetros de demostración y administración de los datos locales."
      />
      <Card
        title="Reglas de asistencia"
        subtitle="Requieren validación del cliente antes de considerarse políticas oficiales."
        action={<Settings2 size={20} className="muted" />}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setConfirm("save");
          }}
        >
          <label className="switch-line">
            <input
              type="checkbox"
              checked={rules.enabled}
              onChange={(e) =>
                setRules((r) => ({ ...r, enabled: e.target.checked }))
              }
            />
            <span>
              <strong>Usar parámetros DEMO para estimaciones</strong>
              <small>
                Al desactivarlos, puntualidad, atrasos y ausencias mostrarán un
                estado pendiente.
              </small>
            </span>
          </label>
          <div className="settings-grid">
            <label>
              Hora de entrada
              <input
                required
                type="time"
                value={rules.start}
                onChange={(e) =>
                  setRules((r) => ({ ...r, start: e.target.value }))
                }
              />
            </label>
            <label>
              Tolerancia (minutos)
              <input
                required
                type="number"
                min={0}
                max={120}
                value={rules.tolerance}
                onChange={(e) =>
                  setRules((r) => ({ ...r, tolerance: Number(e.target.value) }))
                }
              />
            </label>
            <label>
              Tamaño máximo de Excel (MB)
              <input
                required
                type="number"
                min={1}
                max={50}
                value={rules.maxFileMB}
                onChange={(e) =>
                  setRules((r) => ({ ...r, maxFileMB: Number(e.target.value) }))
                }
              />
            </label>
          </div>
          <fieldset className="weekday-picker">
            <legend>Días laborables de demostración</legend>
            {labels.map((day, i) => (
              <label key={day}>
                <input
                  type="checkbox"
                  checked={rules.weekdays.includes(i)}
                  onChange={(e) =>
                    setRules((r) => ({
                      ...r,
                      weekdays: e.target.checked
                        ? [...r.weekdays, i].sort()
                        : r.weekdays.filter((d) => d !== i),
                    }))
                  }
                />
                {day}
              </label>
            ))}
          </fieldset>
          <p className="fine-print">
            Una asistencia representa un día con al menos una marcación. La
            puntualidad usa únicamente días con entrada clasificada. Las
            ausencias requieren fecha de inicio laboral y cobertura importada;
            no incluyen feriados ni justificaciones. Las horas extra están
            pendientes de validación.
          </p>
          <div className="card-actions">
            <button
              type="button"
              className="btn"
              disabled={!dirty}
              onClick={() =>
                setRules({ ...data.rules, weekdays: [...data.rules.weekdays] })
              }
            >
              Descartar cambios
            </button>
            <button
              className="btn primary"
              disabled={!dirty || saving || !rules.weekdays.length}
            >
              <Save size={16} />
              Guardar parámetros
            </button>
          </div>
        </form>
      </Card>
      <Card
        title="Datos de demostración"
        subtitle={
          mode === "local"
            ? "Los cambios se guardan en el servidor local."
            : "Los cambios afectan únicamente a este navegador."
        }
      >
        <div className="data-action">
          <div>
            <strong>Restaurar la demostración</strong>
            <p>
              Reemplaza la asistencia con 24 colaboradores ficticios y
              marcaciones de septiembre y octubre de 2026. Conserva usuarios,
              reglas y auditoría.
            </p>
          </div>
          <button className="btn" onClick={() => setConfirm("seed")}>
            <RotateCcw size={16} />
            Restaurar demo
          </button>
        </div>
        <div className="data-action">
          <div>
            <strong>Limpiar datos de asistencia</strong>
            <p>
              Elimina colaboradores, marcaciones e importaciones para probar una
              carga desde cero. Conserva usuarios, reglas y auditoría.
            </p>
          </div>
          <button
            className="btn danger-outline"
            onClick={() => setConfirm("clear")}
          >
            <Trash2 size={16} />
            Limpiar datos
          </button>
        </div>
      </Card>
      {confirm && (
        <Confirm
          title={
            confirm === "save"
              ? "Guardar parámetros de demostración"
              : confirm === "seed"
                ? "Restaurar la demostración"
                : "Limpiar datos de asistencia"
          }
          label={
            confirm === "save"
              ? "Guardar y recalcular"
              : confirm === "seed"
                ? "Restaurar demostración"
                : "Eliminar datos de asistencia"
          }
          danger={confirm === "clear"}
          onClose={() => setConfirm(null)}
          onConfirm={apply}
        >
          <p>
            {confirm === "save"
              ? "Los nuevos parámetros se aplicarán a todos los indicadores y reportes. Permanecerán identificados como estimaciones de demostración."
              : confirm === "seed"
                ? "Se reemplazarán las importaciones y las marcaciones actuales por el conjunto ficticio original."
                : "Se eliminarán los datos de asistencia guardados en este navegador. Esta operación no se puede deshacer."}
          </p>
        </Confirm>
      )}
    </>
  );
}

export function Users() {
  const { data, user, update, notify, mode } = useApp();
  const [password, setPassword] = useState("");
  const [editing, setEditing] = useState<DemoUser | null>(null);
  const [draft, setDraft] = useState({
    name: "",
    email: "",
    role: "viewer" as Role,
    active: true,
  });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  function edit(value?: DemoUser) {
    setPassword("");
    setEditing(value ?? null);
    setDraft(
      value
        ? {
            name: value.name,
            email: value.email,
            role: value.role,
            active: value.active,
          }
        : { name: "", email: "", role: "viewer", active: true },
    );
    setOpen(true);
  }
  const { visible, page, setPage, size } = usePagination(
    data.users,
    String(data.users.length),
  );
  async function save() {
    setBusy(true);
    try {
      await update(
        (d, u) => {
          assertAdmin(u.role);
          if (!draft.name.trim() || !draft.email.trim())
            throw new Error("Completa nombre y correo.");
          if (
            d.users.some(
              (x) =>
                x.email.toLowerCase() === draft.email.trim().toLowerCase() &&
                x.id !== editing?.id,
            )
          )
            throw new Error("Este correo ya pertenece a un usuario demo.");
          if (editing?.id === u.id && (!draft.active || draft.role !== "admin"))
            throw new Error(
              "No puedes desactivar ni quitar el rol de tu propia sesión.",
            );
          if (
            editing?.id === "viewer-demo" &&
            (!draft.active || draft.role !== "viewer")
          )
            throw new Error(
              "La cuenta de consulta base se conserva para probar el modo viewer.",
            );
          const account = {
            ...draft,
            name: draft.name.trim(),
            email: draft.email.trim(),
            id: editing?.id ?? crypto.randomUUID(),
          };
          const users = editing
            ? d.users.map((x) => (x.id === editing.id ? account : x))
            : [...d.users, account];
          if (!users.some((x) => x.active && x.role === "admin"))
            throw new Error("Debe existir al menos un administrador activo.");
          return withAudit(
            { ...d, users },
            u,
            editing ? "Edición de usuario demo" : "Alta de usuario demo",
            `${account.name} · ${account.role} · ${account.active ? "activo" : "inactivo"}`,
          );
        },
        "Usuario guardado.",
        {
          type: "user",
          user: { ...draft, id: editing?.id },
          password: password || undefined,
        },
      );
      setOpen(false);
    } catch (e) {
      notify(e instanceof Error ? e.message : "No se pudo guardar.", true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        title="Usuarios y permisos"
        subtitle="Administra las cuentas con las que puedes probar los roles del prototipo."
      >
        <button className="btn primary" onClick={() => edit()}>
          <Plus size={17} />
          {mode === "local" ? "Nuevo usuario" : "Nuevo usuario demo"}
        </button>
      </PageHeading>
      <div className="info-banner">
        <ShieldCheck size={20} />
        <span>
          {mode === "local"
            ? "Sesiones autenticadas en el servidor local. Los permisos se verifican en cada operación. Al cambiar la contraseña o el rol se cierran las sesiones de esa cuenta."
            : "Modo demostración: el selector permite probar permisos del navegador, sin autenticación de servidor."}
        </span>
      </div>
      <Card
        title={
          mode === "local"
            ? "Usuarios del servidor local"
            : "Usuarios de demostración"
        }
        subtitle={`${data.users.length} cuentas · Sesión actual: ${user.name}`}
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name}</strong>
                    {u.id === user.id && (
                      <small className="muted block">Sesión actual</small>
                    )}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <Badge tone={u.role === "admin" ? "blue" : "neutral"}>
                      {u.role === "admin" ? "Administrador" : "Viewer"}
                    </Badge>
                  </td>
                  <td>
                    <Badge tone={u.active ? "green" : "neutral"}>
                      {u.active ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                  <td>
                    <button className="text-link" onClick={() => edit(u)}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          count={data.users.length}
          size={size}
          onChange={setPage}
        />
      </Card>
      <div className="permissions-grid">
        <Card title="Administrador">
          <ul className="permission-list">
            <li>Importar y validar archivos Excel</li>
            <li>Consultar dashboards y descargar reportes</li>
            <li>Configurar parámetros de demostración</li>
            <li>Administrar usuarios y consultar auditoría</li>
          </ul>
        </Card>
        <Card title="Viewer">
          <ul className="permission-list">
            <li>Consultar dashboards e historial de colaboradores</li>
            <li>Aplicar filtros y explorar gráficos</li>
            <li>Descargar reportes Excel y PDF</li>
            <li>Acceso de consulta, sin modificar datos</li>
          </ul>
        </Card>
      </div>
      {open && (
        <Modal
          title={editing ? "Editar usuario" : "Nuevo usuario"}
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <form
            className="user-form"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <label>
              Nombre
              <input
                autoFocus
                required
                maxLength={80}
                value={draft.name}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, name: e.target.value }))
                }
              />
            </label>
            <label>
              Correo
              <input
                required
                type="email"
                maxLength={120}
                placeholder="persona@nettplus.example"
                value={draft.email}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, email: e.target.value }))
                }
              />
            </label>
            {mode === "local" && (
              <label>
                {editing ? "Nueva contraseña (opcional)" : "Contraseña inicial"}
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={128}
                  required={!editing}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    editing
                      ? "Deja vacío para conservarla"
                      : "Mínimo 10 caracteres"
                  }
                />
              </label>
            )}
            <label>
              Rol
              <select
                value={draft.role}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, role: e.target.value as Role }))
                }
              >
                <option value="viewer">Viewer</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, active: e.target.checked }))
                }
              />
              Usuario activo
            </label>
            <p className="fine-print">
              {mode === "local"
                ? "La contraseña se almacena protegida mediante hash. La cuenta podrá acceder desde la pantalla de inicio de sesión."
                : "Cuenta de demostración sin contraseña, disponible en el selector del menú lateral."}
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </button>
              <button className="btn primary" disabled={busy}>
                {busy ? "Guardando…" : "Guardar usuario"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export function Audit() {
  const { data, mode } = useApp();
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const actions = [...new Set(data.audits.map((a) => a.action))];
  const rows = useMemo(
    () =>
      data.audits.filter(
        (a) =>
          (!action || a.action === action) &&
          `${a.user} ${a.action} ${a.detail}`
            .toLocaleLowerCase("es")
            .includes(search.toLocaleLowerCase("es")),
      ),
    [data, search, action],
  );
  const { visible, page, setPage, size } = usePagination(
    rows,
    search + action,
    10,
  );
  return (
    <>
      <PageHeading
        title="Auditoría e historial"
        subtitle={
          mode === "local"
            ? "Sesiones, importaciones y cambios registrados por el servidor local."
            : "Trazabilidad de las operaciones realizadas en este navegador."
        }
      />
      <div className="filters card">
        <label className="search-field">
          Buscar operación
          <div className="input-icon">
            <Search size={16} />
            <input
              placeholder="Usuario, archivo u operación…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </label>
        <label>
          Tipo de operación
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">Todas las operaciones</option>
            {actions.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
      </div>
      <Card
        title="Registro de actividad"
        subtitle={`${rows.length} operaciones encontradas`}
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Fecha y hora (Ecuador)</th>
                <th>Usuario</th>
                <th>Operación</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((a) => (
                <tr key={a.id}>
                  <td className="muted">{timestampLabel(a.at)}</td>
                  <td>{a.user}</td>
                  <td>
                    <Badge tone="blue">{a.action}</Badge>
                  </td>
                  <td className="audit-detail">{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <Empty title="No se encontraron operaciones" />}
        <Pagination
          page={page}
          count={rows.length}
          size={size}
          onChange={setPage}
        />
      </Card>
      <p className="fine-print">
        {mode === "local"
          ? "Las operaciones se registran con el usuario de la sesión autenticada. El archivo de la base de datos permanece en el equipo que ejecuta el servidor."
          : "El historial de demostración se guarda en el navegador y no sustituye una auditoría de servidor."}
      </p>
    </>
  );
}
