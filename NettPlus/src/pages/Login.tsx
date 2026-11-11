import { useState } from "react";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  FileSpreadsheet,
  LockKeyhole,
  ShieldCheck,
  Signal,
  UsersRound,
} from "lucide-react";
import type { Role } from "../domain/types";

export default function Login({
  available,
  onLogin,
  onDemo,
  onCheck,
}: {
  available: boolean;
  onLogin: (email: string, password: string) => Promise<void>;
  onDemo: (role: Role) => Promise<void>;
  onCheck: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar sesión.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <section className="login-story">
        <a href="/" className="login-logo">
          <img src="/nettplus-logo.png" alt="Nettplus · The Power of Fiber" />
        </a>
        <div className="login-story-content">
          <span className="eyebrow">
            <i />
            GESTIÓN DE ASISTENCIA
          </span>
          <h1>
            Tu equipo.
            <br />
            Cada día.
            <br />
            <span>Todo conectado.</span>
          </h1>
          <p>
            De las marcaciones a una visión clara.
            <br />
            Menos archivos dispersos, más tiempo para tu gente.
          </p>
          <div className="login-illustration" aria-hidden="true">
            <div className="illustration-top">
              <span>
                <i />
                ASISTENCIA EN ORDEN
              </span>
              <span>NETTPLUS</span>
            </div>
            <div className="illustration-bars">
              {[42, 67, 55, 82, 69, 93, 76, 87, 64, 95, 83, 100].map(
                (height, i) => (
                  <i key={i} style={{ height: `${height}%` }} />
                ),
              )}
            </div>
            <div className="illustration-check">
              <span>
                <Check size={16} />
              </span>
              <div>
                <strong>Información lista para revisar</strong>
                <small>Importa. Valida. Consulta.</small>
              </div>
              <ShieldCheck size={22} />
            </div>
          </div>
          <div className="login-features">
            <span>
              <FileSpreadsheet size={15} />
              Importación inteligente
            </span>
            <span>
              <UsersRound size={15} />
              Tu equipo, en contexto
            </span>
          </div>
        </div>
        <footer>
          THE POWER OF FIBER<span>Asistencia que conecta.</span>
        </footer>
        <div className="brand-orbit orbit-one" />
        <div className="brand-orbit orbit-two" />
      </section>
      <section className="login-panel">
        <div className="login-form-wrap">
          <span className={`connection-pill ${available ? "connected" : ""}`}>
            <Signal size={13} />
            {available
              ? "Servidor local disponible"
              : "Demostración en navegador"}
          </span>
          <div className="login-title">
            <span className="login-lock">
              <LockKeyhole size={23} />
            </span>
            <h2>Bienvenido a Nettplus</h2>
            <p>Tu espacio para gestionar la asistencia.</p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => onLogin(email, password));
            }}
          >
            <label>
              Correo electrónico
              <input
                autoComplete="username"
                type="email"
                required
                maxLength={120}
                placeholder="tu.correo@nettplus.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy || !available}
              />
            </label>
            <label>
              Contraseña
              <div className="password-field">
                <input
                  autoComplete="current-password"
                  type={show ? "text" : "password"}
                  required
                  maxLength={128}
                  placeholder="Ingresa tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy || !available}
                />
                <button
                  type="button"
                  aria-label={
                    show ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  onClick={() => setShow((s) => !s)}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="btn primary login-submit"
              disabled={busy || !available}
            >
              {busy ? (
                <span className="spinner" />
              ) : (
                <>
                  Iniciar sesión
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
          {available ? (
            <details className="trial-credentials">
              <summary>Accesos iniciales de prueba</summary>
              <p>Para probar el servidor local con su base inicial:</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEmail("admin@nettplus.local");
                  setPassword("NettplusDemo2026!");
                }}
              >
                Usar administrador <ArrowRight size={13} />
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEmail("viewer@nettplus.local");
                  setPassword("ConsultaDemo2026!");
                }}
              >
                Usar consulta <ArrowRight size={13} />
              </button>
              <small>
                Si el administrador cambió estas cuentas, utiliza tus
                credenciales asignadas.
              </small>
            </details>
          ) : (
            <div className="offline-note">
              <p>
                Explora la demostración o conecta el servidor local para acceder
                con una cuenta.
              </p>
              <button
                className="text-link"
                disabled={busy}
                onClick={() => run(onCheck)}
              >
                Comprobar conexión
              </button>
            </div>
          )}
          <div className="login-divider">
            <span>¿Quieres explorar primero?</span>
          </div>
          <div className="demo-entry">
            <button disabled={busy} onClick={() => run(() => onDemo("admin"))}>
              <ShieldCheck size={18} />
              <span>
                <strong>Demo administrador</strong>
                <small>Importa y configura</small>
              </span>
              <ArrowRight size={15} />
            </button>
            <button disabled={busy} onClick={() => run(() => onDemo("viewer"))}>
              <UsersRound size={18} />
              <span>
                <strong>Demo consulta</strong>
                <small>Explora y descarga</small>
              </span>
              <ArrowRight size={15} />
            </button>
          </div>
          <p className="login-footnote">
            <LockKeyhole size={12} />
            La demo se guarda solo en este navegador.
            <br />
            El acceso local utiliza tu sesión del servidor.
          </p>
        </div>
        <footer>
          Nettplus · Control de asistencia
          <span>Información que acompaña a tu equipo.</span>
        </footer>
      </section>
    </div>
  );
}
