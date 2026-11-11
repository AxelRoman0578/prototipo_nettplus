import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Inbox, X } from "lucide-react";

export function PageHeading({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </div>
  );
}
export function Card({
  title,
  subtitle,
  children,
  action,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <div className="card-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "green" | "amber" | "red" | "blue" | "neutral";
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Empty({
  title = "No hay resultados",
  detail = "Prueba con otros filtros o importa un archivo Excel.",
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className="empty">
      <Inbox size={30} strokeWidth={1.4} />
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "modal wide" : "modal"}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = ref.current.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button
          className="icon-btn"
          onClick={onClose}
          aria-label="Cerrar diálogo"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Confirm({
  title,
  children,
  label = "Confirmar",
  onConfirm,
  onClose,
  danger = false,
}: {
  title: string;
  children: ReactNode;
  label?: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  danger?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal
      title={title}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="confirm-body">{children}</div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button className="btn" disabled={busy} onClick={onClose}>
          Cancelar
        </button>
        <button
          className={`btn ${danger ? "danger" : "primary"}`}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await onConfirm();
              onClose();
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : "No se pudo completar la operación.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Guardando…" : label}
        </button>
      </div>
    </Modal>
  );
}
export function Pagination({
  page,
  count,
  size,
  onChange,
}: {
  page: number;
  count: number;
  size: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(count / size));
  return (
    <div className="pagination">
      <span>
        {count
          ? `${(page - 1) * size + 1}–${Math.min(page * size, count)} de ${count}`
          : "0 resultados"}
      </span>
      <div>
        <button
          className="icon-btn"
          aria-label="Página anterior"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={17} />
        </button>
        <span>
          Página {page} de {pages}
        </span>
        <button
          className="icon-btn"
          aria-label="Página siguiente"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}
export function usePagination<T>(rows: T[], key: string, size = 8) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [key]);
  const safePage = Math.min(page, Math.max(1, Math.ceil(rows.length / size)));
  return {
    page: safePage,
    setPage,
    size,
    visible: rows.slice((safePage - 1) * size, safePage * size),
  };
}
