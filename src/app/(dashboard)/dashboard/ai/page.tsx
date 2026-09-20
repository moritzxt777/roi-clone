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
  Code2, 
  RotateCcw,
  Eye,
  Laptop,
  Tablet,
  Smartphone,
  Save,
  ExternalLink,
  RefreshCw,
  Undo2,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers
} from 'lucide-react';

interface PageItem {
  id: string;
  name: string;
  slug: string;
  sourceUrl?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  vibeAction?: any;
  actionNotice?: string;
}

interface VibeHistoryItem {
  id: string;
  description: string;
  timestamp: string;
  snapshotHtml: string;
  snapshotCss: string;
}

export default function AiStudioVibePage() {
  // Estado dos projetos
  const [pages, setPages] = useState<PageItem[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>('');
  const [pageLoading, setPageLoading] = useState(true);

  // Estado do código do projeto ativo
  const [projectName, setProjectName] = useState('Projeto');
  const [pageSlug, setPageSlug] = useState('');
  const [html, setHtml] = useState<string>('');
  const [css, setCss] = useState<string>('');
  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Estado do workspace (VS Code da ROI)
  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'history'>('preview');
  const [codeFile, setCodeFile] = useState<'html' | 'css'>('html');
  const [deviceView, setDeviceView] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [previewKey, setPreviewKey] = useState(1);
  const [justModifiedAlert, setJustModifiedAlert] = useState<string | null>(null);

  // Estado do Chat da IA
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Olá! Sou a **ROI IA**, seu copiloto de **Vibe Coding** do ROI Clone. ⚡\n\nEu sou um editor de código inteligente e posso **alterar diretamente a sua página ao vivo**! Basta me pedir em linguagem natural:\n• *"Cria um checkout para esse site com PIX e Cartão"*\n• *"Muda a cor de todos os botões para verde neon"*\n• *"Adiciona uma barra de contagem regressiva de 15 minutos no topo"*\n• *"Coloca um botão flutuante de WhatsApp no canto da tela"*\n\nQual alteração você quer fazer na página agora?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [vibeHistory, setVibeHistory] = useState<VibeHistoryItem[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Carregar lista de páginas do usuário
  useEffect(() => {
    async function fetchPages() {
      try {
        setPageLoading(true);
        const res = await fetch('/api/pages');
        if (res.ok) {
          const data: PageItem[] = await res.json();
          setPages(data);
          if (data.length > 0) {
            setSelectedPageId(data[0].id);
          }
        }
      } catch (err) {
        console.error('Falha ao carregar páginas:', err);
      } finally {
        setPageLoading(false);
      }
    }
    fetchPages();
  }, []);

  // Carregar dados da página selecionada
  useEffect(() => {
    if (!selectedPageId) return;

    async function loadPageDetails() {
      try {
        const res = await fetch(`/api/pages/${selectedPageId}`);
        if (res.ok) {
          const pageData = await res.json();
          setHtml(pageData.html || '');
          setCss(pageData.css || '');
          setProjectName(pageData.name || 'Projeto');
          setPageSlug(pageData.slug || '');
          setSourceUrl(pageData.sourceUrl || '');
          setHasUnsavedChanges(false);
          setPreviewKey((prev) => prev + 1);
        }
      } catch (err) {
        console.error('Erro ao carregar detalhes da página:', err);
      }
    }

    loadPageDetails();
  }, [selectedPageId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, aiLoading]);

  // Salvar alterações permanentemente no banco de dados
  const handleSavePage = async () => {
    if (!selectedPageId || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/pages/${selectedPageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html,
          css,
        }),
      });

      if (res.ok) {
        setHasUnsavedChanges(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Erro ao salvar página:', err);
    } finally {
      setSaving(false);
    }
  };

  // Execução de Vibe Coding no DOM em tempo real
  const executeVibeAction = (action: any): { success: boolean; message: string } => {
    if (!html) return { success: false, message: 'Página sem conteúdo HTML carregado' };

    // Salva no histórico para desfazer
    const historyItem: VibeHistoryItem = {
      id: Date.now().toString(),
      description: action.description || 'Modificação via Vibe Coding',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      snapshotHtml: html,
      snapshotCss: css,
    };
    setVibeHistory((prev) => [historyItem, ...prev]);

    try {
      // 1. Injeção de CSS
      if (action.type === 'INJECT_CSS' && action.css) {
        const newCss = `${css}\n/* ROI IA Vibe Coding */\n${action.css}`;
        setCss(newCss);
        setHasUnsavedChanges(true);
        return { success: true, message: action.description || 'Estilo visual aplicado!' };
      }

      // 2. Manipulação do DOM
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // 2.1 Injeção de HTML
      if (action.type === 'INJECT_HTML' && action.html) {
        const tempDiv = doc.createElement('div');
        tempDiv.innerHTML = action.html;
        const nodes = Array.from(tempDiv.childNodes);

        if (action.position === 'head') {
          nodes.forEach((n) => doc.head.appendChild(n));
        } else if (action.position === 'body_start') {
          nodes.reverse().forEach((n) => doc.body.insertBefore(n, doc.body.firstChild));
        } else {
          // body_end por padrão
          nodes.forEach((n) => doc.body.appendChild(n));
        }
      }

      // 2.2 Substituição de Checkout
      if (action.type === 'REPLACE_CHECKOUT' && action.checkoutUrl) {
        const buyKeywords = ['comprar', 'adquirir', 'checkout', 'pay', 'garantir', 'oferta', 'vendas'];
        doc.querySelectorAll('a').forEach((link) => {
          const href = (link.getAttribute('href') || '').toLowerCase();
          const text = (link.textContent || '').toLowerCase();
          if (buyKeywords.some((k) => href.includes(k) || text.includes(k))) {
            link.setAttribute('href', action.checkoutUrl);
            link.setAttribute('target', '_blank');
          }
        });
      }

      // 2.3 Substituição de Texto
      if (action.type === 'REPLACE_TEXT' && action.replaceText) {
        const { find, replace } = action.replaceText;
        if (find) {
          const regex = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          doc.body.innerHTML = doc.body.innerHTML.replace(regex, replace);
        }
      }

      // 2.4 Mutação de estilos em seletor
      if (action.type === 'DOM_MUTATION' && action.selector) {
        doc.querySelectorAll(action.selector).forEach((el) => {
          if (action.styles) {
            Object.entries(action.styles).forEach(([k, v]) => {
              (el as HTMLElement).style.setProperty(k, v as string, 'important');
            });
          }
        });
      }

      let newCss = css;
      if (action.css) {
        newCss = `${css}\n/* ROI IA Vibe Coding */\n${action.css}`;
        setCss(newCss);
      }

      const updatedHtml = doc.documentElement.outerHTML;
      setHtml(updatedHtml);
      setHasUnsavedChanges(true);
      setPreviewKey((prev) => prev + 1);

      setJustModifiedAlert(action.description || 'Alteração aplicada!');
      setTimeout(() => setJustModifiedAlert(null), 5000);

      return { success: true, message: action.description || 'Alteração aplicada com sucesso!' };
    } catch (err: any) {
      console.error('Falha ao aplicar Vibe Coding action:', err);
      return { success: false, message: err.message || 'Erro ao processar modificação' };
    }
  };

  // Desfazer alteração específica
  const handleUndo = (item: VibeHistoryItem) => {
    setHtml(item.snapshotHtml);
    setCss(item.snapshotCss);
    setHasUnsavedChanges(true);
    setPreviewKey((prev) => prev + 1);
    setVibeHistory((prev) => prev.filter((h) => h.id !== item.id));
    setJustModifiedAlert('Alteração revertida com sucesso!');
    setTimeout(() => setJustModifiedAlert(null), 4000);
  };

  // Enviar mensagem para a IA
  const handleSend = async (queryOverride?: string) => {
    const text = (queryOverride || input).trim();
    if (!text || aiLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setAiLoading(true);

    try {
      const history = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history,
          projectName,
          currentHtml: html.slice(0, 3500),
        }),
      });

      const data = await res.json();
      let actionNotice: string | undefined = undefined;

      // Se a IA retornou uma ação de Vibe Coding, aplica imediatamente!
      if (data.vibeAction) {
        const result = executeVibeAction(data.vibeAction);
        if (result.success) {
          actionNotice = result.message;
        }
      }

      const aiReply = data.reply || 'Modificação processada com sucesso.';
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: aiReply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          vibeAction: data.vibeAction,
          actionNotice,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Houve uma oscilação na conexão com a ROI IA. Tente novamente em instantes.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Constrói o HTML completo para o iframe de Preview
  const buildPreviewHtml = () => {
    let finalHtml = html;
    if (sourceUrl && !finalHtml.includes('<base')) {
      const baseTag = `<base href="${sourceUrl}" />`;
      if (finalHtml.includes('<head>')) {
        finalHtml = finalHtml.replace('<head>', `<head>${baseTag}`);
      } else {
        finalHtml = baseTag + finalHtml;
      }
    }

    if (css && !finalHtml.includes('id="roi-preview-styles"')) {
      const styleTag = `<style id="roi-preview-styles">\n${css}\n</style>`;
      if (finalHtml.includes('</head>')) {
        finalHtml = finalHtml.replace('</head>', `${styleTag}</head>`);
      } else {
        finalHtml = styleTag + finalHtml;
      }
    }

    // Injeta estilo para garantir visibilidade no preview
    const shieldTag = `<style id="roi-anti-blank-shield">\nhtml, body { opacity: 1 !important; visibility: visible !important; display: block !important; min-height: 100vh !important; }\n#preloader, .preloader, #loading, .loading-screen, .elementor-loader, .elementor-loading, .page-loader { display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; }\n</style>`;
    if (finalHtml.includes('</head>')) {
      finalHtml = finalHtml.replace('</head>', `${shieldTag}</head>`);
    } else {
      finalHtml = shieldTag + finalHtml;
    }

    return finalHtml;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#07080d] text-white overflow-hidden">
      {/* BARRA SUPERIOR DE COMANDO (ESTILO VS CODE) */}
      <header className="h-14 border-b border-white/10 bg-[#0d0f17] px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-emerald-500 flex items-center justify-center shadow-md shadow-blue-500/20">
            <Code2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                ROI IA Code Studio
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-normal">
                  VS Code Vibe
                </span>
              </span>
            </div>
            <p className="text-[10px] text-neutral-400">Editor inteligente com Live Preview & Vibe Coding</p>
          </div>
        </div>

        {/* SELETOR DE PROJETO / PÁGINA */}
        <div className="flex items-center gap-2">
          {pageLoading ? (
            <div className="flex items-center gap-1.5 text-xs text-neutral-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
              <span>Carregando projetos...</span>
            </div>
          ) : pages.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400 hidden sm:inline">Página:</span>
              <select
                value={selectedPageId}
                onChange={(e) => setSelectedPageId(e.target.value)}
                className="bg-[#141724] border border-white/15 text-xs text-white rounded-xl px-3 py-1.5 outline-none focus:border-blue-500 transition-colors max-w-[200px] sm:max-w-[280px] truncate"
              >
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.slug})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <span className="text-xs text-neutral-500">Nenhum projeto encontrado</span>
          )}

          {/* STATUS DE SINCRONIZAÇÃO */}
          {hasUnsavedChanges ? (
            <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Modificações não salvas
            </span>
          ) : (
            <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Sincronizado
            </span>
          )}

          {/* BOTÃO SALVAR */}
          <button
            onClick={handleSavePage}
            disabled={saving || !hasUnsavedChanges}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              hasUnsavedChanges
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                : 'bg-white/5 text-neutral-400 hover:text-white border border-white/10'
            }`}
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : saveSuccess ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{saving ? 'Salvando...' : saveSuccess ? 'Salvo no Site!' : 'Salvar no Site'}</span>
          </button>

          {/* BOTÃO VER NO AR */}
          {pageSlug && (
            <a
              href={`/p/${pageSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 text-xs font-medium transition-colors"
              title="Abrir página publicada em nova aba"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ver Online</span>
            </a>
          )}
        </div>
      </header>

      {/* NOTIFICAÇÃO FLUTUANTE DE VIBE CODING */}
      {justModifiedAlert && (
        <div className="absolute top-16 right-6 z-50 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-top-4 duration-300">
          <Zap className="w-4 h-4 fill-white" />
          <span>{justModifiedAlert}</span>
        </div>
      )}

      {/* WORKSPACE PRINCIPAL (SPLIT-SCREEN: CHAT IA + VS CODE WORKSPACE) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* PAINEL ESQUERDO: COPILOTO ROI IA (CHAT) */}
        <div className="w-full md:w-[420px] lg:w-[460px] border-r border-white/10 flex flex-col bg-[#0b0c13] shrink-0">
          {/* Header do Chat */}
          <div className="p-3 border-b border-white/10 bg-[#0e101a] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-white tracking-wide">Copiloto Vibe Coding</span>
              <span className="text-[10px] text-neutral-400 font-mono">glm-5.3-flash</span>
            </div>
            <button
              onClick={() =>
                setMessages([
                  {
                    id: 'reset',
                    role: 'assistant',
                    content: 'Chat reiniciado! Me diga qual alteração você gostaria de fazer no site agora. 🚀',
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  },
                ])
              }
              className="p-1 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
              title="Limpar histórico do chat"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mensagens do Chat */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div key={m.id} className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                      isUser
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#151827] border border-white/10 text-blue-400 shadow-md'
                    }`}
                  >
                    {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                  </div>

                  <div className="flex flex-col space-y-1.5 max-w-[85%]">
                    <div
                      className={`relative group rounded-2xl p-3.5 text-xs leading-relaxed ${
                        isUser
                          ? 'bg-blue-600 text-white rounded-tr-sm shadow-md'
                          : 'bg-[#121420] border border-white/10 text-neutral-200 rounded-tl-sm'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{m.content}</div>

                      {/* BADGE DE AÇÃO EXECUTADA AO VIVO */}
                      {m.actionNotice && (
                        <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 -mx-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
                          <div className="flex items-center gap-1.5 truncate">
                            <Zap className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{m.actionNotice}</span>
                          </div>
                        </div>
                      )}

                      {!isUser && (
                        <button
                          onClick={() => copyToClipboard(m.id, m.content)}
                          className="absolute top-2 right-2 p-1 rounded-md bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Copiar mensagem"
                        >
                          {copiedId === m.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
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

            {aiLoading && (
              <div className="flex items-center gap-2 text-xs text-neutral-400 bg-white/5 border border-white/10 rounded-2xl p-3 w-fit">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                <span>ROI IA analisando o código e aplicando alteração...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* CHIPS DE SUGESTÕES RÁPIDAS */}
          <div className="px-3 py-2 border-t border-white/5 bg-[#090b11] overflow-x-auto flex gap-1.5 no-scrollbar">
            <button
              onClick={() => handleSend('Cria um checkout transparente completo para esse site com PIX e Cartão de Crédito')}
              className="shrink-0 text-[10px] px-2.5 py-1 rounded-full bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 font-medium transition-colors flex items-center gap-1"
            >
              <Zap className="w-3 h-3" />
              Criar Checkout PIX + Cartão
            </button>
            <button
              onClick={() => handleSend('Muda a cor de todos os botões de compra para verde neon chamativo com leve brilho')}
              className="shrink-0 text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 font-medium transition-colors"
            >
              🎨 Botões Verde Neon
            </button>
            <button
              onClick={() => handleSend('Adiciona uma barra fixa no topo da página com contador regressivo de 15 minutos')}
              className="shrink-0 text-[10px] px-2.5 py-1 rounded-full bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 font-medium transition-colors"
            >
              ⏱️ Contador de Escassez
            </button>
            <button
              onClick={() => handleSend('Coloca um botão flutuante oficial do WhatsApp com animação pulsante no canto inferior direito')}
              className="shrink-0 text-[10px] px-2.5 py-1 rounded-full bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 font-medium transition-colors"
            >
              💬 Botão WhatsApp
            </button>
          </div>

          {/* INPUT DO CHAT */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 border-t border-white/10 bg-[#0e101a] flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Peça qualquer alteração para a IA no site..."
              disabled={aiLoading}
              className="flex-1 bg-[#151827] border border-white/15 text-xs text-white rounded-xl px-3.5 py-2.5 outline-none focus:border-blue-500 transition-colors placeholder:text-neutral-500"
            />
            <button
              type="submit"
              disabled={aiLoading || !input.trim()}
              className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white flex items-center justify-center transition-colors shadow-md shadow-blue-600/30"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* PAINEL DIREITO: VS CODE DA ROI (LIVE PREVIEW & EDITOR DE CÓDIGO) */}
        <div className="flex-1 flex flex-col bg-[#08090f] overflow-hidden">
          {/* TAB BAR DO VS CODE DA ROI */}
          <div className="h-11 border-b border-white/10 bg-[#0d0f17] px-3 flex items-center justify-between shrink-0">
            {/* ABAS */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === 'preview'
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Live Preview</span>
              </button>

              <button
                onClick={() => setActiveTab('code')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === 'code'
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Editor de Código</span>
              </button>

              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === 'history'
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Histórico ({vibeHistory.length})</span>
              </button>
            </div>

            {/* CONTROLES DE DISPOSITIVO / RECARGA */}
            {activeTab === 'preview' && (
              <div className="flex items-center gap-1 bg-[#141724] border border-white/10 p-0.5 rounded-lg">
                <button
                  onClick={() => setDeviceView('desktop')}
                  className={`p-1.5 rounded-md transition-colors ${
                    deviceView === 'desktop' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Visualização Computador (100%)"
                >
                  <Laptop className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeviceView('tablet')}
                  className={`p-1.5 rounded-md transition-colors ${
                    deviceView === 'tablet' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Visualização Tablet (768px)"
                >
                  <Tablet className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeviceView('mobile')}
                  className={`p-1.5 rounded-md transition-colors ${
                    deviceView === 'mobile' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Visualização Celular (375px)"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
                <div className="w-[1px] h-3.5 bg-white/10 mx-1" />
                <button
                  onClick={() => setPreviewKey((prev) => prev + 1)}
                  className="p-1.5 rounded-md text-neutral-400 hover:text-white transition-colors"
                  title="Recarregar Preview"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {activeTab === 'code' && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCodeFile('html')}
                  className={`text-[11px] font-mono px-2.5 py-1 rounded-md transition-colors ${
                    codeFile === 'html'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  index.html
                </button>
                <button
                  onClick={() => setCodeFile('css')}
                  className={`text-[11px] font-mono px-2.5 py-1 rounded-md transition-colors ${
                    codeFile === 'css'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  styles.css
                </button>
              </div>
            )}
          </div>

          {/* CONTEÚDO DA ABA SELECIONADA */}
          <div className="flex-1 overflow-hidden relative">
            {/* ABA 1: PREVIEW AO VIVO */}
            {activeTab === 'preview' && (
              <div className="w-full h-full flex items-center justify-center p-3 bg-[#0a0c12] overflow-auto">
                <div
                  className={`h-full transition-all duration-300 rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-white ${
                    deviceView === 'desktop'
                      ? 'w-full'
                      : deviceView === 'tablet'
                      ? 'w-[768px]'
                      : 'w-[375px] max-w-full'
                  }`}
                >
                  <iframe
                    key={previewKey}
                    srcDoc={buildPreviewHtml()}
                    title="Live Preview"
                    className="w-full h-full border-0 block"
                    sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
                  />
                </div>
              </div>
            )}

            {/* ABA 2: EDITOR DE CÓDIGO (VS CODE DA ROI) */}
            {activeTab === 'code' && (
              <div className="w-full h-full flex flex-col bg-[#0e1017]">
                <div className="flex-1 overflow-hidden flex">
                  <textarea
                    value={codeFile === 'html' ? html : css}
                    onChange={(e) => {
                      if (codeFile === 'html') setHtml(e.target.value);
                      else setCss(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    spellCheck={false}
                    className="flex-1 h-full w-full bg-[#0d0f18] text-[#e2e8f0] font-mono text-xs p-4 outline-none resize-none leading-relaxed selection:bg-blue-600/30"
                  />
                </div>
                <div className="h-6 border-t border-white/10 bg-[#090b12] px-4 flex items-center justify-between text-[10px] font-mono text-neutral-500">
                  <div className="flex items-center gap-3">
                    <span>UTF-8</span>
                    <span>{codeFile.toUpperCase()}</span>
                    <span>{codeFile === 'html' ? `${html.length} caracteres` : `${css.length} caracteres`}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-blue-400">
                    <Sparkles className="w-3 h-3" />
                    <span>ROI IA Vibe Coding Engine Conectada</span>
                  </div>
                </div>
              </div>
            )}

            {/* ABA 3: HISTÓRICO DE ALTERAÇÕES */}
            {activeTab === 'history' && (
              <div className="w-full h-full p-6 bg-[#0a0c12] overflow-y-auto">
                <div className="max-w-2xl mx-auto space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div>
                      <h3 className="text-sm font-bold text-white">Histórico de Alterações da Sessão</h3>
                      <p className="text-xs text-neutral-400">Acompanhe e reverta qualquer modificação feita pela IA.</p>
                    </div>
                  </div>

                  {vibeHistory.length === 0 ? (
                    <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl">
                      <Clock className="w-8 h-8 text-neutral-600 mx-auto mb-3" />
                      <p className="text-xs text-neutral-400 font-medium">Nenhuma alteração registrada ainda nesta sessão.</p>
                      <p className="text-[11px] text-neutral-500 mt-1">Peça qualquer alteração no chat ao lado para ver o histórico aqui.</p>
                    </div>
                  ) : (
                    vibeHistory.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 rounded-xl bg-[#11131f] border border-white/10 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                            <Zap className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">{item.description}</p>
                            <span className="text-[10px] text-neutral-500">{item.timestamp}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleUndo(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white text-xs transition-colors"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                          <span>Desfazer</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
