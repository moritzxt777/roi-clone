'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error for diagnostics
    console.error('App runtime error caught by boundary:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#07080b] flex flex-col items-center justify-center px-4 font-sans text-white selection:bg-blue-600/30">
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <img 
              src="/roi-logo.png" 
              alt="ROI Clone" 
              className="h-10 w-auto rounded object-contain transition-transform group-hover:scale-105" 
            />
          </Link>
        </div>

        {/* Error Card */}
        <div className="rounded-3xl border border-white/10 bg-[#0d0e14]/90 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-lg shadow-amber-500/10">
            <AlertTriangle className="h-8 w-8" />
          </div>

          <h1 className="text-xl font-bold tracking-tight text-white mb-2">
            Algo não carregou corretamente
          </h1>
          <p className="text-xs text-neutral-400 mb-8 leading-relaxed">
            Houve uma instabilidade temporária ao carregar estas informações. Você pode tentar recarregar ou retornar ao painel principal com segurança.
          </p>

          <div className="space-y-3">
            <button
              onClick={() => reset()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-semibold text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Tentar Novamente</span>
            </button>

            <Link
              href="/dashboard"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 px-5 py-3 text-xs font-semibold text-neutral-300 hover:text-white hover:bg-white/10 transition-all"
            >
              <Home className="w-4 h-4 text-neutral-400" />
              <span>Voltar ao Dashboard</span>
            </Link>
          </div>
        </div>

        <p className="mt-8 text-[11px] text-neutral-600">
          ROI Clone — Plataforma de Clonagem e Edição Visual de Páginas
        </p>
      </div>
    </div>
  );
}
