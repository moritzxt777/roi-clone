'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function RegisterForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

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
            disabled={isLoading}
          >
            {isLoading ? 'Criando...' : 'Criar Conta'}
          </Button>
        </form>

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