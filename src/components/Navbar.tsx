"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import Logo from "@/components/Logo";

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [menuOpen]);

  const navLinks = (
    <>
      <Link
        href='/browse'
        onClick={closeMenu}
        className='text-[0.9rem] font-semibold tracking-[0.06em] uppercase text-[#6d5a49] hover:text-[#a0733f]'
      >
        Browse
      </Link>
      {user ? (
        <>
          <Link
            href='/dashboard'
            onClick={closeMenu}
            className='text-[0.9rem] font-semibold tracking-[0.06em] uppercase text-[#6d5a49] hover:text-[#a0733f]'
          >
            My Listings
          </Link>
          <Link
            href='/dashboard/new'
            onClick={closeMenu}
            className='inline-flex items-center rounded-full border border-[#b58d5f]/70 bg-[linear-gradient(180deg,#c49a68,#a67841)] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(106,74,39,0.25)] hover:-translate-y-0.5 hover:brightness-105'
          >
            + List a Gown
          </Link>
          <button
            onClick={handleSignOut}
            className='text-[0.86rem] font-medium tracking-wide text-[#7d6b5c] hover:text-[#a0733f]'
          >
            Sign Out
          </button>
        </>
      ) : (
        <>
          <Link
            href='/auth/login'
            onClick={closeMenu}
            className='text-[0.9rem] font-semibold tracking-[0.06em] uppercase text-[#6d5a49] hover:text-[#a0733f]'
          >
            Sign In
          </Link>
          <Link
            href='/auth/login'
            onClick={closeMenu}
            className='inline-flex items-center rounded-full border border-[#b58d5f]/70 bg-[linear-gradient(180deg,#c49a68,#a67841)] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(106,74,39,0.25)] hover:-translate-y-0.5 hover:brightness-105'
          >
            Sell a Gown
          </Link>
        </>
      )}
    </>
  );

  const mobileNavLinks = (
    <>
      <Link
        href='/browse'
        onClick={closeMenu}
        className='flex min-h-11 items-center text-[0.9rem] font-semibold uppercase tracking-[0.06em] text-[#6d5a49]'
      >
        Browse
      </Link>
      {user ? (
        <>
          <Link
            href='/dashboard'
            onClick={closeMenu}
            className='flex min-h-11 items-center text-[0.9rem] font-semibold uppercase tracking-[0.06em] text-[#6d5a49]'
          >
            My Listings
          </Link>
          <Link
            href='/dashboard/new'
            onClick={closeMenu}
            className='flex min-h-11 w-full items-center justify-center rounded-full border border-[#b58d5f]/70 bg-[linear-gradient(180deg,#c49a68,#a67841)] px-5 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(106,74,39,0.25)]'
          >
            + List a Gown
          </Link>
          <button
            onClick={handleSignOut}
            className='flex min-h-11 w-full items-center text-[0.86rem] font-medium tracking-wide text-[#7d6b5c]'
          >
            Sign Out
          </button>
        </>
      ) : (
        <>
          <Link
            href='/auth/login'
            onClick={closeMenu}
            className='flex min-h-11 items-center text-[0.9rem] font-semibold uppercase tracking-[0.06em] text-[#6d5a49]'
          >
            Sign In
          </Link>
          <Link
            href='/auth/register'
            onClick={closeMenu}
            className='flex min-h-11 w-full items-center justify-center rounded-full border border-[#b58d5f]/70 bg-[linear-gradient(180deg,#c49a68,#a67841)] px-5 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(106,74,39,0.25)]'
          >
            Sell a Gown
          </Link>
        </>
      )}
    </>
  );

  return (
    <header className='sticky top-0 z-50 border-b border-[#d5c4b0] bg-[rgba(252,246,236,0.78)] backdrop-blur-lg'>
      <nav
        aria-label='Main navigation'
        className='mx-auto flex w-full max-w-375 items-center justify-between px-4 py-4 sm:px-6 lg:px-10'
      >
        <Link
          href='/'
          className='inline-flex w-fit shrink-0 items-center gap-2'
        >
          <Logo className='h-10 w-auto md:h-11' />
        </Link>

        {/* Desktop nav */}
        <div className='hidden items-center gap-5 md:flex'>
          {navLinks}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className='flex flex-col gap-1.5 rounded-xl border border-[#d8c9b5] bg-white/60 p-3 md:hidden'
          aria-expanded={menuOpen}
          aria-controls='mobile-menu'
          aria-label='Toggle menu'
        >
          <span
            className={`block h-0.5 w-5 bg-[#6a5440] transition-transform duration-200 ${menuOpen ? "translate-y-2 rotate-45" : ""}`}
          />
          <span
            className={`block h-0.5 w-5 bg-[#6a5440] transition-opacity duration-200 ${menuOpen ? "opacity-0" : ""}`}
          />
          <span
            className={`block h-0.5 w-5 bg-[#6a5440] transition-transform duration-200 ${menuOpen ? "-translate-y-2 -rotate-45" : ""}`}
          />
        </button>
      </nav>

      {/* Mobile menu */}
      <div
        id='mobile-menu'
        className={`overflow-hidden transition-[max-height] duration-300 ease-out md:hidden ${menuOpen ? 'max-h-96 border-t border-[#d8c9b5]' : 'max-h-0'}`}
      >
        <div className='mx-auto w-full max-w-375 px-4 py-4 sm:px-6'>
          <div className='rounded-2xl border border-[#dbcdbb] bg-[rgba(255,250,243,0.85)] px-5 py-5 shadow-[0_18px_42px_rgba(102,77,47,0.14)]'>
            <div className='flex flex-col gap-1'>{mobileNavLinks}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
