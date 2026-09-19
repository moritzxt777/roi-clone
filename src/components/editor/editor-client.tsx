'use client';

import { useEffect, useRef } from 'react';
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
import { AiChatDrawer } from './ai-chat-drawer';

interface EditorClientProps {
  pageId: string;
  cloneId: string;
  projectName: string;
  sourceUrl?: string;
  initialElements: EditorElement[];
  css?: string;
  html?: string;
}

export function EditorClient({
  pageId,
  cloneId,
  projectName,
  sourceUrl = '',
  initialElements,
  css = '',
  html = '',
}: EditorClientProps) {
  const initialized = useRef(false);

  // Inicialização síncrona e imediata antes do primeiro render dos filhos
  if (!initialized.current && html) {
    useEditorStore.setState({
      pageId,
      cloneId,
      projectName,
      sourceUrl,
      elements: initialElements,
      css,
      html,
      saveStatus: 'saved',
    });
    initialized.current = true;
  }

  useEffect(() => {
    // Garante sincronização caso props mudem
    if (html) {
      useEditorStore.setState({
        pageId,
        cloneId,
        projectName,
        sourceUrl,
        elements: initialElements,
        css,
        html,
      });
    }
  }, [pageId, cloneId, projectName, sourceUrl, initialElements, css, html]);

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
      <AiChatDrawer />
    </div>
  );
}
