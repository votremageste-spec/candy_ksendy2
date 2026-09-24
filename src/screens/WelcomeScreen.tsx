/**
 * Экран 1: Welcome — витрина личного бренда Ксении.
 *
 * Собран из двух смысловых частей:
 *  1. Hero — фоновое видео выпечки, название, слоган и CTA в конструктор.
 *  2. «О Ксении» — видеорассказ о себе и его расшифровка.
 *
 * Дизайн следует стайл-гайду («нежная вельветовая кондитерская»), космическая
 * линия из рассказа Ксении звучит только акцентом: в тексте, в иконке ракеты
 * на кнопке и в обратном отсчёте перед стартом.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AboutVideo } from '@/components/welcome/AboutVideo';
import { HeroBackground } from '@/components/welcome/HeroBackground';
import { BRAND, CTA_LABEL, KSENIA_COUNTDOWN, KSENIA_QUOTE, KSENIA_STORY } from '@/data/brand';
import { MEDIA } from '@/data/media';
import { hideBackButton } from '@/lib/telegram';

export function WelcomeScreen() {
  const navigate = useNavigate();

  // На стартовом экране возвращаться некуда — прячем нативную кнопку Telegram.
  useEffect(() => {
    hideBackButton();
  }, []);

  const goToConstructor = () => navigate('/constructor');

  const scrollToAbout = () => {
    document.getElementById('about')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <main className="relative">
      {/* ───────────────────────── HERO ───────────────────────── */}
      <section className="relative flex min-h-[100svh] flex-col items-center justify-center px-4 py-16">
        <HeroBackground />

        <div className="animate-rise flex w-full max-w-[560px] flex-col items-center text-center">
          <p className="text-[12px] tracking-[0.24em] text-text-muted uppercase">{BRAND.title}</p>

          <h1 className="mt-3 text-[clamp(34px,9vw,56px)] leading-[1.05] font-medium tracking-[-0.03em] text-text-primary">
            {BRAND.name}
          </h1>

          <p className="mt-5 max-w-[420px] text-[15px] leading-[1.6] text-text-muted">
            {BRAND.tagline}
          </p>

          {/* Ключевая фраза Ксении — самая сильная в рассказе */}
          <blockquote className="mt-8 border-t border-b border-border px-2 py-6">
            <p className="text-[clamp(18px,4.4vw,22px)] leading-[1.4] font-medium tracking-[-0.01em] text-text-primary">
              «{KSENIA_QUOTE}»
            </p>
          </blockquote>

          <div className="mt-9 w-full max-w-[380px]">
            {/* Обратный отсчёт — акцентная деталь из рассказа про запуск ракет */}
            <p
              className="mb-3 text-[12px] text-text-muted"
              aria-label="Ключ на старт: первая, вторая, третья"
            >
              {KSENIA_COUNTDOWN.join(' · ')} …
            </p>

            <Button
              onClick={goToConstructor}
              icon={<Rocket className="h-[18px] w-[18px]" strokeWidth={1.75} />}
            >
              {CTA_LABEL}
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={scrollToAbout}
          aria-label="Перейти к рассказу Ксении о себе"
          className="absolute bottom-6 flex cursor-pointer flex-col items-center gap-1 text-text-muted transition-colors duration-200 hover:text-primary"
        >
          <span className="text-[12px]">Познакомиться с Ксенией</span>
          <ChevronDown className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </section>

      {/* ──────────────────────── О КСЕНИИ ──────────────────────── */}
      <section id="about" className="bg-background px-4 py-16 md:py-24">
        <div className="mx-auto max-w-[1000px]">
          <div className="rounded-[14px] border border-border bg-surface p-5 md:p-10">
            <div className="grid gap-8 md:grid-cols-[minmax(0,300px)_1fr] md:gap-12">
              {/* Видеорассказ */}
              <div className="mx-auto w-full max-w-[300px] md:mx-0">
                <AboutVideo />
              </div>

              {/* Расшифровка рассказа */}
              <div className="flex flex-col justify-center">
                <div className="flex items-center gap-4">
                  <img
                    src={MEDIA.portraitCasual}
                    alt="Ксения"
                    loading="lazy"
                    className="h-14 w-14 shrink-0 rounded-full border border-border object-cover"
                  />
                  <h2 className="text-[20px] leading-[1.3] font-medium tracking-[-0.01em] text-text-primary">
                    Как инженер-ракетчик стал кондитером
                  </h2>
                </div>

                <div className="mt-5 space-y-4">
                  {KSENIA_STORY.map((paragraph) => (
                    <p key={paragraph} className="text-[15px] leading-[1.65] text-text-primary">
                      {paragraph}
                    </p>
                  ))}
                </div>

                <p className="mt-6 border-l-2 border-primary pl-4 text-[15px] leading-[1.6] font-medium text-text-primary">
                  {KSENIA_QUOTE}
                </p>

                <p className="mt-6 text-[13px] leading-[1.6] text-text-muted">
                  Ксения собирает каждый десерт под конкретный праздник и конкретные вкусы.
                  Соберите свой в конструкторе — состав, вес и стоимость вы увидите сразу.
                </p>

                <div className="mt-8 max-w-[320px]">
                  <Button
                    onClick={goToConstructor}
                    icon={<Rocket className="h-[18px] w-[18px]" strokeWidth={1.75} />}
                  >
                    Поехали
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-8 text-center text-[12px] text-text-muted">
            © {new Date().getFullYear()} {BRAND.name} · {BRAND.title}
          </p>
        </div>
      </section>
    </main>
  );
}
