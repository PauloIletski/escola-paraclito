import { useState } from "react";
import { imageUrl } from "../infrastructure/school";

const fallback = {
  src: "https://images.unsplash.com/photo-1519683109079-d5f539e1542f?auto=format&fit=crop&w=1200&q=85",
  alt: "Orquestra em uma sala de concertos; imagem ilustrativa de formação musical",
};

export function HeroImage({ path, alt }: { path: string | null; alt: string }) {
  const source = path ? imageUrl(path) : "";
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const useFallback = !source || failedSource === source;
  return (
    <img
      src={useFallback ? fallback.src : source}
      alt={useFallback ? fallback.alt : alt}
      fetchPriority="high"
      onError={() => {
        if (!useFallback) setFailedSource(source);
      }}
    />
  );
}
