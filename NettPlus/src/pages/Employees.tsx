import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowUpRight, Download, UsersRound } from "lucide-react";
import { useApp } from "../context/AppContext";
import { analyze, dateLabel, initials, percent } from "../domain/attendance";
import { Filters } from "../components/Filters";
import {
  Badge,
  Card,
  Empty,
  Modal,
  PageHeading,
  Pagination,
  usePagination,
} from "../components/ui";
import { downloadBytes, excelReport } from "../services/reports";

export default function Employees() {
  const { data, filters, notify } = useApp();
  const [params, setParams] = useSearchParams();
  const [exporting, setExporting] = useState(false);
  const a = useMemo(() => analyze(data, filters), [data, filters]);
  const { visible, page, setPage, size } = usePagination(
    a.summaries,
    JSON.stringify(filters),
  );
  const selected = data.employees.find((e) => e.id === params.get("id"));
  const personal = selected
    ? analyze(data, {
        ...filters,
        search: "",
        department: "",
        status: "",
        employeeId: selected.id,
      })
    : null;
  const history = usePagination(
    personal?.days ?? [],
    `${selected?.id}|${filters.from}|${filters.to}`,
    8,
  );
  async function exportList() {
    setExporting(true);
    try {
      downloadBytes(
        await excelReport("monthly", a.summaries, a.days, filters, data.rules),
        `nettplus-colaboradores-${filters.month}.xlsx`,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      notify("La lista filtrada se ha exportado a Excel.");
    } catch (e) {
      notify(String(e), true);
    } finally {
      setExporting(false);
    }
  }
  return (
    <>
      <PageHeading
        title="Colaboradores"
        subtitle="Personas, áreas e historial de asistencia en un solo lugar."
      >
        <button
          className="btn"
          disabled={!a.summaries.length || exporting}
          onClick={exportList}
        >
          <Download size={16} />
          {exporting ? "Exportando…" : "Exportar lista"}
        </button>
      </PageHeading>
      <Filters search status />
      <Card
        title="Directorio de colaboradores"
        subtitle={`${a.employees.length} personas · ${dateLabel(filters.from)} – ${dateLabel(filters.to)}`}
        action={<UsersRound size={20} className="muted" />}
      >
        <div className="table-scroll">
          <table className="employee-table">
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Departamento</th>
                <th>Puntualidad (demo)</th>
                <th>Asistencia</th>
                <th>Estado</th>
                <th>
                  <span className="sr-only">Detalle</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                <tr key={s.employee.id}>
                  <td>
                    <button
                      className="person-cell"
                      onClick={() => setParams({ id: s.employee.id })}
                    >
                      <span className="avatar">
                        {initials(s.employee.name)}
                      </span>
                      <span>
                        <strong>{s.employee.name}</strong>
                        <small>{s.employee.id}</small>
                      </span>
                    </button>
                  </td>
                  <td>{s.employee.department}</td>
                  <td>
                    <div className="progress-cell">
                      <strong>{percent(s.punctuality)}</strong>
                      {s.punctuality !== null && (
                        <span className="progress-track">
                          <span style={{ width: `${s.punctuality}%` }} />
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    {s.present}
                    <span className="muted">
                      {s.expected !== null ? ` / ${s.expected} días` : " días"}
                    </span>
                  </td>
                  <td>
                    <Badge
                      tone={
                        s.employee.status === "Activo" ? "green" : "neutral"
                      }
                    >
                      {s.employee.status}
                    </Badge>
                  </td>
                  <td>
                    <button
                      className="icon-btn"
                      aria-label={`Ver historial de ${s.employee.name}`}
                      onClick={() => setParams({ id: s.employee.id })}
                    >
                      <ArrowUpRight size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length && <Empty />}
        <Pagination
          page={page}
          count={a.summaries.length}
          size={size}
          onChange={setPage}
        />
      </Card>
      {selected && personal && (
        <Modal
          wide
          title="Historial del colaborador"
          onClose={() => setParams({})}
        >
          <div className="profile-header">
            <span className="avatar large-avatar">
              {initials(selected.name)}
            </span>
            <div>
              <h3>{selected.name}</h3>
              <p className="muted">
                {selected.id} · {selected.department}
              </p>
            </div>
            <Badge tone={selected.status === "Activo" ? "green" : "neutral"}>
              {selected.status}
            </Badge>
          </div>
          <p className="muted">
            {dateLabel(filters.from)} – {dateLabel(filters.to)} · Inicio
            laboral:{" "}
            {selected.activeFrom
              ? dateLabel(selected.activeFrom)
              : "No informado"}
          </p>
          <div className="mini-stats">
            <div>
              <strong>{personal.present}</strong>
              <span>Días con asistencia</span>
            </div>
            <div>
              <strong>{percent(personal.punctuality)}</strong>
              <span>Puntualidad demo</span>
            </div>
            <div>
              <strong>{personal.incomplete}</strong>
              <span>Incompletos</span>
            </div>
            <div>
              <strong>{personal.absent ?? "—"}</strong>
              <span>Ausencias demo</span>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Entrada</th>
                  <th>Salida</th>
                  <th>Marcaciones</th>
                  <th>Novedad</th>
                </tr>
              </thead>
              <tbody>
                {history.visible.map((d) => (
                  <tr key={d.date}>
                    <td>{dateLabel(d.date)}</td>
                    <td>{d.entry?.slice(0, 5) ?? "Sin entrada"}</td>
                    <td>{d.exit?.slice(0, 5) ?? "Sin salida"}</td>
                    <td>
                      <details>
                        <summary>{d.punches.length} registros</summary>
                        <ul className="raw-punches">
                          {d.punches.map((p) => (
                            <li key={p.id}>
                              {p.time} · {p.kind} · fila {p.sourceRow} ·{" "}
                              {data.imports.find((i) => i.id === p.importId)
                                ?.file ?? p.importId}
                            </li>
                          ))}
                        </ul>
                      </details>
                    </td>
                    <td>
                      <Badge
                        tone={
                          d.incomplete
                            ? "amber"
                            : (d.lateMinutes ?? 0) > 0
                              ? "red"
                              : "green"
                        }
                      >
                        {d.incomplete
                          ? "Incompleto"
                          : d.lateMinutes === null
                            ? "Reglas pendientes"
                            : d.lateMinutes > 0
                              ? `${d.lateMinutes} min (demo)`
                              : "A tiempo (demo)"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!personal.days.length && (
            <Empty title="Sin marcaciones en el periodo" />
          )}
          <Pagination
            page={history.page}
            count={personal.days.length}
            size={history.size}
            onChange={history.setPage}
          />
          <p className="fine-print">
            Las horas proceden del archivo original. Los eventos sin tipo se
            conservan sin inferir entrada ni salida.
          </p>
        </Modal>
      )}
    </>
  );
}
