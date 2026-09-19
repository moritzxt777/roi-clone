'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Stats {
  overview: {
    totalUsers: number;
    totalDomains: number;
    totalPages: number;
    totalClones: number;
    verifiedDomains: number;
    pendingDomains: number;
    failedClones: number;
  };
  usersByRole: Array<{ role: string; count: number }>;
  domainsByStatus: Array<{ status: string; count: number }>;
  clonesByStatus: Array<{ status: string; count: number }>;
  pagesByStatus: Array<{ status: string; count: number }>;
  recentActivity: {
    users: Array<{ id: string; email: string; name: string | null; role: string; createdAt: string }>;
    clones: Array<{ id: string; name: string; status: string; sourceUrl: string; user: { email: string; name: string | null } }>;
  };
  growth: {
    usersLast7Days: number;
    clonesLast7Days: number;
    pagesLast7Days: number;
  };
}

async function fetchStats(): Promise<Stats> {
  const res = await fetch('/api/admin/stats');
  if (!res.ok) throw new Error('Erro ao buscar estatísticas');
  return res.json();
}

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: fetchStats,
  });

  if (isLoading) return <div className="flex items-center justify-center h-64">Carregando...</div>;
  if (!stats) return <div>Erro ao carregar</div>;

  const o = stats.overview;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Painel Admin</h1>
        <p className="text-muted-foreground">Visão geral do sistema</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Totais</CardTitle>
            <span className="text-2xl">👥</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{o.totalUsers}</div>
            <p className="text-xs text-muted-foreground">+{stats.growth.usersLast7Days} nos últimos 7 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Domínios</CardTitle>
            <span className="text-2xl">🌐</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{o.totalDomains}</div>
            <p className="text-xs text-muted-foreground">{o.verifiedDomains} verificados • {o.pendingDomains} pendentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Páginas</CardTitle>
            <span className="text-2xl">📄</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{o.totalPages}</div>
            <p className="text-xs text-muted-foreground">+{stats.growth.pagesLast7Days} nos últimos 7 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clonagens</CardTitle>
            <span className="text-2xl">🔄</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{o.totalClones}</div>
            <p className="text-xs text-muted-foreground">{o.failedClones} falharam • +{stats.growth.clonesLast7Days} 7d</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Usuários por Role</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.usersByRole.map((r) => (
                <div key={r.role} className="flex justify-between text-sm">
                  <span className="capitalize">{r.role}</span>
                  <span className="font-medium">{r.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Domínios por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.domainsByStatus.map((d) => (
                <div key={d.status} className="flex justify-between text-sm">
                  <Badge variant="outline">{d.status}</Badge>
                  <span className="font-medium">{d.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clonagens por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.clonesByStatus.map((c) => (
                <div key={c.status} className="flex justify-between text-sm">
                  <Badge variant={c.status === 'COMPLETED' ? 'success' : c.status === 'FAILED' ? 'destructive' : 'outline'}>
                    {c.status}
                  </Badge>
                  <span className="font-medium">{c.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Páginas por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.pagesByStatus.map((p) => (
                <div key={p.status} className="flex justify-between text-sm">
                  <Badge variant={p.status === 'PUBLISHED' ? 'success' : 'outline'}>{p.status}</Badge>
                  <span className="font-medium">{p.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Usuários Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentActivity.users.map((user) => (
                <div key={user.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">{user.name || user.email}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="capitalize">{user.role}</Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clonagens Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentActivity.clones.map((clone) => (
                <div key={clone.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium truncate max-w-xs">{clone.name}</p>
                    <p className="text-sm text-muted-foreground truncate max-w-xs">{clone.sourceUrl}</p>
                    <p className="text-xs text-muted-foreground">por {clone.user.name || clone.user.email}</p>
                  </div>
                  <Badge variant={clone.status === 'COMPLETED' ? 'success' : clone.status === 'FAILED' ? 'destructive' : 'outline'}>
                    {clone.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}