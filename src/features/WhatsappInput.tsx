import { normalizeWhatsapp } from "../domain/school";
export function WhatsappInput({
  defaultValue = "",
  required = false,
}: {
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <>
      <input
        name="whatsapp"
        type="tel"
        autoComplete="tel"
        required={required}
        defaultValue={
          defaultValue
            ? defaultValue.startsWith("+")
              ? defaultValue
              : `+${defaultValue}`
            : "+55 "
        }
        placeholder="+55 17 99999-9999"
        onBlur={(event) => {
          const normalized = normalizeWhatsapp(event.currentTarget.value);
          if (normalized !== null)
            event.currentTarget.value = normalized ? `+${normalized}` : "+55 ";
        }}
      />
      <small>
        Brasil (+55) por padrão. Você pode digitar apenas o DDD e o número.
      </small>
    </>
  );
}
