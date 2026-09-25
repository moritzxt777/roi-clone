'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function CloneProgressPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Iniciando clonagem...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    let isSubscribed = true;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/clone/${id}/status`);
        if (!res.ok) {
          throw new Error('Erro ao buscar status');
        }
        
        const data = await res.json();
        if (!isSubscribed) return;
        
        setProgress(data.progress || 0);
        
        const statusMap: Record<string, string> = {
          PENDING: 'Na fila de processamento...',
          FETCHING: 'Acessando página e baixando conteúdo...',
          ANALYZING: 'Analisando estrutura e estilos da página...',
          RECONSTRUCTING: 'Gerando elementos visuais e preparando editor...',
          COMPLETED: 'Clonagem concluída com sucesso!',
          FAILED: 'Erro na clonagem',
        };
        
        setStatus(statusMap[data.status] || data.status);
        
        if (data.status === 'FAILED') {
          setError(data.error || 'Não foi possível acessar a página. Verifique a URL e tente novamente.');
          clearInterval(interval);
        }
        
        if (data.status === 'COMPLETED') {
          setProgress(100);
          setStatus('Clonagem concluída com sucesso!');
          clearInterval(interval);
          setTimeout(() => {
            window.location.href = `/dashboard/projeto/${id}`;
          }, 1200);
        }
      } catch (err) {
        console.error(err);
      }
    }, 1200);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [id, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#07080b] px-6 text-white selection:bg-blue-600/30">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0d0e14]/80 p-8 shadow-2xl backdrop-blur-xl text-center">
        {error ? (
          <div className="space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
              <AlertCircle className="h-8 w-8" />
            </div>
            <h1 className="text-xl font-bold text-white">Falha na clonagem</h1>
            <p className="text-xs text-neutral-400 leading-relaxed">{error}</p>
            <button 
              onClick={() => router.push('/dashboard')}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-xs font-semibold text-white hover:bg-white/20 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao Início
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shadow-lg shadow-blue-500/10">
              {progress >= 100 ? (
                <CheckCircle2 className="h-8 w-8 text-emerald-400 animate-in zoom-in-75 duration-200" />
              ) : (
                <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
              )}
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold tracking-tight text-white">
                {progress >= 100 ? 'Pronto para editar!' : 'Clonando Página'}
              </h1>
              <p className="text-xs text-neutral-400">
                {progress >= 100 
                  ? 'Todos os elementos, estilos e mídias foram processados com sucesso.'
                  : 'Nosso motor inteligente está baixando elementos, estilos e imagens.'}
              </p>
            </div>
            
            <div className="space-y-2 pt-2">
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                <div 
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 to-emerald-400 transition-all duration-500 ease-out rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              
              <div className="flex justify-between items-center text-xs pt-1 font-medium">
                <span className="text-neutral-400 truncate max-w-[240px] text-left">{status}</span>
                <span className="font-mono text-blue-400 shrink-0">{progress}%</span>
              </div>
            </div>

            {progress >= 100 && (
              <button
                onClick={() => { window.location.href = `/dashboard/projeto/${id}`; }}
                className="w-full mt-4 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
              >
                Abrir no Editor Visual →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
