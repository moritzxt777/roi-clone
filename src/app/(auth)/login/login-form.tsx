'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, Loader2, Sparkles } from 'lucide-react';

interface LoginFormProps {
  callbackUrl: string;
}

export default function LoginForm({ callbackUrl }: LoginFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ email: '', password: '' });

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
        setError('Email ou senha inválidos');
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError('Erro ao fazer login');
    } finally {
      setIsLoading(false);
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-xs text-red-400 bg-red-950/40 border border-red-500/30 rounded-xl text-center">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium text-neutral-300">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@roiclone.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={isLoading}
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
              disabled={isLoading}
              className="h-11 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white placeholder:text-neutral-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>

          <Button 
            type="submit" 
            className="w-full h-11 mt-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all active:scale-[0.98]" 
            disabled={isLoading}
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