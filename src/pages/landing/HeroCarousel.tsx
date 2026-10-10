import React, { useState, useEffect, useCallback } from "react";
import {
  IconChevronLeft,
  IconChevronRight,
  IconX,
} from "@tabler/icons-react";

export const HERO_IMAGES = Array.from({ length: 23 }, (_, i) => ({
  id: i + 1,
  src: `/images/hero/hero-${i + 1}.jpeg`,
  alt: `Likya Kuyumculuk & Sarrafiye ERP`,
}));

export const HeroCarousel: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % HERO_IMAGES.length);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? HERO_IMAGES.length - 1 : prev - 1));
  }, []);

  const goToSlide = (idx: number) => {
    setCurrentIndex(idx);
  };

  // Otomatik geçiş (Modal kapalı ve hover yokken 3.8s)
  useEffect(() => {
    if (isModalOpen || isHovered) return;
    const timer = setInterval(() => {
      nextSlide();
    }, 3800);
    return () => clearInterval(timer);
  }, [isModalOpen, isHovered, nextSlide]);

  // Modal açıkken klavye yön tuşları ve ESC ile kontrol
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isModalOpen) return;
      if (e.key === "Escape") setIsModalOpen(false);
      if (e.key === "ArrowRight") nextSlide();
      if (e.key === "ArrowLeft") prevSlide();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen, nextSlide, prevSlide]);

  const currentImage = HERO_IMAGES[currentIndex];

  return (
    <>
      <div
        className="furni-hero-clean-wrap"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Doğrudan Ekran Görünümü (Dış Kenarlıksız, Arka Plansız, Tıklanabilir Ekran) */}
        <div
          className="furni-hero-screen"
          onClick={() => setIsModalOpen(true)}
          title="Büyük boyutta incelemek için tıklayın"
        >
          {HERO_IMAGES.map((img, idx) => (
            <img
              key={img.id}
              src={img.src}
              alt={img.alt}
              className={`furni-hero-pure-img ${idx === currentIndex ? "active" : ""}`}
              loading={idx === 0 ? "eager" : "lazy"}
            />
          ))}

          {/* Sol / Sağ Ok Butonları (Ekran Üzerinde) */}
          <button
            type="button"
            className="furni-hero-arrow-btn prev"
            onClick={(e) => {
              e.stopPropagation();
              prevSlide();
            }}
            aria-label="Önceki Görsel"
          >
            <IconChevronLeft size={22} />
          </button>
          <button
            type="button"
            className="furni-hero-arrow-btn next"
            onClick={(e) => {
              e.stopPropagation();
              nextSlide();
            }}
            aria-label="Sonraki Görsel"
          >
            <IconChevronRight size={22} />
          </button>
        </div>

        {/* Altta Nokta (.) İkonları Navigasyonu */}
        <div className="furni-hero-dots-nav">
          {HERO_IMAGES.map((img, idx) => (
            <button
              key={img.id}
              type="button"
              className={`furni-hero-dot ${idx === currentIndex ? "active" : ""}`}
              onClick={() => goToSlide(idx)}
              aria-label={`Görsel ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      {/* ─── Modal (Büyük Ekran Lightbox) ─── */}
      {isModalOpen && (
        <div
          className="furni-hero-modal-backdrop"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="furni-hero-modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Kapat Butonu */}
            <div className="furni-hero-modal-header">
              <div />
              <button
                type="button"
                className="furni-hero-modal-close"
                onClick={() => setIsModalOpen(false)}
                aria-label="Kapat"
              >
                <IconX size={24} />
              </button>
            </div>

            {/* Modal Görsel Alanı */}
            <div className="furni-hero-modal-body">
              <button
                type="button"
                className="furni-hero-modal-nav prev"
                onClick={prevSlide}
                aria-label="Önceki"
              >
                <IconChevronLeft size={32} />
              </button>

              <div className="furni-hero-modal-img-box">
                <img
                  src={currentImage.src}
                  alt={currentImage.alt}
                  className="furni-hero-modal-img"
                />
              </div>

              <button
                type="button"
                className="furni-hero-modal-nav next"
                onClick={nextSlide}
                aria-label="Sonraki"
              >
                <IconChevronRight size={32} />
              </button>
            </div>

            {/* Modal Alt Nokta (.) İkonları */}
            <div className="furni-hero-modal-dots">
              {HERO_IMAGES.map((img, idx) => (
                <button
                  key={img.id}
                  type="button"
                  className={`furni-hero-dot modal-dot ${idx === currentIndex ? "active" : ""}`}
                  onClick={() => goToSlide(idx)}
                  aria-label={`Görsel ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HeroCarousel;
