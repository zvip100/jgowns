import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";

import heroImage from "@/assets/jgowns-hero.png";
import SellSection from "@/components/SellSection";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <>
    <section className='hero-glow relative isolate mb-8 overflow-hidden rounded-[2.1rem] border border-[#d4c2ad] shadow-[0_35px_90px_rgba(109,82,47,0.17)] min-h-[58svh] sm:mb-12 sm:min-h-[62vh] lg:min-h-[66vh] 2xl:min-h-[58vh]'>
      <Image
        src={heroImage}
        alt='Softly lit bridal showroom with floral arrangements'
        fill
        preload
        sizes='(max-width: 768px) 100vw, 1280px'
        className='object-cover object-center'
      />
      <div className='absolute inset-0 bg-[linear-gradient(112deg,rgba(255,251,246,0.78)_0%,rgba(255,251,246,0.47)_34%,rgba(73,52,30,0.18)_100%)]' />
      <div className='absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(255,255,255,0.7),transparent_52%)]' />

      <div className='relative flex flex-col justify-center px-4 py-12 sm:px-10 sm:py-16 lg:px-14 lg:py-20'>
        <div className='surface-panel hairline stagger-rise w-full rounded-2xl p-5 mb-6 sm:max-w-3xl sm:rounded-[1.7rem] sm:p-9'>
          <span className='mb-4 inline-flex items-center rounded-full border border-white/75 bg-white/66 px-4 py-1.5 text-[0.66rem] font-semibold uppercase tracking-[0.24em] text-[#6d5949] backdrop-blur-md'>
            The ultimate marketplace for modest gowns.
          </span>
          <h1 className='max-w-3xl text-[2.4rem] text-[#2f241b] sm:text-6xl lg:text-[4.25rem]'>
            Find the gown that already feels like yours.
          </h1>
          <p className='mt-5 max-w-2xl text-base leading-7 text-[#5d4b3d] sm:text-lg'>
            Shop gently loved wedding gowns in exceptional condition, speak
            directly with sellers, and move from discovery to "yes" with calm
            confidence.
          </p>

          <div className='mt-7 hidden flex-wrap gap-3 sm:flex'>
            <span className='rounded-full border border-[#d7c2a9] bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.11em] text-[#7f6954]'>
              Modest silhouettes
            </span>
            <span className='rounded-full border border-[#d7c2a9] bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.11em] text-[#7f6954]'>
              Trusted direct contact
            </span>
            <span className='rounded-full border border-[#d7c2a9] bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.11em] text-[#7f6954]'>
              Like-new quality
            </span>
          </div>
        </div>
      </div>

      <div className='absolute inset-x-0 bottom-6 z-10 flex justify-center px-6'>
        <Button
          asChild
          variant='secondary'
          className='h-11 rounded-full border border-white/60 px-6 text-xs font-semibold uppercase tracking-[0.14em] shadow-[0_12px_28px_rgba(98,72,40,0.10)] backdrop-blur-md transition hover:-translate-y-0.5'
        >
          <Link href='/browse'>
            <Search data-icon='inline-start' />
            Browse Gowns
          </Link>
        </Button>
      </div>
    </section>
    <SellSection />
    </>
  );
}
