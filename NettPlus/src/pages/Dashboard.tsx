import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  CheckCheck,
  Clock3,
  FileUp,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  analyze,
  dateLabel,
  initials,
  monthBounds,
  monthLabel,
  number,
  percent,
} from "../domain/attendance";
import { Card, Badge, Empty, PageHeading } from "../components/ui";
import { Chart } from "../components/Chart";
import { Filters } from "../components/Filters";
import { ImportHistory } from "../components/ImportHistory";

export default function Dashboard() {
  const { data, user, filters, setFilters } = useApp();
  const navigate = useNavigate();
  const a = useMemo(() => analyze(data, filters), [data, filters]);
  const previous = useMemo(() => {
    const d = new Date(`${filters.month}-01T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - 1);
    return analyze(data, {
      ...filters,
      ...monthBounds(d.toISOString().slice(0, 7)),
    });
  }, [data, filters]);
  const bounds = monthBounds(filters.month);
  const comparable =
    filters.from === bounds.from &&
    filters.to === bounds.to &&
    previous.present > 0;
  const delta = comparable
    ? ((a.present - previous.present) / previous.present) * 100
    : null;
  const issues = a.days
    .filter((d) => d.incomplete || (d.lateMinutes ?? 0) > 0)
    .slice(0, 4);
  const option = useMemo(
    () => ({
      color: ["#233a84", "#73b542"],
      legend: {
        data: ["Asistencias", "Atrasos (demo)"],
        right: 0,
        top: 0,
        itemWidth: 9,
        itemHeight: 9,
        textStyle: { color: "#76839a", fontSize: 11 },
      },
      grid: { left: 34, right: 8, top: 40, bottom: 50 },
      xAxis: {
        type: "category",
        data: a.timeline.map((d) => d.date),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#7a88a0",
          formatter: (date: string) => date.slice(8),
        },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        splitLine: { lineStyle: { color: "#edf0f5" } },
        axisLabel: { color: "#7a88a0" },
      },
      dataZoom: [
        { type: "inside" },
        {
          type: "slider",
          height: 10,
          bottom: 5,
          borderColor: "transparent",
          fillerColor: "#dbe3f5",
          handleSize: 0,
          showDetail: false,
        },
      ],
      series: [
        {
          name: "Asistencias",
          type: "bar",
          barMaxWidth: 20,
          itemStyle: { borderRadius: [4, 4, 0, 0] },
          data: a.timeline.map((d) => d.present),
        },
        {
          name: "Atrasos (demo)",
          type: "line",
          symbol: "circle",
          symbolSize: 5,
          smooth: false,
          data: a.timeline.map((d) => d.late),
        },
      ],
    }),
    [a],
  );
  const departments = [...new Set(a.employees.map((e) => e.department))];
  const departmentOption = useMemo(
    () => ({
      color: ["#73b542"],
      grid: { left: 110, right: 25, top: 8, bottom: 20 },
      xAxis: {
        type: "value",
        minInterval: 1,
        splitLine: { lineStyle: { color: "#edf0f5" } },
      },
      yAxis: {
        type: "category",
        data: departments,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { width: 100, overflow: "truncate", color: "#74819a" },
      },
      series: [
        {
          type: "bar",
          barMaxWidth: 15,
          itemStyle: { borderRadius: [0, 4, 4, 0] },
          data: departments.map(
            (d) => a.days.filter((day) => day.employee.department === d).length,
          ),
        },
      ],
    }),
    [a, departments.join("|")],
  );
  return (
    <>
      <PageHeading
        title="Resumen de asistencia"
        subtitle="Una visión clara de tu equipo, cada día."
      >
        {user.role === "admin" && (
          <Link className="btn primary" to="/importaciones">
            <FileUp size={17} />
            Nueva importación
          </Link>
        )}
      </PageHeading>
      <Filters />
      <div className="section-caption">
        <span>
          Indicadores clave{" "}
          <span className="muted">
            /{" "}
            {filters.from === bounds.from && filters.to === bounds.to
              ? monthLabel(filters.month)
              : `${dateLabel(filters.from)} – ${dateLabel(filters.to)}`}
          </span>
        </span>
        <Badge tone="blue">
          {data.dataset === "mixed"
            ? "Base demo + archivos cargados"
            : data.dataset === "imported"
              ? "Datos importados"
              : data.dataset === "empty"
                ? "Sin datos"
                : "Datos de demostración"}
        </Badge>
      </div>
      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon blue-icon">
            <UsersRound size={19} />
          </span>
          <p>Colaboradores</p>
          <strong>{number(a.employees.length)}</strong>
          <small>En los filtros seleccionados</small>
        </div>
        <div className="kpi">
          <span className="kpi-icon green-icon">
            <CheckCheck size={19} />
          </span>
          <p>Asistencias registradas</p>
          <strong>{number(a.present)}</strong>
          <small>
            {delta !== null ? (
              <span className={delta >= 0 ? "positive" : "muted"}>
                {delta >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                {Math.abs(delta).toFixed(1)}% vs. mes anterior
              </span>
            ) : (
              "Días con al menos una marcación"
            )}
          </small>
        </div>
        <div className="kpi">
          <span className="kpi-icon teal-icon">
            <Clock3 size={19} />
          </span>
          <p>
            Puntualidad <span className="demo-suffix">DEMO</span>
          </p>
          <strong className={a.punctuality === null ? "pending-value" : ""}>
            {percent(a.punctuality)}
          </strong>
          <small>
            {data.rules.enabled
              ? `Entrada ${data.rules.start} · ${data.rules.tolerance} min de tolerancia`
              : "Pendiente de reglas validadas"}
          </small>
        </div>
        <div className="kpi">
          <span className="kpi-icon amber-icon">
            <CalendarDays size={19} />
          </span>
          <p>
            Ausencias estimadas <span className="demo-suffix">DEMO</span>
          </p>
          <strong className={a.absent === null ? "pending-value" : ""}>
            {a.absent === null ? "Pendiente" : number(a.absent)}
          </strong>
          <small>
            {a.absent === null
              ? "Requiere vigencia laboral y reglas"
              : "En días configurados y cobertura importada"}
          </small>
        </div>
      </div>
      <div className="dashboard-charts">
        <Card
          title="Tendencia de asistencia"
          subtitle={`${dateLabel(filters.from)} – ${dateLabel(filters.to)} · Haz clic en un día para consultarlo`}
        >
          <div className="chart-holder">
            {a.days.length ? (
              <Chart
                label="Asistencias diarias y atrasos estimados"
                option={option}
                onSelect={(date) => {
                  setFilters((f) => ({ ...f, from: date, to: date }));
                  navigate("/reportes?tipo=diario");
                }}
                height={275}
              />
            ) : (
              <Empty title="Este periodo todavía no tiene marcaciones" />
            )}
          </div>
        </Card>
        <Card
          title="Novedades por revisar"
          subtitle={`${a.incomplete} días incompletos · ${a.late ?? "—"} atrasos estimados`}
          action={<span className="status-dot" />}
        >
          <div className="issue-list">
            {issues.map((d) => (
              <button
                key={`${d.employee.id}-${d.date}`}
                className="issue-item"
                onClick={() =>
                  navigate(
                    `/colaboradores?id=${encodeURIComponent(d.employee.id)}`,
                  )
                }
              >
                <span className="avatar amber-avatar">
                  {initials(d.employee.name)}
                </span>
                <span>
                  <strong>{d.employee.name}</strong>
                  <small>
                    {d.incomplete
                      ? "Marcación incompleta"
                      : `Atraso estimado · ${d.lateMinutes} min`}
                    <span>{dateLabel(d.date)}</span>
                  </small>
                </span>
                <ArrowRight size={15} />
              </button>
            ))}
            {!issues.length && (
              <Empty
                title="Sin novedades en este periodo"
                detail="No hay marcaciones incompletas ni atrasos calculables."
              />
            )}
          </div>
          <Link className="card-footer-link" to="/reportes">
            Consultar el reporte <ArrowRight size={15} />
          </Link>
        </Card>
      </div>
      <div className="dashboard-bottom">
        <Card
          title="Importaciones recientes"
          subtitle="Archivos procesados desde Excel"
          action={
            <Link
              className="text-link"
              to={user.role === "admin" ? "/importaciones" : "/reportes"}
            >
              Ver {user.role === "admin" ? "todas" : "reportes"}{" "}
              <ArrowRight size={14} />
            </Link>
          }
        >
          <ImportHistory compact />
        </Card>
        <Card
          title="Asistencia por departamento"
          subtitle="Días registrados · Clic para filtrar"
        >
          {a.days.length ? (
            <Chart
              option={departmentOption}
              label="Días de asistencia por departamento"
              height={190}
              onSelect={(department) =>
                setFilters((f) => ({ ...f, department, employeeId: "" }))
              }
            />
          ) : (
            <Empty />
          )}
        </Card>
      </div>
      <div className="scope-note">
        <UserRound size={14} />
        <span>
          La asistencia cuenta días con marcaciones. Los indicadores DEMO usan
          parámetros de prueba y requieren validación de Nettplus.
        </span>
      </div>
    </>
  );
}
