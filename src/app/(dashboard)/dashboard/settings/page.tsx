'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { 
  User, 
  Mail, 
  Shield, 
  Sparkles, 
  Save, 
  Check, 
  Loader2, 
  Globe, 
  Code2, 
  Lock,
  Key,
  LogOut,
  Bell
} from 'lucide-react';

export default function SettingsDashboardPage() {
  const { data: session, update } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  
  // Pixels e Configurações Globais
  const [metaPixelId, setMetaPixelId] = useState('');
  const [googleTagId, setGoogleTagId] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingIntegrations, setSavingIntegrations] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name || '');
      setEmail(session.user.email || '');
    }

    // Carregar preferências locais/globais se existirem
    const savedMeta = localStorage.getItem('roiclone_meta_pixel');
    const savedGtm = localStorage.getItem('roiclone_google_tag');
    const savedWebhook = localStorage.getItem('roiclone_webhook_url');
    if (savedMeta) setMetaPixelId(savedMeta);
    if (savedGtm) setGoogleTagId(savedGtm);
    if (savedWebhook) setWebhookUrl(savedWebhook);
  }, [session]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (res.ok) {
        await update({ name });
        setStatusMessage({ text: 'Perfil atualizado com sucesso!', type: 'success' });
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao atualizar perfil');
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message, type: 'error' });
    } finally {
      setSavingProfile(false);
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  const handleSaveIntegrations = (e: React.FormEvent) => {
    e.preventDefault();
    setSavingIntegrations(true);

    try {
      localStorage.setItem('roiclone_meta_pixel', metaPixelId.trim());
      localStorage.setItem('roiclone_google_tag', googleTagId.trim());
      localStorage.setItem('roiclone_webhook_url', webhookUrl.trim());
      setStatusMessage({ text: 'Integrações e Pixels globais salvos!', type: 'success' });
    } catch (err) {
      setStatusMessage({ text: 'Erro ao salvar preferências locais.', type: 'error' });
    } finally {
      setSavingIntegrations(false);
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#07080b] text-white p-6 lg:p-10 selection:bg-blue-600/30">
      {/* Background Glow */}
      <div 
        className="absolute inset-x-0 top-0 h-[380px] bg-cover bg-top bg-no-repeat opacity-20 pointer-events-none"
        style={{ backgroundImage: 'url(/bg-dashboard.jpg)' }}
      />

      <div className="relative z-10 max-w-4xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="border-b border-white/10 pb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 rounded bg-blue-500/10 text-blue-400 text-xs border border-blue-500/20 font-mono font-medium">
              PREFERÊNCIAS & SISTEMA
            </span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
            Configurações da Conta
          </h1>
          <p className="text-xs lg:text-sm text-neutral-400 mt-1">
            Gerencie seus dados de acesso, pixels globais e preferências da plataforma.
          </p>
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div
            className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2 border animate-in fade-in duration-200 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Perfil & Informações Pessoais */}
        <div className="rounded-2xl border border-white/10 bg-[#0d0e14] p-6 shadow-xl">
          <div className="flex items-center gap-3 pb-5 border-b border-white/10 mb-6">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Perfil do Usuário</h2>
              <p className="text-xs text-neutral-400">Suas credenciais e informações de exibição na plataforma.</p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4 max-w-lg">
            <div>
              <label className="text-xs font-medium text-neutral-300 block mb-1.5">
                Nome Completo
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#151722] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-300 block mb-1.5">
                E-mail (Login)
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#151722]/50 border border-white/5 rounded-xl text-xs text-neutral-400 cursor-not-allowed"
                />
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">O e-mail é utilizado para login e notificações da conta.</p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 shadow-md shadow-blue-500/20"
              >
                {savingProfile ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Salvar Alterações</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Pixels & Rastreamento Global */}
        <div className="rounded-2xl border border-white/10 bg-[#0d0e14] p-6 shadow-xl">
          <div className="flex items-center gap-3 pb-5 border-b border-white/10 mb-6">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Pixels & Scripts Globais</h2>
              <p className="text-xs text-neutral-400">
                Configure seus IDs de rastreamento para aplicar automaticamente em novos clones.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveIntegrations} className="space-y-4 max-w-lg">
            <div>
              <label className="text-xs font-medium text-neutral-300 block mb-1.5">
                Meta Pixel ID Padrão (Facebook / Instagram)
              </label>
              <input
                type="text"
                placeholder="Ex: 123456789012345"
                value={metaPixelId}
                onChange={(e) => setMetaPixelId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#151722] border border-white/10 rounded-xl text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-300 block mb-1.5">
                Google Tag / Analytics (GTM / GA4 ID)
              </label>
              <input
                type="text"
                placeholder="Ex: G-XXXXXXXXXX ou GTM-XXXXXX"
                value={googleTagId}
                onChange={(e) => setGoogleTagId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#151722] border border-white/10 rounded-xl text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-300 block mb-1.5">
                Webhook de Notificação de Leads
              </label>
              <input
                type="url"
                placeholder="https://sua-api.com/webhook/leads"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#151722] border border-white/10 rounded-xl text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 font-mono"
              />
              <p className="text-[11px] text-neutral-500 mt-1">
                Dispara um POST automático sempre que um novo formulário for enviado em qualquer página.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingIntegrations}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-semibold transition-colors disabled:opacity-50 shadow-md"
              >
                {savingIntegrations ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Salvar Pixels & Integrações</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Domínios Customizados Quick Access */}
        <div className="rounded-2xl border border-white/10 bg-[#0d0e14] p-6 shadow-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Domínios Customizados</h2>
              <p className="text-xs text-neutral-400">Conecte seus próprios domínios via CNAME e TXT para publicar na raiz.</p>
            </div>
          </div>

          <a
            href="/dashboard/domains"
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors border border-white/10"
          >
            Gerenciar Domínios
          </a>
        </div>
      </div>
    </div>
  );
}
