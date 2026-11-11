import { useState } from "react";
import { FileSpreadsheet, Download } from "lucide-react";
import { useApp } from "../context/AppContext";
import { number, timestampLabel } from "../domain/attendance";
import type { ImportLog } from "../domain/types";
import { downloadIssues } from "../services/reports";
import { Badge, Empty, Modal, Pagination, usePagination } from "./ui";

export function ImportHistory({ compact = false }: { compact?: boolean }) {
  const { data, user, notify } = useApp();
  const [selected, setSelected] = useState<ImportLog | null>(null);
  const { visible, page, setPage, size } = usePagination(
    data.imports,
    String(data.imports.length),
    compact ? 3 : 6,
  );
  return (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Archivo</th>
              <th>Fecha</th>
              <th>Filas válidas</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((log) => (
              <tr key={log.id}>
                <td>
                  <div className="file-cell">
                    <span className="file-icon">
                      <FileSpreadsheet size={18} />
                    </span>
                    <div>
                      {user.role === "admin" ? (
                        <button
                          className="text-link file-name"
                          onClick={() => setSelected(log)}
                        >
                          {log.file}
                        </button>
                      ) : (
                        <strong className="file-name">{log.file}</strong>
                      )}
                      <small>
                        {log.sheet} · {log.user}
                      </small>
                    </div>
                  </div>
                </td>
                <td className="muted">{timestampLabel(log.at)}</td>
                <td>
                  {number(log.valid)}{" "}
                  <span className="muted">/ {number(log.rows)}</span>
                </td>
                <td>
                  <Badge tone={log.invalid || log.warnings ? "amber" : "green"}>
                    {log.invalid || log.warnings
                      ? "Con novedades"
                      : "Procesado"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visible.length && (
        <Empty
          title="Todavía no hay importaciones"
          detail="Los archivos procesados aparecerán aquí con su resultado."
        />
      )}
      {!compact && (
        <Pagination
          count={data.imports.length}
          page={page}
          size={size}
          onChange={setPage}
        />
      )}
      {selected && (
        <Modal
          title="Detalle de importación"
          onClose={() => setSelected(null)}
          wide
        >
          <h3 className="break-words">{selected.file}</h3>
          <p className="muted">
            {selected.sheet} · {timestampLabel(selected.at)} · {selected.user}
          </p>
          <div className="mini-stats">
            <div>
              <strong>{selected.valid}</strong>
              <span>Filas válidas</span>
            </div>
            <div>
              <strong>{selected.duplicates}</strong>
              <span>Duplicadas</span>
            </div>
            <div>
              <strong>{selected.invalid}</strong>
              <span>Rechazadas</span>
            </div>
            <div>
              <strong>{selected.warnings}</strong>
              <span>Con advertencias</span>
            </div>
          </div>
          <IssueTable issues={selected.issues} />
          {selected.issues.length > 0 && (
            <div className="modal-actions">
              <button
                className="btn"
                onClick={() =>
                  downloadIssues(
                    selected.issues,
                    "nettplus-incidencias.xlsx",
                  ).catch((e) => notify(String(e), true))
                }
              >
                <Download size={16} />
                Exportar incidencias
              </button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
export function IssueTable({ issues }: { issues: ImportLog["issues"] }) {
  const { visible, page, setPage, size } = usePagination(
    issues,
    String(issues.length),
    7,
  );
  if (!issues.length)
    return (
      <Empty
        title="Sin incidencias"
        detail="Todos los registros revisados cumplen las validaciones."
      />
    );
  return (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Fila</th>
              <th>Columna</th>
              <th>Motivo</th>
              <th>Resultado</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((issue, i) => (
              <tr key={`${issue.row}-${i}`}>
                <td className="muted">{issue.row}</td>
                <td>{issue.column}</td>
                <td className="issue-message">{issue.message}</td>
                <td>
                  <Badge
                    tone={
                      issue.type === "error"
                        ? "red"
                        : issue.type === "duplicate"
                          ? "blue"
                          : "amber"
                    }
                  >
                    {issue.type === "error"
                      ? "Rechazado"
                      : issue.type === "duplicate"
                        ? "Duplicado"
                        : "Por revisar"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        count={issues.length}
        page={page}
        size={size}
        onChange={setPage}
      />
    </>
  );
}
