import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import heroImage from "@/assets/jgowns-hero.png";

import CategoryMarquee from "./CategoryMarquee";
import ContactSection from "./ContactSection";
import SellSection from "./SellSection";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "JGowns | The ultimate marketplace for modest gowns.",
  },
  description:
    "Find your dream modest gown at a fraction of the retail price. Browse pre-loved bridal, women's, mother-of-the-bride, girls', and maternity gowns from trusted sellers.",
  openGraph: {
    title: "JGowns | The ultimate marketplace for modest gowns.",
    description:
      "Find your dream modest gown at a fraction of the retail price. Browse pre-loved bridal, women's, mother-of-the-bride, girls', and maternity gowns from trusted sellers.",
    type: "website",
  },
};

export default function HomePage() {
  return (
    <div className='flex flex-col gap-16 sm:gap-24'>
      <section className='hero-enter hero-glow relative isolate overflow-hidden rounded-[2.1rem] border border-[#d4c2ad] shadow-[0_35px_90px_rgba(109,82,47,0.17)] min-h-136 lg:min-h-160'>
        <Image
          src={heroImage}
          alt='Softly lit bridal showroom with floral arrangements'
          fill
          priority
          sizes='(max-width: 768px) 100vw, 1280px'
          className='hero-kenburns object-cover object-center'
        />
        <div className='absolute inset-0 bg-[linear-gradient(112deg,rgba(255,251,246,0.92)_0%,rgba(255,251,246,0.6)_34%,rgba(73,52,30,0.18)_100%)]' />
        <div className='absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(255,255,255,0.7),transparent_52%)]' />

        <div className='relative flex flex-col justify-center px-6 py-12 sm:px-10 sm:py-16 lg:px-14 lg:py-20'>
          <p className='hero-float text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-[#6d5949] [animation-delay:0ms]'>
            The ultimate marketplace for modest gowns.
          </p>
          <h1 className='hero-float mt-5 max-w-3xl text-balance text-[2.6rem] text-[#2f241b] sm:text-6xl lg:text-[4.75rem] [animation-delay:280ms]'>
            Dream gown, <em className='shimmer-text'>Dreamier</em> price.
          </h1>
          <p className='hero-float mt-6 max-w-xl text-pretty text-base leading-7 text-[#5d4b3d] sm:text-lg [animation-delay:640ms]'>
            Browse gently worn modest gowns from sellers in your community. Find one you love, contact the seller directly, and save hundreds off retail.
          </p>
          <p className='hero-float mt-6 hidden text-xs font-semibold italic uppercase tracking-wide text-[#7f6954] sm:block [animation-delay:960ms]'>
            Every category and size
            <span aria-hidden className='mx-2.5'>&middot;</span>
            Direct contact
            <span aria-hidden className='mx-2.5'>&middot;</span>
            Like-new quality
          </p>

          <div className='hero-float mt-16 self-center sm:mt-24 [animation-delay:1240ms]'>
            <Link
              href='/browse'
              prefetch={true}
              className='group inline-flex flex-col items-center gap-3 text-sm font-semibold uppercase tracking-[0.24em] text-(--accent-deep)'
            >
              <span className='inline-flex items-center gap-2.5'>
                Browse Gowns
                <ArrowRight className='size-4.5 transition-transform duration-300 group-hover:translate-x-1.5' />
              </span>
              <span
                aria-hidden
                className='h-px w-14 bg-[#b58d5f] transition-[width] duration-500 group-hover:w-full'
              />
            </Link>
          </div>
        </div>
      </section>
      <CategoryMarquee />
      <SellSection />
      <ContactSection />
    </div>
  );
}
