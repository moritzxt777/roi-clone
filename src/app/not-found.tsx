import Link from 'next/link';
import { ArrowLeft, Home, Layers } from 'lucide-react';

export default function NotFound() {
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

        {/* 404 Badge & Card */}
        <div className="rounded-3xl border border-white/10 bg-[#0d0e14]/90 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shadow-lg shadow-blue-500/10">
            <span className="text-2xl font-black font-mono">404</span>
          </div>

          <h1 className="text-xl font-bold tracking-tight text-white mb-2">
            Página não encontrada
          </h1>
          <p className="text-xs text-neutral-400 mb-8 leading-relaxed">
            O projeto ou endereço que você tentou acessar não existe, foi removido ou você não possui permissão para visualizá-lo.
          </p>

          <div className="space-y-3">
            <Link
              href="/dashboard"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-semibold text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"
            >
              <Home className="w-4 h-4" />
              <span>Ir para o Dashboard</span>
            </Link>

            <Link
              href="/dashboard/clones"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 px-5 py-3 text-xs font-semibold text-neutral-300 hover:text-white hover:bg-white/10 transition-all"
            >
              <Layers className="w-4 h-4 text-neutral-400" />
              <span>Ver Meus Projetos</span>
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
