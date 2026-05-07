'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Lock, ChefHat, UserCog, ArrowLeft, UserCheck, ShieldCheck, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { NetrikLogo } from '@/components/netrik-logo';
import LoadingLogo from '@/components/loading-logo';

const STAFF_ROLES = [
  { id: 'manager', label: 'Manager', desc: 'Restaurant admin', icon: UserCog },
  { id: 'chef', label: 'Chef', desc: 'Kitchen view', icon: ChefHat },
  { id: 'server', label: 'Server', desc: 'Waiter view', icon: UserCheck },
];

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState('staff');
  const [staffRole, setStaffRole] = useState('manager');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!userId || !password) return toast.error('Enter both fields');
    setLoading(true);
    try {
      const type = tab === 'central' ? 'central' : staffRole;
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, userId, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem('netrik_user', JSON.stringify(data.user));
      toast.success(`Welcome, ${data.user.userId}`);
      if (data.user.type === 'central') router.push('/central');
      else if (data.user.type === 'manager') router.push('/manager');
      else if (data.user.type === 'chef') router.push('/chef');
      else if (data.user.type === 'server') router.push('/server');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900 grid lg:grid-cols-2">
      {loading && (
        <div className="fixed inset-0 z-50 bg-white/70 backdrop-blur-sm grid place-items-center">
          <div className="flex flex-col items-center gap-3 text-sm text-neutral-600">
            <LoadingLogo className="h-12 w-12" alt="Signing in" />
            <div>Signing in...</div>
          </div>
        </div>
      )}
      {/* Left side — brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-emerald-900 text-white overflow-hidden">
        <div className="absolute inset-0 netrik-dot-bg opacity-10 pointer-events-none" />
        <div className="absolute -right-32 -top-32 w-[420px] h-[420px] bg-emerald-700/40 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -left-20 bottom-0 w-[360px] h-[360px] bg-emerald-600/30 blur-3xl rounded-full pointer-events-none" />

        <Link href="/" className="relative flex items-center gap-2.5 group w-fit">
          <NetrikLogo variant="login" className="h-12 w-auto max-w-[420px] md:max-w-[480px]" />
        </Link>

        <div className="relative max-w-md">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-[11px] uppercase tracking-wider font-medium">
            <ShieldCheck className="h-3 w-3" />
            Secure access
          </span>
          <h2 className="mt-6 font-display text-5xl font-extrabold leading-[1.05] tracking-tight">
            Welcome back to
            <br />
            your <span className="font-serif-display italic font-normal text-emerald-200">control center.</span>
          </h2>
          <p className="mt-5 text-emerald-50/80 leading-relaxed">
            Manage tables, menus, kitchen tickets and live orders — all in one beautifully designed dashboard.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-3 max-w-sm">
            {[
              { v: '24/7', l: 'realtime' },
              { v: '<1s', l: 'order sync' },
              { v: '100%', l: 'uptime' },
            ].map((s) => (
              <div key={s.l} className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 backdrop-blur">
                <div className="text-xl font-bold tabular-nums">{s.v}</div>
                <div className="text-[10px] uppercase tracking-widest text-emerald-100/70 mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-[11px] text-emerald-100/60">
          © {new Date().getFullYear()}
        </div>
      </div>

      {/* Right side — form */}
      <div className="flex items-center justify-center px-5 py-10 md:p-12">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-emerald-700 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to home
          </Link>

          {/* Mobile-only logo */}
          <div className="lg:hidden mt-5 flex items-center gap-2.5">
            <NetrikLogo variant="primary" className="h-12 w-auto max-w-[420px]" />
          </div>

          <h1 className="mt-6 font-display text-3xl md:text-4xl font-bold tracking-tight">Sign in</h1>
          <p className="text-sm text-neutral-500 mt-1.5">Choose your access type to continue.</p>

          {/* Tab switcher */}
          <div className="mt-7 grid grid-cols-2 rounded-full p-1 bg-neutral-100 border border-neutral-200/80">
            {[
              { id: 'staff', label: 'Staff' },
              { id: 'central', label: 'Central' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`h-9 rounded-full text-[13px] font-semibold transition-all ${
                  tab === t.id ? 'bg-white text-emerald-800 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Staff role picker */}
          {tab === 'staff' && (
            <div className="mt-5 grid grid-cols-3 gap-2.5">
              {STAFF_ROLES.map((r) => {
                const active = staffRole === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setStaffRole(r.id)}
                    className={`relative rounded-2xl border p-3.5 text-left transition-all ${
                      active
                        ? 'border-emerald-700 bg-emerald-50 ring-1 ring-emerald-700'
                        : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/60'
                    }`}
                  >
                    <r.icon className={`h-4 w-4 mb-2 ${active ? 'text-emerald-700' : 'text-neutral-500'}`} />
                    <div className="font-semibold text-sm">{r.label}</div>
                    <div className="text-[11px] text-neutral-500">{r.desc}</div>
                  </button>
                );
              })}
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <Label className="text-xs font-semibold text-neutral-700">User ID</Label>
              <Input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="e.g. hello or manager_xxx"
                className="mt-1.5 h-11 bg-white border-neutral-200 rounded-xl focus-visible:ring-emerald-700 focus-visible:border-emerald-700"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-neutral-700">Password</Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <Input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="h-11 pl-10 pr-10 bg-white border-neutral-200 rounded-xl focus-visible:ring-emerald-700 focus-visible:border-emerald-700"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-lg shadow-emerald-700/15"
            >
              {loading ? 'Signing in…' : (
                <span className="inline-flex items-center">Sign in <ArrowRight className="ml-1.5 h-4 w-4" /></span>
              )}
            </Button>
          </form>

          <div className="mt-7 rounded-xl bg-neutral-50 border border-neutral-200/80 px-4 py-3 text-[12px] text-neutral-600 leading-relaxed">
            <span className="font-semibold text-neutral-800">Need access?</span> Contact your restaurant manager or
            Central admin to receive your credentials.
          </div>
        </div>
      </div>
    </div>
  );
}
