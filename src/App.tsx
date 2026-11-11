import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ArrowUpRight, Moon, Sun, X, Menu, LogOut } from "lucide-react";
import { Landing } from "./features/Landing";
import { Student } from "./features/Student";
import { Admin } from "./features/Admin";
import type { Course, Profile } from "./domain/school";
import { isStaff, whatsappLink } from "./domain/school";
import {
  accessAreaForPath,
  canEnterArea,
  shouldShowLanding,
  entryPathForRole,
} from "./domain/access";
import { MIN_PASSWORD_LENGTH } from "../supabase/functions/_shared/input.ts";
import {
  accountAction,
  emptyData,
  loadProfile,
  loadSchool,
  signIn,
  signOut,
  supabase,
} from "./infrastructure/school";
import "./App.css";

function App() {
  const area = accessAreaForPath(location.pathname);
  const staffRoute = area !== "student";
  const teacherRoute = area === "teacher";
  const [theme, setTheme] = useState(
    () =>
      localStorage.getItem("paracleto-theme") ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  );
  const [data, setData] = useState(emptyData);
  const [profile, setProfile] = useState<Profile | null>(null);
  const publicPage = shouldShowLanding(profile, area);
  const [login, setLogin] = useState(location.hash === "#entrar");
  const [menu, setMenu] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!!supabase);
  const [ready, setReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("paracleto-theme", theme);
  }, [theme]);
  useEffect(() => {
    document.title = staffRoute
      ? teacherRoute
        ? "Área do professor · Escola Paráclito"
        : "Administração · Escola Paráclito"
      : "Escola Paráclito · Música Litúrgica";
  }, [staffRoute, teacherRoute]);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const refresh = async () => {
      try {
        const next = await loadProfile();
        const content = await loadSchool(
          next && canEnterArea(next, area) ? next : null,
        );
        if (active) {
          setProfile(next);
          setData(content);
          setReady(true);
          setError("");
        }
      } catch (e) {
        if (active) {
          setReady(false);
          setError((e as Error).message);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void refresh();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => {
        if (active) void refresh();
      }, 0);
    });
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, [area]);
  async function refresh() {
    const next = await loadProfile();
    setProfile(next);
    setData(await loadSchool(next && canEnterArea(next, area) ? next : null));
    setReady(true);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      if (profile?.must_change_password) {
        if (form.get("password") !== form.get("confirm"))
          throw new Error("As senhas precisam ser iguais.");
        await accountAction({
          action: "change-password",
          password: form.get("password"),
        });
        // A server-side password change can invalidate the previous Auth session.
        await signIn(profile.email, String(form.get("password")));
        await refresh();
      } else {
        await signIn(String(form.get("email")), String(form.get("password")));
        const signedIn = await loadProfile();
        if (!signedIn || !canEnterArea(signedIn, area)) {
          await signOut();
          throw new Error(
            "Este perfil deve usar sua entrada específica: alunos pelo site, professores por /professor e administradores por /admin.",
          );
        }
        await refresh();
        setLogin(false);
        location.hash = "";
        window.scrollTo(0, 0);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await signOut();
      setProfile(null);
      setData(emptyData);
      setLogin(false);
      setError("");
    } catch {
      setError("Não foi possível sair. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  function openStudentLogin() {
    if (profile && profile.role !== "student") {
      location.assign(entryPathForRole(profile.role));
      return;
    }
    setLogin(true);
    setError("");
  }
  const contact = whatsappLink(data.settings.whatsapp);
  const allowedArea = !profile || canEnterArea(profile, area);
  const showLogin =
    allowedArea &&
    (profile
      ? profile.active && profile.must_change_password
      : staffRoute || login);
  const LoginContainer = staffRoute ? "main" : "div";
  useEffect(() => {
    const overlay = (!staffRoute && showLogin) || !!course;
    if (!overlay) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const nodes = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button, a[href], input, textarea, select, [tabindex="0"]',
        ) || [],
      ).filter((n) => !n.hasAttribute("disabled"));
    nodes()[0]?.focus();
    function keydown(e: KeyboardEvent) {
      if (e.key === "Escape" && !profile?.must_change_password) {
        setLogin(false);
        setCourse(null);
      }
      if (e.key === "Tab") {
        const items = nodes();
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", keydown);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [showLogin, course, profile?.must_change_password, staffRoute]);
  return (
    <>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="site-header">
        <a
          href={staffRoute ? "/" : "#inicio"}
          className="brand"
          onClick={() => {
            if (profile) return;
            setLogin(false);
          }}
          aria-label="Escola Paráclito, início"
        >
          <span className="brand-mark">
            <img src="/images/logo.jpeg" alt="" />
          </span>
          <span className="brand-name">
            Escola Paráclito<small>Música litúrgica</small>
          </span>
        </a>
        {publicPage && (
          <nav
            className={menu ? "public-nav open" : "public-nav"}
            aria-label="Navegação principal"
          >
            <a href="#escola" onClick={() => setMenu(false)}>
              A escola
            </a>
            <a href="#cursos" onClick={() => setMenu(false)}>
              Nossos cursos
            </a>
            <a href="#vivencias" onClick={() => setMenu(false)}>
              Nossa essência
            </a>
            {profile && (
              <a
                className="mobile-admin-link"
                href={entryPathForRole(profile.role)}
              >
                {profile.role === "teacher"
                  ? "Área do professor"
                  : "Administração"}
              </a>
            )}
            <a href="#contato" onClick={() => setMenu(false)}>
              Contato
            </a>
          </nav>
        )}
        <div className="header-actions">
          {publicPage && profile && (
            <a
              className="button primary header-login"
              href={entryPathForRole(profile.role)}
            >
              {profile.role === "teacher"
                ? "Área do professor"
                : "Administração"}
            </a>
          )}
          <button
            className="icon-button theme-toggle"
            title={theme === "light" ? "Usar tema escuro" : "Usar tema claro"}
            aria-label={
              theme === "light" ? "Usar tema escuro" : "Usar tema claro"
            }
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
          </button>
          {profile ? (
            <button
              className="button secondary"
              onClick={() => {
                void logout();
              }}
              disabled={busy}
            >
              <LogOut size={16} /> Sair
            </button>
          ) : staffRoute ? (
            <span className="admin-entry-label">
              {teacherRoute ? "Área do professor" : "Acesso administrativo"}
            </span>
          ) : (
            <button
              className="button primary header-login"
              onClick={() => {
                setLogin(true);
                setError("");
              }}
            >
              Área do aluno <ArrowUpRight size={16} />
            </button>
          )}
          {publicPage && (
            <button
              className="icon-button mobile-menu"
              aria-label={menu ? "Fechar menu" : "Abrir menu"}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          )}
        </div>
      </header>
      {error && !showLogin && (
        <div className="page-notice notice error" role="alert">
          {error}
          <button
            className="text-button"
            onClick={() => {
              void refresh().catch((e) => setError(e.message));
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}
      <div id={staffRoute && showLogin ? undefined : "conteudo"}>
        {loading ? (
          <main className="loading" role="status">
            Preparando seu espaço…
          </main>
        ) : publicPage ? (
          <main>
            <Landing
              data={data}
              onLogin={openStudentLogin}
              onCourse={setCourse}
            />
          </main>
        ) : staffRoute && showLogin ? null : profile ? (
          !ready ? (
            <main className="section empty">
              Não foi possível verificar seu acesso. Tente carregar novamente.
            </main>
          ) : !allowedArea ? (
            <main className="section empty">
              <h1>Entrada incompatível com seu perfil.</h1>
              <p>Continue pela entrada correspondente à sua conta.</p>
              <a
                className="button primary"
                href={entryPathForRole(profile.role)}
              >
                Ir para meu acesso
              </a>
            </main>
          ) : !profile.active ? (
            <main className="section empty">
              <h1>Seu acesso está suspenso.</h1>
              <p>
                Entre em contato com a escola para regularizar seu cadastro.
              </p>
            </main>
          ) : profile.must_change_password ? (
            <main className="section empty">
              Defina sua nova senha para começar.
            </main>
          ) : staffRoute && isStaff(profile) ? (
            <Admin profile={profile} data={data} refresh={refresh} />
          ) : (
            <Student profile={profile} data={data} refresh={refresh} />
          )
        ) : null}
      </div>
      {!(staffRoute && showLogin) && (
        <footer className="site-footer">
          <a className="footer-name" href={staffRoute ? "/" : "#inicio"}>
            Escola Paráclito<span>Música litúrgica</span>
          </a>
          <p>
            Formar para a música.
            <br />
            Inspirar para o serviço.
          </p>
          <div>
            <span>Diocese de Barretos</span>
            <small>© {new Date().getFullYear()} Escola Paráclito</small>
          </div>
        </footer>
      )}
      {showLogin && (
        <LoginContainer
          className={staffRoute ? "admin-entry" : "modal-backdrop"}
          id={staffRoute ? "conteudo" : undefined}
        >
          <section
            className="modal login-modal"
            role={staffRoute ? undefined : "dialog"}
            aria-modal={staffRoute ? undefined : true}
            aria-labelledby="login-title"
          >
            <div className="modal-top">
              <span className="section-kicker">
                {staffRoute
                  ? teacherRoute
                    ? "Professores · Escola Paráclito"
                    : "Administração · Escola Paráclito"
                  : "Escola Paráclito"}
              </span>
              {!staffRoute && !profile?.must_change_password && (
                <button
                  className="icon-button"
                  aria-label="Fechar login"
                  onClick={() => setLogin(false)}
                >
                  <X size={20} />
                </button>
              )}
            </div>
            <h2 id="login-title">
              {profile?.must_change_password
                ? "Um novo começo."
                : staffRoute
                  ? teacherRoute
                    ? "Seu espaço para ensinar."
                    : "Acesso administrativo."
                  : "Bom ter você aqui."}
            </h2>
            <p>
              {profile?.must_change_password
                ? "Defina uma senha pessoal para continuar sua formação."
                : staffRoute
                  ? teacherRoute
                    ? "Entre para cadastrar aulas e partituras dos seus cursos."
                    : "Entre com sua conta de Administrador ou Super Admin."
                  : "Entre para continuar sua formação musical."}
            </p>
            <form onSubmit={submit}>
              {!profile?.must_change_password && (
                <label>
                  E-mail
                  <input
                    name="email"
                    autoComplete="username"
                    type="email"
                    placeholder="seu@email.com"
                    required
                  />
                </label>
              )}
              <label>
                {profile?.must_change_password ? "Nova senha" : "Senha"}
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  minLength={
                    profile?.must_change_password ? MIN_PASSWORD_LENGTH : 1
                  }
                  autoComplete={
                    profile?.must_change_password
                      ? "new-password"
                      : "current-password"
                  }
                  required
                />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                />{" "}
                Mostrar senha
              </label>
              {profile?.must_change_password && (
                <>
                  <small>
                    Use pelo menos {MIN_PASSWORD_LENGTH} caracteres.
                  </small>
                  <label>
                    Confirme a nova senha
                    <input
                      name="confirm"
                      type="password"
                      autoComplete="new-password"
                      minLength={MIN_PASSWORD_LENGTH}
                      required
                    />
                  </label>
                </>
              )}
              {error && (
                <p className="notice error" role="alert">
                  {error}
                </p>
              )}
              {!supabase && (
                <p className="notice">
                  A plataforma está em preparação. O acesso será liberado pela
                  escola após a configuração.
                </p>
              )}
              <button className="button primary" disabled={busy || !supabase}>
                {busy
                  ? "Aguarde…"
                  : profile?.must_change_password
                    ? "Salvar nova senha"
                    : staffRoute
                      ? teacherRoute
                        ? "Entrar na área do professor"
                        : "Entrar na administração"
                      : "Entrar na plataforma"}
                <ArrowUpRight size={17} />
              </button>
            </form>
            <p className="login-help">
              {profile?.must_change_password ? (
                <button
                  className="text-button"
                  onClick={() => {
                    void logout();
                  }}
                >
                  Sair e continuar depois
                </button>
              ) : (
                <>
                  {staffRoute
                    ? "Precisa recuperar o acesso? Procure a administração da escola."
                    : "Primeiro acesso ou esqueceu a senha?"}
                  <br />
                  {!staffRoute &&
                    (contact ? (
                      <a href={contact} target="_blank" rel="noreferrer">
                        Fale com a administração da escola.
                      </a>
                    ) : (
                      "Solicite seu acesso à administração da escola."
                    ))}
                </>
              )}
            </p>
            {staffRoute && (
              <a className="text-button" href="/">
                Voltar ao site da escola
              </a>
            )}
          </section>
        </LoginContainer>
      )}
      {course && (
        <div className="modal-backdrop">
          <section
            className="modal course-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-title"
          >
            <div className="modal-top">
              <span className="section-kicker">Nossa formação</span>
              <button
                className="icon-button"
                aria-label="Fechar curso"
                onClick={() => setCourse(null)}
              >
                <X size={20} />
              </button>
            </div>
            <h2 id="course-title">{course.title}</h2>
            <p>{course.description}</p>
            <div className="course-detail">
              <BookNote />{" "}
              <p>
                Formação para desenvolver sua musicalidade e colocar o
                aprendizado a serviço da comunidade.
              </p>
            </div>
            <p>
              As matrículas e a liberação dos cursos são feitas pela
              administração da escola.
            </p>
            <div className="form-actions">
              {contact && (
                <a
                  className="button primary"
                  href={contact}
                  target="_blank"
                  rel="noreferrer"
                >
                  Consultar matrícula <ArrowUpRight size={17} />
                </a>
              )}
              <button
                className="button secondary"
                onClick={() => {
                  setCourse(null);
                  openStudentLogin();
                }}
              >
                Já sou aluno
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
function BookNote() {
  return (
    <span className="book-note" aria-hidden="true">
      𝄞
    </span>
  );
}
export default App;
