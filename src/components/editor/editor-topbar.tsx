'use client';

import { useEditorStore } from '@/stores/editor-store';
import { 
  Monitor, 
  Smartphone, 
  RotateCw, 
  ChevronDown, 
  ExternalLink, 
  Download, 
  PanelLeftClose, 
  PanelLeft,
  Check,
  Loader2,
  Rocket,
  ArrowLeft,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export function EditorTopbar() {
  const {
    projectName,
    deviceMode,
    setDeviceMode,
    isSidebarOpen,
    toggleSidebar,
    isAiChatOpen,
    toggleAiChat,
    saveStatus,
    setSaveStatus,
    setActiveModal,
    html,
    css,
    cloneId,
    pageId,
  } = useEditorStore();

  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/clones/${cloneId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, css }),
      });

      if (res.ok) {
        setSaveStatus('saved');
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2500);
      }
    } catch (e) {
      console.error('Error saving:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = () => {
    const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${projectName}</title>
  <style>${css}</style>
</head>
<body>
  ${html}
</body>
</html>`;
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'pagina'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReload = () => {
    const iframe = document.getElementById('canvas-iframe') as HTMLIFrameElement;
    if (iframe) {
      iframe.srcdoc = iframe.srcdoc;
    }
  };

  return (
    <header className="h-14 bg-[#090a0f] border-b border-white/10 px-4 flex items-center justify-between select-none z-30 shrink-0">
      {/* Lado Esquerdo: Botão Voltar, Logo, Nome do Projeto, Toggle Sidebar */}
      <div className="flex items-center gap-3">
        <Link 
          href="/dashboard" 
          title="Voltar ao Painel Principal"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white text-xs font-medium transition-all group shrink-0"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform text-neutral-400 group-hover:text-white" />
          <span className="font-semibold">Voltar</span>
        </Link>

        <div className="h-4 w-[1px] bg-white/10 mx-0.5 hidden sm:block" />

        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <img 
            src="/roi-logo.png" 
            alt="ROI Clone" 
            className="h-7 w-auto rounded object-contain group-hover:scale-105 transition-transform" 
          />
          <span className="text-sm font-semibold text-white tracking-tight group-hover:text-blue-400 transition-colors truncate max-w-[180px] sm:max-w-[280px]">
            {projectName || 'ROI Clone'}
          </span>
        </Link>

        <button 
          onClick={toggleSidebar}
          title={isSidebarOpen ? "Recolher barra lateral" : "Expandir barra lateral"}
          className="w-8 h-8 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors ml-1 shrink-0"
        >
          {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Centro: Viewport, Reload, Seletor de Página, External Link */}
      <div className="flex items-center gap-2">
        {/* Device Switcher */}
        <div className="flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5">
          <button
            onClick={() => setDeviceMode('desktop')}
            title="Visualização Desktop"
            className={`p-1.5 rounded-md transition-all ${
              deviceMode === 'desktop' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Monitor className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeviceMode('mobile')}
            title="Visualização Mobile"
            className={`p-1.5 rounded-md transition-all ${
              deviceMode === 'mobile' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4" />
          </button>
        </div>

        {/* Reload Preview */}
        <button
          onClick={handleReload}
          title="Recarregar página"
          className="p-2 rounded-lg border border-white/10 bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>

        {/* Page Selector Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-[#12141c] text-xs font-medium text-neutral-200 shadow-inner">
          <span>Página Inicial</span>
          <ChevronDown className="w-3 h-3 text-neutral-400" />
        </div>

        {/* Open in New Tab */}
        <Link
          href={`/preview/${cloneId}`}
          target="_blank"
          title="Abrir página em nova aba"
          className="p-2 rounded-lg border border-white/10 bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Lado Direito: Download / Export, IA Nvidia, Botão Salvar, Publicar */}
      <div className="flex items-center gap-2.5">
        {/* Botão ROI IA */}
        <button
          onClick={toggleAiChat}
          title="Abrir Chat da ROI IA"
          className={`h-9 px-3 rounded-lg font-semibold text-xs tracking-tight flex items-center gap-1.5 transition-all shadow-md active:scale-95 border ${
            isAiChatOpen
              ? 'bg-blue-600/30 text-blue-300 border-blue-500/50 shadow-blue-500/10'
              : 'bg-gradient-to-r from-blue-600/20 to-indigo-600/20 hover:from-blue-600/30 hover:to-indigo-600/30 text-blue-300 border-blue-500/30'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
          <span>ROI IA</span>
        </button>

        {/* Download HTML */}
        <button
          onClick={handleDownload}
          title="Baixar HTML da página"
          className="p-2 rounded-lg border border-white/10 bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Download className="w-4 h-4" />
        </button>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-9 px-4 rounded-lg bg-white hover:bg-neutral-100 text-black font-semibold text-xs tracking-tight flex items-center gap-2 shadow-lg shadow-white/10 transition-all active:scale-95 disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
              <span>Salvando...</span>
            </>
          ) : justSaved ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-700 font-bold">Salvo!</span>
            </>
          ) : (
            <span>Salvar</span>
          )}
        </button>

        {/* Publish Button */}
        <button
          onClick={() => setActiveModal('publish')}
          className="h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs tracking-tight flex items-center gap-1.5 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
        >
          <Rocket className="w-3.5 h-3.5" />
          <span>Publicar</span>
        </button>
      </div>
    </header>
  );
}
