'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role: string;
  emailVerified: string | null;
  createdAt: string;
  _count: { domains: number; pages: number; clones: number };
}

async function fetchUsers(params: URLSearchParams): Promise<{ users: User[]; pagination: any }> {
  const res = await fetch(`/api/admin/users?${params}`);
  if (!res.ok) throw new Error('Erro ao buscar usuários');
  return res.json();
}

async function updateUserRole(id: string, role: string): Promise<void> {
  const res = await fetch(`/api/admin/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error('Erro ao atualizar');
}

async function deleteUser(id: string): Promise<void> {
  const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Erro ao excluir');
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    userId: string | null;
    userEmail: string;
  }>({
    isOpen: false,
    userId: null,
    userEmail: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, search, roleFilter],
    queryFn: () => fetchUsers(new URLSearchParams({
      page: page.toString(),
      limit: '20',
      search,
      role: roleFilter,
    })),
  });

  const [actionError, setActionError] = useState<string | null>(null);

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => updateUserRole(id, role),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: Error) => setActionError(error.message),
  });

  if (isLoading) return <div className="flex items-center justify-center h-64">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Gerenciar Usuários</h1>
          <p className="text-muted-foreground">{data?.pagination.total} usuários no total</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar por email ou nome..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="max-w-md"
              />
            </div>
            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
              <option value="">Todos os roles</option>
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-muted-foreground border-b">
                  <th className="pb-3">Usuário</th>
                  <th className="pb-3">Role</th>
                  <th className="pb-3">Domínios</th>
                  <th className="pb-3">Páginas</th>
                  <th className="pb-3">Clonagens</th>
                  <th className="pb-3">Verificado</th>
                  <th className="pb-3">Criado em</th>
                  <th className="pb-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data?.users.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-muted/50">
                    <td className="py-3">
                      <div>
                        <p className="font-medium">{user.name || user.email}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </td>
                    <td className="py-3">
                      <Select
                        value={user.role}
                        onValueChange={(v) => updateRoleMutation.mutate({ id: user.id, role: v })}
                        disabled={updateRoleMutation.isPending}
                      >
                        <option value="USER">USER</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                      </Select>
                    </td>
                    <td className="py-3 text-sm">{user._count.domains}</td>
                    <td className="py-3 text-sm">{user._count.pages}</td>
                    <td className="py-3 text-sm">{user._count.clones}</td>
                    <td className="py-3">
                      {user.emailVerified ? (
                        <Badge variant="success">Sim</Badge>
                      ) : (
                        <Badge variant="destructive">Não</Badge>
                      )}
                    </td>
                    <td className="py-3 text-sm text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setDeleteDialog({
                            isOpen: true,
                            userId: user.id,
                            userEmail: user.email,
                          });
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        Excluir
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Página {data?.pagination.page} de {data?.pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(data?.pagination.totalPages || 1, p + 1))}
                disabled={page >= (data?.pagination.totalPages || 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, userId: null, userEmail: '' })}
        onConfirm={async () => {
          if (deleteDialog.userId) {
            await deleteMutation.mutateAsync(deleteDialog.userId);
            setDeleteDialog({ isOpen: false, userId: null, userEmail: '' });
          }
        }}
        isLoading={deleteMutation.isPending}
        title="Excluir Usuário"
        description="Tem certeza que deseja excluir permanentemente este usuário e todas as suas páginas, domínios e clones associados?"
        itemName={deleteDialog.userEmail}
        confirmText="Excluir Usuário"
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  );
}