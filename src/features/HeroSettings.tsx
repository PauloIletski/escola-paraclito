import { useEffect, useState } from "react";
import type { Settings } from "../domain/school";
import { saveRecord, upload } from "../infrastructure/school";
import { HeroImage } from "./HeroImage";

export function HeroSettings({
  settings,
  busy,
  onSave,
}: {
  settings: Settings;
  busy: boolean;
  onSave: (
    action: () => Promise<unknown>,
    success?: string,
  ) => Promise<boolean>;
}) {
  const [selection, setSelection] = useState<{
    file: File;
    url: string;
  } | null>(null);
  useEffect(
    () => () => {
      if (selection) URL.revokeObjectURL(selection.url);
    },
    [selection],
  );
  return (
    <form
      className="settings-form"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const alt = String(
          new FormData(form).get("hero_image_alt") || "",
        ).trim();
        void onSave(async () => {
          if (!selection && !settings.hero_image_path)
            throw new Error("Escolha uma imagem para cadastrar.");
          if (!alt)
            throw new Error("Descreva a imagem para quem usa leitor de tela.");
          const path = selection
            ? await upload("institutional", selection.file)
            : settings.hero_image_path;
          await saveRecord("site_settings", {
            id: 1,
            hero_image_path: path,
            hero_image_alt: alt,
          });
          setSelection(null);
        }, "Imagem inicial salva. A landing page já usa a nova imagem.");
      }}
    >
      <h2>Imagem inicial</h2>
      <p>
        Escolha a imagem em destaque no início da landing page. Sem imagem
        cadastrada, a fotografia atual continua sendo exibida.
      </p>
      <div className="site-hero-preview">
        {selection ? (
          <img src={selection.url} alt="Prévia da nova imagem inicial" />
        ) : (
          <HeroImage
            path={settings.hero_image_path}
            alt={settings.hero_image_alt}
          />
        )}
      </div>
      <label>
        Enviar ou substituir imagem
        <input
          type="file"
          name="hero_image"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            setSelection(
              file ? { file, url: URL.createObjectURL(file) } : null,
            );
          }}
        />
        <small>
          JPG, PNG ou WebP, até 10 MB. Prefira uma imagem com espaço para
          recorte.
        </small>
      </label>
      <label>
        Descrição da imagem
        <input
          name="hero_image_alt"
          required
          defaultValue={settings.hero_image_alt}
          disabled={busy}
          placeholder="Ex.: alunos tocando durante uma celebração"
        />
        <small>Descreva o conteúdo da foto para quem usa leitor de tela.</small>
      </label>
      <div className="form-actions">
        <button className="button primary" disabled={busy}>
          Salvar imagem inicial
        </button>
        {settings.hero_image_path && (
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => {
              void onSave(async () => {
                await saveRecord("site_settings", {
                  id: 1,
                  hero_image_path: null,
                  hero_image_alt: "",
                });
                setSelection(null);
              }, "A imagem padrão voltou a ser exibida.");
            }}
          >
            Usar imagem padrão
          </button>
        )}
      </div>
    </form>
  );
}
