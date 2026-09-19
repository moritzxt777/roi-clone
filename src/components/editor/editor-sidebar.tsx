'use client';

import { useEditorStore, ModalType } from '@/stores/editor-store';
import { 
  Link2, 
  Code2, 
  Type, 
  Image as ImageIcon, 
  MousePointerClick,
  Sparkles,
  Undo2,
  Flame
} from 'lucide-react';

interface ToolCard {
  id: ModalType;
  title: string;
  icon: any;
  color: string;
  badge?: string;
}

const toolCards: ToolCard[] = [
  {
    id: 'replace-url',
    title: 'Substituir URL',
    icon: Link2,
    color: 'text-blue-400 group-hover:text-blue-300',
  },
  {
    id: 'scripts',
    title: 'Scripts e Pixel',
    icon: Code2,
    color: 'text-purple-400 group-hover:text-purple-300',
  },
  {
    id: 'texts',
    title: 'Textos',
    icon: Type,
    color: 'text-amber-400 group-hover:text-amber-300',
  },
  {
    id: 'images',
    title: 'Imagens',
    icon: ImageIcon,
    color: 'text-emerald-400 group-hover:text-emerald-300',
  },
  {
    id: 'buttons',
    title: 'Botões',
    icon: MousePointerClick,
    color: 'text-sky-400 group-hover:text-sky-300',
  },
  {
    id: 'back-redirect',
    title: 'Back-Redirect',
    icon: Undo2,
    color: 'text-rose-400 group-hover:text-rose-300',
  },
  {
    id: 'timer',
    title: 'Escassez/Timer',
    icon: Flame,
    color: 'text-orange-400 group-hover:text-orange-300',
  },
];

export function EditorSidebar() {
  const { isSidebarOpen, activeModal, setActiveModal, isAiChatOpen, toggleAiChat } = useEditorStore();

  if (!isSidebarOpen) return null;

  return (
    <aside className="w-[210px] bg-[#090a0f] border-r border-white/10 flex flex-col p-3 z-20 shrink-0 select-none">
      {/* Botão Especial ROI IA Chat */}
      <button
        onClick={toggleAiChat}
        className={`w-full mb-3 flex items-center justify-between p-2.5 rounded-xl border transition-all duration-200 ${
          isAiChatOpen
            ? 'bg-blue-600/30 border-blue-500 text-blue-300 shadow-lg shadow-blue-500/10'
            : 'bg-gradient-to-r from-blue-950/40 via-[#11131a] to-indigo-950/40 border-blue-500/30 hover:border-blue-500/60 text-white'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div className="text-left">
            <span className="text-xs font-bold block leading-tight">ROI IA</span>
            <span className="text-[10px] text-neutral-400 block">Ajustes & Pix</span>
          </div>
        </div>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
          Chat
        </span>
      </button>

      {/* Grid de 2 Colunas como na Imagem de Referência */}
      <div className="grid grid-cols-2 gap-2.5">
        {toolCards.map((card) => {
          const Icon = card.icon;
          const isActive = activeModal === card.id;

          return (
            <button
              key={card.id}
              onClick={() => setActiveModal(isActive ? 'none' : card.id)}
              className={`group flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 aspect-square text-center ${
                isActive
                  ? 'bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-500/10'
                  : 'bg-[#11131a] hover:bg-[#161922] border-white/5 hover:border-white/15'
              }`}
            >
              <div className={`p-2 rounded-lg bg-white/5 group-hover:scale-110 transition-transform mb-2 ${card.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-medium text-neutral-300 group-hover:text-white leading-tight">
                {card.title}
              </span>
            </button>
          );
        })}
      </div>

      {/* Dica no rodapé da barra */}
      <div className="mt-auto pt-4 border-t border-white/5 text-[11px] text-neutral-500 flex items-center gap-1.5 px-1">
        <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        <span>Clique nos elementos da página para editar direto.</span>
      </div>
    </aside>
  );
}
