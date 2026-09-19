'use client';

import { useSession } from 'next-auth/react';
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
  Home
} from 'lucide-react';
import { cn } from '@/lib/utils';

const adminNav = [
  { name: 'Visão Geral', href: '/admin-master', icon: Activity },
  { name: 'Gestão de Usuários', href: '/admin-master/users', icon: Users },
  { name: 'Clonagens Globais', href: '/admin-master/clones', icon: Layers },
];

export default function AdminMasterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/admin-master');
    } else if (
      status === 'authenticated' && 
      (session?.user as any)?.role !== 'ADMIN' && 
      (session?.user as any)?.role !== 'SUPER_ADMIN'
    ) {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#07080b] flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" />
      </div>
    );
  }

  const role = (session?.user as any)?.role;
  if (!session || (role !== 'ADMIN' && role !== 'SUPER_ADMIN')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#07080b] text-white font-sans selection:bg-red-600/30">
      {/* Top Navbar */}
      <header className="border-b border-white/10 bg-[#0c0d13]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Link href="/admin-master" className="flex items-center gap-2.5">
              <img src="/roi-logo.png" alt="ROI Clone" className="h-6 w-auto rounded object-contain" />
              <span className="text-sm font-bold tracking-tight text-white">ROI Clone</span>
            </Link>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" />
              ADMIN MASTER
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
                      ? 'bg-red-500/15 text-red-400 border border-red-500/30' 
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
              className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-400 hover:text-white px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Dashboard App</span>
            </Link>

            <form action="/api/auth/signout" method="POST">
              <button 
                type="submit"
                className="p-2 rounded-xl text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4 sm:p-8">{children}</main>
    </div>
  );
}
