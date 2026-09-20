'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title?: string;
  description?: string;
  itemName?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmar Ação',
  description = 'Tem certeza que deseja prosseguir com esta ação?',
  itemName,
  confirmText = 'Excluir',
  cancelText = 'Cancelar',
  variant = 'danger',
  isLoading = false,
}: ConfirmDialogProps) {
  // Fechar com tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  // Prevenir scroll do body quando aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isDanger = variant === 'danger';
  const isWarning = variant === 'warning';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={() => {
          if (!isLoading) onClose();
        }}
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0f17]/95 p-6 shadow-2xl backdrop-blur-2xl shadow-black/80 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Botão Fechar no canto */}
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="absolute right-4 top-4 p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Ícone estilizado */}
        <div className="flex items-center gap-4 mb-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
            isDanger 
              ? 'bg-red-500/10 border border-red-500/20 text-red-400 ring-8 ring-red-500/5' 
              : isWarning
              ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400 ring-8 ring-amber-500/5'
              : 'bg-blue-500/10 border border-blue-500/20 text-blue-400 ring-8 ring-blue-500/5'
          }`}>
            {isDanger ? (
              <Trash2 className="w-6 h-6" />
            ) : (
              <AlertTriangle className="w-6 h-6" />
            )}
          </div>

          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              {title}
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Esta ação requer sua confirmação
            </p>
          </div>
        </div>

        {/* Descrição */}
        <p className="text-sm text-neutral-300 leading-relaxed">
          {description}
        </p>

        {/* Nome do item (se houver) */}
        {itemName && (
          <div className="mt-3 px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-neutral-200 font-mono flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-red-400 shrink-0 animate-pulse" />
            <span className="truncate font-semibold">{itemName}</span>
          </div>
        )}

        {/* Botões de Ação */}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 h-11 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 font-medium text-xs transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={() => onConfirm()}
            disabled={isLoading}
            className={`flex-1 h-11 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 ${
              isDanger
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/25'
                : isWarning
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/25'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processando...</span>
              </>
            ) : (
              <>
                {isDanger && <Trash2 className="w-4 h-4" />}
                <span>{confirmText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
