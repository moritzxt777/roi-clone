'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global application error caught:', error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="bg-[#07080b] text-white min-h-screen flex items-center justify-center p-4 font-sans antialiased">
        <div className="w-full max-w-md text-center p-8 rounded-3xl border border-white/10 bg-[#0d0e14] shadow-2xl">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-white mb-2">Ops! Algo deu errado</h1>
          <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
            Não foi possível carregar o sistema neste momento. Por favor, clique abaixo para tentar novamente.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => reset()}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              Tentar novamente
            </button>
            <button
              onClick={() => { window.location.href = '/dashboard'; }}
              className="w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 text-neutral-300 rounded-xl text-xs font-semibold transition-colors border border-white/10"
            >
              Ir para o Início
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
