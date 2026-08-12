"use client";

import { useState } from "react";

export function CarouselViewer({ slides, portrait = true }: { slides: Array<{ src: string | null; alt: string }>; portrait?: boolean }) {
  const [index, setIndex] = useState(0);
  const current = slides[index]!;
  const move = (delta: number) => setIndex((value) => (value + delta + slides.length) % slides.length);
  return (
    <section className="carousel-viewer" aria-label="Carousel preview" onKeyDown={(event) => {
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    }} tabIndex={0}>
      {current.src ? <img className={`preview ${portrait ? "portrait" : "historical"}`} src={current.src} alt={current.alt} width={1080} height={portrait ? 1350 : 1080} /> : <div className={`preview-placeholder ${portrait ? "portrait" : "historical"}`} role="status">Preview is rendering</div>}
      <div className="carousel-controls">
        <button type="button" className="button button-secondary carousel-button" onClick={() => move(-1)} aria-label="Previous slide">←</button>
        <span aria-live="polite">{index + 1} of {slides.length}</span>
        <button type="button" className="button button-secondary carousel-button" onClick={() => move(1)} aria-label="Next slide">→</button>
      </div>
    </section>
  );
}
