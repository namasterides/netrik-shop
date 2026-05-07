'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  ArrowUpRight,
  QrCode,
  MessageSquare,
  ChefHat,
  BarChart3,
  Sparkles,
  Smartphone,
  Zap,
  Shield,
  Star,
  Check,
  Menu as MenuIcon,
  X,
} from 'lucide-react';
import { NetrikLogo } from '@/components/netrik-logo';

const HERO_IMAGE = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80';

const FLOW_IMAGES = [
  'https://images.unsplash.com/photo-1600147131759-880e94a6185f?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1633567059020-dfc3375bd2f5?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1548285181-3103ce5d3db2?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1556745757-8d76bdb6984b?auto=format&fit=crop&w=900&q=80',
];

const FEATURES = [
  { icon: Sparkles, t: 'AI Waiter', d: 'A warm conversational waiter that knows your menu, dietary needs and recommendations.' },
  { icon: Zap, t: 'Realtime Sync', d: 'Orders move from table to kitchen to manager dashboard the moment they happen.' },
  { icon: Smartphone, t: 'No App Required', d: 'Guests just scan a QR. Works on every smartphone — no downloads, no logins.' },
  { icon: Shield, t: 'Multi-tenant', d: 'Each restaurant gets isolated data, branded experience and dedicated credentials.' },
  { icon: BarChart3, t: 'Live Analytics', d: 'Revenue, top items, peak hours — beautiful charts that update in realtime.' },
  { icon: ChefHat, t: 'Bilingual KOT', d: 'Kitchen tickets in English, Spanish or both — auto-print on every new order.' },
];

const STEPS = [
  { n: '01', icon: QrCode, t: 'Scan', d: 'Guest scans the QR placed on the table.', img: FLOW_IMAGES[0] },
  { n: '02', icon: MessageSquare, t: 'Chat & order', d: 'A warm AI waiter opens. Browse, ask, order — all in chat.', img: FLOW_IMAGES[1] },
  { n: '03', icon: ChefHat, t: 'Kitchen ticket', d: 'Order flies live to the kitchen with allergy, spice & notes.', img: FLOW_IMAGES[2] },
  { n: '04', icon: BarChart3, t: 'Manager dashboard', d: 'Tables, revenue, and orders update in realtime.', img: FLOW_IMAGES[3] },
];

const TESTIMONIALS = [
  {
    quote:
      'Service went from chaotic to choreographed. Our waiters now spend time being warm, not running tickets.',
    name: 'Maya Chen',
    role: 'Owner, Hibiscus Bistro',
  },
  {
    quote:
      'The AI waiter handles 80% of menu questions before they reach a human. Tickets are printed before guests look up.',
    name: 'Diego Ramírez',
    role: 'GM, Casa Verde',
  },
  {
    quote:
      'Setup took an afternoon. By dinner service we were running every table on QR. Revenue is up 22% this quarter.',
    name: 'Aisha Patel',
    role: 'Founder, North & Field',
  },
];

const FAQS = [
  { q: 'Do my guests need to download an app?', a: 'Never. They scan the QR and a chat opens in their phone browser. Works on iOS and Android with no install.' },
  { q: 'Can I keep my existing POS?', a: 'Yes. Netrik Shop runs alongside your POS for ordering and ticketing. Receipts can be exported as CSV or printed A4.' },
  { q: 'How long does setup take?', a: 'About one afternoon. Add your menu, generate table QRs, share staff credentials, and you are live by dinner service.' },
  { q: 'Is the data isolated per restaurant?', a: 'Each tenant has its own scoped data — menus, orders, tables, staff. Central admin only sees billing and aggregate metrics.' },
];

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('reveal-in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-white text-neutral-900 overflow-x-hidden selection:bg-emerald-200/60 selection:text-emerald-900">
      {/* ───────── NAV ───────── */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-white/85 backdrop-blur-xl border-b border-neutral-200/80' : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-14 md:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <NetrikLogo variant="primary" className="h-12 w-auto max-w-[420px] md:max-w-[480px]" />
          </Link>

          <nav className="hidden md:flex items-center gap-9 text-[14px] font-medium text-neutral-600">
            <a href="#features" className="hover:text-emerald-700 transition-colors">Features</a>
            <a href="#flow" className="hover:text-emerald-700 transition-colors">How it works</a>
            <a href="#stories" className="hover:text-emerald-700 transition-colors">Stories</a>
            <a href="#faq" className="hover:text-emerald-700 transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden md:block">
              <Button className="rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm h-10 px-5 shadow-sm">
                Sign in <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </Link>
            <button
              onClick={() => setMobileNav((s) => !s)}
              className="md:hidden h-10 w-10 grid place-items-center rounded-full hover:bg-neutral-100"
              aria-label="Open menu"
            >
              {mobileNav ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileNav && (
          <div className="md:hidden border-t border-neutral-200 bg-white/95 backdrop-blur-xl">
            <div className="px-6 py-5 flex flex-col gap-4 text-sm font-medium text-neutral-700">
              <a onClick={() => setMobileNav(false)} href="#features">Features</a>
              <a onClick={() => setMobileNav(false)} href="#flow">How it works</a>
              <a onClick={() => setMobileNav(false)} href="#stories">Stories</a>
              <a onClick={() => setMobileNav(false)} href="#faq">FAQ</a>
              <Link href="/login" className="block">
                <Button className="w-full rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold h-11">
                  Sign in
                </Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ───────── HERO ───────── */}
      <section className="relative pt-20 md:pt-28 pb-20 md:pb-28 px-5 md:px-8">
        <div className="absolute inset-0 netrik-dot-bg opacity-40 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-emerald-100/40 blur-[120px] rounded-full pointer-events-none" />

        <div className="relative max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 mb-6 reveal">
            <span className="netrik-pill">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 netrik-pulse" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-600" />
              </span>
              Restaurant OS · v2.0 live
            </span>
          </div>

          <h1 className="font-display text-[clamp(40px,7.5vw,84px)] font-extrabold leading-[1.02] tracking-tight reveal">
            The operating system
            <br />
            for the <span className="font-serif-display italic font-normal text-emerald-700">modern table.</span>
          </h1>

          <p className="mt-7 text-base md:text-lg text-neutral-600 max-w-2xl mx-auto leading-relaxed reveal">
            One QR per table. A warm AI waiter that knows your menu by heart. Orders fly to the kitchen — and a manager
            who sees every table, live.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3 reveal">
            <Link href="/login">
              <Button className="rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm h-12 px-7 shadow-lg shadow-emerald-700/15">
                Open Dashboard <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
            <a
              href="#flow"
              className="group inline-flex items-center gap-2 rounded-full border border-neutral-200 hover:border-emerald-700 hover:bg-emerald-50/50 px-7 h-12 transition-all"
            >
              <span className="text-sm font-semibold text-neutral-800 group-hover:text-emerald-800">See how it works</span>
              <ArrowUpRight className="h-4 w-4 text-neutral-500 group-hover:text-emerald-700 group-hover:rotate-12 transition" />
            </a>
          </div>

          {/* Trust bar */}
          <div className="mt-14 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-xs text-neutral-500 reveal">
            {['No app downloads', 'Bilingual EN/ES', 'Realtime kitchen', 'Multi-tenant'].map((t) => (
              <div key={t} className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-700" />
                <span className="font-medium">{t}</span>
              </div>
            ))}
          </div>

          {/* Hero device mockup */}
          <div className="mt-16 md:mt-20 relative max-w-5xl mx-auto reveal">
            <div className="relative rounded-3xl overflow-hidden border border-neutral-200/80 shadow-2xl shadow-neutral-900/5 bg-white">
              <div className="aspect-[16/9] bg-gradient-to-br from-emerald-50 via-white to-neutral-50 grid place-items-center relative">
                <img
                  src={HERO_IMAGE}
                  alt="Restaurant"
                  className="absolute inset-0 w-full h-full object-cover opacity-30"
                />
                <div className="relative grid grid-cols-2 md:grid-cols-3 gap-5 p-8 md:p-12 w-full">
                  <DemoStatCard label="Tables live" value="14 / 18" tone="emerald" />
                  <DemoStatCard label="Today" value="$3,284" tone="dark" />
                  <DemoStatCard label="Avg. ticket" value="$42.10" tone="light" />
                  <DemoStatCard label="Pending" value="3" tone="emerald" />
                  <DemoStatCard label="Top item" value="Truffle pasta" tone="dark" />
                  <DemoStatCard label="AI replies" value="91%" tone="light" />
                </div>
              </div>
            </div>
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-3/4 h-8 bg-neutral-900/8 blur-2xl rounded-full" />
          </div>
        </div>
      </section>

      {/* ───────── FEATURES GRID ───────── */}
      <section id="features" className="py-20 md:py-28 px-5 md:px-8 border-t border-neutral-200/80">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-14 reveal">
            <span className="netrik-pill mb-4">Features</span>
            <h2 className="font-display text-[clamp(28px,4.5vw,52px)] font-bold leading-tight tracking-tight">
              Everything a restaurant needs.
              <br />
              <span className="font-serif-display italic font-normal text-emerald-700">Nothing it doesn't.</span>
            </h2>
            <p className="mt-5 text-neutral-600 text-base md:text-lg leading-relaxed">
              Built ground-up for restaurants. No bloated POS modules, no learning curve — just the tools your team
              touches every shift.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {FEATURES.map((f, i) => (
              <div
                key={f.t}
                className="reveal group relative rounded-2xl border border-neutral-200/80 bg-white p-7 hover:border-emerald-700/40 hover:shadow-lg hover:shadow-emerald-700/5 transition-all duration-300"
                style={{ transitionDelay: `${i * 40}ms` }}
              >
                <div className="h-11 w-11 rounded-xl bg-emerald-50 grid place-items-center text-emerald-700 mb-5 group-hover:bg-emerald-700 group-hover:text-white transition-colors">
                  <f.icon className="h-5 w-5" />
                </div>
                <div className="font-display text-lg font-bold tracking-tight">{f.t}</div>
                <p className="mt-2 text-sm text-neutral-600 leading-relaxed">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── FLOW / HOW IT WORKS ───────── */}
      <section id="flow" className="py-20 md:py-28 px-5 md:px-8 bg-neutral-50/60 border-y border-neutral-200/80">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 reveal">
            <span className="netrik-pill mb-4">How it works</span>
            <h2 className="font-display text-[clamp(28px,4.5vw,52px)] font-bold leading-tight tracking-tight">
              Four steps. <span className="font-serif-display italic font-normal text-emerald-700">Zero friction.</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map((s, i) => (
              <div
                key={s.n}
                className="reveal group relative rounded-2xl overflow-hidden border border-neutral-200/80 bg-white hover:border-emerald-700/30 hover:shadow-xl hover:shadow-neutral-900/5 transition-all duration-500"
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                <div className="relative h-44 overflow-hidden bg-neutral-100">
                  <img
                    src={s.img}
                    alt={s.t}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute top-3 left-3 text-[10px] tracking-[0.25em] uppercase font-bold text-emerald-800 bg-white/90 backdrop-blur rounded-full px-2.5 py-1 border border-emerald-100">
                    {s.n}
                  </div>
                  <div className="absolute bottom-3 left-3 h-9 w-9 rounded-xl bg-white/95 backdrop-blur grid place-items-center text-emerald-700 shadow">
                    <s.icon className="h-4 w-4" />
                  </div>
                </div>
                <div className="p-5">
                  <div className="font-display text-lg font-bold tracking-tight">{s.t}</div>
                  <div className="text-sm text-neutral-600 mt-1.5 leading-relaxed">{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── BIG STATEMENT / STORY ───────── */}
      <section className="py-24 md:py-36 px-5 md:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="reveal">
            <span className="netrik-pill mb-6">Our story</span>
            <h2 className="font-display text-[clamp(28px,5vw,60px)] font-bold leading-[1.08] tracking-tight">
              Built for restaurants that{' '}
              <span className="font-serif-display italic font-normal text-emerald-700">move at the speed of a guest.</span>
            </h2>
          </div>
          <div className="mt-10 max-w-2xl mx-auto space-y-5 reveal">
            <p className="text-base md:text-lg text-neutral-700 leading-relaxed">
              Netrik Shop is the operating system for the modern table. The guest scans a QR, an AI waiter opens, and
              from that moment everything — menu, order, kitchen ticket, payment, feedback — happens live, inside one
              chat.
            </p>
            <p className="text-base md:text-lg text-neutral-500 leading-relaxed">
              No apps to download. No PDFs. No flagging down a server. Just a warm conversation that ends in a
              perfectly cooked dish.
            </p>
          </div>
          <div className="mt-12 flex items-center justify-center gap-3 reveal">
            <span className="h-px w-16 bg-emerald-200" />
            <span className="text-emerald-700 text-xl">✦</span>
            <span className="h-px w-16 bg-emerald-200" />
          </div>
        </div>
      </section>

      {/* ───────── TESTIMONIALS ───────── */}
      <section id="stories" className="py-20 md:py-28 px-5 md:px-8 bg-neutral-50/60 border-y border-neutral-200/80">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14 reveal">
            <span className="netrik-pill mb-4">Stories</span>
            <h2 className="font-display text-[clamp(28px,4.5vw,52px)] font-bold leading-tight tracking-tight">
              Loved by teams that <span className="font-serif-display italic font-normal text-emerald-700">care</span>.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <figure
                key={t.name}
                className="reveal rounded-2xl border border-neutral-200/80 bg-white p-7 flex flex-col"
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                <div className="flex items-center gap-1 text-emerald-600 mb-4">
                  {[...Array(5)].map((_, k) => (
                    <Star key={k} className="h-4 w-4 fill-emerald-600" />
                  ))}
                </div>
                <blockquote className="font-display text-lg leading-snug text-neutral-800 flex-1">
                  "{t.quote}"
                </blockquote>
                <figcaption className="mt-6 pt-5 border-t border-neutral-100">
                  <div className="font-semibold text-sm">{t.name}</div>
                  <div className="text-xs text-neutral-500 mt-0.5">{t.role}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── FAQ ───────── */}
      <section id="faq" className="py-20 md:py-28 px-5 md:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14 reveal">
            <span className="netrik-pill mb-4">FAQ</span>
            <h2 className="font-display text-[clamp(28px,4.5vw,52px)] font-bold leading-tight tracking-tight">
              Questions, <span className="font-serif-display italic font-normal text-emerald-700">answered.</span>
            </h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((f, i) => (
              <details
                key={f.q}
                className="reveal group rounded-2xl border border-neutral-200/80 bg-white open:bg-neutral-50/60 transition-colors"
                style={{ transitionDelay: `${i * 30}ms` }}
              >
                <summary className="cursor-pointer list-none flex items-center justify-between px-6 py-5 font-semibold text-base">
                  {f.q}
                  <span className="ml-4 h-7 w-7 rounded-full border border-neutral-200 grid place-items-center text-neutral-500 group-open:rotate-45 transition-transform">
                    +
                  </span>
                </summary>
                <div className="px-6 pb-5 text-sm text-neutral-600 leading-relaxed">{f.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── CTA ───────── */}
      <section className="py-20 md:py-28 px-5 md:px-8">
        <div className="max-w-5xl mx-auto relative rounded-3xl overflow-hidden bg-emerald-900 text-white p-10 md:p-16 reveal">
          <div className="absolute inset-0 netrik-dot-bg opacity-10 pointer-events-none" />
          <div className="absolute -right-20 -top-20 w-96 h-96 bg-emerald-700/40 blur-3xl rounded-full pointer-events-none" />

          <div className="relative max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-[11px] font-medium tracking-wide uppercase">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-70 netrik-pulse" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
              </span>
              Live now
            </span>
            <h3 className="mt-5 font-display text-[clamp(28px,4.5vw,48px)] font-bold leading-[1.05] tracking-tight">
              Watch every table.
              <br />
              <span className="font-serif-display italic font-normal text-emerald-200">In realtime.</span>
            </h3>
            <p className="mt-5 text-emerald-50/80 text-base md:text-lg leading-relaxed max-w-xl">
              Every QR scan, every order, every payment — your dashboard updates the moment it happens. Sign in and see
              for yourself.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login">
                <Button className="rounded-full bg-white text-emerald-900 hover:bg-emerald-50 font-semibold h-12 px-7">
                  Open Dashboard <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 hover:bg-white/10 px-7 h-12 text-sm font-semibold transition"
              >
                Explore features
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── FOOTER ───────── */}
      <footer className="border-t border-neutral-200/80 py-10 px-5 md:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-5 text-sm text-neutral-500">
          <div className="flex items-center gap-3">
            <NetrikLogo variant="primary" className="h-12 w-auto max-w-[420px] md:max-w-[480px]" />
            <span className="font-medium">© {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-6 text-xs font-medium">
            <a href="#features" className="hover:text-emerald-700 transition">Features</a>
            <a href="#flow" className="hover:text-emerald-700 transition">Flow</a>
            <a href="#stories" className="hover:text-emerald-700 transition">Stories</a>
            <Link href="/login" className="hover:text-emerald-700 transition">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function DemoStatCard({ label, value, tone = 'light' }) {
  const tones = {
    light: 'bg-white/95 border border-neutral-200 text-neutral-900',
    dark: 'bg-neutral-900 text-white',
    emerald: 'bg-emerald-700 text-white',
  };
  return (
    <div className={`rounded-xl px-4 py-3 shadow-sm ${tones[tone]}`}>
      <div className="text-[10px] uppercase tracking-widest opacity-70 font-medium">{label}</div>
      <div className="text-base md:text-lg font-bold mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}
