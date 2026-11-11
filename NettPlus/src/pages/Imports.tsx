import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CircleCheck,
  Download,
  FileSpreadsheet,
  FileUp,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import {
  fields,
  detectColumns,
  mappingErrors,
  readExcel,
  validateSheet,
  type ColumnMap,
  type SheetData,
  type ValidationResult,
} from "../services/excel";
import {
  detectDocument,
  sourceMonth,
  validateDocument,
  type DocumentKind,
  type DocumentValidation,
} from "../services/sourceDocuments";
import {
  downloadBytes,
  downloadIssues,
  exampleWorkbook,
} from "../services/reports";
import { Card, Badge, Confirm, PageHeading } from "../components/ui";
import { ImportHistory, IssueTable } from "../components/ImportHistory";

export default function Imports() {
  const {
    data,
    user,
    importWorkbook,
    notify,
    saving,
    setFilters,
    filters,
    mode,
  } = useApp();
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [header, setHeader] = useState(0);
  const [map, setMap] = useState<ColumnMap | null>(null);
  const [result, setResult] = useState<
    ValidationResult | DocumentValidation | null
  >(null);
  const [kind, setKind] = useState<DocumentKind>("attendance");
  const [month, setMonth] = useState(filters.month);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [exampleBusy, setExampleBusy] = useState(false);
  useEffect(() => {
    setResult(null);
  }, [data, sheetIndex, header, map, kind, month]);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  function selectSheet(index: number, list = sheets) {
    const sheet = list[index];
    const detected = detectDocument(sheet);
    let best = detected.header;
    for (let i = 0; i < Math.min(20, sheet.rows.length); i++) {
      const m = detectColumns(sheet.rows[i]);
      if (m.code >= 0 && (m.datetime >= 0 || m.date >= 0)) {
        best = i;
        break;
      }
    }
    setSheetIndex(index);
    setKind(detected.kind);
    setMonth(sourceMonth(sheet) ?? filters.month);
    setHeader(best);
    setMap(detectColumns(sheet.rows[best] ?? []));
    setResult(null);
    setError("");
  }
  async function load(file: File) {
    const ticket = ++request.current;
    setError("");
    setResult(null);
    setFile(null);
    setSheets([]);
    setMap(null);
    if (!/\.xlsx$/i.test(file.name)) {
      setError(
        "Selecciona un archivo .xlsx. Otros formatos no son compatibles.",
      );
      return;
    }
    if (file.size > data.rules.maxFileMB * 1024 * 1024) {
      setError(`El archivo supera el máximo de ${data.rules.maxFileMB} MB.`);
      return;
    }
    setBusy(true);
    try {
      const buffer = await file.arrayBuffer();
      const signature = new Uint8Array(
        buffer,
        0,
        Math.min(2, buffer.byteLength),
      );
      if (signature[0] !== 80 || signature[1] !== 75)
        throw new Error(
          "El contenido no corresponde a un libro Excel .xlsx válido.",
        );
      const list = await readExcel(buffer);
      if (ticket !== request.current) return;
      setFile(file);
      setSheets(list);
      selectSheet(0, list);
    } catch (e) {
      if (ticket === request.current)
        setError(
          `No se pudo leer el archivo. ${e instanceof Error ? e.message : "Puede estar dañado o protegido por contraseña."}`,
        );
    } finally {
      if (ticket === request.current) setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  async function downloadExample() {
    setExampleBusy(true);
    try {
      downloadBytes(
        await exampleWorkbook(),
        "Nettplus_Ejemplo.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      notify(
        "Ejemplo descargado: incluye filas válidas, duplicadas e incorrectas y una hoja de eventos.",
      );
    } catch (e) {
      notify(String(e), true);
    } finally {
      setExampleBusy(false);
    }
  }
  const sheet = sheets[sheetIndex];
  const requirements = map && kind === "attendance" ? mappingErrors(map) : [];
  const recordCount = result
    ? "punches" in result
      ? result.punches.length
      : result.valid
    : 0;
  function clear() {
    request.current++;
    setFile(null);
    setSheets([]);
    setMap(null);
    setResult(null);
    setError("");
    setBusy(false);
  }
  return (
    <>
      <PageHeading
        title={result ? "Validación de archivo" : "Importar archivo"}
        subtitle={
          result
            ? "Revisa los resultados antes de incorporar las marcaciones."
            : "Marcaciones, permisos y horas informadas: cada archivo en su lugar."
        }
      >
        <button
          className="btn"
          disabled={exampleBusy}
          onClick={downloadExample}
        >
          <Download size={16} />
          {exampleBusy ? "Preparando…" : "Descargar Excel de ejemplo"}
        </button>
      </PageHeading>
      <div className="stepper">
        <span className={file ? "done" : "active"}>
          <i>{file ? <Check size={12} /> : "1"}</i>Seleccionar archivo
        </span>
        <b />
        <span className={result ? "done" : file ? "active" : ""}>
          <i>{result ? <Check size={12} /> : "2"}</i>Validar información
        </span>
        <b />
        <span>
          <i>3</i>Confirmar importación
        </span>
      </div>
      {!result && (
        <Card>
          <input
            ref={input}
            className="sr-only"
            type="file"
            accept=".xlsx"
            onChange={(e) => {
              if (e.target.files?.[0]) void load(e.target.files[0]);
            }}
            aria-label="Archivo Excel de asistencia"
          />
          <div
            className={`dropzone ${dragging ? "dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (e.dataTransfer.files[0]) void load(e.dataTransfer.files[0]);
            }}
          >
            <span className="upload-icon">
              {busy ? (
                <RefreshCw size={27} className="spin" />
              ) : file ? (
                <FileSpreadsheet size={28} />
              ) : (
                <Upload size={28} />
              )}
            </span>
            <h2>
              {busy
                ? "Leyendo el archivo…"
                : file
                  ? file.name
                  : "Arrastra tu archivo aquí"}
            </h2>
            <p>
              {file
                ? `${(file.size / 1024).toFixed(1)} KB · ${sheets.length} hoja(s) encontrada(s)`
                : "o selecciona un archivo Excel de tu equipo"}
            </p>
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              <FileUp size={16} />
              {file ? "Cambiar archivo" : "Seleccionar archivo"}
            </button>
            <small>
              Formato .XLSX · Máximo {data.rules.maxFileMB} MB · Procesado en tu
              {mode === "local"
                ? "navegador y validado nuevamente en el servidor"
                : "navegador"}
            </small>
          </div>
          <div className="import-guidance">
            <strong>Antes de continuar</strong>
            <div>
              <span>
                <i>01</i>Asigna las columnas del archivo
              </span>
              <span>
                <i>02</i>Revisa duplicados e inconsistencias
              </span>
              <span>
                <i>03</i>Confirma los registros válidos
              </span>
            </div>
          </div>
        </Card>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {sheet && map && !result && (
        <Card
          title="Estructura del archivo"
          subtitle="Confirma la hoja, la fila de encabezados y la correspondencia de columnas."
        >
          <div className="mapping-top">
            <label>
              Hoja
              <select
                value={sheetIndex}
                onChange={(e) => selectSheet(Number(e.target.value))}
              >
                {sheets.map((s, i) => (
                  <option key={s.name} value={i}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Fila de encabezados
              <input
                type="number"
                min={1}
                max={Math.min(100, sheet.rows.length || 1)}
                value={header + 1}
                onChange={(e) => {
                  const row = Math.max(
                    0,
                    Math.min(
                      99,
                      sheet.rows.length - 1,
                      Number(e.target.value) - 1,
                    ),
                  );
                  setHeader(row);
                  setMap(detectColumns(sheet.rows[row] ?? []));
                }}
              />
            </label>
            <label>
              Tipo de reporte
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as DocumentKind)}
              >
                <option value="attendance">Marcaciones de asistencia</option>
                <option value="permits">Permisos registrados</option>
                <option value="hours">Consolidado de horas</option>
              </select>
            </label>
            <Badge tone="blue">
              {Math.max(0, sheet.rows.length - header - 1)} filas después del
              encabezado
            </Badge>
          </div>
          {kind === "attendance" && (
            <>
              <div className="mapping-grid">
                {fields.map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <select
                      value={map[key]}
                      onChange={(e) =>
                        setMap((prev) => ({
                          ...prev!,
                          [key]: Number(e.target.value),
                        }))
                      }
                    >
                      <option value={-1}>Sin asignar</option>
                      {(sheet.rows[header] ?? []).map((h, index) => (
                        <option key={index} value={index}>
                          {index + 1}. {String(h ?? "Sin título")}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <p className="fine-print">
                * Código y nombre obligatorios. Usa fecha + entrada/salida, o
                fecha y hora de evento. Fechas: AAAA-MM-DD o DD/MM/AAAA. Los
                turnos nocturnos requieren eventos con fechas individuales. Las
                celdas con fórmulas no se importan.
              </p>
            </>
          )}
          {kind === "hours" && (
            <div className="document-import-info">
              <label>
                Periodo del consolidado
                <input
                  type="month"
                  required
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </label>
              <p>
                Se conservan las horas suplementarias, extras y nocturnas
                informadas en el Excel, incluidas duraciones mayores de 24
                horas. No se calculan valores monetarios ni se aprueban estas
                horas.
              </p>
            </div>
          )}
          {kind === "permits" && (
            <div className="document-import-info">
              <p>
                Se importan el colaborador, el departamento, las fechas, la
                categoría y el estado de aprobación. Los motivos y comentarios
                personales se omiten. Los permisos no modifican automáticamente
                las ausencias estimadas.
              </p>
            </div>
          )}
          {requirements.length > 0 && (
            <div className="validation-hints">
              {requirements.map((r) => (
                <p key={r}>{r}</p>
              ))}
            </div>
          )}
          <h3 className="preview-title">Vista previa del archivo</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fila</th>
                  {(sheet.rows[header] ?? []).map((v, i) => (
                    <th key={i}>{String(v ?? "—")}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.rows.slice(header + 1, header + 6).map((row, i) => (
                  <tr key={i}>
                    <td className="muted">{header + i + 2}</td>
                    {row.map((v, j) => (
                      <td key={j}>
                        {v instanceof Date
                          ? v.toISOString().replace("T", " ").slice(0, 19)
                          : String(v ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-actions">
            <button className="btn" onClick={clear}>
              Cancelar
            </button>
            <button
              className="btn primary"
              disabled={
                requirements.length > 0 || busy || user.role !== "admin"
              }
              onClick={() => {
                try {
                  const validation =
                    kind === "attendance"
                      ? validateSheet(sheet, header, map, data)
                      : validateDocument(sheet, header, kind, data, month);
                  if (!validation.total) {
                    setError(
                      "La hoja no tiene filas de datos después del encabezado.",
                    );
                    return;
                  }
                  setError("");
                  setResult(validation);
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              Validar archivo
              <ArrowRight size={16} />
            </button>
          </div>
        </Card>
      )}
      {result && file && (
        <>
          <Card className="validation-success">
            <span className="success-icon">
              <CircleCheck size={28} />
            </span>
            <div>
              <h2>
                {result.valid
                  ? "Archivo revisado, listo para importar"
                  : "Revisión completada"}
              </h2>
              <p>
                {file.name} · {sheet.name} · {recordCount} registros nuevos
              </p>
            </div>
            <Badge tone={result.invalid ? "amber" : "green"}>
              {result.invalid ? "Requiere revisión" : "Validación completada"}
            </Badge>
          </Card>
          <div className="kpi-grid validation-kpis">
            {[
              ["Filas revisadas", result.total],
              ["Filas válidas", result.valid],
              ["Duplicadas completas", result.duplicates],
              ["Filas rechazadas", result.invalid],
            ].map(([title, count]) => (
              <div className="kpi" key={title}>
                <p>{title}</p>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
          <Card
            title="Novedades encontradas"
            subtitle={`${result.incomplete} filas válidas con advertencias. Las filas rechazadas se omitirán; las marcaciones incompletas válidas se conservarán.`}
            action={
              result.issues.length > 0 && (
                <button
                  className="btn small"
                  onClick={() =>
                    downloadIssues(
                      result.issues,
                      "nettplus-validacion.xlsx",
                    ).catch((e) => notify(String(e), true))
                  }
                >
                  <Download size={15} />
                  Incidencias
                </button>
              )
            }
          >
            <IssueTable issues={result.issues} />
          </Card>
          <div className="card-actions">
            <button className="btn" onClick={() => setResult(null)}>
              Revisar columnas
            </button>
            <button className="btn" onClick={clear}>
              <X size={15} />
              Cancelar
            </button>
            <button
              className="btn primary"
              disabled={saving}
              onClick={() => setConfirm(true)}
            >
              {result.valid
                ? `Importar ${result.valid} filas válidas`
                : "Guardar resultado de revisión"}
              <ArrowRight size={16} />
            </button>
          </div>
        </>
      )}
      <Card
        title="Historial de importaciones"
        subtitle="Cada archivo conserva su usuario responsable, fecha y resultado."
      >
        <ImportHistory />
      </Card>
      {confirm && result && file && (
        <Confirm
          title="Confirmar importación"
          label={result.valid ? "Confirmar e importar" : "Guardar revisión"}
          onClose={() => setConfirm(false)}
          onConfirm={async () => {
            await importWorkbook(
              { file, sheetIndex, header, map: map!, kind, month },
              result,
              sheet.name,
            );
            const latest =
              "punches" in result
                ? result.punches
                    .map((p) => p.date)
                    .sort()
                    .at(-1)
                : result.kind === "hours"
                  ? `${month}-01`
                  : result.permits
                      .map((p) => p.from.slice(0, 10))
                      .sort()
                      .at(-1);
            if (latest) {
              const month = latest.slice(0, 7);
              const { monthBounds } = await import("../domain/attendance");
              setFilters((f) => ({
                ...f,
                month,
                ...monthBounds(month),
                search: "",
                employeeId: "",
                department: "",
                status: "",
              }));
            }
            clear();
            navigate(kind === "attendance" ? "/" : "/novedades");
          }}
        >
          <p>
            Se guardarán <strong>{result.valid} filas válidas</strong> con{" "}
            {recordCount} registros nuevos. Se omitirán {result.duplicates}{" "}
            filas duplicadas y {result.invalid} filas rechazadas.
          </p>
          <p>
            Los datos y el resultado de validación quedarán guardados{" "}
            {mode === "local"
              ? "en la base SQLite del servidor local"
              : "en este navegador"}
            .
          </p>
        </Confirm>
      )}
    </>
  );
}
