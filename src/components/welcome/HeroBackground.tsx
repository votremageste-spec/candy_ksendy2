/**
 * Фоновое видео стартового экрана: Ксения за работой.
 *
 * Беззвучное, зациклённое, с автозапуском — UX-flow, п. 2.1.
 * Три предосторожности:
 *  1. playsInline — иначе iOS откроет видео на весь экран поверх интерфейса;
 *  2. poster — пока видео качается, экран не мигает пустотой;
 *  3. уважение к prefers-reduced-motion: пользователям с отключённой анимацией
 *     показываем статичный кадр вместо движущегося фона.
 */

import { useEffect, useState } from 'react';
import { MEDIA } from '@/data/media';

export function HeroBackground() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(query.matches);

    const listener = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);

  return (
    <div className="absolute inset-0 -z-10 overflow-hidden bg-surface-hover">
      {prefersReducedMotion ? (
        <img
          src={MEDIA.heroPoster}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover"
        />
      ) : (
        <video
          poster={MEDIA.heroPoster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          className="h-full w-full object-cover"
        >
          <source src={MEDIA.heroVideo} type="video/mp4" />
          <source src={MEDIA.heroVideoWebm} type="video/webm" />
        </video>
      )}

      {/*
        Матовый слой поверх видео — стайл-гайд требует читаемости текста
        без теней. Оттенок берётся из палитры, поэтому вуаль сама
        подстраивается под светлую и тёмную тему.
      */}
      <div className="video-veil absolute inset-0 backdrop-blur-[2px]" />
      <div className="video-fade absolute inset-0" />
    </div>
  );
}
