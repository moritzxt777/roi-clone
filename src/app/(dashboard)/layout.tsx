'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { 
  Search, 
  Home, 
  Layers, 
  Users, 
  Settings, 
  Globe, 
  Plus, 
  X, 
  Menu, 
  ArrowRight,
  ExternalLink,
  Sparkles,
  Flame,
  ShieldAlert,
  ShieldCheck,
  Fingerprint,
  Newspaper
} from 'lucide-react';

const navigation = [
  { name: 'Início', href: '/dashboard', icon: Home },
  { name: 'Projetos', href: '/dashboard/clones', icon: Layers },
  { name: 'Camuflador ADS', href: '/dashboard/camuflador', icon: Fingerprint, badge: 'ANTI-BLOCK' },
  { name: 'Advertoriais', href: '/dashboard/advertoriais', icon: Newspaper, badge: 'NOVO' },
  { name: 'Cloaker Nativo', href: '/dashboard/cloaker', icon: ShieldCheck, badge: 'PRO' },
  { name: 'Ofertas', href: '/dashboard/ofertas', icon: Flame },
  { name: 'ROI IA Copilot', href: '/dashboard/ai', icon: Sparkles },
  { name: 'Leads', href: '/dashboard/forms', icon: Users },
  { name: 'Configurações', href: '/dashboard/settings', icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickClones, setQuickClones] = useState<{ id: string; name: string; sourceUrl: string }[]>([]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Carregar projetos rápidos para o command palette
  useEffect(() => {
    if (session?.user) {
      fetch('/api/clones')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setQuickClones(data.slice(0, 10));
          }
        })
        .catch(() => {});
    }
  }, [session]);

  // Tecla de atalho Ctrl+K / Cmd+K para abrir busca rápida
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#07080b] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!session) return null;

  const isFullBleed = pathname.includes('/projeto/') || pathname.includes('/progress');
  if (isFullBleed) {
    return <main className="min-h-screen bg-[#07080b] text-white">{children}</main>;
  }

  const userEmail = session?.user?.email?.toLowerCase();
  const userRole = (session?.user as any)?.role;
  const isSuperAdmin = userEmail === 'moritzadmin777roi@gmail.com' || userEmail === 'moritzdoblack@proton.me' || userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

  const navItems = isSuperAdmin
    ? [
        navigation[0],
        { name: 'Painel Admin', href: '/moritzadmin171roi', icon: ShieldAlert, badge: 'MASTER', isAdmin: true },
        ...navigation.slice(1),
      ]
    : navigation;

  const filteredQuickClones = quickClones.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.sourceUrl.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#07080b] text-white font-sans selection:bg-blue-600/30">
      {/* Mobile Top Header */}
      <div className="lg:hidden flex items-center justify-between border-b border-white/10 bg-[#0d0e14] px-4 py-3 sticky top-0 z-50">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <img src="/roi-logo.png" alt="ROI Clone" className="h-6 w-auto rounded object-contain" />
          <span className="text-sm font-bold tracking-tight text-white">ROI Clone</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5"
            aria-label="Buscar"
          >
            <Search className="w-5 h-5" />
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#0d0e14] border-b border-white/10 p-4 space-y-2 sticky top-[57px] z-40">
          <Link
            href="/dashboard/clones"
            onClick={() => setMobileMenuOpen(false)}
            className="flex h-9 items-center justify-center rounded-xl bg-white text-xs font-semibold text-black mb-3"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Novo Projeto
          </Link>
          <nav className="space-y-1">
            {navItems.map((item, idx) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              const isAdmin = (item as any).isAdmin;
              return (
                <Link
                  key={idx}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                    isAdmin
                      ? 'bg-red-500/15 text-red-400 font-semibold border border-red-500/30'
                      : isActive 
                      ? 'bg-white/10 text-white font-semibold' 
                      : 'text-neutral-400 hover:bg-white/5 hover:text-white'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className={cn('w-4 h-4', isAdmin ? 'text-red-400' : '')} />
                    <span>{item.name}</span>
                  </div>
                  {'badge' in item && item.badge && (
                    <span className={cn(
                      'text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider',
                      isAdmin 
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                    )}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
            <Link
              href="/dashboard/domains"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-neutral-400 hover:bg-white/5 hover:text-white"
            >
              <Globe className="w-4 h-4" />
              Domínios Customizados
            </Link>
          </nav>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] border-r border-white/10 bg-[#0a0c10] px-4 py-6 text-white lg:flex lg:flex-col">
        {/* Brand */}
        <div className="mb-7 flex items-center justify-between px-2">
          <Link href="/dashboard" className="flex items-center gap-3">
            <img src="/roi-logo.png" alt="ROI Clone" className="h-7 w-auto rounded object-contain" />
            <span className="text-base font-bold tracking-tight text-white">ROI Clone</span>
          </Link>
        </div>
        
        {/* Novo Projeto Button */}
        <Link 
          href="/dashboard/clones" 
          className="mb-6 flex h-10 items-center justify-center rounded-xl bg-white text-xs font-bold text-black transition-all hover:bg-neutral-200 shadow-md"
        >
          <Plus className="mr-1.5 w-4 h-4" /> Novo Projeto
        </Link>
        
        {/* Navigation List */}
        <nav className="space-y-1">
          {navItems.map((item, index) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const isAdmin = (item as any).isAdmin;

            return (
              <Link
                key={`${item.name}-${index}`}
                href={item.href}
                className={cn(
                  'flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium transition-all',
                  isAdmin
                    ? 'bg-red-500/15 text-red-400 font-semibold border border-red-500/30 hover:bg-red-500/20 shadow-sm shadow-red-500/10'
                    : isActive 
                    ? 'bg-blue-600/10 text-blue-400 font-semibold border border-blue-500/20' 
                    : 'text-neutral-400 hover:bg-white/5 hover:text-white'
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={cn('w-4 h-4', isAdmin ? 'text-red-400' : isActive ? 'text-blue-400' : 'text-neutral-500')} />
                  <span>{item.name}</span>
                </div>
                {'badge' in item && item.badge && (
                  <span className={cn(
                    'text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider',
                    isAdmin 
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                      : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                  )}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        
        {/* Recentes */}
        <div className="mt-8 px-3 text-xs">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Recentes</p>
          <Link 
            href="/dashboard/clones" 
            className="block truncate text-neutral-400 hover:text-white transition-colors text-xs py-1"
          >
            Projetos salvos ({quickClones.length})
          </Link>
        </div>
        
        {/* Bottom Section */}
        <div className="mt-auto border-t border-white/10 pt-4 space-y-3">
          <Link 
            href="/dashboard/domains" 
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors',
              pathname === '/dashboard/domains' 
                ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' 
                : 'text-neutral-400 hover:bg-white/5 hover:text-white'
            )}
          >
            <Globe className="w-4 h-4 text-neutral-500" />
            <span>Domínios Customizados</span>
          </Link>

          <div className="flex items-center justify-between rounded-xl p-2 bg-[#12141c] border border-white/5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-600/20 font-bold text-xs border border-blue-500/30 text-blue-400">
                {(session.user?.name || session.user?.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white">{session.user?.name || 'Usuário'}</p>
                <p className="truncate text-[10px] text-neutral-500">{session.user?.email}</p>
              </div>
            </div>
            <button 
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-white/5 transition-colors text-xs"
              title="Sair"
            >
              Sair
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="min-h-screen lg:ml-[260px] bg-[#07080b]">{children}</main>

      {/* Quick Search / Command Palette Dialog */}
      {searchOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setSearchOpen(false)}
        >
          <div 
            className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0d0e14] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10 bg-[#12141d]">
              <Search className="w-5 h-5 text-neutral-400 shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="Pesquisar projetos, páginas, leads ou configurações..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-sm text-white placeholder:text-neutral-500 focus:outline-none"
              />
              <button
                onClick={() => setSearchOpen(false)}
                className="p-1 rounded text-neutral-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Links & Results */}
            <div className="p-3 max-h-[380px] overflow-y-auto space-y-4 text-xs">
              {/* Navegação Rápida */}
              <div>
                <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Navegação Rápida
                </p>
                <div className="space-y-0.5">
                  <Link
                    href="/dashboard"
                    onClick={() => setSearchOpen(false)}
                    className="flex items-center justify-between px-2.5 py-2 rounded-xl text-neutral-300 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Home className="w-4 h-4 text-blue-400" />
                      <span>Painel Inicial</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-neutral-600" />
                  </Link>

                  <Link
                    href="/dashboard/clones"
                    onClick={() => setSearchOpen(false)}
                    className="flex items-center justify-between px-2.5 py-2 rounded-xl text-neutral-300 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Layers className="w-4 h-4 text-blue-400" />
                      <span>Gerenciar Todos os Projetos</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-neutral-600" />
                  </Link>

                  <Link
                    href="/dashboard/forms"
                    onClick={() => setSearchOpen(false)}
                    className="flex items-center justify-between px-2.5 py-2 rounded-xl text-neutral-300 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Users className="w-4 h-4 text-purple-400" />
                      <span>Leads & Formulários Capturados</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-neutral-600" />
                  </Link>

                  <Link
                    href="/dashboard/domains"
                    onClick={() => setSearchOpen(false)}
                    className="flex items-center justify-between px-2.5 py-2 rounded-xl text-neutral-300 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Globe className="w-4 h-4 text-emerald-400" />
                      <span>Domínios Customizados (CNAME/TXT)</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-neutral-600" />
                  </Link>

                  <Link
                    href="/dashboard/settings"
                    onClick={() => setSearchOpen(false)}
                    className="flex items-center justify-between px-2.5 py-2 rounded-xl text-neutral-300 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Settings className="w-4 h-4 text-amber-400" />
                      <span>Configurações & Pixels Globais</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-neutral-600" />
                  </Link>
                </div>
              </div>

              {/* Projetos Clones Encontrados */}
              {quickClones.length > 0 && (
                <div>
                  <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    Páginas e Clones Recentes
                  </p>
                  <div className="space-y-0.5">
                    {filteredQuickClones.length === 0 ? (
                      <p className="px-2.5 py-2 text-neutral-500 italic">Nenhum projeto corresponde à pesquisa.</p>
                    ) : (
                      filteredQuickClones.map((clone) => (
                        <Link
                          key={clone.id}
                          href={`/dashboard/projeto/${clone.id}`}
                          onClick={() => setSearchOpen(false)}
                          className="flex items-center justify-between px-2.5 py-2 rounded-xl text-neutral-300 hover:bg-white/5 hover:text-white transition-colors group"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <span className="font-semibold text-white block truncate group-hover:text-blue-400">
                              {clone.name}
                            </span>
                            <span className="text-[10px] text-neutral-500 block truncate">
                              {clone.sourceUrl}
                            </span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                            Abrir Editor
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Tip */}
            <div className="px-4 py-2.5 bg-[#0a0c12] border-t border-white/5 flex items-center justify-between text-[11px] text-neutral-500">
              <span>Pressione <kbd className="px-1 py-0.5 rounded bg-white/10 font-mono text-[10px] text-neutral-400">ESC</kbd> para fechar</span>
              <span className="text-blue-400">ROI Clone Navigator</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}