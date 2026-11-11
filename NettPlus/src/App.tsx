import { lazy, Suspense, useState, type ReactNode } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import {
  BookOpenCheck,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  Database,
  FileBarChart2,
  FileUp,
  Menu,
  Settings2,
  Shield,
  Users,
  X,
  LogOut,
  ClipboardCheck,
} from "lucide-react";
import { useApp } from "./context/AppContext";
import { initials } from "./domain/attendance";
import { Badge } from "./components/ui";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Employees = lazy(() => import("./pages/Employees"));
const Imports = lazy(() => import("./pages/Imports"));
const Reports = lazy(() => import("./pages/Reports"));
const SourceDocuments = lazy(() => import("./pages/SourceDocuments"));
const Settings = lazy(() =>
  import("./pages/Admin").then((m) => ({ default: m.Settings })),
);
const UsersPage = lazy(() =>
  import("./pages/Admin").then((m) => ({ default: m.Users })),
);
const Audit = lazy(() =>
  import("./pages/Admin").then((m) => ({ default: m.Audit })),
);
const nav = [
  { path: "/", name: "Resumen", icon: ChartNoAxesCombined },
  { path: "/colaboradores", name: "Colaboradores", icon: Users },
  { path: "/importaciones", name: "Importaciones", icon: FileUp, admin: true },
  { path: "/reportes", name: "Reportes", icon: FileBarChart2 },
  { path: "/novedades", name: "Novedades y horas", icon: ClipboardCheck },
];
const adminNav = [
  { path: "/usuarios", name: "Usuarios y permisos", icon: Shield },
  { path: "/auditoria", name: "Auditoría", icon: BookOpenCheck },
  { path: "/configuracion", name: "Configuración", icon: Settings2 },
];
function AdminOnly({ children }: { children: ReactNode }) {
  return useApp().user.role === "admin" ? (
    children
  ) : (
    <Navigate to="/" replace />
  );
}

export default function App() {
  const { user, data, selectUser, saving, mode, logout } = useApp();
  const [mobileMenu, setMobileMenu] = useState(false);
  const path = useLocation().pathname;
  const title =
    [...nav, ...adminNav].find((n) => n.path === path)?.name ??
    "Página no encontrada";
  return (
    <div className="app-shell">
      {mobileMenu && (
        <button
          className="sidebar-backdrop"
          onClick={() => setMobileMenu(false)}
          aria-label="Cerrar menú"
        />
      )}
      <aside className={`sidebar ${mobileMenu ? "is-open" : ""}`}>
        <Link to="/" className="brand" onClick={() => setMobileMenu(false)}>
          <img
            className="brand-logo"
            src="/nettplus-logo.png"
            alt="Nettplus · The Power of Fiber"
          />
        </Link>
        <button
          className="mobile-close icon-btn"
          onClick={() => setMobileMenu(false)}
          aria-label="Cerrar menú"
        >
          <X size={20} />
        </button>
        <div className="sidebar-navigation">
          <div className="nav-label">MENÚ PRINCIPAL</div>
          <nav aria-label="Menú principal">
            {nav
              .filter((n) => !n.admin || user.role === "admin")
              .map((n) => (
                <NavLink
                  end={n.path === "/"}
                  to={n.path}
                  key={n.path}
                  onClick={() => setMobileMenu(false)}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? "active" : ""}`
                  }
                >
                  <n.icon size={18} strokeWidth={1.7} />
                  <span>{n.name}</span>
                </NavLink>
              ))}
          </nav>
          {user.role === "admin" && (
            <>
              <div className="nav-label admin-label">ADMINISTRACIÓN</div>
              <nav aria-label="Administración">
                {adminNav.map((n) => (
                  <NavLink
                    to={n.path}
                    key={n.path}
                    className={({ isActive }) =>
                      `nav-item ${isActive ? "active" : ""}`
                    }
                    onClick={() => setMobileMenu(false)}
                  >
                    <n.icon size={17} strokeWidth={1.7} />
                    <span>{n.name}</span>
                  </NavLink>
                ))}
              </nav>
            </>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="demo-local">
            <Database size={14} />
            <span>
              {mode === "local"
                ? "Servidor local conectado"
                : "Espacio de demostración"}
            </span>
            <i />
          </div>
          <div className="sidebar-user">
            <span className="avatar sidebar-avatar">{initials(user.name)}</span>
            <div>
              <strong>{user.name}</strong>
              <small>
                {user.role === "admin"
                  ? "Administrador"
                  : "Viewer · Solo lectura"}
              </small>
            </div>
          </div>
          {mode === "demo" && (
            <label className="session-label">
              Probar sesión demo
              <select
                aria-label="Probar sesión demo"
                value={user.id}
                onChange={(e) => selectUser(e.target.value)}
                disabled={saving}
              >
                {data.users
                  .filter((u) => u.active)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} · {u.role === "admin" ? "Admin" : "Viewer"}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <button
            className="logout-button"
            disabled={saving}
            onClick={() => void logout()}
          >
            <LogOut size={15} />
            Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-btn mobile-menu"
              onClick={() => setMobileMenu(true)}
              aria-label="Abrir menú"
            >
              <Menu size={21} />
            </button>
            <Link to="/">Nettplus</Link>
            <ChevronRight size={14} />
            <span>{title}</span>
          </div>
          <div className="topbar-right">
            <span className="save-status">
              <Check size={13} />
              {saving
                ? "Guardando…"
                : mode === "local"
                  ? "Guardado en el servidor local"
                  : "Guardado en este navegador"}
            </span>
            <Badge tone={mode === "local" ? "green" : "blue"}>
              {mode === "local" ? "LOCAL" : "DEMO"}
            </Badge>
            <span className="avatar header-avatar" title={user.name}>
              {initials(user.name)}
            </span>
          </div>
        </header>
        <main id="main-content">
          <Suspense
            fallback={
              <div className="loading-card" role="status">
                <span className="spinner" />
                Cargando módulo…
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/colaboradores" element={<Employees />} />
              <Route path="/reportes" element={<Reports />} />
              <Route path="/novedades" element={<SourceDocuments />} />
              <Route
                path="/importaciones"
                element={
                  <AdminOnly>
                    <Imports />
                  </AdminOnly>
                }
              />
              <Route
                path="/usuarios"
                element={
                  <AdminOnly>
                    <UsersPage />
                  </AdminOnly>
                }
              />
              <Route
                path="/auditoria"
                element={
                  <AdminOnly>
                    <Audit />
                  </AdminOnly>
                }
              />
              <Route
                path="/configuracion"
                element={
                  <AdminOnly>
                    <Settings />
                  </AdminOnly>
                }
              />
              <Route
                path="*"
                element={
                  <div className="startup">
                    <h1>Página no encontrada</h1>
                    <p>Esta ruta no pertenece al espacio de Nettplus.</p>
                    <Link className="btn primary" to="/">
                      Volver al resumen
                    </Link>
                  </div>
                }
              />
            </Routes>
          </Suspense>
        </main>
        <footer className="app-footer">
          <span>Nettplus · Control de asistencia</span>
          <span>Apoyo a la preparación de nómina</span>
        </footer>
      </div>
    </div>
  );
}
