import { useState } from "react";
import type { FormEvent } from "react";
import {
  Plus,
  Users,
  BookOpen,
  FileMusic,
  Settings,
  Shield,
  Search,
  GraduationCap,
} from "lucide-react";
import type { Course, Lesson, Profile, SchoolData } from "../domain/school";
import { normalizeWhatsapp, whatsappLink, youtubeId } from "../domain/school";
import { WhatsappInput } from "./WhatsappInput";
import { HeroSettings } from "./HeroSettings";
import {
  accountAction,
  enroll,
  saveRecord,
  updateStudent,
  upload,
  assignTeacher,
} from "../infrastructure/school";
import { useDialog } from "./useDialog";
import { entryPathForRole } from "../domain/access";

export function Admin({
  profile,
  data,
  refresh,
}: {
  profile: Profile;
  data: SchoolData;
  refresh: () => Promise<void>;
}) {
  const [tab, setTab] = useState(
    profile.role === "super_admin"
      ? "admins"
      : profile.role === "teacher"
        ? "courses"
        : "students",
  );
  const [query, setQuery] = useState("");
  const [siteTab, setSiteTab] = useState("about");
  const [modal, setModal] = useState<
    "account" | "course" | "lesson" | "score" | "image" | null
  >(null);
  const [editing, setEditing] = useState<Course | Lesson | null>(null);
  const teacher = profile.role === "teacher";
  const managedCourses = teacher
    ? data.courses.filter((c) =>
        data.teachingAssignments.some(
          (a) =>
            a.teacher_id === profile.id && a.course_id === c.id && a.active,
        ),
      )
    : data.courses;
  const [courseSelection, setSelectedCourse] = useState(
    managedCourses[0]?.id || "",
  );
  const selectedCourse =
    managedCourses.find((c) => c.id === courseSelection)?.id ||
    managedCourses[0]?.id ||
    "";
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [video, setVideo] = useState("");
  const [credentials, setCredentials] = useState<{
    password: string;
    email: string;
    phone: string;
    path: string;
  } | null>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const superAdmin = profile.role === "super_admin";
  useDialog(!!modal || !!credentials, () => {
    if (!credentials && !busy) setModal(null);
  });
  const tabs = superAdmin
    ? [{ id: "admins", label: "Administradores", icon: Shield }]
    : teacher
      ? [
          { id: "courses", label: "Meus cursos e aulas", icon: BookOpen },
          { id: "scores", label: "Partituras dos cursos", icon: FileMusic },
        ]
      : [
          { id: "students", label: "Alunos", icon: Users },
          { id: "teachers", label: "Professores", icon: GraduationCap },
          { id: "courses", label: "Cursos e aulas", icon: BookOpen },
          { id: "scores", label: "Partituras", icon: FileMusic },
          { id: "settings", label: "Configurar site", icon: Settings },
        ];
  async function run(
    action: () => Promise<unknown>,
    success = "Alterações salvas.",
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      await refresh();
      setMessage(success);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function open(type: typeof modal, item: Course | Lesson | null = null) {
    setRequestId(crypto.randomUUID());
    setEditing(item);
    setVideo(
      item && "video_id" in item ? `https://youtu.be/${item.video_id}` : "",
    );
    setModal(type);
    setError("");
    setMessage("");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) || "").trim();
    const published = form.get("published") === "on";
    const success = await run(
      async () => {
        if (modal === "account") {
          const email = text("email"),
            phone = normalizeWhatsapp(text("whatsapp")) || "";
          if (!whatsappLink(phone))
            throw new Error("Informe o WhatsApp com código do país e DDD.");
          const result = await accountAction({
            action: "create",
            request_id: requestId,
            name: text("name"),
            email,
            whatsapp: `+${phone}`,
            role: superAdmin
              ? "admin"
              : tab === "teachers"
                ? "teacher"
                : "student",
            choir: form.get("choir") === "on",
            courses: form.getAll("courses"),
          });
          if (result.temporary_password)
            setCredentials({
              password: result.temporary_password,
              email,
              phone,
              path: entryPathForRole(
                superAdmin
                  ? "admin"
                  : tab === "teachers"
                    ? "teacher"
                    : "student",
              ),
            });
        }
        if (modal === "course")
          await saveRecord("courses", {
            id: editing?.id || crypto.randomUUID(),
            title: text("title"),
            description: text("description"),
            published,
          });
        if (modal === "lesson") {
          if (!selectedCourse)
            throw new Error(
              "Selecione um curso liberado para cadastrar a aula.",
            );
          const id = youtubeId(text("video"));
          if (!id)
            throw new Error("Informe um link válido de vídeo do YouTube.");
          await saveRecord("lessons", {
            id: editing?.id || crypto.randomUUID(),
            course_id: selectedCourse,
            title: text("title"),
            description: text("description"),
            position: Number(text("position")),
            video_id: id,
            published,
          });
        }
        if (modal === "score" || modal === "image") {
          const file = form.get("file") as File;
          if (!file?.size) throw new Error("Escolha um arquivo.");
          const courseId = modal === "score" ? text("course_id") : null;
          if (
            modal === "score" &&
            !managedCourses.some((c) => c.id === courseId)
          )
            throw new Error(
              "Selecione um curso liberado para cadastrar a partitura.",
            );
          const path = await upload(
            modal === "score" ? "scores" : "institutional",
            file,
            courseId,
          );
          if (modal === "score")
            await saveRecord("scores", {
              id: crypto.randomUUID(),
              title: text("title"),
              path,
              published,
              course_id: courseId,
            });
          else
            await saveRecord("institutional_images", {
              id: crypto.randomUUID(),
              alt: text("title"),
              path,
              position: Number(text("position")),
              published,
            });
        }
      },
      modal === "account"
        ? "Conta criada. Copie a senha temporária antes de fechar."
        : "Conteúdo salvo.",
    );
    if (success) setModal(null);
  }
  const people = data.profiles.filter(
    (p) =>
      p.role ===
        (superAdmin ? "admin" : tab === "teachers" ? "teacher" : "student") &&
      `${p.name} ${p.email}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <main className="admin-layout">
      <aside className="admin-nav">
        <span className="section-kicker">
          {superAdmin
            ? "Super Admin"
            : teacher
              ? "Área do professor"
              : "Administração"}
        </span>
        <h2>{teacher ? "Ensinar e inspirar." : "Cuidar da escola."}</h2>
        {tabs.map((t) => (
          <button
            className={tab === t.id ? "active" : ""}
            key={t.id}
            onClick={() => {
              setTab(t.id);
              setMessage("");
              setError("");
            }}
          >
            <t.icon size={19} />
            {t.label}
          </button>
        ))}
      </aside>
      <section className="admin-content">
        <div className="workspace-heading">
          <span className="section-kicker">Escola Paráclito</span>
          <h1>{tabs.find((t) => t.id === tab)?.label}</h1>
          <p>
            {tab === "students"
              ? "Acompanhe quem faz parte desta caminhada."
              : teacher
                ? "Cadastre aulas e partituras dos cursos atribuídos a você."
                : "Organize o conteúdo e os acessos da escola."}
          </p>
        </div>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
        {(tab === "students" || tab === "admins" || tab === "teachers") && (
          <>
            <div className="toolbar">
              <label className="search">
                <Search size={18} />
                <input
                  placeholder="Buscar por nome ou e-mail"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <button
                className="button primary"
                onClick={() => open("account")}
              >
                <Plus size={17} />
                {superAdmin
                  ? "Novo administrador"
                  : tab === "teachers"
                    ? "Novo professor"
                    : "Novo aluno"}
              </button>
            </div>
            <div className="people-list">
              {people.map((p) => (
                <article className="person" key={p.id}>
                  <div className="person-top">
                    <div className="avatar">{p.name.slice(0, 1)}</div>
                    <div>
                      <h3>{p.name}</h3>
                      <small>{p.email}</small>
                    </div>
                    <span className={`status ${p.active ? "" : "inactive"}`}>
                      {p.active ? "Ativo" : "Suspenso"}
                    </span>
                  </div>
                  <div className="person-controls">
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        disabled={busy}
                        checked={p.active}
                        onChange={(e) => {
                          void run(() =>
                            updateStudent(p.id, { active: e.target.checked }),
                          );
                        }}
                      />{" "}
                      Conta ativa
                    </label>
                    {p.role === "student" && (
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          disabled={busy}
                          checked={p.choir}
                          onChange={(e) => {
                            void run(() =>
                              updateStudent(p.id, { choir: e.target.checked }),
                            );
                          }}
                        />{" "}
                        Participa do coral
                      </label>
                    )}
                  </div>
                  {!superAdmin && (
                    <div className="enrollment-options">
                      {managedCourses.map((c) => (
                        <label className="checkbox" key={c.id}>
                          <input
                            type="checkbox"
                            disabled={busy}
                            checked={(p.role === "teacher"
                              ? data.teachingAssignments
                              : data.enrollments
                            ).some(
                              (e) =>
                                ("teacher_id" in e
                                  ? e.teacher_id
                                  : e.student_id) === p.id &&
                                e.course_id === c.id &&
                                e.active,
                            )}
                            onChange={(e) => {
                              void run(() =>
                                p.role === "teacher"
                                  ? assignTeacher(p.id, c.id, e.target.checked)
                                  : enroll(p.id, c.id, e.target.checked),
                              );
                            }}
                          />
                          {c.title}
                        </label>
                      ))}
                    </div>
                  )}
                  <details className="edit-person">
                    <summary>Editar cadastro</summary>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = new FormData(e.currentTarget);
                        const phone =
                          normalizeWhatsapp(String(form.get("whatsapp"))) || "";
                        if (!whatsappLink(phone)) {
                          setError(
                            "Informe o WhatsApp com código do país e DDD.",
                          );
                          return;
                        }
                        void run(() =>
                          accountAction({
                            action: "update",
                            id: p.id,
                            name: String(form.get("name")).trim(),
                            whatsapp: `+${phone}`,
                          }),
                        );
                      }}
                    >
                      <label>
                        Nome completo
                        <input name="name" required defaultValue={p.name} />
                      </label>
                      <label>
                        WhatsApp
                        <WhatsappInput required defaultValue={p.whatsapp} />
                      </label>
                      <button className="button secondary" disabled={busy}>
                        Salvar cadastro
                      </button>
                    </form>
                  </details>
                  <button
                    disabled={busy}
                    className="text-button"
                    onClick={() => {
                      void run(async () => {
                        const result = await accountAction({
                          action: "reset",
                          id: p.id,
                        });
                        if (result.temporary_password)
                          setCredentials({
                            password: result.temporary_password,
                            email: p.email,
                            phone: p.whatsapp,
                            path: entryPathForRole(p.role),
                          });
                      }, "Nova senha temporária gerada.");
                    }}
                  >
                    Gerar novo acesso
                  </button>
                </article>
              ))}
              {!people.length && (
                <div className="empty">
                  Nenhum cadastro encontrado. Use o botão acima para começar.
                </div>
              )}
            </div>
          </>
        )}
        {tab === "courses" && (
          <>
            <div className="toolbar">
              <label>
                Curso
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                >
                  {managedCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                      {!c.published && " (rascunho)"}
                    </option>
                  ))}
                </select>
              </label>
              {!teacher && (
                <button
                  className="button secondary"
                  onClick={() => open("course")}
                >
                  Criar curso
                </button>
              )}
              <button
                className="button primary"
                onClick={() => open("lesson")}
                disabled={!selectedCourse}
              >
                <Plus size={17} /> Nova aula
              </button>
            </div>
            {managedCourses
              .filter((c) => c.id === selectedCourse)
              .map((c) => (
                <div className="course-admin" key={c.id}>
                  <h2>{c.title}</h2>
                  <p>{c.description}</p>
                  {!teacher && (
                    <button
                      className="text-button"
                      onClick={() => open("course", c)}
                    >
                      Editar curso
                    </button>
                  )}
                </div>
              ))}
            <div className="score-list">
              {data.lessons
                .filter((l) => l.course_id === selectedCourse)
                .map((l) => (
                  <div className="score-row" key={l.id}>
                    <span>{l.position}</span>
                    <div>
                      <h3>{l.title}</h3>
                      <small>{l.published ? "Publicada" : "Rascunho"}</small>
                    </div>
                    <button
                      className="button secondary"
                      onClick={() => open("lesson", l)}
                    >
                      Editar aula
                    </button>
                  </div>
                ))}
            </div>
            {!managedCourses.length && (
              <div className="empty">
                Nenhum curso atribuído. Solicite à administração a liberação dos
                cursos que você leciona.
              </div>
            )}
          </>
        )}
        {tab === "scores" && (
          <>
            <div className="toolbar">
              <p>
                Partituras organizadas por curso. A leitura dos alunos continua
                restrita ao coral.
              </p>
              <button
                className="button primary"
                onClick={() => open("score")}
                disabled={!managedCourses.length}
              >
                <Plus size={17} /> Nova partitura
              </button>
            </div>
            {data.scores.map((s) => (
              <div className="score-row" key={s.id}>
                <FileMusic />
                <div>
                  <h3>{s.title}</h3>
                  <small>
                    {data.courses.find((c) => c.id === s.course_id)?.title ||
                      "Acervo geral"}{" "}
                    · {s.published ? "Publicada" : "Rascunho"}
                  </small>
                </div>
                <label className="button secondary">
                  Substituir PDF
                  <input
                    type="file"
                    hidden
                    accept="application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file)
                        void run(async () => {
                          const path = await upload(
                            "scores",
                            file,
                            s.course_id,
                          );
                          await saveRecord("scores", { ...s, path });
                        });
                    }}
                  />
                </label>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => {
                    void run(() =>
                      saveRecord("scores", { ...s, published: !s.published }),
                    );
                  }}
                >
                  {s.published ? "Retirar publicação" : "Publicar"}
                </button>
              </div>
            ))}
            {!data.scores.length && (
              <div className="empty">Nenhuma partitura cadastrada.</div>
            )}
          </>
        )}
        {tab === "settings" && (
          <>
            <p>Gerencie as informações exibidas no site público da escola.</p>
            <nav className="tabs" aria-label="Configurações do site">
              {[
                { id: "about", label: "Quem somos" },
                { id: "hero", label: "Imagem inicial" },
                { id: "contact", label: "Contato" },
                { id: "gallery", label: "Galeria" },
              ].map((item) => (
                <button
                  key={item.id}
                  className={siteTab === item.id ? "active" : ""}
                  aria-current={siteTab === item.id ? "page" : undefined}
                  onClick={() => {
                    setSiteTab(item.id);
                    setError("");
                    setMessage("");
                  }}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </>
        )}
        {tab === "settings" && siteTab === "gallery" && (
          <>
            <div className="toolbar">
              <p>Imagens e descrições da página pública.</p>
              <button className="button primary" onClick={() => open("image")}>
                <Plus size={17} /> Adicionar imagem
              </button>
            </div>
            {data.images.map((i) => (
              <div className="score-row" key={i.id}>
                <div>
                  <h3>{i.alt}</h3>
                  <small>{i.published ? "Publicada" : "Oculta"}</small>
                </div>
                <label>
                  Ordem
                  <input
                    type="number"
                    min="0"
                    defaultValue={i.position}
                    onBlur={(e) => {
                      if (+e.target.value !== i.position)
                        void run(() =>
                          saveRecord("institutional_images", {
                            ...i,
                            position: +e.target.value,
                          }),
                        );
                    }}
                  />
                </label>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => {
                    void run(() =>
                      saveRecord("institutional_images", {
                        ...i,
                        published: !i.published,
                      }),
                    );
                  }}
                >
                  {i.published ? "Retirar da galeria" : "Publicar"}
                </button>
              </div>
            ))}
            {!data.images.length && (
              <div className="empty">A galeria ainda não tem imagens.</div>
            )}
          </>
        )}
        {tab === "settings" && siteTab === "hero" && (
          <HeroSettings
            key={data.settings.hero_image_path || "default"}
            settings={data.settings}
            busy={busy}
            onSave={run}
          />
        )}
        {tab === "settings" &&
          (siteTab === "about" || siteTab === "contact") && (
            <form
              className="settings-form"
              key={siteTab}
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                const whatsapp = form.has("whatsapp")
                  ? normalizeWhatsapp(String(form.get("whatsapp")))
                  : data.settings.whatsapp;
                if (whatsapp === null) {
                  setError("Informe o WhatsApp em formato internacional.");
                  return;
                }
                void run(() =>
                  saveRecord("site_settings", {
                    id: 1,
                    about: form.has("about")
                      ? String(form.get("about"))
                      : data.settings.about,
                    whatsapp,
                  }),
                );
              }}
            >
              {siteTab === "about" && (
                <label>
                  Quem somos
                  <textarea
                    name="about"
                    rows={7}
                    required
                    defaultValue={data.settings.about}
                  />
                </label>
              )}
              {siteTab === "contact" && (
                <>
                  <h2>Contato da escola</h2>
                  <p>
                    Este número será usado no botão de WhatsApp da landing page
                    e nos links de contato da plataforma.
                  </p>
                  <label>
                    WhatsApp da escola
                    <WhatsappInput defaultValue={data.settings.whatsapp} />
                    <small>
                      Deixe vazio ou apenas +55 para ocultar o botão de contato.
                    </small>
                  </label>
                  {whatsappLink(data.settings.whatsapp) && (
                    <a
                      className="text-button"
                      href={whatsappLink(data.settings.whatsapp)!}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Testar WhatsApp configurado
                    </a>
                  )}
                </>
              )}
              <button className="button primary" disabled={busy}>
                Salvar alterações
              </button>
            </form>
          )}
      </section>
      {modal && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="form-title"
          >
            <div className="modal-top">
              <h2 id="form-title">
                {modal === "account"
                  ? superAdmin
                    ? "Novo administrador"
                    : tab === "teachers"
                      ? "Novo professor"
                      : "Novo aluno"
                  : modal === "course"
                    ? "Curso"
                    : modal === "lesson"
                      ? "Aula"
                      : modal === "score"
                        ? "Nova partitura"
                        : "Nova imagem"}
              </h2>
              <button className="text-button" onClick={() => setModal(null)}>
                Fechar
              </button>
            </div>
            <form onSubmit={submit}>
              {modal === "account" ? (
                <>
                  <label>
                    Nome completo
                    <input name="name" required autoFocus />
                  </label>
                  <label>
                    E-mail de acesso
                    <input name="email" type="email" required />
                  </label>
                  <label>
                    WhatsApp
                    <WhatsappInput required />
                  </label>
                  {!superAdmin && (
                    <>
                      {tab !== "teachers" && (
                        <label className="checkbox">
                          <input name="choir" type="checkbox" /> Participa do
                          coral
                        </label>
                      )}
                      <fieldset>
                        <legend>
                          {tab === "teachers"
                            ? "Cursos do professor"
                            : "Cursos liberados"}
                        </legend>
                        {managedCourses.map((c) => (
                          <label className="checkbox" key={c.id}>
                            <input
                              name="courses"
                              type="checkbox"
                              value={c.id}
                            />
                            {c.title}
                          </label>
                        ))}
                      </fieldset>
                    </>
                  )}
                </>
              ) : (
                <>
                  <label>
                    {modal === "image"
                      ? "Descrição da imagem (texto alternativo)"
                      : "Título"}
                    <input
                      name="title"
                      required
                      autoFocus
                      defaultValue={editing?.title}
                    />
                  </label>
                  {(modal === "course" || modal === "lesson") && (
                    <label>
                      Descrição
                      <textarea
                        name="description"
                        rows={3}
                        defaultValue={editing?.description}
                      />
                    </label>
                  )}
                  {(modal === "lesson" || modal === "image") && (
                    <label>
                      Ordem de exibição
                      <input
                        name="position"
                        type="number"
                        required
                        min="0"
                        defaultValue={
                          editing && "position" in editing
                            ? editing.position
                            : 1
                        }
                      />
                    </label>
                  )}
                  {modal === "lesson" && (
                    <>
                      <label>
                        Link do YouTube
                        <input
                          name="video"
                          type="url"
                          required
                          defaultValue={
                            editing && "video_id" in editing
                              ? `https://youtu.be/${editing.video_id}`
                              : ""
                          }
                          onChange={(e) => setVideo(e.target.value)}
                        />
                      </label>
                      {youtubeId(video) && (
                        <iframe
                          className="video"
                          title="Prévia da aula"
                          src={`https://www.youtube-nocookie.com/embed/${youtubeId(video)}`}
                          allowFullScreen
                        />
                      )}
                    </>
                  )}
                  {modal === "score" && (
                    <label>
                      Curso
                      <select
                        name="course_id"
                        required
                        defaultValue={selectedCourse}
                      >
                        <option value="" disabled>
                          Selecione um curso
                        </option>
                        {managedCourses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {(modal === "image" || modal === "score") && (
                    <label>
                      Arquivo (até 10 MB)
                      <input
                        name="file"
                        type="file"
                        required
                        accept={
                          modal === "score"
                            ? "application/pdf"
                            : "image/jpeg,image/png,image/webp"
                        }
                      />
                    </label>
                  )}
                  <label className="checkbox">
                    <input
                      name="published"
                      type="checkbox"
                      defaultChecked={editing?.published || false}
                    />{" "}
                    Publicar agora
                  </label>
                </>
              )}
              {error && (
                <p className="notice error" role="alert">
                  {error}
                </p>
              )}
              <button className="button primary" disabled={busy}>
                {busy
                  ? "Salvando…"
                  : modal === "account"
                    ? "Criar conta"
                    : "Salvar"}
              </button>
            </form>
          </section>
        </div>
      )}
      {credentials && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Primeiro acesso"
          >
            <h2>Acesso preparado.</h2>
            <p>Copie esta senha agora. Ela não será exibida novamente.</p>
            <label>
              Login
              <input readOnly value={credentials.email} />
            </label>
            <label>
              Senha temporária
              <input readOnly value={credentials.password} />
            </label>
            <p className="hint">
              Inclua a senha manualmente na conversa do WhatsApp. O link contém
              apenas o login e o endereço da plataforma.
            </p>
            <div className="form-actions">
              <a
                className="button primary"
                href={
                  whatsappLink(
                    credentials.phone,
                    `Olá! Seu acesso à Escola Paráclito está pronto. Login: ${credentials.email}. Acesse: ${location.origin}${credentials.path}. A senha temporária será informada nesta conversa.`,
                  ) || undefined
                }
                target="_blank"
                rel="noreferrer"
              >
                Enviar acesso pelo WhatsApp
              </a>
              <button
                className="button secondary"
                onClick={() => setCredentials(null)}
              >
                Já copiei, fechar
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
