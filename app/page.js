'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowUpRight, Volume2, VolumeX, QrCode, MessageSquare, ChefHat, BarChart3 } from 'lucide-react';
import { NetrikLogo } from '@/components/netrik-logo';

// Reliable public-CDN restaurant ambiance videos (with fallback chain)
const BG_VIDEOS = [
  'https://videos.pexels.com/video-files/4253170/4253170-hd_1920_1080_30fps.mp4',
  'https://videos.pexels.com/video-files/3196284/3196284-uhd_2560_1440_25fps.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-restaurant-tables-prepared-for-a-meal-4079-large.mp4',
];
const POSTER = 'https://images.unsplash.com/photo-1650490534612-d9ba46776916?auto=format&fit=crop&w=1920&q=80';

// Free ambient restaurant music (self-hosted Kalimba ambient as primary; Web Audio synth as fallback)
const BG_MUSIC = [
  'https://www.learningcontainer.com/wp-content/uploads/2020/02/Kalimba.mp3',
];

// Step images for the Flow section
const FLOW_IMAGES = [
  'https://images.unsplash.com/photo-1600147131759-880e94a6185f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzF8MHwxfHNlYXJjaHwxfHxRUiUyMGNvZGUlMjByZXN0YXVyYW50fGVufDB8fHx8MTc3NzYyMTM1NHww&ixlib=rb-4.1.0&q=85',
  'https://images.unsplash.com/photo-1633567059020-dfc3375bd2f5?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1548285181-3103ce5d3db2?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1585105593056-eb01c42753f3?auto=format&fit=crop&w=900&q=80',
];

const STORY_BG = 'https://images.unsplash.com/photo-1703793578040-07e1778b6b2c?auto=format&fit=crop&w=1600&q=80';

export default function Landing() {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const [musicOn, setMusicOn] = useState(false);
  const [videoIdx, setVideoIdx] = useState(0);
  const [audioIdx, setAudioIdx] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Reveal-on-scroll
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('reveal-in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const handleVideoError = () => {
    if (videoIdx < BG_VIDEOS.length - 1) setVideoIdx((i) => i + 1);
  };
  const handleAudioError = () => {
    if (audioIdx < BG_MUSIC.length - 1) setAudioIdx((i) => i + 1);
  };

  // Web Audio API ambient pad — generated on-the-fly, no external file needed.
  // Plays a soft sustained chord (Cmaj9-ish) with subtle LFO breathing modulation.
  const audioCtxRef = useRef(null);
  const padNodesRef = useRef(null);

  const startPad = async () => {
    try {
      // eslint-disable-next-line no-undef
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      const ctx = audioCtxRef.current || new Ctx();
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') await ctx.resume();

      const master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
      master.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 1.5);

      // Soft analogue low-pass filter for warmth
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1400;
      filter.Q.value = 0.6;
      filter.connect(master);

      // Cmaj9 chord (warm, jazzy, restaurant-friendly)
      const freqs = [130.81, 196.00, 261.63, 329.63, 392.00];
      const voices = freqs.map((f, i) => {
        const o1 = ctx.createOscillator();
        o1.type = 'sine';
        o1.frequency.value = f;
        const o2 = ctx.createOscillator();
        o2.type = 'triangle';
        o2.frequency.value = f * 2;
        const g = ctx.createGain();
        g.gain.value = 0.18 / freqs.length;
        o1.connect(g);
        const g2 = ctx.createGain();
        g2.gain.value = 0.07 / freqs.length;
        o2.connect(g2);
        g.connect(filter);
        g2.connect(filter);

        // LFO for subtle breathing
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.06 + Math.random() * 0.05;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.3;
        lfo.connect(lfoGain);
        lfoGain.connect(g.gain);

        o1.start();
        o2.start();
        lfo.start(ctx.currentTime + i * 0.4);
        return { o1, o2, lfo, g, g2 };
      });

      padNodesRef.current = { master, filter, voices };
      return true;
    } catch (e) {
      return false;
    }
  };

  const stopPad = () => {
    const ctx = audioCtxRef.current;
    const nodes = padNodesRef.current;
    if (!ctx || !nodes) return;
    try {
      nodes.master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
      setTimeout(() => {
        try {
          nodes.voices.forEach((v) => {
            v.o1.stop();
            v.o2.stop();
            v.lfo.stop();
          });
          nodes.master.disconnect();
        } catch (_) { /* ignore */ }
        padNodesRef.current = null;
      }, 700);
    } catch (_) { /* ignore */ }
  };

  const toggleMusic = async () => {
    const a = audioRef.current;
    if (musicOn) {
      // Stop both
      try { if (a) a.pause(); } catch (_) { /* ignore */ }
      stopPad();
      setMusicOn(false);
      return;
    }
    // Try the audio file first
    if (a) {
      try {
        a.volume = 0.3;
        await a.play();
        setMusicOn(true);
        return;
      } catch (_) {
        // fall through to synth
      }
    }
    // Fallback to Web Audio synthesised pad
    const ok = await startPad();
    if (ok) setMusicOn(true);
  };

  const STEPS = [
    { n: '01', icon: <QrCode className="h-5 w-5" />, t: 'Scan', d: 'Guest scans the QR placed on the table.', img: FLOW_IMAGES[0] },
    { n: '02', icon: <MessageSquare className="h-5 w-5" />, t: 'Chat & order', d: 'A warm AI waiter opens. Browse, ask, order — all in chat.', img: FLOW_IMAGES[1] },
    { n: '03', icon: <ChefHat className="h-5 w-5" />, t: 'Kitchen ticket', d: 'Order flies live to the kitchen with allergy, spice & notes.', img: FLOW_IMAGES[2] },
    { n: '04', icon: <BarChart3 className="h-5 w-5" />, t: 'Manager dashboard', d: 'Tables, revenue, and orders update in realtime.', img: FLOW_IMAGES[3] },
  ];

  return (
    <div className="netrik-landing min-h-screen text-white overflow-x-hidden">
      {/* Hidden audio element for ambient music (file primary, Web Audio synth fallback) */}
      <audio
        ref={audioRef}
        key={BG_MUSIC[audioIdx]}
        src={BG_MUSIC[audioIdx]}
        loop
        preload="none"
        onError={handleAudioError}
      />

      {/* ───────── NAV ───────── */}
      <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ${scrolled ? 'bg-black/75 backdrop-blur-xl border-b border-white/10' : 'bg-transparent'}`}>
        <div className="max-w-[1280px] mx-auto px-5 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <NetrikLogo className="h-9 w-9" />
            <div className="leading-tight">
              <div className="text-[13px] font-bold tracking-[0.18em] uppercase">Netrik Shop</div>
              <div className="text-[8.5px] tracking-[0.4em] text-white/45 uppercase">Restaurant OS</div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-10 text-[10.5px] tracking-[0.4em] uppercase text-white/65">
            <a href="#story" className="hover:text-amber-200 transition">Story</a>
            <a href="#flow" className="hover:text-amber-200 transition">Flow</a>
            <a href="#live" className="hover:text-amber-200 transition">Live</a>
          </nav>
          <Link href="/login">
            <Button className="rounded-full bg-amber-300 hover:bg-amber-200 text-black font-bold tracking-[0.25em] uppercase text-[10.5px] h-9 px-5">
              Enter <ArrowRight className="ml-1.5 h-3 w-3" />
            </Button>
          </Link>
        </div>
      </header>

      {/* ───────── HERO ───────── */}
      <section className="relative h-screen min-h-[640px] flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          key={BG_VIDEOS[videoIdx]}
          autoPlay
          loop
          muted
          playsInline
          poster={POSTER}
          onError={handleVideoError}
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src={BG_VIDEOS[videoIdx]} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/55" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/35 to-black" />
        <div className="absolute inset-0 vignette" />

        <div className="relative z-10 text-center px-6 max-w-3xl">
          <div className="inline-flex items-center gap-3 mb-6 reveal">
            <span className="h-px w-10 bg-amber-200/60" />
            <span className="text-[9.5px] tracking-[0.5em] uppercase text-amber-100/80">Realtime Restaurant OS</span>
            <span className="h-px w-10 bg-amber-200/60" />
          </div>

          <h1 className="netrik-display leading-[0.95] reveal">
            <span className="block text-[clamp(44px,9vw,116px)] text-white">Scan. Sit.</span>
            <span className="block text-[clamp(44px,9vw,116px)] italic text-amber-300 -mt-1">Savour.</span>
          </h1>

          <p className="mt-7 text-sm md:text-[15px] text-white/70 max-w-xl mx-auto leading-relaxed reveal">
            One QR on every table. A warm AI waiter that knows your menu by heart. Orders fly to the kitchen — and a manager who sees it all, live.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3.5 reveal">
            <Link href="/login">
              <Button className="rounded-full bg-amber-300 hover:bg-amber-200 text-black font-bold tracking-[0.18em] uppercase text-[11px] h-12 px-7 shadow-2xl shadow-amber-300/20">
                Open Dashboard <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </Link>
            <a href="#flow" className="group inline-flex items-center gap-2.5 rounded-full border border-white/30 hover:border-amber-300 hover:bg-amber-300/5 px-7 h-12 transition-all">
              <span className="text-[11px] tracking-[0.18em] uppercase font-semibold text-white group-hover:text-amber-200">See the flow</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-white/70 group-hover:text-amber-200 group-hover:rotate-12 transition" />
            </a>
          </div>
        </div>

        {/* Music toggle */}
        <button
          onClick={toggleMusic}
          className="group absolute bottom-6 right-5 z-20 h-10 w-10 rounded-full border border-white/20 bg-black/50 backdrop-blur grid place-items-center hover:bg-black/70 hover:border-amber-300/50 transition"
          aria-label="Toggle ambient music"
          title={musicOn ? 'Pause ambient music' : 'Play ambient music'}
        >
          {musicOn ? <Volume2 className="h-3.5 w-3.5 text-amber-200" /> : <VolumeX className="h-3.5 w-3.5 text-white/75" />}
          {!musicOn && (
            <span className="pointer-events-none absolute right-12 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-black/80 border border-white/10 px-2.5 py-1 text-[9.5px] tracking-[0.25em] uppercase text-amber-200/90 opacity-0 group-hover:opacity-100 transition">
              Tap for music
            </span>
          )}
        </button>

        {/* Scroll indicator */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[9.5px] tracking-[0.5em] uppercase text-white/45 flex flex-col items-center gap-2">
          <span>Scroll</span>
          <span className="w-px h-7 bg-gradient-to-b from-white/55 to-transparent scroll-line" />
        </div>
      </section>

      {/* ───────── STORY (minimal aesthetic) ───────── */}
      <section id="story" className="relative py-28 px-6">
        <div className="absolute inset-0">
          <img src={STORY_BG} alt="" className="absolute inset-0 w-full h-full object-cover opacity-15" />
          <div className="absolute inset-0 bg-gradient-to-b from-black via-black/95 to-black" />
        </div>
        <div className="relative max-w-[820px] mx-auto text-center">
          <div className="reveal">
            <div className="inline-flex items-center gap-3 mb-7">
              <span className="h-px w-10 bg-amber-200/40" />
              <span className="text-[9.5px] tracking-[0.5em] uppercase text-amber-200/70">Our story</span>
              <span className="h-px w-10 bg-amber-200/40" />
            </div>
            <h2 className="netrik-display text-[clamp(28px,4.2vw,52px)] leading-[1.1]">
              Built for restaurants that<br/>
              <span className="italic text-amber-300">move at the speed of a guest.</span>
            </h2>
          </div>

          <div className="mt-10 max-w-[680px] mx-auto space-y-5 reveal">
            <p className="text-[15px] text-white/75 leading-relaxed">
              Netrik Shop is the operating system for the modern table. The guest scans a QR, an AI waiter opens, and from that moment everything — menu, order, kitchen ticket, payment, feedback — happens live, inside one chat.
            </p>
            <p className="text-[15px] text-white/65 leading-relaxed">
              No apps to download. No PDFs. No flagging down a server. Just a <span className="text-amber-200">warm conversation</span> that ends in a perfectly cooked dish.
            </p>
          </div>

          {/* Subtle decorative ornament instead of stats */}
          <div className="mt-14 flex items-center justify-center gap-4 reveal">
            <span className="h-px w-16 bg-gradient-to-r from-transparent to-amber-300/40" />
            <span className="text-amber-300/70 text-2xl">✦</span>
            <span className="h-px w-16 bg-gradient-to-l from-transparent to-amber-300/40" />
          </div>
        </div>
      </section>

      {/* ───────── FLOW (with images) ───────── */}
      <section id="flow" className="relative py-28 px-6 border-t border-white/5">
        <div className="max-w-[1180px] mx-auto">
          <div className="text-center mb-16 reveal">
            <div className="inline-flex items-center gap-3 mb-5">
              <span className="h-px w-10 bg-amber-200/40" />
              <span className="text-[9.5px] tracking-[0.5em] uppercase text-amber-200/70">The flow</span>
              <span className="h-px w-10 bg-amber-200/40" />
            </div>
            <h2 className="netrik-display text-[clamp(28px,4.2vw,52px)] leading-[1.1]">
              Four steps. <span className="italic text-amber-300">Zero friction.</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map((s, i) => (
              <div
                key={s.n}
                className="reveal group relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 hover:border-amber-300/40 transition-all duration-500"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                {/* Image */}
                <div className="relative h-52 overflow-hidden">
                  <img
                    src={s.img}
                    alt={s.t}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent" />
                  <div className="absolute top-3 left-3 text-[10px] tracking-[0.3em] uppercase text-amber-200/80 bg-black/60 backdrop-blur rounded-full px-2.5 py-0.5 border border-amber-200/20">{s.n}</div>
                  <div className="absolute bottom-3 left-3 h-9 w-9 rounded-xl border border-amber-300/40 bg-black/60 backdrop-blur grid place-items-center text-amber-200">
                    {s.icon}
                  </div>
                </div>
                {/* Text */}
                <div className="p-5">
                  <div className="netrik-display text-xl mb-1.5">{s.t}</div>
                  <div className="text-[13px] text-white/55 leading-relaxed">{s.d}</div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── LIVE ───────── */}
      <section id="live" className="relative py-28 px-6">
        <div className="absolute inset-0">
          <img src={POSTER} alt="" className="absolute inset-0 w-full h-full object-cover opacity-15" />
          <div className="absolute inset-0 bg-gradient-to-b from-black via-black/90 to-black" />
        </div>
        <div className="relative max-w-[900px] mx-auto text-center">
          <div className="reveal">
            <div className="inline-flex items-center gap-3 mb-5">
              <span className="h-px w-10 bg-amber-200/40" />
              <span className="text-[9.5px] tracking-[0.5em] uppercase text-amber-200/70">Live</span>
              <span className="h-px w-10 bg-amber-200/40" />
            </div>
            <h2 className="netrik-display text-[clamp(28px,4.2vw,52px)] leading-[1.1]">
              Watch every table.<br/><span className="italic text-amber-300">In realtime.</span>
            </h2>
            <p className="mt-6 text-[15px] text-white/65 max-w-xl mx-auto leading-relaxed">
              Every QR scan, every order, every payment — the dashboard updates the moment it happens.
            </p>
          </div>

          <div className="mt-10 reveal">
            <div className="inline-flex items-center gap-3 rounded-full border border-amber-200/30 bg-black/50 backdrop-blur px-2 py-2">
              <div className="flex items-center gap-2 px-3.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-300" />
                </span>
                <span className="text-[10px] tracking-[0.3em] uppercase text-white/80">Live now</span>
              </div>
              <Link href="/login">
                <Button className="rounded-full bg-amber-300 hover:bg-amber-200 text-black font-bold tracking-[0.18em] uppercase text-[10.5px] h-10 px-6">
                  Open Dashboard <ArrowRight className="ml-1.5 h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── FOOTER ───────── */}
      <footer className="relative border-t border-white/5 py-8 px-6">
        <div className="max-w-[1180px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-[10px] tracking-[0.3em] uppercase text-white/35">
          <div className="flex items-center gap-2.5">
            <NetrikLogo className="h-5 w-5" />
            <span>© {new Date().getFullYear()} Netrik Shop · Restaurant OS</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#story" className="hover:text-amber-200 transition">Story</a>
            <a href="#flow" className="hover:text-amber-200 transition">Flow</a>
            <Link href="/login" className="hover:text-amber-200 transition">Enter</Link>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        .netrik-landing { background: #050506; font-family: 'Inter', system-ui, sans-serif; }
        .netrik-display { font-family: 'Fraunces', 'Times New Roman', serif; font-weight: 600; letter-spacing: -0.02em; }
        .vignette { background: radial-gradient(ellipse at center, transparent 0%, transparent 50%, rgba(0,0,0,0.55) 100%); }
        .reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.85s cubic-bezier(0.22,1,0.36,1), transform 0.85s cubic-bezier(0.22,1,0.36,1); }
        .reveal-in { opacity: 1; transform: translateY(0); }
        .scroll-line { animation: scrollPulse 1.8s ease-in-out infinite; }
        @keyframes scrollPulse {
          0%, 100% { transform: scaleY(0.4); transform-origin: top; opacity: 0.4; }
          50% { transform: scaleY(1); transform-origin: top; opacity: 1; }
        }
      `}</style>
    </div>
  );
}
