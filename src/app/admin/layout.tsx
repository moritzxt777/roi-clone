'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const adminNav = [
  { name: 'Visão Geral', href: '/admin' },
  { name: 'Usuários', href: '/admin/users' },
  { name: 'Domínios', href: '/admin/domains' },
  { name: 'Páginas', href: '/admin/pages' },
  { name: 'Clonagens', href: '/admin/clones' },
  { name: 'Logs', href: '/admin/logs' },
  { name: 'Configurações', href: '/admin/settings' },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = '/admin'; // fallback since usePathname not available

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && (session?.user as any)?.role !== 'ADMIN' && (session?.user as any)?.role !== 'SUPER_ADMIN') {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  if (status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  if (!session || ((session.user as any)?.role !== 'ADMIN' && (session.user as any)?.role !== 'SUPER_ADMIN')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--color-background))]">
      <header className="border-b bg-[rgb(var(--color-card))]/50 sticky top-0 z-50">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/admin" className="text-xl font-bold">Admin ROI Clone</Link>
          <nav className="flex items-center gap-1">
            {adminNav.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  pathname === item.href
                    ? 'bg-[rgb(var(--color-primary))] text-[rgb(var(--color-primary-foreground))]'
                    : 'text-[rgb(var(--color-muted-foreground))] hover:text-[rgb(var(--color-foreground))] hover:bg-[rgb(var(--color-muted))]'
                )}
              >
                {item.name}
              </Link>
            ))}
          </nav>
          <form action="/api/auth/signout" method="POST">
            <button className="text-sm text-[rgb(var(--color-muted-foreground))] hover:text-[rgb(var(--color-foreground))]">Sair</button>
          </form>
        </div>
      </header>
      <main className="container mx-auto py-8 px-4">{children}</main>
    </div>
  );
}