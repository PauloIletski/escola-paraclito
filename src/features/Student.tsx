import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Download,
  FileMusic,
  Play,
  Printer,
} from "lucide-react";
import type { Course, Profile, SchoolData } from "../domain/school";
import { progressFor } from "../domain/school";
import { downloadScore, setProgress } from "../infrastructure/school";
import { CourseSymbol } from "./CourseSymbol";
import { useDialog } from "./useDialog";
export function Student({
  profile,
  data,
  refresh,
}: {
  profile: Profile;
  data: SchoolData;
  refresh: () => Promise<void>;
}) {
  const [tab, setTab] = useState("courses");
  const [course, setCourse] = useState<Course | null>(null);
  const [lessonId, setLessonId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pdf, setPdf] = useState<{ url: string; title: string } | null>(null);
  useDialog(!!pdf, () => setPdf(null));
  useEffect(
    () => () => {
      if (pdf) URL.revokeObjectURL(pdf.url);
    },
    [pdf],
  );
  const courses = data.courses.filter(
    (c) =>
      c.published &&
      data.enrollments.some(
        (e) => e.student_id === profile.id && e.course_id === c.id && e.active,
      ),
  );
  const currentCourse = courses.find((c) => c.id === course?.id);
  const lessons = data.lessons.filter(
    (l) => l.course_id === currentCourse?.id && l.published,
  );
  const lesson = lessons.find((l) => l.id === lessonId) || lessons[0];
  async function complete() {
    if (!lesson) return;
    setBusy(true);
    setError("");
    try {
      await setProgress(
        profile.id,
        lesson.id,
        !data.progress.includes(lesson.id),
      );
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function openScore(path: string, title: string) {
    setBusy(true);
    setError("");
    try {
      setPdf({ url: await downloadScore(path), title });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="workspace section">
      <div className="workspace-heading">
        <span className="section-kicker">Seu espaço de formação</span>
        <h1>Olá, {profile.name.split(" ")[0]}.</h1>
        <p>Um pouco de prática, todos os dias. Vamos continuar?</p>
      </div>
      <nav className="tabs" aria-label="Área do aluno">
        <button
          className={tab === "courses" ? "active" : ""}
          onClick={() => setTab("courses")}
        >
          Meus cursos
        </button>
        {profile.choir && (
          <button
            className={tab === "scores" ? "active" : ""}
            onClick={() => setTab("scores")}
          >
            Partituras do coral
          </button>
        )}
      </nav>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {tab === "courses" &&
        (currentCourse ? (
          <>
            <button
              className="text-button back"
              onClick={() => setCourse(null)}
            >
              <ArrowLeft size={16} /> Todos os meus cursos
            </button>
            <h2>{currentCourse.title}</h2>
            {lesson ? (
              <div className="lesson-layout">
                <div>
                  <iframe
                    className="video"
                    title={lesson.title}
                    src={`https://www.youtube-nocookie.com/embed/${lesson.video_id}`}
                    allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                  <p className="hint">
                    Se o vídeo estiver indisponível ou não permitir reprodução,
                    entre em contato com a escola.
                  </p>
                  <h3>{lesson.title}</h3>
                  <p>{lesson.description}</p>
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={complete}
                  >
                    <Check size={18} />{" "}
                    {data.progress.includes(lesson.id)
                      ? "Marcar como não concluída"
                      : "Concluir aula"}
                  </button>
                </div>
                <aside className="lesson-list">
                  <h3>Aulas do curso</h3>
                  {lessons.map((l, i) => (
                    <button
                      key={l.id}
                      className={lesson.id === l.id ? "selected" : ""}
                      onClick={() => setLessonId(l.id)}
                    >
                      <span>
                        {data.progress.includes(l.id) ? (
                          <Check size={18} />
                        ) : (
                          String(i + 1).padStart(2, "0")
                        )}
                      </span>
                      {l.title}
                      <Play size={14} />
                    </button>
                  ))}
                </aside>
              </div>
            ) : (
              <div className="empty">
                Nenhuma aula disponível. A escola está preparando o conteúdo
                deste curso.
              </div>
            )}
          </>
        ) : (
          <div className="student-courses">
            {courses.length ? (
              courses.map((c) => {
                const progress = progressFor(
                  data.lessons.filter((l) => l.course_id === c.id),
                  data.progress,
                );
                return (
                  <button
                    className="student-course"
                    key={c.id}
                    onClick={() => {
                      setCourse(c);
                      setLessonId("");
                    }}
                  >
                    <CourseSymbol course={c} />
                    <h2>{c.title}</h2>
                    <p>{c.description}</p>
                    <div className="progress-track">
                      <span style={{ width: `${progress.percent}%` }} />
                    </div>
                    <small>
                      {progress.total
                        ? `${progress.done} de ${progress.total} aulas concluídas · ${progress.percent}%`
                        : "Nenhuma aula disponível"}
                    </small>
                    <span className="course-link">
                      Acessar curso <Play size={15} />
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="empty">
                Você ainda não tem cursos liberados. Entre em contato com a
                escola para organizar sua formação.
              </div>
            )}
          </div>
        ))}
      {tab === "scores" && profile.choir && (
        <>
          <h2>Repertório para cantar juntos.</h2>
          <p>Partituras disponibilizadas pela escola para o coral.</p>
          <div className="score-list">
            {data.scores
              .filter((s) => s.published)
              .map((s) => (
                <div className="score-row" key={s.id}>
                  <FileMusic />
                  <div>
                    <h3>{s.title}</h3>
                    <small>Partitura em PDF</small>
                  </div>
                  <button
                    disabled={busy}
                    className="button secondary"
                    onClick={() => openScore(s.path, s.title)}
                  >
                    Abrir partitura
                  </button>
                </div>
              ))}
            {!data.scores.length && (
              <div className="empty">
                Nenhuma partitura publicada no momento.
              </div>
            )}
          </div>
        </>
      )}
      {pdf && (
        <div className="modal-backdrop">
          <section
            className="modal pdf-modal"
            role="dialog"
            aria-modal="true"
            aria-label={pdf.title}
          >
            <div className="modal-top">
              <h2>{pdf.title}</h2>
              <button className="text-button" onClick={() => setPdf(null)}>
                Fechar
              </button>
            </div>
            <div className="form-actions">
              <a
                className="button secondary"
                href={pdf.url}
                download={`${pdf.title}.pdf`}
              >
                <Download size={16} /> Baixar PDF
              </a>
              <button
                className="button secondary"
                onClick={() => {
                  const frame =
                    document.querySelector<HTMLIFrameElement>("#pdf-reader");
                  frame?.contentWindow?.focus();
                  frame?.contentWindow?.print();
                }}
              >
                <Printer size={16} /> Imprimir
              </button>
            </div>
            <iframe id="pdf-reader" title={pdf.title} src={pdf.url} />
            <p className="hint">
              Se seu navegador não exibir o leitor, baixe o PDF para abrir e
              imprimir.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
