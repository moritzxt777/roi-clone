'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function HomePage() {
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hash.includes('access_token') || window.location.search.includes('token=')) {
        window.location.href = `/auth/verify${window.location.search}${window.location.hash}`;
      }
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-8">
        <div className="flex items-center gap-3">
          <img src="/roi-logo.png" alt="ROI Clone" className="h-10 w-auto rounded bg-black object-contain" />
          <span className="text-2xl font-semibold tracking-tight text-white">ROI Clone</span>
        </div>
        
        <Link href="/login">
          <Button variant="secondary" className="px-8 h-11 bg-white text-black hover:bg-neutral-200 transition-colors">
            Entrar no Painel
          </Button>
        </Link>
      </div>
    </div>
  );
}