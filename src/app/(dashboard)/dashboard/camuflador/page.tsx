'use client';

import { useState, useRef } from 'react';
import { 
  Fingerprint, 
  UploadCloud, 
  Download, 
  Trash2, 
  ShieldCheck, 
  Sparkles, 
  CheckCircle2, 
  Copy, 
  FileVideo, 
  FileImage, 
  AlertCircle,
  Archive,
  RefreshCw,
  Eye
} from 'lucide-react';
import JSZip from 'jszip';
import { 
  camouflageImage, 
  camouflageVideo, 
  formatBytes, 
  CamouflagedFileResult 
} from '@/lib/creative-camouflager';

export default function CamufladorPage() {
  const [files, setFiles] = useState<CamouflagedFileResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (fileList: FileList | File[]) => {
    setIsProcessing(true);
    const newResults: CamouflagedFileResult[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        if (file.type.startsWith('image/')) {
          const res = await camouflageImage(file);
          newResults.push(res);
        } else if (file.type.startsWith('video/') || file.name.match(/\.(mp4|mov|webm)$/i)) {
          const res = await camouflageVideo(file);
          newResults.push(res);
        } else {
          // Arquivo não suportado
          console.warn(`Tipo de arquivo não suportado: ${file.name}`);
        }
      } catch (err: any) {
        console.error(`Erro ao camuflar ${file.name}:`, err);
      }
    }

    setFiles((prev) => [...prev, ...newResults]);
    setIsProcessing(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDownloadSingle = (item: CamouflagedFileResult) => {
    const url = URL.createObjectURL(item.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.camouflagedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadZip = async () => {
    if (files.length === 0) return;
    const zip = new JSZip();

    files.forEach((f) => {
      zip.file(f.camouflagedName, f.blob);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `criativos_camuflados_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Fingerprint className="w-5 h-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              Camuflador de Criativos ADS
            </h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Anti-Bloqueio
            </span>
          </div>
          <p className="text-sm text-neutral-400">
            Limpe rastros de EXIF, coordenadas de GPS e altere a assinatura digital (Hash MD5/SHA) para subir criativos no Meta, TikTok e Google sem ser detectado como anúncio duplicado.
          </p>
        </div>

        {files.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFiles([])}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-neutral-300 transition-colors"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
              Limpar Lista
            </button>
            <button
              onClick={handleDownloadZip}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-bold text-white shadow-lg shadow-blue-600/20 transition-all"
            >
              <Archive className="w-4 h-4" />
              Baixar Todos (.ZIP)
            </button>
          </div>
        )}
      </div>

      {/* Upload Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 md:p-12 text-center cursor-pointer transition-all duration-200 ${
          dragActive 
            ? 'border-blue-500 bg-blue-500/10 scale-[1.01]' 
            : 'border-white/15 bg-[#0e1117] hover:border-white/30 hover:bg-[#121620]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              processFiles(e.target.files);
            }
          }}
        />

        <div className="max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-b from-blue-500/20 to-indigo-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            {isProcessing ? (
              <RefreshCw className="w-8 h-8 animate-spin" />
            ) : (
              <UploadCloud className="w-8 h-8" />
            )}
          </div>

          <div>
            <h3 className="text-base font-semibold text-white">
              {isProcessing ? 'Processando e camuflando arquivos...' : 'Arraste imagens ou vídeos aqui'}
            </h3>
            <p className="text-xs text-neutral-400 mt-1">
              Suporte a MP4, MOV, WEBM, JPG, PNG e WEBP (sem limite de tamanho).
            </p>
          </div>

          <div className="flex items-center justify-center gap-4 text-[11px] text-neutral-500">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 100% Processado no Navegador
            </span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> Remoção Total de Metadados
            </span>
          </div>
        </div>
      </div>

      {/* Lista de Criativos Camuflados */}
      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-400">
              Arquivos Processados ({files.length})
            </h2>
            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Todos os arquivos possuem Hash único
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {files.map((file) => (
              <div
                key={file.id}
                className="bg-[#0e1117] border border-white/10 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-white/20 transition-colors"
              >
                {/* Info & Icon */}
                <div className="flex items-start md:items-center gap-3.5 min-w-0">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 shrink-0 text-neutral-300">
                    {file.type === 'video' ? (
                      <FileVideo className="w-5 h-5 text-purple-400" />
                    ) : (
                      <FileImage className="w-5 h-5 text-blue-400" />
                    )}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white truncate max-w-[280px] md:max-w-md">
                        {file.camouflagedName}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                        NOVO HASH
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                      <span>Orig: {file.originalName}</span>
                      <span>•</span>
                      <span>{formatBytes(file.camouflagedSize)}</span>
                      <span>•</span>
                      <span className="text-emerald-400 font-medium">EXIF/GPS Removido</span>
                    </div>
                  </div>
                </div>

                {/* Hashes Comparativos */}
                <div className="flex flex-col md:flex-row md:items-center gap-4 text-xs font-mono shrink-0">
                  <div className="bg-black/40 border border-white/5 rounded-lg px-3 py-1.5">
                    <div className="text-[10px] text-neutral-500 uppercase">Hash Antigo:</div>
                    <div className="text-neutral-400 flex items-center gap-1.5">
                      <span className="line-through">{file.originalHash.substring(0, 14)}...</span>
                    </div>
                  </div>

                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5">
                    <div className="text-[10px] text-emerald-400 uppercase font-semibold">Novo Hash MD5:</div>
                    <div className="text-emerald-300 font-bold flex items-center gap-2">
                      <span>{file.camouflagedHash.substring(0, 14)}...</span>
                      <button
                        onClick={() => copyToClipboard(file.camouflagedHash, file.id)}
                        className="text-neutral-400 hover:text-white transition-colors"
                        title="Copiar Hash Completo"
                      >
                        {copiedId === file.id ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Botão Baixar */}
                  <button
                    onClick={() => handleDownloadSingle(file)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-black hover:bg-neutral-200 text-xs font-bold transition-all shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dicas e FAQ sobre Anti-Bloqueio */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-white/10">
        <div className="bg-[#0e1117] border border-white/5 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs">
            <Fingerprint className="w-4 h-4" />
            Por que mudar o Hash MD5?
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Plataformas como o Facebook e TikTok salvam o hash dos anúncios bloqueados. Se você subir o mesmo criativo em outra conta, ele é banido imediatamente pelo robô. O camuflador gera um código hash inédito.
          </p>
        </div>

        <div className="bg-[#0e1117] border border-white/5 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
            <ShieldCheck className="w-4 h-4" />
            Remoção de Metadados EXIF
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Câmeras e celulares gravam localização GPS, marca do celular e datas dentro do arquivo. Ao camuflar, limpamos 100% dessas informações para evitar cruzamento de dados de identidade.
          </p>
        </div>

        <div className="bg-[#0e1117] border border-white/5 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-purple-400 font-semibold text-xs">
            <Sparkles className="w-4 h-4" />
            Vídeos Rápidos sem Perda
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Nosso algoritmo altera o byte-trailer de arquivos MP4/MOV instantaneamente, sem precisar renderizar ou comprimir. A qualidade do vídeo permanece 100% idêntica e sem atrasos.
          </p>
        </div>
      </div>
    </div>
  );
}
