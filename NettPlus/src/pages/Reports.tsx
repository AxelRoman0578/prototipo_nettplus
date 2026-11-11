import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, FileDown, FileSpreadsheet } from "lucide-react";
import { useApp } from "../context/AppContext";
import { analyze, dateLabel, percent } from "../domain/attendance";
import {
  reportTable,
  excelReport,
  pdfReport,
  downloadBytes,
  type ReportMode,
} from "../services/reports";
import {
  Card,
  Empty,
  PageHeading,
  Pagination,
  usePagination,
} from "../components/ui";
import { Filters } from "../components/Filters";
import { Chart } from "../components/Chart";

export default function Reports() {
  const { data, filters, notify } = useApp();
  const [params, setParams] = useSearchParams();
  const mode: ReportMode =
    params.get("tipo") === "diario" ? "daily" : "monthly";
  const [exporting, setExporting] = useState("");
  const a = useMemo(() => analyze(data, filters), [data, filters]);
  const table = reportTable(mode, a.summaries, a.days);
  const { visible, page, setPage, size } = usePagination(
    table.rows,
    JSON.stringify(filters) + mode,
    10,
  );
  const weeks = useMemo(
    () =>
      Array.from({ length: Math.ceil(a.timeline.length / 7) }, (_, i) => ({
        label: `Semana ${i + 1}`,
        days: a.timeline
          .slice(i * 7, i * 7 + 7)
          .reduce((sum, day) => sum + day.present, 0),
      })),
    [a.timeline],
  );
  const option = useMemo(
    () => ({
      grid: { left: 80, right: 30, top: 10, bottom: 20 },
      xAxis: {
        type: "value",
        minInterval: 1,
        splitLine: { lineStyle: { color: "#edf0f5" } },
      },
      yAxis: {
        type: "category",
        inverse: true,
        data: weeks.map((w) => w.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: "#74819a" },
      },
      dataZoom:
        weeks.length > 6
          ? [
              {
                type: "slider",
                yAxisIndex: 0,
                startValue: 0,
                endValue: 5,
                width: 8,
                right: 0,
                showDetail: false,
              },
            ]
          : [],
      series: [
        {
          type: "bar",
          data: weeks.map((w) => w.days),
          barMaxWidth: 13,
          showBackground: true,
          backgroundStyle: { color: "#f3f6f9", borderRadius: 6 },
          itemStyle: { color: "#73b542", borderRadius: 6 },
          label: { show: true, position: "right", color: "#253246" },
        },
      ],
    }),
    [weeks],
  );
  async function exportReport(type: "excel" | "pdf") {
    setExporting(type);
    try {
      const bytes = await (type === "excel" ? excelReport : pdfReport)(
        mode,
        a.summaries,
        a.days,
        filters,
        data.rules,
      );
      downloadBytes(
        bytes,
        `Nettplus_${mode === "monthly" ? "Consolidado" : "Diario"}_${filters.from}_${filters.to}.${type === "excel" ? "xlsx" : "pdf"}`,
        type === "excel"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "application/pdf",
      );
      notify(
        `Reporte ${type === "excel" ? "Excel" : "PDF"} exportado con los filtros seleccionados.`,
      );
    } catch (e) {
      notify(`No se pudo exportar: ${String(e)}`, true);
    } finally {
      setExporting("");
    }
  }
  return (
    <>
      <PageHeading
        title={mode === "monthly" ? "Reporte mensual" : "Resumen diario"}
        subtitle="Información de asistencia para apoyar la preparación externa de nómina."
      >
        <button
          className="btn"
          disabled={!!exporting || !table.rows.length}
          onClick={() => exportReport("pdf")}
        >
          <FileDown size={16} />
          {exporting === "pdf" ? "Generando…" : "Exportar PDF"}
        </button>
        <button
          className="btn primary"
          disabled={!!exporting || !table.rows.length}
          onClick={() => exportReport("excel")}
        >
          <FileSpreadsheet size={16} />
          {exporting === "excel" ? "Generando…" : "Exportar Excel"}
        </button>
      </PageHeading>
      <div className="tabs">
        <button
          className={mode === "monthly" ? "active" : ""}
          onClick={() => setParams({})}
        >
          Consolidado mensual
        </button>
        <button
          className={mode === "daily" ? "active" : ""}
          onClick={() => setParams({ tipo: "diario" })}
        >
          Marcaciones diarias
        </button>
      </div>
      <Filters status />
      <p className="filter-summary">
        {dateLabel(filters.from)} – {dateLabel(filters.to)}
        {filters.search ? ` · Búsqueda activa: ${filters.search}` : ""} ·{" "}
        {data.rules.enabled
          ? "Indicadores sujetos a parámetros de demostración"
          : "Puntualidad y ausencias pendientes de reglas"}
      </p>
      <Card title="Resumen del periodo">
        <div className="report-stats">
          <div>
            <strong>{a.workdays.length}</strong>
            <small>Días laborables con cobertura</small>
          </div>
          <div>
            <strong>{percent(a.punctuality)}</strong>
            <small>Puntualidad estimada · DEMO</small>
          </div>
          <div>
            <strong>{a.absent ?? "—"}</strong>
            <small>Ausencias estimadas · DEMO</small>
          </div>
          <div>
            <strong className="amber-text">{a.incomplete}</strong>
            <small>Días incompletos por revisar</small>
          </div>
        </div>
      </Card>
      <div className="report-charts">
        <Card
          title="Asistencia por semana"
          subtitle="Días registrados · Semanas de 7 días desde el inicio del filtro"
        >
          {a.days.length ? (
            <Chart
              option={option}
              label="Cantidad de días de asistencia por semana del mes"
              height={220}
            />
          ) : (
            <Empty />
          )}
        </Card>
        <Card
          title="Novedades del periodo"
          subtitle="Calculadas sobre las marcaciones seleccionadas"
        >
          <ul className="novelty-list">
            <li>
              <i className="dot amber-dot" />
              Atrasos estimados (demo)<strong>{a.late ?? "Pendiente"}</strong>
            </li>
            <li>
              <i className="dot red-dot" />
              Ausencias estimadas (demo)
              <strong>{a.absent ?? "Pendiente"}</strong>
            </li>
            <li>
              <i className="dot blue-dot" />
              Días incompletos<strong>{a.incomplete}</strong>
            </li>
            <li>
              <i className="dot purple-dot" />
              Eventos sin clasificar
              <strong>
                {a.punches.filter((p) => p.kind === "sin clasificar").length}
              </strong>
            </li>
          </ul>
        </Card>
      </div>
      <Card
        title={
          mode === "monthly"
            ? "Consolidado por colaborador"
            : "Detalle diario de marcaciones"
        }
        subtitle="La exportación incluye todos los resultados filtrados, independientemente de la página visible."
        action={<Download size={18} className="muted" />}
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
              {visible.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className={j === 1 ? "font-medium" : ""}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length && <Empty />}
        <Pagination
          count={table.rows.length}
          page={page}
          size={size}
          onChange={setPage}
        />
      </Card>
      <p className="fine-print">
        Las ausencias requieren vigencia laboral conocida y se estiman
        únicamente dentro de la cobertura de las marcaciones importadas. No se
        descuentan feriados ni justificaciones. Las horas extra permanecen
        pendientes de reglas aprobadas.
      </p>
    </>
  );
}
