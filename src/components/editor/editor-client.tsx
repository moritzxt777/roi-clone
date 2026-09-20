'use client';

import { useState, useEffect } from 'react';
import { EditorElement, useEditorStore } from '@/stores/editor-store';
import { EditorTopbar } from './editor-topbar';
import { EditorSidebar } from './editor-sidebar';
import { EditorCanvas } from './editor-canvas';
import { EditorInspector } from './editor-inspector';
import { ReplaceUrlModal } from './modals/replace-url-modal';
import { ScriptsModal } from './modals/scripts-modal';
import { TextsModal } from './modals/texts-modal';
import { ImagesModal } from './modals/images-modal';
import { ButtonsModal } from './modals/buttons-modal';
import { PublishModal } from './modals/publish-modal';
import { BackRedirectModal } from './modals/back-redirect-modal';
import { TimerModal } from './modals/timer-modal';
import { SeoModal } from './modals/seo-modal';
import { AiChatDrawer } from './ai-chat-drawer';

interface EditorClientProps {
  pageId: string;
  cloneId: string;
  projectName: string;
  sourceUrl?: string;
  initialElements: EditorElement[];
  css?: string;
  html?: string;
  availablePages?: Array<{
    id: string;
    name: string;
    slug?: string;
    sourceUrl?: string;
    isCurrent?: boolean;
  }>;
  discoveredSubpages?: Array<{
    title: string;
    url: string;
    slug: string;
  }>;
  meta?: Record<string, any>;
}

export function EditorClient({
  pageId,
  cloneId,
  projectName,
  sourceUrl = '',
  initialElements,
  css = '',
  html = '',
  availablePages = [],
  discoveredSubpages = [],
  meta = {},
}: EditorClientProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    useEditorStore.setState({
      pageId,
      cloneId,
      projectName,
      sourceUrl,
      elements: initialElements || [],
      css,
      html,
      availablePages: availablePages || [],
      discoveredSubpages: discoveredSubpages || [],
      meta: meta || {},
      saveStatus: 'saved',
    });
    setIsMounted(true);
  }, [pageId, cloneId, projectName, sourceUrl, initialElements, css, html, availablePages, discoveredSubpages, meta]);

  if (!isMounted) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#07080b] text-white selection:bg-blue-600/30">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative">
            <img src="/roi-logo.png" alt="ROI Clone" className="h-10 w-auto rounded object-contain" />
            <div className="absolute -inset-2 rounded-xl bg-blue-500/20 blur-lg animate-pulse -z-10" />
          </div>
          <div className="flex items-center gap-2.5 text-xs text-neutral-400">
            <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            <span>Carregando editor visual...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col bg-[#07080b] text-white overflow-hidden selection:bg-blue-600/30 font-sans">
      {/* Topbar com logo ROI, controles e salvar */}
      <EditorTopbar />

      {/* Workspace Principal */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Barra lateral de ferramentas com cards */}
        <EditorSidebar />

        {/* Canvas central com iframe responsivo e interativo */}
        <EditorCanvas initialHtml={html} initialSourceUrl={sourceUrl} />

        {/* Painel lateral direito (Inspector) ao selecionar qualquer elemento */}
        <EditorInspector />
      </div>

      {/* Modais das Ferramentas */}
      <ReplaceUrlModal />
      <ScriptsModal />
      <TextsModal />
      <ImagesModal />
      <ButtonsModal />
      <PublishModal />
      <BackRedirectModal />
      <TimerModal />
      <SeoModal />
      <AiChatDrawer />
    </div>
  );
}
