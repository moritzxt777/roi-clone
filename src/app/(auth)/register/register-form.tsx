'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, ArrowRight, CheckCircle2, RotateCcw, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';

export default function RegisterForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isDiscordLoading, setIsDiscordLoading] = useState(false);
  const [error, setError] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [resendMessage, setResendMessage] = useState('');
  const [deliveryInfo, setDeliveryInfo] = useState<{
    sent: boolean;
    error?: string;
    confirmUrl?: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const handleDiscordSignUp = async () => {
    setIsDiscordLoading(true);
    setError('');
    try {
      await signIn('discord', { callbackUrl: '/dashboard' });
    } catch {
      setError('Falha ao conectar com o Discord');
      setIsDiscordLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!registeredEmail) return;
    setIsResending(true);
    setResendStatus('idle');
    setResendMessage('');

    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registeredEmail }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResendStatus('success');
        setResendMessage(data.message || 'Novo link enviado com sucesso!');
        if (data.confirmUrl) {
          setDeliveryInfo(prev => ({ ...(prev || { sent: true }), confirmUrl: data.confirmUrl }));
        }
      } else {
        setResendStatus('error');
        setResendMessage(data.message || data.error || 'Erro ao reenviar.');
        if (data.confirmUrl) {
          setDeliveryInfo(prev => ({ ...(prev || { sent: false }), confirmUrl: data.confirmUrl, error: data.error }));
        }
      }
    } catch {
      setResendStatus('error');
      setResendMessage('Erro de conexão ao tentar reenviar.');
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Senhas não conferem');
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError('Senha deve ter pelo menos 8 caracteres');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Erro ao criar conta');
        return;
      }

      if (data.autoVerified) {
        const loginRes = await signIn('credentials', {
          email: formData.email,
          password: formData.password,
          redirect: false,
        });
        if (loginRes?.ok) {
          window.location.href = '/dashboard';
          return;
        }
      }

      setRegisteredEmail(formData.email);
      setDeliveryInfo({
        sent: data.emailSent ?? true,
        error: data.emailError,
        confirmUrl: data.confirmUrl,
      });
    } catch {
      setError('Erro ao criar conta');
    } finally {
      setIsLoading(false);
    }
  };

  // Se a conta foi criada, exibe a tela exigindo confirmação de e-mail
  if (registeredEmail) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-4 font-sans text-white">
        <div className="w-full max-w-[440px] rounded-3xl border border-white/10 bg-[#0d0f18]/90 p-8 shadow-2xl backdrop-blur-xl text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="mb-6 flex justify-center">
            <img src="/roi-logo.png" alt="ROI Clone" className="h-10 w-auto rounded object-contain" />
          </div>

          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600/15 border border-blue-500/30 text-blue-400">
            <Mail className="h-8 w-8" />
          </div>

          <div className="inline-block px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full mb-3">
            <span className="text-[11px] font-mono font-bold text-blue-400 uppercase tracking-wider">
              Confirmação Necessária
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
            Verifique seu e-mail
          </h1>

          <p className="text-xs text-neutral-400 leading-relaxed mb-3">
            Para ativar sua máquina, enviamos o link de acesso para:
          </p>

          <div className="p-3 bg-white/5 border border-white/10 rounded-xl font-mono text-xs text-blue-400 font-semibold break-all mb-5">
            {registeredEmail}
          </div>

          {deliveryInfo?.sent && (
            <div className="mb-5 p-3 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>E-mail enviado! Acesse sua caixa de entrada e spam.</span>
            </div>
          )}

          {/* Se o envio falhou (por exemplo, conta Resend em modo de teste com e-mail não verificado) */}
          {deliveryInfo && !deliveryInfo.sent && (
            <div className="mb-5 p-4 bg-amber-950/40 border border-amber-500/30 rounded-2xl text-left text-xs space-y-2.5 animate-in fade-in">
              <div className="flex items-center gap-2 font-semibold text-amber-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Aviso de Envio de E-mail</span>
              </div>
              <p className="text-[11px] text-neutral-300 leading-relaxed">
                {deliveryInfo.error || 'O provedor de e-mail (Resend) está em modo restrito de teste.'}
              </p>
              
              {deliveryInfo.confirmUrl && (
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <p className="text-[11px] text-neutral-400">
                    💡 <strong>Ativação direta disponível:</strong> Como este é um teste, você pode ativar a conta e entrar agora clicando abaixo:
                  </p>
                  <a
                    href={deliveryInfo.confirmUrl}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-500 transition-all active:scale-[0.98]"
                  >
                    <span>Confirmar E-mail e Entrar no Painel</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-neutral-400 leading-relaxed mb-6">
            Ao clicar no botão de confirmação dentro do e-mail, sua conta será validada e você entrará <strong>diretamente no Dashboard</strong>!
          </p>

          {resendStatus === 'success' && (
            <div className="mb-4 p-3 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{resendMessage || 'Novo link enviado! Verifique sua caixa de entrada e spam.'}</span>
            </div>
          )}

          {resendStatus === 'error' && (
            <div className="mb-4 p-3 text-xs text-red-400 bg-red-950/40 border border-red-500/30 rounded-xl">
              {resendMessage || 'Erro ao reenviar e-mail. Tente novamente em alguns instantes.'}
            </div>
          )}

          <div className="space-y-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={handleResendEmail}
              disabled={isResending}
              className="w-full h-11 border border-white/10 bg-white/5 text-xs text-white hover:bg-white/10 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isResending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Reenviando link...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Não recebeu? Reenviar e-mail</span>
                </>
              )}
            </Button>

            <Link
              href="/login"
              className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-all"
            >
              <span>Ir para o Login</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="mt-6 text-center text-xs text-neutral-500">
            Digitou o e-mail errado?{' '}
            <button
              onClick={() => {
                setRegisteredEmail('');
                setDeliveryInfo(null);
                setResendStatus('idle');
              }}
              className="text-blue-400 hover:underline cursor-pointer font-medium"
            >
              Cadastrar com outro e-mail
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-4 font-sans text-white">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex justify-center">
          <img src="/roi-logo.png" alt="ROI Clone" className="h-10 w-auto rounded object-contain" />
        </div>
        
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white mb-2">Criar conta</h1>
          <p className="text-sm text-neutral-400">Insira seus dados para começar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-400 bg-red-900/20 border border-red-900/50 rounded-md text-center">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm text-neutral-300">Nome</Label>
            <Input
              id="name"
              placeholder="Seu nome"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              disabled={isLoading}
              className="h-11 bg-transparent border border-white/10 rounded-md text-white placeholder:text-neutral-600 focus:border-white/30 focus:ring-0 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm text-neutral-300">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="exemplo@email.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={isLoading}
              className="h-11 bg-transparent border border-white/10 rounded-md text-white placeholder:text-neutral-600 focus:border-white/30 focus:ring-0 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm text-neutral-300">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              disabled={isLoading}
              className="h-11 bg-transparent border border-white/10 rounded-md text-white placeholder:text-neutral-600 focus:border-white/30 focus:ring-0 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" className="text-sm text-neutral-300">Confirmar Senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
              disabled={isLoading}
              className="h-11 bg-transparent border border-white/10 rounded-md text-white placeholder:text-neutral-600 focus:border-white/30 focus:ring-0 transition-colors"
            />
          </div>

          <Button 
            type="submit" 
            className="w-full h-11 mt-2 rounded-md bg-white text-black font-medium hover:bg-neutral-200 transition-colors cursor-pointer" 
            disabled={isLoading || isDiscordLoading}
          >
            {isLoading ? 'Criando...' : 'Criar Conta'}
          </Button>
        </form>

        {/* Divider */}
        <div className="relative my-5 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative bg-[#0a0a0a] px-3 text-xs uppercase tracking-wider text-neutral-500">
            ou cadastre-se com
          </div>
        </div>

        {/* Discord Register Button */}
        <Button
          type="button"
          onClick={handleDiscordSignUp}
          disabled={isLoading || isDiscordLoading}
          className="w-full h-11 rounded-md bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium text-sm flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer"
        >
          {isDiscordLoading ? (
            'Conectando ao Discord...'
          ) : (
            <>
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              <span>Cadastrar com Discord</span>
            </>
          )}
        </Button>

        <div className="mt-8 text-center text-sm text-neutral-500">
          Já tem conta?{' '}
          <Link href="/login" className="text-white hover:underline">
            Entrar
          </Link>
        </div>
      </div>
    </div>
  );
}