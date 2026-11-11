import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AppData, DemoUser, Filters } from "../domain/types";
import { assertAdmin, defaultFilters } from "../domain/attendance";
import { commitImport, loadData, saveData } from "../services/storage";
import {
  api,
  ApiError,
  commandApi,
  serverAvailable,
  uploadWorkbook,
  type ApiCommand,
  type Session,
  type WorkbookImport,
} from "../services/api";
import {
  commitDocument,
  type DocumentValidation,
} from "../services/sourceDocuments";
import type { ValidationResult } from "../services/excel";
import Login from "../pages/Login";

interface AppContextValue {
  data: AppData;
  user: DemoUser;
  filters: Filters;
  mode: "local" | "demo";
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  selectUser: (id: string) => void;
  logout: () => Promise<void>;
  update: (
    fn: (data: AppData, user: DemoUser) => AppData,
    message?: string,
    command?: ApiCommand,
  ) => Promise<void>;
  importWorkbook: (
    input: WorkbookImport,
    result: ValidationResult | DocumentValidation,
    sheetName: string,
  ) => Promise<void>;
  notify: (message: string, error?: boolean) => void;
  saving: boolean;
}
const AppContext = createContext<AppContextValue | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [user, setUser] = useState<DemoUser | null>(null);
  const [mode, setMode] = useState<"local" | "demo">("demo");
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const current = useRef<AppData | null>(null);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function apply(value: AppData, account?: DemoUser) {
    current.current = value;
    setData(value);
    if (account) setUser(account);
    else if (user)
      setUser(value.users.find((u) => u.id === user.id && u.active) ?? user);
  }
  function start(
    value: AppData,
    account: DemoUser,
    provider: "local" | "demo",
  ) {
    apply(value, account);
    setFilters(defaultFilters(value));
    setMode(provider);
    sessionStorage.setItem("nettplus:mode", provider);
  }
  useEffect(() => {
    let active = true;
    (async () => {
      const online = await serverAvailable();
      if (!active) return;
      setAvailable(online);
      if (sessionStorage.getItem("nettplus:mode") === "demo") {
        try {
          const value = await loadData();
          const account = value.users.find(
            (u) => u.id === sessionStorage.getItem("nettplus:user") && u.active,
          );
          if (active && account) start(value, account, "demo");
        } catch {
          if (active)
            notify(
              "No se pudo abrir la demostración guardada. Puedes volver a intentarlo.",
              true,
            );
        }
      } else if (online) {
        try {
          const session = await api<Session>("/session");
          if (active) start(session.data, session.user, "local");
        } catch {}
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function notify(text: string, error = false) {
    if (timer.current) clearTimeout(timer.current);
    setToast({ text, error });
    timer.current = setTimeout(() => setToast(null), 6500);
  }
  function selectUser(id: string) {
    if (mode !== "demo" || saving) return;
    const account = data?.users.find((u) => u.id === id && u.active);
    if (account) {
      setUser(account);
      sessionStorage.setItem("nettplus:user", id);
    }
  }
  async function failure(error: unknown) {
    if (error instanceof ApiError && error.status === 409) {
      try {
        apply(await api<AppData>("/data"));
      } catch {}
    }
    if (error instanceof ApiError && error.status === 401) {
      setUser(null);
      setData(null);
      sessionStorage.removeItem("nettplus:mode");
    }
    notify(
      error instanceof Error ? error.message : "No se pudo guardar el cambio.",
      true,
    );
  }
  async function mutate(action: () => Promise<AppData>, message?: string) {
    if (busy.current)
      throw new Error("Espera a que termine la operación actual.");
    busy.current = true;
    setSaving(true);
    try {
      assertAdmin(user?.role ?? "");
      const next = await action();
      apply(next);
      if (message) notify(message);
    } catch (error) {
      await failure(error);
      throw error;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  async function update(
    fn: (d: AppData, u: DemoUser) => AppData,
    message?: string,
    command?: ApiCommand,
  ) {
    await mutate(async () => {
      if (mode === "local") {
        if (!command)
          throw new Error("Esta operación requiere una acción del servidor.");
        return commandApi(command, current.current?.revision);
      }
      const next = fn(current.current!, user!);
      await saveData(next);
      return next;
    }, message);
    if (
      mode === "local" &&
      command?.type === "user" &&
      command.user.id === user?.id &&
      command.password
    ) {
      sessionStorage.removeItem("nettplus:mode");
      setUser(null);
      setData(null);
      current.current = null;
      notify("Contraseña actualizada. Inicia sesión con tu nueva contraseña.");
    }
  }
  async function importWorkbook(
    input: WorkbookImport,
    result: ValidationResult | DocumentValidation,
    sheetName: string,
  ) {
    await mutate(async () => {
      if (mode === "local")
        return uploadWorkbook(input, current.current?.revision);
      const next =
        "kind" in result
          ? commitDocument(
              current.current!,
              user!,
              input.file.name,
              sheetName,
              result,
            )
          : commitImport(
              current.current!,
              user!,
              input.file.name,
              sheetName,
              result,
            );
      await saveData(next);
      return next;
    }, "Importación guardada. La información ya está actualizada.");
  }
  async function logout() {
    if (saving) return;
    try {
      if (mode === "local") await api("/auth/logout", "POST");
      sessionStorage.removeItem("nettplus:mode");
      sessionStorage.removeItem("nettplus:user");
      setUser(null);
      setData(null);
      current.current = null;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        sessionStorage.removeItem("nettplus:mode");
        sessionStorage.removeItem("nettplus:user");
        setUser(null);
        setData(null);
        current.current = null;
        return;
      }
      notify(
        error instanceof Error ? error.message : "No se pudo cerrar la sesión.",
        true,
      );
    }
  }
  const content = loading ? (
    <div className="startup" role="status">
      <span className="spinner" />
      <p>Conectando tu espacio de asistencia…</p>
    </div>
  ) : !user || !data || !filters ? (
    <Login
      available={available}
      onCheck={async () => setAvailable(await serverAvailable())}
      onLogin={async (email, password) => {
        const session = await api<Session>("/auth/login", "POST", {
          email,
          password,
        });
        start(session.data, session.user, "local");
      }}
      onDemo={async (role) => {
        const value = await loadData();
        const account =
          value.users.find(
            (u) =>
              u.id === (role === "admin" ? "admin-demo" : "viewer-demo") &&
              u.active,
          ) ?? value.users.find((u) => u.role === role && u.active);
        if (!account)
          throw new Error(
            "No hay una cuenta de demostración activa para este rol.",
          );
        sessionStorage.setItem("nettplus:user", account.id);
        start(value, account, "demo");
      }}
    />
  ) : (
    <AppContext.Provider
      value={{
        data,
        user,
        filters,
        mode,
        setFilters: (value) =>
          setFilters((prev) =>
            typeof value === "function" ? value(prev!) : value,
          ),
        selectUser,
        logout,
        update,
        importWorkbook,
        notify,
        saving,
      }}
    >
      {children}
    </AppContext.Provider>
  );
  return (
    <>
      {content}
      {toast && (
        <div
          className={`toast ${toast.error ? "toast-error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          <span>{toast.text}</span>
          <button
            aria-label="Cerrar notificación"
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("Falta AppProvider");
  return value;
}
