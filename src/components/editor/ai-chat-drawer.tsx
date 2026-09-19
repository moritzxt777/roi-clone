'use client';

import { useState, useRef, useEffect } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { 
  Sparkles, 
  X, 
  Send, 
  Check, 
  Loader2, 
  Bot,
  Zap
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  actionExecuted?: string;
}

export function AiChatDrawer() {
  const { 
    isAiChatOpen, 
    setAiChatOpen, 
    projectName, 
    injectPixModal, 
    replaceCheckoutLinks,
    html
  } = useEditorStore();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: `Olá! Sou a **ROI IA**, a inteligência artificial oficial do ROI Clone. ⚡\n\nPosso ajustar seu site em tempo real:\n1. **Adicionar Checkout PIX** com QR Code e Copia-e-Cola automático\n2. **Trocar o link de checkout** de todos os botões da página\n3. **Melhorar a copy, headlines e gatilhos** para você vender mais\n\nComo posso ajustar sua página agora?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAiChatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isAiChatOpen]);

  if (!isAiChatOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          projectName,
          currentHtml: html?.slice(0, 10000),
        }),
      });

      const data = await res.json();
      let actionExecutedNotice: string | undefined = undefined;

      // Executar ações diretamente na página
      if (data.action === 'INJECT_PIX') {
        const result = injectPixModal({
          pixKey: data.actionData?.pixKey || 'suachave@email.com',
          price: data.actionData?.price || 'R$ 97,00',
          recipientName: data.actionData?.recipientName || projectName || 'Recebedor Oficial',
        });
        actionExecutedNotice = `❖ Modal Pix injetado e ${result.buttonsUpdated} botões vinculados!`;
        setNotification('Checkout PIX ativado com sucesso!');
        setTimeout(() => setNotification(null), 4000);
      } else if (data.action === 'REPLACE_CHECKOUT') {
        const count = replaceCheckoutLinks(data.actionData?.url || '');
        actionExecutedNotice = `🔗 ${count} botões/links de checkout atualizados!`;
        setNotification(`${count} links de checkout substituídos!`);
        setTimeout(() => setNotification(null), 4000);
      }

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: data.reply || 'Alterações aplicadas com sucesso.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionExecuted: actionExecutedNotice,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: 'Houve uma oscilação na conexão com a ROI IA. Tente novamente em alguns segundos.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { label: '❖ Colocar Checkout PIX', prompt: 'Coloca a API Pix com QR code no site e vincula a todos os botões de compra' },
    { label: '🔗 Trocar Link de Checkout', prompt: 'Trocar o checkout de todos os botões da página para https://pay.hotmart.com/exemplo' },
    { label: '🔥 Otimizar Copy & Headlines', prompt: 'Analise a copy desta página e sugira melhorias para aumentar a conversão de vendas' },
  ];

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-[#0a0c10] border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 text-white select-none">
      {/* Top Header */}
      <div className="h-14 px-4 border-b border-white/10 flex items-center justify-between bg-[#0e1017] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-white tracking-tight">ROI IA Copilot</h3>
              <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Ativa
              </span>
            </div>
            <p className="text-[10px] text-neutral-400">Inteligência Artificial do ROI Clone</p>
          </div>
        </div>

        <button
          onClick={() => setAiChatOpen(false)}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Floating Action Notification */}
      {notification && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2 text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
          <Check className="w-3.5 h-3.5 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Quick Action Chips */}
      <div className="p-2.5 border-b border-white/5 bg-[#090b0e] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        {quickActions.map((qa, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(qa.prompt)}
            className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-blue-600/20 hover:border-blue-500/30 border border-white/10 text-[11px] text-neutral-300 hover:text-white transition-all whitespace-nowrap shrink-0"
          >
            {qa.label}
          </button>
        ))}
      </div>

      {/* Chat Messages Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
        {messages.map((m) => {
          const isUser = m.sender === 'user';
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl p-3.5 leading-relaxed ${
                  isUser
                    ? 'bg-blue-600 text-white rounded-br-sm shadow-md'
                    : 'bg-[#12141c] border border-white/10 text-neutral-200 rounded-bl-sm shadow-inner'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.text}</div>

                {m.actionExecuted && (
                  <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>{m.actionExecuted}</span>
                  </div>
                )}
              </div>
              <span className="text-[9px] text-neutral-500 mt-1 px-1">
                {m.timestamp}
              </span>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 p-3 bg-[#12141c] rounded-2xl border border-white/10 text-neutral-400 w-fit">
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            <span className="text-[11px]">ROI IA está analisando e aplicando...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input Bar */}
      <div className="p-3 border-t border-white/10 bg-[#0e1017] shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ex: coloca o pix com chave meupix@email.com..."
            className="flex-1 bg-[#151722] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || loading}
            className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:hover:bg-blue-600 transition-all shadow-md shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-[10px] text-neutral-500 mt-2 text-center">
          Dica: Peça para trocar checkout, injetar Pix ou reescrever textos da página.
        </p>
      </div>
    </div>
  );
}
