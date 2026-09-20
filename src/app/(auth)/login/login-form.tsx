'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';

interface LoginFormProps {
  callbackUrl: string;
}

function DiscordIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

export default function LoginForm({ callbackUrl }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');
  const isRegistered = searchParams.get('registered') === 'true';

  const [isLoading, setIsLoading] = useState(false);
  const [isDiscordLoading, setIsDiscordLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ email: '', password: '' });

  const getOAuthErrorMessage = (err: string | null) => {
    if (!err) return '';
    switch (err) {
      case 'OAuthAccountNotLinked':
        return 'Email já associado a outro método. Conecte-se com sua senha.';
      case 'OAuthCallback':
      case 'OAuthCallbackError':
        return 'Falha ao autenticar com o Discord. Tente novamente.';
      case 'OAuthSignin':
        return 'Não foi possível iniciar a autenticação com o Discord.';
      case 'AccessDenied':
        return 'Acesso negado no Discord.';
      case 'Configuration':
        return 'Configuração do Discord OAuth pendente no servidor.';
      default:
        return 'Ocorreu um erro na autenticação.';
    }
  };

  const activeError = error || getOAuthErrorMessage(urlError);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        // Verifica se a conta está pendente de confirmação
        try {
          const checkRes = await fetch(`/api/auth/check-status?email=${encodeURIComponent(formData.email)}`);
          const checkData = await checkRes.json();
          if (checkData.exists && checkData.unverified) {
            setError('⚠️ Conta pendente de validação: Acesse seu e-mail e clique no botão de confirmação para liberar seu acesso.');
            return;
          }
        } catch {}

        setError('Email ou senha inválidos');
      } else {
        const isMaster = formData.email.toLowerCase() === 'moritzadmin777roi@gmail.com';
        const targetUrl = (callbackUrl && callbackUrl !== '/dashboard') 
          ? callbackUrl 
          : (isMaster ? '/moritzadmin171roi' : '/dashboard');
        router.push(targetUrl);
        router.refresh();
      }
    } catch {
      setError('Erro ao fazer login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDiscordSignIn = async () => {
    setIsDiscordLoading(true);
    setError('');
    try {
      await signIn('discord', { callbackUrl });
    } catch {
      setError('Falha ao conectar com o Discord');
      setIsDiscordLoading(false);
    }
  };

  return (
    <div 
      className="relative flex min-h-screen items-center justify-center bg-cover bg-center bg-no-repeat px-4 font-sans text-white overflow-hidden"
      style={{ backgroundImage: 'url(/bg-login.jpg)' }}
    >
      {/* Dark overlay with subtle blue ambient gradient */}
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[6px]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />

      {/* Glassmorphism Card */}
      <div className="relative z-10 w-full max-w-[420px] rounded-3xl border border-white/10 bg-[#090b11]/85 p-8 shadow-2xl backdrop-blur-2xl shadow-blue-500/10 animate-in fade-in zoom-in-95 duration-200">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex items-center justify-center">
            <img 
              src="/roi-logo.png" 
              alt="ROI Clone" 
              className="h-11 w-auto rounded-lg object-contain drop-shadow-[0_0_15px_rgba(37,99,235,0.4)]" 
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Acessar Plataforma
          </h1>
          <p className="mt-1 text-xs text-neutral-400">
            Entre com suas credenciais para gerenciar seus clones
          </p>
        </div>

        {isRegistered && !activeError && (
          <div className="mb-4 p-3 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-center justify-center gap-2 text-center">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Conta criada com sucesso! Faça login para continuar.</span>
          </div>
        )}

        {activeError && (
          <div className="mb-4 p-3 text-xs text-red-400 bg-red-950/40 border border-red-500/30 rounded-xl text-center">
            {activeError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium text-neutral-300">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="seuemail@exemplo.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={isLoading || isDiscordLoading}
              className="h-11 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white placeholder:text-neutral-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs font-medium text-neutral-300">
                Senha
              </Label>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              disabled={isLoading || isDiscordLoading}
              className="h-11 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white placeholder:text-neutral-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>

          <Button 
            type="submit" 
            className="w-full h-11 mt-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all active:scale-[0.98]" 
            disabled={isLoading || isDiscordLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Autenticando...</span>
              </>
            ) : (
              <>
                <span>Entrar no Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </form>

        {/* Divider */}
        <div className="relative my-4 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative bg-[#090b11] px-3 text-[10px] uppercase tracking-wider text-neutral-500">
            ou continue com
          </div>
        </div>

        {/* Discord Login Button */}
        <Button
          type="button"
          onClick={handleDiscordSignIn}
          disabled={isLoading || isDiscordLoading}
          className="w-full h-11 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold text-xs flex items-center justify-center gap-2.5 shadow-lg shadow-[#5865F2]/20 transition-all active:scale-[0.98]"
        >
          {isDiscordLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Conectando ao Discord...</span>
            </>
          ) : (
            <>
              <DiscordIcon className="w-4 h-4" />
              <span>Entrar com Discord</span>
            </>
          )}
        </Button>

        <div className="mt-6 text-center text-xs text-neutral-500">
          Não possui uma conta?{' '}
          <Link href="/register" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
            Criar conta gratuita
          </Link>
        </div>
      </div>
    </div>
  );
}