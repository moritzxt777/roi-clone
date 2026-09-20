'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { 
  ShieldAlert, 
  Users, 
  Layers, 
  Activity, 
  ArrowLeft, 
  LogOut,
  Sparkles,
  Home,
  Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ADMIN_AUTHORIZED_EMAIL = 'moritzadmin777roi@gmail.com';

const adminNav = [
  { name: 'Visão Geral', href: '/moritzadmin171roi', icon: Activity },
  { name: 'Gestão de Usuários', href: '/moritzadmin171roi/users', icon: Users },
  { name: 'Clonagens Globais', href: '/moritzadmin171roi/clones', icon: Layers },
];

export default function MoritzAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/moritzadmin171roi');
    } else if (status === 'authenticated') {
      const email = session?.user?.email?.toLowerCase();
      const role = (session?.user as any)?.role;
      const isAuthorized = email === ADMIN_AUTHORIZED_EMAIL || role === 'SUPER_ADMIN' || role === 'ADMIN';
      if (!isAuthorized) {
        router.push('/dashboard');
      }
    }
  }, [status, session, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#07080b] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-red-500" />
          <p className="text-xs text-neutral-400 font-mono">Autenticando Moritz Admin...</p>
        </div>
      </div>
    );
  }

  const role = (session?.user as any)?.role;
  const email = session?.user?.email?.toLowerCase();
  const isAuthorized = email === ADMIN_AUTHORIZED_EMAIL || role === 'SUPER_ADMIN' || role === 'ADMIN';

  if (!session || !isAuthorized) {
    return (
      <div className="min-h-screen bg-[#07080b] flex flex-col items-center justify-center p-6 text-center text-white">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold">Acesso Restrito</h1>
        <p className="text-xs text-neutral-400 max-w-sm mt-1 mb-6">
          Esta área é confidencial e exclusiva para o administrador supremo.
        </p>
        <Link
          href="/dashboard"
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-all"
        >
          Voltar ao Início
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07080b] text-white font-sans selection:bg-red-600/30">
      {/* Top Navbar */}
      <header className="border-b border-red-500/20 bg-[#0c0d13]/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Link href="/moritzadmin171roi" className="flex items-center gap-2.5">
              <img src="/roi-logo.png" alt="ROI Clone" className="h-6 w-auto rounded object-contain" />
              <span className="text-sm font-bold tracking-tight text-white">ROI Clone</span>
            </Link>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-1.5 shadow-sm shadow-red-500/10">
              <ShieldAlert className="w-3 h-3 text-red-400" />
              MORITZ ADMIN
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5">
            {adminNav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all',
                    isActive 
                      ? 'bg-red-500/15 text-red-400 border border-red-500/30 shadow-sm shadow-red-500/10' 
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-neutral-400 hover:text-white hover:bg-white/5 transition-all border border-white/5"
            >
              <Home className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>

            <div className="h-4 w-px bg-white/10" />

            <div className="flex items-center gap-2 pl-1">
              <div className="w-7 h-7 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center text-xs font-bold text-red-400 font-mono">
                M
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-[11px] font-semibold text-white leading-none">Moritz Admin</p>
                <p className="text-[9px] text-neutral-500 font-mono leading-none mt-1">{ADMIN_AUTHORIZED_EMAIL}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Sair da sessão"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Sub-bar */}
        <div className="md:hidden flex items-center border-t border-white/5 px-4 py-2 gap-1 overflow-x-auto bg-[#0a0b10]">
          {adminNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                  isActive 
                    ? 'bg-red-500/15 text-red-400 font-semibold border border-red-500/30' 
                    : 'text-neutral-400 hover:text-white'
                )}
              >
                <item.icon className="w-3 h-3" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
