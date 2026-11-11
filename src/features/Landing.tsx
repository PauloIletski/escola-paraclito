import {
  ArrowUpRight,
  BookOpen,
  Music2,
  Play,
  Church,
  MessageCircle,
} from "lucide-react";
import type { SchoolData, Course } from "../domain/school";
import { whatsappLink } from "../domain/school";
import { imageUrl } from "../infrastructure/school";
import { HeroImage } from "./HeroImage";
import { CourseSymbol } from "./CourseSymbol";
export function Landing({
  data,
  onLogin,
  onCourse,
}: {
  data: SchoolData;
  onLogin: () => void;
  onCourse: (course: Course) => void;
}) {
  const contact = whatsappLink(data.settings.whatsapp);
  return (
    <>
      <section className="hero" id="inicio">
        <div className="hero-copy">
          <div className="diocese">
            <span /> Diocese de Barretos
          </div>
          <h1>
            A música que <br />
            forma.
            <br />A fé que inspira.
          </h1>
          <p>
            Um caminho de aprendizado e espiritualidade para colocar seu dom a
            serviço da liturgia.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#cursos">
              Conheça os cursos <ArrowUpRight size={18} />
            </a>
            <button className="text-button" onClick={onLogin}>
              <span className="play-circle">
                <Play size={13} fill="currentColor" />
              </span>{" "}
              Já sou aluno
            </button>
          </div>
          <div className="hero-caption">
            <Music2 size={18} />
            <span>Formação musical com propósito.</span>
          </div>
        </div>
        <div className="hero-art">
          <div className="hero-photo">
            <HeroImage
              path={data.settings.hero_image_path}
              alt={data.settings.hero_image_alt}
            />
            <div className="photo-shade" />
            <span className="photo-caption">Aprender. Celebrar. Servir.</span>
          </div>
          <div className="score-stamp" aria-hidden="true">
            <span>𝄞</span>
            <div>
              Onde a música
              <br />
              se torna oração.
            </div>
            <i>Escola Paráclito</i>
          </div>
          <div className="art-note" aria-hidden="true">
            ♩
          </div>
        </div>
      </section>
      <div className="values-strip">
        <span>
          <Music2 size={19} /> Música que aproxima
        </span>
        <span>
          <BookOpen size={19} /> Formação que transforma
        </span>
        <span>
          <Church size={19} /> A serviço da comunidade
        </span>
      </div>
      <section className="courses-section section" id="cursos">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Encontre o seu caminho</span>
            <h2>Cada dom, uma forma de servir.</h2>
          </div>
          <p>
            Da primeira nota à prática litúrgica.
            <br />
            Conheça nossas áreas de formação.
          </p>
        </div>
        <div className="course-grid">
          {data.courses
            .filter((c) => c.published)
            .map((course) => (
              <button
                className="course-card"
                key={course.id}
                onClick={() => onCourse(course)}
              >
                <div className="course-icon">
                  <CourseSymbol course={course} />
                </div>
                <h3>{course.title}</h3>
                <p>{course.description}</p>
                <span className="course-link">
                  Conhecer o curso <ArrowUpRight size={17} />
                </span>
              </button>
            ))}
        </div>
      </section>
      <section className="about-section section" id="escola">
        <div className="about-visual">
          <img
            src="/images/logo.jpeg"
            alt="Brasão da Diocese de Barretos e identidade da Escola Paráclito de Música Litúrgica"
            loading="lazy"
          />
        </div>
        <div className="about-copy">
          <span className="section-kicker">Quem somos</span>
          <h2>
            Mais que aprender música.
            <br />
            Cultivar uma missão.
          </h2>
          <p>{data.settings.about}</p>
          <p>
            Acreditamos que cada voz e cada instrumento podem ajudar uma
            comunidade inteira a celebrar.
          </p>
          <div className="signature">
            <span>Escola Paráclito</span>
            <small>Música litúrgica · Diocese de Barretos</small>
          </div>
        </div>
      </section>
      <section className="gallery-section section" id="vivencias">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Nossa essência</span>
            <h2>A beleza de fazer parte.</h2>
          </div>
          <p>Música, encontro e vida em comunidade.</p>
        </div>
        {data.images.length ? (
          <div className="gallery">
            {data.images
              .filter((i) => i.published)
              .map((i) => (
                <figure key={i.id}>
                  <img src={imageUrl(i.path)} alt={i.alt} loading="lazy" />
                  <figcaption>{i.alt}</figcaption>
                </figure>
              ))}
          </div>
        ) : (
          <div className="invitation">
            <Music2 size={46} strokeWidth={1} />
            <div>
              <h3>Uma escola feita de encontros.</h3>
              <p>Em breve, os registros da nossa caminhada estarão aqui.</p>
            </div>
          </div>
        )}
      </section>
      <section
        className="contact-section"
        id="contato"
        aria-labelledby="contact-title"
      >
        <div>
          <span className="section-kicker">Contato</span>
          <h2 id="contact-title">Vamos conversar?</h2>
          <p>
            Tire suas dúvidas sobre os cursos, matrículas e a vida na escola.
          </p>
        </div>
        {contact ? (
          <a
            className="button light"
            href={contact}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle size={19} /> Conversar no WhatsApp{" "}
            <ArrowUpRight size={18} />
          </a>
        ) : (
          <p>Em breve, o WhatsApp da escola estará disponível aqui.</p>
        )}
      </section>
    </>
  );
}
