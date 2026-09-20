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
  Sparkles,
  Edit3,
  MousePointerClick,
  FileText,
  Plus,
  Layers,
  Zap,
  Archive,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { downloadSiteZip } from '@/lib/zip-exporter';

export function EditorTopbar() {
  const {
    projectName,
    deviceMode,
    setDeviceMode,
    editorMode,
    setEditorMode,
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
    availablePages,
    discoveredSubpages,
  } = useEditorStore();

  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [isPageDropdownOpen, setIsPageDropdownOpen] = useState(false);
  const [isNewPageModalOpen, setIsNewPageModalOpen] = useState(false);
  const [newPageName, setNewPageName] = useState('');
  const [newPageUrl, setNewPageUrl] = useState('');
  const [creatingPage, setCreatingPage] = useState(false);

  const activePageObj = availablePages.find((p) => p.id === pageId || p.id === cloneId) || availablePages[0];
  const currentPageTitle = activePageObj?.name || projectName || 'Página Inicial';

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('saving');
    try {
      const targetId = pageId || cloneId;
      const res = await fetch(`/api/clones/${targetId}`, {
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

  const handleCreateSubpage = async (nameToUse?: string, urlToUse?: string) => {
    setCreatingPage(true);
    try {
      const res = await fetch('/api/pages/subpage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameToUse || newPageName || 'Página 2',
          url: urlToUse || newPageUrl || undefined,
          cloneId,
          parentPageId: pageId,
        }),
      });

      const data = await res.json();
      if (data.pageId) {
        window.location.href = `/dashboard/projeto/${data.pageId}`;
      }
    } catch (err) {
      console.error('Error creating subpage:', err);
    } finally {
      setCreatingPage(false);
    }
  };

  const [downloadingZip, setDownloadingZip] = useState(false);

  const handleDownloadZip = async () => {
    setDownloadingZip(true);
    try {
      const subpagesToExport = availablePages
        .filter((p) => p.id !== (pageId || cloneId))
        .map((p) => ({
          name: p.name,
          slug: p.slug,
          html: '',
          css: '',
        }));

      await downloadSiteZip({
        projectName: currentPageTitle || projectName || 'oferta-clonada',
        html,
        css,
        subpages: subpagesToExport,
      });
    } catch (e) {
      console.error('Falha ao gerar ZIP no cliente, acionando servidor:', e);
      window.open(`/api/clones/${cloneId || pageId}/zip`, '_blank');
    } finally {
      setDownloadingZip(false);
    }
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

      {/* Centro: Alternador Editar/Navegar, Viewport, Reload, Seletor de Página, External Link */}
      <div className="flex items-center gap-2.5">
        {/* Alternador de Modo: Editar vs Navegar / Testar */}
        <div className="flex items-center rounded-xl border border-white/10 bg-[#12141c] p-0.5 shadow-inner">
          <button
            onClick={() => setEditorMode('edit')}
            title="Modo Edição: Clique nos elementos da página para editar textos, imagens e links"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              editorMode === 'edit' 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25' 
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Editar</span>
          </button>
          <button
            onClick={() => setEditorMode('interact')}
            title="Modo Navegação: Interaja livremente com a página, clique em botões, popups e formulários para testar"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              editorMode === 'interact' 
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/25' 
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <MousePointerClick className="w-3.5 h-3.5" />
            <span>Navegar</span>
          </button>
        </div>

        <div className="h-4 w-[1px] bg-white/10 mx-0.5 hidden lg:block" />

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

        {/* Dynamic Page Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsPageDropdownOpen(!isPageDropdownOpen)}
            title="Alternar entre páginas do funil ou adicionar Página 2"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-[#12141c] hover:bg-[#181b26] hover:border-white/20 text-xs font-medium text-neutral-200 shadow-inner transition-all group"
          >
            <FileText className="w-3.5 h-3.5 text-blue-400 group-hover:scale-105 transition-transform" />
            <span className="max-w-[120px] sm:max-w-[170px] truncate font-semibold">
              {currentPageTitle}
            </span>
            <ChevronDown className={`w-3 h-3 text-neutral-400 transition-transform duration-200 ${isPageDropdownOpen ? 'rotate-180 text-white' : ''}`} />
          </button>

          {isPageDropdownOpen && (
            <>
              {/* Backdrop para fechar */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsPageDropdownOpen(false)}
              />

              {/* Popover Menu */}
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-80 rounded-2xl border border-white/15 bg-[#0d0e16] p-2 text-white shadow-2xl z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    <span>Páginas do Funil</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono">
                    {availablePages.length} {availablePages.length === 1 ? 'página' : 'páginas'}
                  </span>
                </div>

                {/* Lista de Páginas do Usuário */}
                <div className="max-h-52 overflow-y-auto py-1 space-y-1">
                  {availablePages.map((pageItem, idx) => {
                    const isCurrent = pageItem.id === pageId || pageItem.id === cloneId;
                    return (
                      <button
                        key={pageItem.id}
                        onClick={() => {
                          setIsPageDropdownOpen(false);
                          if (!isCurrent) {
                            window.location.href = `/dashboard/projeto/${pageItem.id}`;
                          }
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-all ${
                          isCurrent
                            ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 font-bold'
                            : 'hover:bg-white/5 text-neutral-300 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono ${
                            isCurrent ? 'bg-blue-500 text-white font-bold' : 'bg-white/10 text-neutral-400'
                          }`}>
                            {idx + 1}
                          </span>
                          <span className="truncate">{pageItem.name}</span>
                        </div>
                        {isCurrent ? (
                          <span className="text-[10px] text-blue-400 font-medium shrink-0 ml-2">Editando</span>
                        ) : (
                          <span className="text-[10px] text-neutral-500 shrink-0 ml-2">Abrir</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Subpáginas Detectadas no Site Clonado */}
                {discoveredSubpages && discoveredSubpages.length > 0 && (
                  <div className="pt-2 border-t border-white/10 mt-1">
                    <span className="text-[10px] font-semibold text-emerald-400 px-3 block mb-1 flex items-center gap-1">
                      <Zap className="w-3 h-3" /> Subpáginas Detectadas no Site:
                    </span>
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {discoveredSubpages.map((sub, sIdx) => (
                        <div
                          key={sIdx}
                          className="flex items-center justify-between p-1.5 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-neutral-300"
                        >
                          <span className="truncate max-w-[160px]" title={sub.url}>
                            {sub.title || sub.slug}
                          </span>
                          <button
                            disabled={creatingPage}
                            onClick={() => {
                              setIsPageDropdownOpen(false);
                              handleCreateSubpage(`Página ${sub.title}`, sub.url);
                            }}
                            className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold shadow transition-colors"
                          >
                            Clonar & Editar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Adicionar / Clonar Página 2 */}
                <div className="pt-2 border-t border-white/10 mt-1">
                  <button
                    onClick={() => {
                      setIsPageDropdownOpen(false);
                      setIsNewPageModalOpen(true);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 p-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-bold border border-blue-500/30 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Adicionar / Clonar Página 2</span>
                  </button>
                </div>
              </div>
            </>
          )}
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

        {/* Baixar ZIP do Site Todo */}
        <button
          onClick={handleDownloadZip}
          disabled={downloadingZip}
          title="Baixar Site Todo em ZIP (HTML, CSS, Subpáginas, .htaccess)"
          className="h-9 px-3 rounded-lg border border-blue-500/30 bg-blue-600/10 hover:bg-blue-600/20 text-blue-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50"
        >
          {downloadingZip ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
              <span className="hidden sm:inline">Gerando ZIP...</span>
            </>
          ) : (
            <>
              <Archive className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Baixar ZIP</span>
            </>
          )}
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

      {/* Modal Adicionar / Clonar Subpágina (Página 2, Checkout, Upsell) */}
      {isNewPageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0e16] p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Adicionar Página ao Funil</h3>
                  <p className="text-xs text-neutral-400">Página 2, Checkout, Upsell ou Página de Obrigado</p>
                </div>
              </div>
              <button
                onClick={() => setIsNewPageModalOpen(false)}
                className="p-1.5 rounded-lg border border-white/10 text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Nome da Página
                </label>
                <input
                  type="text"
                  value={newPageName}
                  onChange={(e) => setNewPageName(e.target.value)}
                  placeholder="Ex: Página 2 - Checkout ou Conteúdo"
                  className="w-full px-3 py-2 rounded-xl border border-white/10 bg-[#141624] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  URL para Clonar (Opcional)
                </label>
                <input
                  type="text"
                  value={newPageUrl}
                  onChange={(e) => setNewPageUrl(e.target.value)}
                  placeholder="https://exemplo.com/cdd ou /checkout"
                  className="w-full px-3 py-2 rounded-xl border border-white/10 bg-[#141624] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
                />
                <p className="text-[11px] text-neutral-500 mt-1">
                  Se preencher com uma URL, a ROI IA clonará esta subpágina diretamente para o seu projeto.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                onClick={() => setIsNewPageModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-xs text-neutral-400"
              >
                Cancelar
              </button>
              <button
                disabled={creatingPage}
                onClick={() => handleCreateSubpage()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/25 disabled:opacity-50 transition-all"
              >
                {creatingPage ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Criando Página...</span>
                  </>
                ) : (
                  <span>Criar & Editar Página</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
