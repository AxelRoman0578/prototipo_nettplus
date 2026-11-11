import { useMemo, useState } from "react";
import {
  FileDown,
  FileSpreadsheet,
  CalendarCheck2,
  Clock4,
  CircleCheck,
  ArrowUpRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import {
  dateLabel,
  initials,
  monthBounds,
  monthLabel,
} from "../domain/attendance";
import { durationLabel } from "../services/sourceDocuments";
import { downloadBytes, tableExport } from "../services/reports";
import {
  Badge,
  Card,
  Empty,
  PageHeading,
  Pagination,
  usePagination,
} from "../components/ui";
import { Chart } from "../components/Chart";

export default function SourceDocuments() {
  const { data, filters, setFilters, user, notify } = useApp();
  const [tab, setTab] = useState<"permits" | "hours">("permits");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [approval, setApproval] = useState("");
  const [exporting, setExporting] = useState(false);
  const departments = [
    ...new Set(
      (tab === "permits" ? data.permits : data.sourceHours).map(
        (r) => r.department,
      ),
    ),
  ].sort();
  const permits = useMemo(
    () =>
      data.permits.filter(
        (p) =>
          p.from.slice(0, 10) <= filters.to &&
          p.to.slice(0, 10) >= filters.from &&
          (!department || p.department === department) &&
          (!approval || p.approval === approval) &&
          `${p.name} ${p.employeeId}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [data, filters, department, approval, search],
  );
  const hours = useMemo(
    () =>
      data.sourceHours.filter(
        (h) =>
          h.month === filters.month &&
          (!department || h.department === department) &&
          `${h.name} ${h.employeeId}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [data, filters.month, department, search],
  );
  const table =
    tab === "permits"
      ? {
          headers: [
            "Código",
            "Colaborador",
            "Departamento",
            "Desde",
            "Hasta",
            "Categoría",
            "Aprobación",
          ],
          rows: permits.map((p) => [
            p.employeeId,
            p.name,
            p.department,
            `${p.from.slice(0, 10)} ${p.from.slice(11, 16)}`,
            `${p.to.slice(0, 10)} ${p.to.slice(11, 16)}`,
            p.category,
            p.approval,
          ]),
        }
      : {
          headers: [
            "Código",
            "Colaborador",
            "Departamento",
            "Periodo",
            "Suplementarias",
            "Extras informadas",
            "Nocturnas",
          ],
          rows: hours.map((h) => [
            h.employeeId,
            h.name,
            h.department,
            h.month,
            durationLabel(h.supplemental),
            durationLabel(h.extra),
            durationLabel(h.night),
          ]),
        };
  const pager = usePagination(
    table.rows,
    [tab, search, department, approval, filters.month].join("|"),
    8,
  );
  const totalMinutes = hours.reduce(
    (sum, h) => sum + (h.supplemental ?? 0) + (h.extra ?? 0) + (h.night ?? 0),
    0,
  );
  const categories = [...new Set(permits.map((p) => p.category))];
  const chart = useMemo(
    () => ({
      color: ["#233a84", "#73b542", "#fdea18", "#8b9ac7", "#b7d99e"],
      tooltip: { trigger: "item", renderMode: "richText" },
      legend: {
        orient: "vertical",
        right: 0,
        top: "center",
        textStyle: { color: "#78869d", fontSize: 10 },
        itemWidth: 8,
        itemHeight: 8,
      },
      series: [
        {
          type: "pie",
          radius: ["47%", "71%"],
          center: ["26%", "50%"],
          label: { show: false },
          data: categories.map((name) => ({
            name,
            value: permits.filter((p) => p.category === name).length,
          })),
        },
      ],
    }),
    [permits, categories.join("|")],
  );
  async function exportData(type: "xlsx" | "pdf") {
    setExporting(true);
    try {
      const title =
        tab === "permits"
          ? "Permisos registrados"
          : "Horas informadas en archivo";
      const bytes = await tableExport(
        type,
        table.headers,
        table.rows,
        title,
        `${monthLabel(filters.month)} · ${department || "Todos los departamentos"} · ${approval || "Todos los estados"} · Búsqueda: ${search || "Todas"}`,
      );
      downloadBytes(
        bytes,
        `Nettplus_${tab}_${filters.month}.${type}`,
        type === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      notify("Reporte exportado con los filtros seleccionados.");
    } catch (e) {
      notify(String(e), true);
    } finally {
      setExporting(false);
    }
  }
  return (
    <>
      <PageHeading
        title="Novedades y horas"
        subtitle="El contexto de la asistencia, organizado desde tus reportes de origen."
      >
        {user.role === "admin" && (
          <Link to="/importaciones" className="btn primary">
            Importar reporte
            <ArrowUpRight size={16} />
          </Link>
        )}
      </PageHeading>
      <div className="tabs">
        <button
          className={tab === "permits" ? "active" : ""}
          onClick={() => {
            setTab("permits");
            setDepartment("");
          }}
        >
          Permisos registrados
        </button>
        <button
          className={tab === "hours" ? "active" : ""}
          onClick={() => {
            setTab("hours");
            setDepartment("");
          }}
        >
          Horas informadas
        </button>
      </div>
      <div className="filters card">
        <label>
          Periodo
          <input
            type="month"
            value={filters.month}
            onChange={(e) => {
              if (e.target.value)
                setFilters((f) => ({
                  ...f,
                  month: e.target.value,
                  ...monthBounds(e.target.value),
                }));
            }}
          />
        </label>
        <label className="search-field">
          Buscar colaborador
          <input
            value={search}
            placeholder="Nombre o código…"
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          Departamento
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="">Todos los departamentos</option>
            {departments.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        {tab === "permits" && (
          <label>
            Aprobación
            <select
              value={approval}
              onChange={(e) => setApproval(e.target.value)}
            >
              <option value="">Todos los estados</option>
              {[...new Set(data.permits.map((p) => p.approval))].map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="source-overview">
        <Card
          title={
            tab === "permits"
              ? "Permisos del periodo"
              : "Consolidado del archivo"
          }
          subtitle={monthLabel(filters.month)}
        >
          <div className="source-metrics">
            <div>
              <span className="source-metric-icon">
                <CalendarCheck2 size={21} />
              </span>
              <strong>
                {tab === "permits" ? permits.length : hours.length}
              </strong>
              <small>
                {tab === "permits"
                  ? "Permisos registrados"
                  : "Colaboradores informados"}
              </small>
            </div>
            <div>
              <span className="source-metric-icon green-icon">
                {tab === "permits" ? (
                  <CircleCheck size={21} />
                ) : (
                  <Clock4 size={21} />
                )}
              </span>
              <strong>
                {tab === "permits"
                  ? permits.filter(
                      (p) => p.approval.toLowerCase() === "aprobado",
                    ).length
                  : durationLabel(totalMinutes)}
              </strong>
              <small>
                {tab === "permits"
                  ? "Aprobados en el origen"
                  : "Total de horas informadas"}
              </small>
            </div>
          </div>
        </Card>
        <Card
          title={
            tab === "permits"
              ? "Permisos por categoría"
              : "Información de origen"
          }
          subtitle={
            tab === "permits"
              ? "Distribución de los registros seleccionados"
              : "Un insumo para la revisión del equipo"
          }
        >
          {tab === "permits" && permits.length ? (
            <Chart
              option={chart}
              label="Permisos por categoría del archivo"
              height={145}
            />
          ) : (
            <div className="source-explanation">
              <FileSpreadsheet size={30} />
              <p>
                {tab === "permits"
                  ? "Carga el reporte de permisos para consultar su distribución."
                  : "Estas duraciones se leen del consolidado. No se calculan desde las marcaciones ni representan horas aprobadas por el sistema."}
              </p>
            </div>
          )}
        </Card>
      </div>
      <Card
        title={
          tab === "permits" ? "Detalle de permisos" : "Horas por colaborador"
        }
        subtitle={
          tab === "permits"
            ? "Categoría y aprobación conservadas del reporte. Los motivos personales no se almacenan."
            : "Duraciones acumuladas en HHH:MM, incluso superiores a 24 horas."
        }
        action={
          <div className="heading-actions">
            <button
              className="btn small"
              disabled={!table.rows.length || exporting}
              onClick={() => exportData("pdf")}
            >
              <FileDown size={15} />
              PDF
            </button>
            <button
              className="btn small"
              disabled={!table.rows.length || exporting}
              onClick={() => exportData("xlsx")}
            >
              <FileSpreadsheet size={15} />
              Excel
            </button>
          </div>
        }
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {table.headers.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pager.visible.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>
                      {j === 1 ? (
                        <span className="source-person">
                          <span className="avatar">
                            {initials(String(cell))}
                          </span>
                          <strong>{cell}</strong>
                        </span>
                      ) : j === 6 && tab === "permits" ? (
                        <Badge
                          tone={
                            String(cell).toLowerCase() === "aprobado"
                              ? "green"
                              : "amber"
                          }
                        >
                          {cell}
                        </Badge>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!table.rows.length && (
          <Empty
            title={
              tab === "permits"
                ? "Sin permisos en este periodo"
                : "Sin horas informadas en este periodo"
            }
            detail="Importa un reporte compatible o selecciona otro mes."
          />
        )}
        <Pagination
          page={pager.page}
          size={pager.size}
          count={table.rows.length}
          onChange={pager.setPage}
        />
      </Card>
      <p className="fine-print">
        {tab === "permits"
          ? `Se muestran permisos que coinciden con ${dateLabel(filters.from)} – ${dateLabel(filters.to)}. No se convierten en marcaciones ni justifican ausencias automáticamente.`
          : "Las horas suplementarias, extras y nocturnas son valores informados en el documento de origen. Su aprobación y tratamiento requieren las reglas de Nettplus. No se calculan salarios ni pagos."}
      </p>
    </>
  );
}
