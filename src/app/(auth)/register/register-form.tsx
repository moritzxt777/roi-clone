'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function RegisterForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isDiscordLoading, setIsDiscordLoading] = useState(false);
  const [error, setError] = useState('');
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

      router.push('/login?registered=true');
    } catch {
      setError('Erro ao criar conta');
    } finally {
      setIsLoading(false);
    }
  };

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
            className="w-full h-11 mt-2 rounded-md bg-white text-black font-medium hover:bg-neutral-200 transition-colors" 
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
          className="w-full h-11 rounded-md bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium text-sm flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
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