'use client';

import { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  ShieldAlert, 
  ShieldCheck, 
  UserCheck, 
  Loader2, 
  Calendar,
  Layers,
  FileText
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
  _count: {
    clones: number;
    pages: number;
    domains: number;
  };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [roleDialog, setRoleDialog] = useState<{
    isOpen: boolean;
    userId: string | null;
    userEmail: string;
    newRole: string;
  }>({
    isOpen: false,
    userId: null,
    userEmail: '',
    newRole: '',
  });

  const fetchUsers = async () => {
    try {
      const res = await fetch(`/api/admin-master/users?q=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [search]);

  const promptRoleChange = (userId: string, userEmail: string, newRole: string) => {
    setRoleDialog({
      isOpen: true,
      userId,
      userEmail,
      newRole,
    });
  };

  const handleConfirmRoleChange = async () => {
    if (!roleDialog.userId || !roleDialog.newRole) return;
    setUpdatingId(roleDialog.userId);

    try {
      const res = await fetch('/api/admin-master/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: roleDialog.userId, role: roleDialog.newRole }),
      });

      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === roleDialog.userId ? { ...u, role: roleDialog.newRole } : u))
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingId(null);
      setRoleDialog({ isOpen: false, userId: null, userEmail: '', newRole: '' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 rounded bg-red-500/10 text-red-400 text-xs font-mono font-medium border border-red-500/20">
              SEGURANÇA & CONTAS
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Gestão de Usuários
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Controle de acessos, papéis administrativos e auditoria de usuários.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Buscar por e-mail ou nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#12141c] border border-white/10 rounded-xl text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-red-500"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-white/10 bg-[#0d0e14] overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-red-500 mb-3" />
            <p className="text-xs text-neutral-400">Carregando usuários...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-neutral-400 text-xs">
            Nenhum usuário encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#141620] text-neutral-400 uppercase tracking-wider text-[10px] border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 font-semibold">Usuário</th>
                  <th className="px-6 py-4 font-semibold">Papel / Acesso</th>
                  <th className="px-6 py-4 font-semibold">Clones & Páginas</th>
                  <th className="px-6 py-4 font-semibold">Data Cadastro</th>
                  <th className="px-6 py-4 font-semibold text-right">Gerenciar Papel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{u.name || 'Sem nome'}</div>
                      <div className="text-[11px] text-neutral-400 font-mono">{u.email}</div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${
                          u.role === 'SUPER_ADMIN'
                            ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                            : u.role === 'ADMIN'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : 'bg-white/5 text-neutral-300 border border-white/10'
                        }`}
                      >
                        {u.role === 'SUPER_ADMIN' && <ShieldAlert className="w-3 h-3" />}
                        {u.role === 'ADMIN' && <ShieldCheck className="w-3 h-3" />}
                        {u.role === 'USER' && <UserCheck className="w-3 h-3" />}
                        {u.role}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-neutral-300">
                      <div className="flex items-center gap-3 text-[11px]">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3 text-purple-400" />
                          {u._count.clones} Clones
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3 text-emerald-400" />
                          {u._count.pages} Páginas
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-neutral-400 text-[11px]">
                      {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {updatingId === u.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-red-500 ml-auto" />
                      ) : (
                        <select
                          value={u.role}
                          onChange={(e) => promptRoleChange(u.id, u.email, e.target.value)}
                          className="bg-[#151722] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-red-500 cursor-pointer"
                        >
                          <option value="USER">USER</option>
                          <option value="ADMIN">ADMIN</option>
                          <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Papel */}
      <ConfirmDialog
        isOpen={roleDialog.isOpen}
        onClose={() => setRoleDialog({ isOpen: false, userId: null, userEmail: '', newRole: '' })}
        onConfirm={handleConfirmRoleChange}
        isLoading={updatingId === roleDialog.userId}
        title="Alterar Permissão de Acesso"
        description={`Deseja realmente alterar o papel e permissões de acesso deste usuário para "${roleDialog.newRole}"?`}
        itemName={roleDialog.userEmail}
        confirmText="Confirmar Alteração"
        cancelText="Cancelar"
        variant="warning"
      />
    </div>
  );
}
