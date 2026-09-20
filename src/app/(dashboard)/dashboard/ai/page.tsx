'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Copy, 
  Check, 
  Zap, 
  Lightbulb, 
  Code, 
  TrendingUp, 
  ShoppingBag,
  RotateCcw
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export default function AiStudioPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Olá! Sou a **ROI IA**, sua inteligência artificial oficial e assistente de **Vibe Coding**. ⚡\n\nEstou com capacidade **100% aberta e sem limitações**: você pode me fazer qualquer pergunta sobre código, estratégias de tráfego, copywriting, funis de alta conversão, e-commerce, dropshipping, ou me pedir ideias de alterações para suas páginas.\n\nComo posso acelerar seus resultados hoje?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (queryText?: string) => {
    const text = (queryText || input).trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history,
          projectName: 'ROI Studio Hub',
        }),
      });

      const data = await res.json();
      const aiReply = data.reply || 'Desculpe, ocorreu uma instabilidade momentânea.';

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: aiReply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Houve uma falha na conexão com o servidor da ROI IA. Tente novamente em instantes.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        content: `Histórico reiniciado! Em que posso ajudar você agora? Faça qualquer pergunta livremente. 🚀`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const suggestedPrompts = [
    {
      icon: TrendingUp,
      title: 'Estratégia de Conversão',
      desc: 'Como aumentar a taxa de conversão da minha página clonada?',
      prompt: 'Quais são os 5 elementos mais críticos que fazem uma página de vendas converter o dobro de clientes no Brasil?',
    },
    {
      icon: Lightbulb,
      title: 'Copywriting & Headlines',
      desc: 'Gere 5 variações persuasivas de headline para oferta',
      prompt: 'Crie 5 variações de headlines magnéticas de alta conversão usando gatilhos de urgência, novidade e prova social.',
    },
    {
      icon: Zap,
      title: 'Dicas de Vibe Coding',
      desc: 'Como instruir a IA para alterar o site pelo chat',
      prompt: 'Como posso usar comandos de Vibe Coding no editor do ROI Clone para alterar botões, cores e colocar cronômetros?',
    },
    {
      icon: Code,
      title: 'Scripts & Rastreamento',
      desc: 'Como adicionar scripts personalizados na página',
      prompt: 'Me dê um script simples de contagem regressiva em JavaScript puro para colocar em uma página de vendas.',
    },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight">ROI IA Copilot Studio</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Livre & Ilimitada
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Converse com a inteligência artificial oficial do ROI Clone sem restrições de assunto.
            </p>
          </div>
        </div>

        <button
          onClick={handleClearHistory}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-neutral-400 hover:text-white transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Limpar Chat</span>
        </button>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto py-6 space-y-4 pr-1">
        {messages.length === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {suggestedPrompts.map((sp, idx) => {
              const Icon = sp.icon;
              return (
                <button
                  key={idx}
                  onClick={() => handleSend(sp.prompt)}
                  className="p-3.5 rounded-2xl bg-white/[0.02] hover:bg-blue-600/10 border border-white/5 hover:border-blue-500/30 text-left transition-all group"
                >
                  <div className="flex items-center gap-2 text-blue-400 mb-1">
                    <Icon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-semibold text-white">{sp.title}</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 line-clamp-2">{sp.desc}</p>
                </button>
              );
            })}
          </div>
        )}

        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={m.id}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  isUser
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#141724] border border-white/10 text-blue-400 shadow-md'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div className="flex flex-col space-y-1 max-w-[85%]">
                <div
                  className={`relative group rounded-2xl p-4 text-xs leading-relaxed ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-tr-sm shadow-md'
                      : 'bg-[#0f111a] border border-white/10 text-neutral-200 rounded-tl-sm shadow-inner'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.content}</div>

                  {!isUser && (
                    <button
                      onClick={() => copyToClipboard(m.id, m.content)}
                      className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                      title="Copiar texto"
                    >
                      {copiedId === m.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
                <span
                  className={`text-[9px] text-neutral-500 px-1 ${
                    isUser ? 'text-right' : 'text-left'
                  }`}
                >
                  {m.timestamp}
                </span>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#141724] border border-white/10 text-blue-400 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-3.5 bg-[#0f111a] rounded-2xl rounded-tl-sm border border-white/10 flex items-center gap-2 text-xs text-neutral-400">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              <span>ROI IA está formulando a resposta...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="pt-3 border-t border-white/10 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Faça qualquer pergunta sobre código, marketing, estratégias, tráfego ou alterações..."
              className="w-full bg-[#121520] border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 transition-colors pr-10 shadow-inner"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs disabled:opacity-40 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20 shrink-0"
          >
            <span>Enviar</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
        <p className="text-[10px] text-neutral-500 mt-2 text-center">
          Potencializado por NVIDIA NIM com motor de raciocínio. Totalmente integrado ao ecossistema do ROI Clone.
        </p>
      </div>
    </div>
  );
}
