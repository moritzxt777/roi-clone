'use client';

import { useState, useEffect } from 'react';
import { 
  Globe, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  RefreshCw, 
  Trash2, 
  Copy, 
  Check, 
  ExternalLink,
  ShieldCheck,
  Server
} from 'lucide-react';

interface DomainItem {
  id: string;
  name: string;
  status: 'PENDING' | 'VERIFYING' | 'VERIFIED' | 'FAILED' | 'EXPIRED';
  sslStatus: string;
  createdAt: string;
  verification?: {
    type: string;
    value: string;
    verified: boolean;
  };
  dnsRecords?: any;
  pages?: { id: string; name: string; slug: string }[];
}

export default function DomainsPage() {
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDomain, setNewDomain] = useState('');
  const [adding, setAdding] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDomains = async () => {
    try {
      const res = await fetch('/api/domains');
      if (res.ok) {
        const data = await res.json();
        setDomains(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDomains();
  }, []);

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain) return;
    setAdding(true);
    setError(null);

    try {
      const res = await fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDomain }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao adicionar domínio');
      }

      setNewDomain('');
      fetchDomains();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleVerify = async (id: string) => {
    setVerifyingId(id);
    setError(null);

    try {
      const res = await fetch(`/api/domains/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify' }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Verificação pendente. O DNS pode levar alguns minutos para propagar.');
      }
      fetchDomains();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover este domínio?')) return;

    try {
      await fetch(`/api/domains/${id}`, { method: 'DELETE' });
      setDomains(domains.filter(d => d.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8 text-white">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Domínios Personalizados</h1>
            <p className="text-xs text-neutral-400">
              Conecte seus próprios domínios (ex: <code>www.seusite.com</code>) para publicar suas páginas clonadas com SSL grátis.
            </p>
          </div>
        </div>
      </div>

      {/* Formulário para Adicionar Domínio */}
      <div className="p-6 rounded-2xl border border-white/10 bg-[#0e1017] shadow-xl">
        <h2 className="text-sm font-semibold text-neutral-200 mb-1">Adicionar Novo Domínio</h2>
        <p className="text-xs text-neutral-500 mb-4">
          Insira o domínio ou subdomínio que deseja apontar para a plataforma.
        </p>

        <form onSubmit={handleAddDomain} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              required
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="ex: www.meusite.com.br ou ofertas.meusite.com"
              className="w-full bg-[#151722] border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 font-mono transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs tracking-tight flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>{adding ? 'Adicionando...' : 'Adicionar Domínio'}</span>
          </button>
        </form>

        {error && (
          <div className="mt-3 p-3 rounded-xl bg-red-950/40 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Lista de Domínios Conectados */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-white tracking-tight">Seus Domínios Cadastrados</h2>

        {loading ? (
          <div className="py-12 text-center text-xs text-neutral-500">Carregando domínios...</div>
        ) : domains.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-white/10 text-center text-xs text-neutral-500">
            Nenhum domínio personalizado configurado ainda. Adicione o seu acima para começar.
          </div>
        ) : (
          domains.map((dom) => {
            const isVerified = dom.status === 'VERIFIED';
            const isVerifying = verifyingId === dom.id;

            return (
              <div
                key={dom.id}
                className="p-6 rounded-2xl border border-white/10 bg-[#0e1017] shadow-xl space-y-5"
              >
                {/* Header do Card de Domínio */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-bold text-white font-mono">{dom.name}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                      isVerified 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {isVerified ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {isVerified ? 'Ativo e Verificado' : 'Aguardando DNS'}
                    </span>

                    {isVerified && (
                      <span className="text-[10px] text-emerald-400 bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        <span>SSL Ativo</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleVerify(dom.id)}
                      disabled={isVerifying}
                      className="px-3.5 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-neutral-300 hover:text-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin text-blue-400' : ''}`} />
                      <span>{isVerifying ? 'Verificando...' : 'Verificar DNS'}</span>
                    </button>

                    <button
                      onClick={() => handleDelete(dom.id)}
                      title="Excluir domínio"
                      className="p-2 rounded-xl bg-white/5 hover:bg-red-500/10 text-neutral-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Instruções de Apontamento DNS */}
                {!isVerified && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300">
                      <Server className="w-4 h-4 text-blue-400" />
                      <span>Instruções de Configuração no seu Provedor (Cloudflare, GoDaddy, Hostgator):</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Registro CNAME */}
                      <div className="p-3.5 rounded-xl bg-[#141722] border border-white/5 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-neutral-400">1. Registro CNAME</span>
                          <span className="text-[10px] text-blue-400 font-mono">Apontamento Principal</span>
                        </div>
                        <div className="text-[11px] font-mono text-neutral-300 space-y-1">
                          <p><span className="text-neutral-500">Tipo:</span> CNAME</p>
                          <p><span className="text-neutral-500">Nome:</span> {dom.name.split('.')[0] || 'www'}</p>
                          <div className="flex items-center justify-between bg-black/40 p-1.5 rounded border border-white/5 mt-1">
                            <span className="text-blue-300 truncate">roi-clone.pages.dev</span>
                            <button
                              onClick={() => copyToClipboard('roi-clone.pages.dev', `${dom.id}-cname`)}
                              className="text-neutral-400 hover:text-white p-1"
                            >
                              {copiedKey === `${dom.id}-cname` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Registro TXT de Verificação */}
                      <div className="p-3.5 rounded-xl bg-[#141722] border border-white/5 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-neutral-400">2. Registro TXT (Opcional)</span>
                          <span className="text-[10px] text-purple-400 font-mono">Validação Rápida</span>
                        </div>
                        <div className="text-[11px] font-mono text-neutral-300 space-y-1">
                          <p><span className="text-neutral-500">Tipo:</span> TXT</p>
                          <p><span className="text-neutral-500">Nome:</span> _roi-verify.{dom.name}</p>
                          <div className="flex items-center justify-between bg-black/40 p-1.5 rounded border border-white/5 mt-1">
                            <span className="text-purple-300 truncate">roi-verify={dom.verification?.value}</span>
                            <button
                              onClick={() => copyToClipboard(`roi-verify=${dom.verification?.value}`, `${dom.id}-txt`)}
                              className="text-neutral-400 hover:text-white p-1"
                            >
                              {copiedKey === `${dom.id}-txt` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
