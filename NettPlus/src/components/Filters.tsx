import { RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { useApp } from "../context/AppContext";
import { monthBounds } from "../domain/attendance";

export function Filters({
  search = false,
  status = false,
}: {
  search?: boolean;
  status?: boolean;
}) {
  const { data, filters: f, setFilters } = useApp();
  const departments = [
    ...new Set(data.employees.map((e) => e.department)),
  ].sort();
  const set = (key: keyof typeof f, value: string) =>
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "department" ? { employeeId: "" } : {}),
    }));
  return (
    <>
      <div className="filters card">
        <div className="filter-symbol">
          <SlidersHorizontal size={18} />
        </div>
        {search && (
          <label className="search-field">
            Buscar colaborador
            <div className="input-icon">
              <Search size={16} />
              <input
                value={f.search}
                placeholder="Nombre o código…"
                onChange={(e) => set("search", e.target.value)}
              />
            </div>
          </label>
        )}
        <label>
          Periodo
          <input
            type="month"
            min="1900-01"
            max="2100-12"
            value={f.month}
            onChange={(e) => {
              if (e.target.value)
                setFilters((prev) => ({
                  ...prev,
                  month: e.target.value,
                  ...monthBounds(e.target.value),
                }));
            }}
          />
        </label>
        <label>
          Departamento
          <select
            value={f.department}
            onChange={(e) => set("department", e.target.value)}
          >
            <option value="">Todos los departamentos</option>
            {departments.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        {!search && (
          <label>
            Colaborador
            <select
              value={f.employeeId}
              onChange={(e) => set("employeeId", e.target.value)}
            >
              <option value="">Todos los colaboradores</option>
              {data.employees
                .filter((e) => !f.department || e.department === f.department)
                .map((e) => (
                  <option value={e.id} key={e.id}>
                    {e.name}
                  </option>
                ))}
            </select>
          </label>
        )}
        {status && (
          <label>
            Estado
            <select
              value={f.status}
              onChange={(e) => set("status", e.target.value)}
            >
              <option value="">Todos</option>
              <option>Activo</option>
              <option>Inactivo</option>
            </select>
          </label>
        )}
        <details className="date-details">
          <summary>Fechas</summary>
          <div>
            <label>
              Desde
              <input
                type="date"
                value={f.from}
                max={f.to}
                onChange={(e) => {
                  if (e.target.value && e.target.value <= f.to)
                    set("from", e.target.value);
                }}
              />
            </label>
            <label>
              Hasta
              <input
                type="date"
                value={f.to}
                min={f.from}
                onChange={(e) => {
                  if (e.target.value && e.target.value >= f.from)
                    set("to", e.target.value);
                }}
              />
            </label>
          </div>
        </details>
        <button
          className="icon-btn reset-filter"
          title="Restablecer filtros del mes"
          aria-label="Restablecer filtros del mes"
          onClick={() =>
            setFilters((prev) => ({
              ...prev,
              ...monthBounds(prev.month),
              department: "",
              employeeId: "",
              status: "",
              search: "",
            }))
          }
        >
          <RotateCcw size={16} />
        </button>
      </div>
      {((!search && f.search) ||
        (search && f.employeeId) ||
        (!status && f.status)) && (
        <div className="active-filters">
          {!search && f.search && (
            <button
              className="filter-chip"
              aria-label="Quitar filtro de búsqueda"
              onClick={() => set("search", "")}
            >
              Búsqueda: {f.search}
              <X size={12} />
            </button>
          )}
          {search && f.employeeId && (
            <button
              className="filter-chip"
              aria-label="Quitar filtro de colaborador"
              onClick={() => set("employeeId", "")}
            >
              Colaborador:{" "}
              {data.employees.find((e) => e.id === f.employeeId)?.name ??
                f.employeeId}
              <X size={12} />
            </button>
          )}
          {!status && f.status && (
            <button
              className="filter-chip"
              aria-label="Quitar filtro de estado"
              onClick={() => set("status", "")}
            >
              Estado: {f.status}
              <X size={12} />
            </button>
          )}
        </div>
      )}
    </>
  );
}
