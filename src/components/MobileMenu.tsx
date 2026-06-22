'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

type MobileMenuContextValue = {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
};

const MobileMenuContext = createContext<MobileMenuContextValue | null>(null);

function useMobileMenu(): MobileMenuContextValue {
  const context = useContext(MobileMenuContext);
  if (!context) {
    throw new Error('MobileMenu components must be used within MobileMenuProvider');
  }
  return context;
}

export function MobileMenuProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((open) => !open), []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  return (
    <MobileMenuContext.Provider value={{ isOpen, toggle, close }}>
      {children}
    </MobileMenuContext.Provider>
  );
}

export function MobileMenuTrigger() {
  const { isOpen, toggle } = useMobileMenu();

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex flex-col gap-1.5 rounded-xl border border-[#d8c9b5] bg-white/60 p-3 md:hidden"
      aria-expanded={isOpen}
      aria-controls="mobile-menu"
      aria-label="Toggle menu"
    >
      <span className={`block h-0.5 w-5 bg-[#6a5440] transition-transform duration-200 ${isOpen ? 'translate-y-2 rotate-45' : ''}`} />
      <span className={`block h-0.5 w-5 bg-[#6a5440] transition-opacity duration-200 ${isOpen ? 'opacity-0' : ''}`} />
      <span className={`block h-0.5 w-5 bg-[#6a5440] transition-transform duration-200 ${isOpen ? '-translate-y-2 -rotate-45' : ''}`} />
    </button>
  );
}

export function MobileMenuPanel({ children }: { children: ReactNode }) {
  const { isOpen, close } = useMobileMenu();

  return (
    <div
      id="mobile-menu"
      className={`overflow-hidden transition-[max-height] duration-300 ease-out md:hidden ${isOpen ? 'max-h-96 border-t border-[#d8c9b5]' : 'max-h-0'}`}
    >
      <div className="mx-auto w-full max-w-375 px-4 py-4 sm:px-6">
        <div className="rounded-2xl border border-[#dbcdbb] bg-[rgba(255,250,243,0.85)] px-5 py-5 shadow-[0_18px_42px_rgba(102,77,47,0.14)]">
          <div className="flex flex-col gap-1" onClick={close}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
