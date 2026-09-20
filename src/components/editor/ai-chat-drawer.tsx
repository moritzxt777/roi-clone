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
  vibeAction?: any;
  actionExecuted?: string;
  isUndone?: boolean;
}

export function AiChatDrawer() {
  const { 
    isAiChatOpen, 
    setAiChatOpen, 
    projectName, 
    html,
    css,
    selectedElement,
    applyVibeAction,
    undoVibeAction,
    undoSnapshot
  } = useEditorStore();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: `Olá! Sou a **ROI IA**, seu copiloto de **Vibe Coding** e inteligência artificial aberta do ROI Clone. ⚡\n\nVocê é livre para me perguntar qualquer coisa ou me pedir para alterar sua página em tempo real:\n• *"Muda a cor de todos os botões para verde neon com brilho"*\n• *"Adiciona um botão flutuante de WhatsApp no canto da tela"*\n• *"Coloca uma barra de contagem regressiva de 15 minutos no topo"*\n• *"Troca o link de checkout para https://kiwify.com.br/meu-link"*\n• *"Adiciona checkout PIX com QR Code instantâneo"*\n• Ou qualquer pergunta sobre estratégias, código ou marketing!\n\nComo posso te ajudar agora?`,
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
      // Montar histórico para permitir conversas contínuas e multi-turn
      const history = messages.slice(-6).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history,
          projectName,
          selectedElement: selectedElement ? {
            id: selectedElement.id,
            tagName: selectedElement.tagName,
            text: selectedElement.text,
            selector: selectedElement.selector
          } : undefined,
          currentHtml: html?.slice(0, 3000),
        }),
      });

      const data = await res.json();
      let actionExecutedNotice: string | undefined = undefined;

      // Executar Vibe Coding action imediatamente na página com live preview
      if (data.vibeAction) {
        const result = applyVibeAction(data.vibeAction);
        if (result.success) {
          actionExecutedNotice = result.message;
          setNotification(`⚡ Vibe Coding: ${result.message}`);
          setTimeout(() => setNotification(null), 5000);
        }
      }

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: data.reply || 'Alterações aplicadas com sucesso.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        vibeAction: data.vibeAction,
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

  const handleToggleUndo = (msgId: string, action: any, isCurrentlyUndone?: boolean) => {
    if (isCurrentlyUndone) {
      applyVibeAction(action);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isUndone: false, actionExecuted: action.description } : m));
      setNotification('Alteração reaplicada com sucesso!');
    } else {
      undoVibeAction();
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isUndone: true, actionExecuted: 'Alteração desfeita' } : m));
      setNotification('Alteração desfeita com sucesso!');
    }
    setTimeout(() => setNotification(null), 4000);
  };

  const quickActions = [
    { label: '💬 Botão WhatsApp', prompt: 'Adicione um botão flutuante de WhatsApp com animação pulsante no canto inferior direito' },
    { label: '⏱️ Contador Regressivo', prompt: 'Adicione uma barra de aviso com cronômetro regressivo de 15 minutos no topo da página' },
    { label: '🟢 Botões Verde Neon', prompt: 'Mude a cor de todos os botões de compra para verde vibrante com texto em destaque' },
    { label: '⚡ Checkout PIX', prompt: 'Adicione o checkout Pix com QR code e código copia-e-cola em todos os botões de compra' },
    { label: '🔗 Trocar Checkout', prompt: 'Trocar o checkout de todos os botões para https://pay.hotmart.com/meu-checkout' },
    { label: '💡 Dúvida Geral / Estratégia', prompt: 'Como posso melhorar a conversão e o tráfego desta oferta?' },
  ];

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] bg-[#0a0c10] border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 text-white select-none">
      {/* Top Header */}
      <div className="h-14 px-4 border-b border-white/10 flex items-center justify-between bg-[#0e1017] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white shadow-md">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-white tracking-tight">ROI IA Vibe Copilot</h3>
              <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Vibe Coding Ativo
              </span>
            </div>
            <p className="text-[10px] text-neutral-400">Altere o site em tempo real & Tire dúvidas</p>
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
        <div className="bg-emerald-500/15 border-b border-emerald-500/25 px-4 py-2 text-xs text-emerald-300 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            <span>{notification}</span>
          </div>
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
                className={`max-w-[92%] rounded-2xl p-3.5 leading-relaxed ${
                  isUser
                    ? 'bg-blue-600 text-white rounded-br-sm shadow-md'
                    : 'bg-[#12141c] border border-white/10 text-neutral-200 rounded-bl-sm shadow-inner'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.text}</div>

                {/* Card de Ação Vibe Coding */}
                {m.vibeAction && (
                  <div className="mt-3 p-2.5 rounded-xl bg-[#090b10] border border-emerald-500/30 text-[11px] space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                        <Zap className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                        <span>Vibe Coding Aplicado</span>
                      </div>
                      <span className="text-[10px] text-neutral-500 uppercase font-mono">
                        {m.vibeAction.type}
                      </span>
                    </div>

                    <p className="text-neutral-300 text-[11px] leading-snug">
                      {m.vibeAction.description || 'Modificação estrutural realizada no site.'}
                    </p>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleToggleUndo(m.id, m.vibeAction, m.isUndone)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
                          m.isUndone
                            ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-600/30'
                            : 'bg-white/5 text-neutral-300 border-white/10 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30'
                        }`}
                      >
                        {m.isUndone ? '↺ Reaplicar Alteração' : '↺ Desfazer Alteração'}
                      </button>
                    </div>
                  </div>
                )}

                {m.actionExecuted && !m.vibeAction && (
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
            <span className="text-[11px]">ROI IA está criando o código e aplicando...</span>
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
            placeholder="Peça qualquer alteração no site ou faça uma pergunta..."
            className="flex-1 bg-[#151722] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || loading}
            className="p-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white disabled:opacity-40 transition-all shadow-md shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-[10px] text-neutral-500 mt-2 text-center">
          Vibe Coding: altere botões, cores, adicione WhatsApp, cronômetros ou tire dúvidas.
        </p>
      </div>
    </div>
  );
}
