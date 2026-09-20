'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Redireciona mantendo query params e hash para a página de verificação
    const query = searchParams.toString();
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const destination = `/auth/verify${query ? `?${query}` : ''}${hash}`;
    window.location.href = destination;
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-[#07080b] flex flex-col items-center justify-center text-white">
      <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-4" />
      <p className="text-xs text-neutral-400">Processando confirmação...</p>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#07080b] flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
