'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { Loader2, CheckCircle2, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    // Redireciona imediatamente se estiver no domínio interno da Vercel
    if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
      window.location.replace(`https://www.roi-clone.site/auth/verify${window.location.search}${window.location.hash}`);
      return;
    }

    async function handleAutoLogin() {
      // 1. Caso com token direto do ROI Clone
      if (token) {
        try {
          const res = await signIn('credentials', {
            token,
            callbackUrl: '/dashboard',
            redirect: false,
          });

          if (!isMounted) return;

          if (res?.ok && !res?.error) {
            setStatus('success');
            // Redireciona imediatamente para o dashboard oficial
            setTimeout(() => {
              window.location.replace('/dashboard');
            }, 800);
          } else {
            setStatus('error');
            setErrorMessage('Este link de confirmação é inválido ou já expirou. Você pode fazer login diretamente com seu e-mail e senha abaixo.');
          }
        } catch {
          if (!isMounted) return;
          setStatus('error');
          setErrorMessage('Erro de conexão ao tentar validar seu acesso.');
        }
        return;
      }

      // Se nenhum token for detectado
      setStatus('error');
      setErrorMessage('Nenhum código de verificação foi encontrado neste link.');
    }

    handleAutoLogin();

    return () => {
      isMounted = false;
    };
  }, [token, router]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#07080b] px-4 font-sans text-white overflow-hidden selection:bg-blue-600/30">
      {/* Background glow effects */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Card Principal */}
      <div className="relative z-10 w-full max-w-[440px] rounded-3xl border border-white/10 bg-[#0c0e17]/90 p-8 shadow-2xl backdrop-blur-2xl text-center">
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <img 
            src="/roi-logo.png" 
            alt="ROI Clone" 
            className="h-11 w-auto rounded-lg object-contain drop-shadow-[0_0_15px_rgba(37,99,235,0.4)]" 
          />
        </div>

        {/* Status: Loading */}
        {status === 'loading' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600/10 border border-blue-500/20">
              <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
            </div>

            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">
                Validando seu acesso...
              </h2>
              <p className="mt-2 text-xs text-neutral-400 leading-relaxed">
                Confirmando seu e-mail e conectando diretamente ao seu painel ROI Clone.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] text-neutral-400 font-mono">
              <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
              <span>Autenticação instantânea sem senha</span>
            </div>
          </div>
        )}

        {/* Status: Success */}
        {status === 'success' && (
          <div className="space-y-5 animate-in zoom-in-95 duration-300">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">
                E-mail confirmado com sucesso!
              </h2>
              <p className="mt-2 text-xs text-neutral-300 leading-relaxed">
                Tudo liberado. Redirecionando direto para o seu Dashboard...
              </p>
            </div>

            <div className="pt-2">
              <a
                href="/dashboard"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-500 transition-all active:scale-[0.98]"
              >
                <span>Acessar Painel Agora</span>
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        )}

        {/* Status: Error */}
        {status === 'error' && (
          <div className="space-y-5 animate-in zoom-in-95 duration-300">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400">
              <AlertCircle className="h-8 w-8" />
            </div>

            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">
                Não foi possível entrar
              </h2>
              <p className="mt-2 text-xs text-neutral-400 leading-relaxed">
                {errorMessage || 'O link de acesso expirou ou é inválido.'}
              </p>
            </div>

            <div className="pt-2 space-y-2">
              <Link
                href="/login"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-xs font-semibold text-black hover:bg-neutral-200 transition-all active:scale-[0.98]"
              >
                <span>Fazer login com e-mail e senha</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              
              <Link
                href="/register"
                className="inline-block text-xs text-neutral-500 hover:text-white transition-colors"
              >
                Criar uma nova conta
              </Link>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="mt-8 border-t border-white/5 pt-4 text-[11px] text-neutral-600">
          ROI CLONE • SISTEMA DE ESCALA BRUTAL
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#07080b] flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
