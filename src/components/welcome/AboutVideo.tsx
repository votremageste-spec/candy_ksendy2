/**
 * Плеер видео «О себе».
 *
 * Отличие от фонового видео: тут есть речь, поэтому автозапуск невозможен —
 * браузеры блокируют звук без действия пользователя. Плюс файл тяжёлый, а
 * основной трафик приходит с телефонов по ссылке из профиля. Поэтому до первого
 * клика показываем только обложку (preload="none"), а сам файл начинаем грузить
 * лишь когда человек осознанно нажал «Смотреть».
 */

import { useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { MEDIA } from '@/data/media';
import { haptic } from '@/lib/telegram';

export function AboutVideo() {
  const [isActivated, setIsActivated] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleActivate = () => {
    haptic('light');
    setIsActivated(true);
    // Даём React отрисовать <video>, затем запускаем воспроизведение.
    requestAnimationFrame(() => {
      videoRef.current?.play().catch(() => {
        // Автозапуск отклонён системой — оставляем нативные контролы,
        // пользователь запустит вручную. Это не ошибка загрузки.
      });
    });
  };

  if (hasFailed) {
    return (
      <div className="flex aspect-[9/16] w-full items-center justify-center rounded-[14px] border border-border bg-surface-hover p-6 text-center">
        <p className="text-[14px] text-text-muted">
          Видео не удалось загрузить.
          <br />
          Но рассказ Ксении вы можете прочитать рядом.
        </p>
      </div>
    );
  }

  if (!isActivated) {
    return (
      <button
        type="button"
        onClick={handleActivate}
        aria-label="Смотреть видео: Ксения рассказывает о себе"
        className="group relative aspect-[9/16] w-full cursor-pointer overflow-hidden rounded-[14px] border border-border bg-surface-hover"
      >
        <img
          src={MEDIA.aboutPoster}
          alt="Ксения — домашний кондитер"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          loading="lazy"
          onError={(event) => {
            // Обложки нет — не показываем «битую картинку», просто убираем её.
            event.currentTarget.style.visibility = 'hidden';
          }}
        />

        {/* Матовая вуаль, чтобы кнопка Play читалась на любом кадре */}
        <span className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />

        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
            <Play className="ml-1 h-6 w-6 fill-primary text-primary" strokeWidth={1.5} />
          </span>
        </span>

        <span className="absolute right-0 bottom-0 left-0 p-4 text-left">
          <span className="block text-[12px] font-medium text-white/95">
            Ксения — о себе за минуту
          </span>
        </span>
      </button>
    );
  }

  return (
    <video
      ref={videoRef}
      poster={MEDIA.aboutPoster}
      controls
      playsInline
      preload="auto"
      onError={() => setHasFailed(true)}
      className="aspect-[9/16] w-full rounded-[14px] border border-border bg-black object-cover"
    >
      <source src={MEDIA.aboutVideo} type="video/mp4" />
      <source src={MEDIA.aboutVideoWebm} type="video/webm" />
      Ваш браузер не поддерживает видео.
    </video>
  );
}
