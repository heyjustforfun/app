import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Download, LogIn, Menu, X } from 'lucide-react';
import { Logo } from '../components/ui';
import { DASHBOARD_URL } from '../lib/api';

const LINKS = [
  ['Home', '#home'],
  ['Live Trade', '#trade'],
  ['About Us', '#about'],
  ['How It Works', '#how-it-works'],
  ['Daily Tasks & Referrals', '#tasks'],
  ['Feature', '#features'],
  ['Packages', '#packages'],
  ['Contact Us', '#contact'],
];

export default function Navbar({ onOpenInstall }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('#home');

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
      const current = [...LINKS].reverse().find(([, href]) => {
        const el = document.querySelector(href);
        return el && el.getBoundingClientRect().top < 160;
      });
      if (current) setActive(current[1]);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled ? 'border-b border-white/5 bg-ink-900/85 backdrop-blur-xl shadow-lg shadow-black/30' : 'bg-transparent'
      }`}
    >
      <nav className="mx-auto flex h-16 sm:h-20 w-full max-w-[1720px] items-center justify-between px-4 sm:px-8 lg:px-12 xl:px-16">
        {/* Brand Logo */}
        <a href="#home" aria-label="Home" className="shrink-0">
          <Logo />
        </a>

        {/* Desktop Navigation Links */}
        <div className="hidden items-center gap-0.5 xl:gap-1 lg:flex">
          {LINKS.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className={`relative rounded-lg px-2.5 py-1.5 text-xs xl:px-3 xl:py-2 xl:text-sm font-medium transition ${
                active === href ? 'text-white font-semibold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {active === href && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-lg bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                  transition={{ type: 'spring', duration: 0.45 }}
                />
              )}
              <span className="relative">{label}</span>
            </a>
          ))}
        </div>

        {/* Desktop Right Actions: Download App & Sign In */}
        <div className="hidden items-center gap-2.5 lg:flex shrink-0">
          <button
            type="button"
            onClick={() => (onOpenInstall ? onOpenInstall('android') : null)}
            className="btn-outline !px-3.5 !py-2 text-xs xl:text-sm inline-flex items-center gap-2 font-medium"
          >
            <Download className="h-4 w-4 text-green-400" />
            <span>Download App</span>
          </button>

          <a
            href={`${DASHBOARD_URL}/login`}
            className="btn-primary !px-4 !py-2 text-xs xl:text-sm inline-flex items-center gap-2 font-semibold"
          >
            <LogIn className="h-4 w-4" />
            <span>Sign In</span>
          </a>
        </div>

        {/* Mobile Hamburger Toggle Button */}
        <button
          type="button"
          className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-zinc-300 transition hover:bg-white/10 hover:text-white lg:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle navigation menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden border-t border-white/5 bg-ink-900/98 backdrop-blur-2xl lg:hidden shadow-2xl"
          >
            <div className="flex flex-col gap-1 px-4 py-5 max-h-[calc(100vh-5rem)] overflow-y-auto">
              {LINKS.map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                    active === href ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span>{label}</span>
                  <ChevronRight className="h-4 w-4 opacity-40" />
                </a>
              ))}

              <div className="mt-4 pt-3 border-t border-white/10 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (onOpenInstall) onOpenInstall('android');
                  }}
                  className="btn-outline !w-full !py-2.5 text-sm inline-flex items-center justify-center gap-2"
                >
                  <Download className="h-4 w-4 text-green-400" />
                  <span>Download App</span>
                </button>

                <a
                  href={`${DASHBOARD_URL}/login`}
                  className="btn-primary !w-full !py-2.5 text-sm inline-flex items-center justify-center gap-2"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Sign In</span>
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
