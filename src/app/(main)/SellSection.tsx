import Link from 'next/link';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';

import ScrollReveal from './ScrollReveal';

const STEP_NUMBER_CLASS =
  'font-display text-[3.4rem] leading-none font-medium text-(--accent-deep)/25 sm:text-[4rem]';

const STEP_RISE_CLASSES = [
  'reveal-item [transition-delay:180ms]',
  'reveal-item [transition-delay:270ms]',
  'reveal-item [transition-delay:360ms]',
];

const steps = [
  {
    n: '01',
    title: 'Photograph',
    detail: 'A single clear shot in natural light is all you need to begin.',
  },
  {
    n: '02',
    title: 'List',
    detail: 'Add a few details, set your price. Listed until someone falls for it.',
  },
  {
    n: '03',
    title: 'Connect',
    detail: 'Buyers reach out directly. No middlemen, no commissions taken.',
  },
];

export default function SellSection() {
  return (
    <section aria-labelledby="sell-headline">
      <ScrollReveal className="reveal-card relative isolate overflow-hidden rounded-[2.1rem] border border-[#d4c2ad] bg-(--bg-cream) py-12 shadow-[0_22px_60px_rgba(109,82,47,0.10)] sm:py-16 lg:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_18%,rgba(216,181,134,0.32),transparent_46%),radial-gradient(circle_at_8%_88%,rgba(255,255,255,0.55),transparent_50%)]"
        />

        <div className="relative grid gap-10 px-6 sm:px-10 lg:grid-cols-12 lg:gap-14 lg:px-14">
          <div className="lg:col-span-5">
            <p className="reveal-item text-[0.66rem] font-semibold uppercase tracking-[0.24em] text-(--accent-deep) [transition-delay:90ms]">
              Pass it on
            </p>
            <h2
              id="sell-headline"
              className="reveal-item mt-4 text-balance font-display text-[2.1rem] leading-[1.05] text-(--ink) sm:text-[2.6rem] lg:text-[3rem] [transition-delay:180ms]"
            >
              Worn once.
              <br />
              <span className="italic text-(--accent-deep)">Ready for another.</span>
            </h2>
            <p className="reveal-item mt-5 max-w-md text-pretty text-base leading-relaxed text-(--muted-ink) sm:text-[1.05rem] [transition-delay:270ms]">
              Every gown in your closet has another night ahead of it. List it in a
              few minutes. There&apos;s someone in your community searching for it now.
            </p>

            <div className="reveal-item mt-7 flex flex-wrap items-center gap-4 [transition-delay:360ms]">
              <Button
                asChild
                className="h-12 rounded-full border border-[#b58d5f]/70 gold-gradient px-6 text-xs font-semibold uppercase tracking-[0.14em] text-white shadow-[0_14px_30px_rgba(106,74,39,0.28)] transition hover:-translate-y-0.5 hover:brightness-105"
              >
                <Link href="/dashboard/new">
                  <Plus data-icon="inline-start" />
                  List Your Gown
                </Link>
              </Button>
              <p className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-(--muted-ink)">
                You set the price · Direct contact
              </p>
            </div>
          </div>

          <div className="lg:col-span-7">
            <p className="reveal-item mb-7 text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-(--muted-ink) [transition-delay:180ms]">
              How it works
            </p>
            <div className="relative">
              <span
                aria-hidden
                className="reveal-rail gold-gradient absolute inset-y-0 left-0 w-0.5 [transition-delay:180ms]"
              />
              <ol className="flex flex-col gap-9 pl-8">
                {steps.map((s, i) => (
                  <li
                    key={s.n}
                    className={`relative flex items-start gap-2 ${STEP_RISE_CLASSES[i]}`}
                  >
                    <span aria-hidden className={STEP_NUMBER_CLASS}>
                      {s.n}
                    </span>
                    <div className="-ml-6 flex-1 pt-3">
                      <h3 className="font-display text-xl font-medium text-(--ink) sm:text-2xl">
                        {s.title}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-(--muted-ink)">
                        {s.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
