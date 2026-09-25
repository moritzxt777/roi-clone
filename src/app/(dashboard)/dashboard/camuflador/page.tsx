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
  Loader2,
  MapPinOff,
  Ruler,
} from 'lucide-react';
import JSZip from 'jszip';
import {
  camouflageImage,
  camouflageVideo,
  formatBytes,
  HASH_BITS,
  MIN_EFFECTIVE_DISTANCE,
  type CamouflagedFileResult,
} from '@/lib/creative-camouflager';

export default function CamufladorPage() {
  const [files, setFiles] = useState<CamouflagedFileResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (fileList: FileList | File[]) => {
    setIsProcessing(true);
    setErrors([]);
    const collected: CamouflagedFileResult[] = [];
    const failed: string[] = [];
    const total = fileList.length;

    for (let i = 0; i < total; i++) {
      const file = fileList[i];
      setProgress(`${i + 1} de ${total} — ${file.name}`);

      try {
        const isVideo =
          file.type.startsWith('video/') || /\.(mp4|mov|webm|mkv)$/i.test(file.name);

        if (file.type.startsWith('image/')) {
          collected.push(await camouflageImage(file));
        } else if (isVideo) {
          collected.push(await camouflageVideo(file));
        } else {
          failed.push(`${file.name}: formato não suportado (use imagem, MP4, MOV, WEBM ou MKV).`);
        }
      } catch (error) {
        failed.push(`${file.name}: ${error instanceof Error ? error.message : 'erro desconhecido'}.`);
      }
    }

    setFiles((prev) => [...prev, ...collected]);
    if (failed.length > 0) setErrors((prev) => [...prev, ...failed]);
    setProgress('');
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
    files.forEach((f) => zip.file(f.camouflagedName, f.blob));
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

  const done = files.filter((f) => f.status === 'done');
  const mutated = done.filter((f) => f.perceptualMutation);
  const metadataCleaned = done.filter((f) => f.exifStripped);

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Fingerprint className="w-5 h-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              Camuflador de Criativos
            </h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Verificado
            </span>
          </div>
          <p className="text-sm text-neutral-400">
            Remove metadados de identificação do arquivo e altera a impressão digital visual do
            criativo. Toda transformação é medida antes de ser aprovada — o painel mostra a
            distância real, não uma promessa.
          </p>
        </div>

        {files.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFiles([])}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-neutral-300 transition-colors"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
              Limpar
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

      {errors.length > 0 && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 space-y-1">
          {errors.map((message, index) => (
            <div key={index} className="text-xs text-red-300 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{message}</span>
            </div>
          ))}
        </div>
      )}

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 md:p-12 text-center cursor-pointer transition-all duration-200 ${
          dragActive
            ? 'border-blue-500 bg-blue-500/10 scale-[1.01]'
            : 'border-white/15 bg-[#0e1117] hover:border-white/30 hover:bg-[#121620]'
        } ${isProcessing ? 'pointer-events-none' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,.mkv"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) processFiles(e.target.files);
          }}
        />

        <div className="max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-b from-blue-500/20 to-indigo-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            {isProcessing ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <UploadCloud className="w-8 h-8" />
            )}
          </div>

          <div>
            <h3 className="text-base font-semibold text-white">
              {isProcessing ? 'Processando criativos...' : 'Arraste imagens ou vídeos aqui'}
            </h3>
            <p className="text-xs text-neutral-400 mt-1 min-h-4">
              {isProcessing ? progress : 'MP4, MOV, WEBM, MKV, JPG, PNG e WEBP. Processado no seu navegador.'}
            </p>
          </div>

          <div className="flex items-center justify-center gap-4 text-[11px] text-neutral-500">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Nada sai do seu computador
            </span>
            <span className="flex items-center gap-1">
              <Ruler className="w-3.5 h-3.5 text-blue-400" /> Resultado medido, não estimado
            </span>
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryTile label="Arquivos processados" value={done.length} tone="neutral" />
          <SummaryTile
            label="Metadados removidos"
            value={metadataCleaned.length}
            tone="emerald"
            hint="EXIF/GPS confirmado"
          />
          <SummaryTile
            label="Impressão digital alterada"
            value={mutated.length}
            tone="blue"
            hint={`>= ${MIN_EFFECTIVE_DISTANCE} de ${HASH_BITS} bits`}
          />
          <SummaryTile
            label="Hash de arquivo novo"
            value={done.filter((f) => f.originalHash !== f.camouflagedHash).length}
            tone="purple"
            hint="MD5 do container"
          />
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-400">
            Resultados ({files.length})
          </h2>

          <div className="grid grid-cols-1 gap-3">
            {files.map((file) => (
              <FileResultCard
                key={file.id}
                file={file}
                onDownload={() => handleDownloadSingle(file)}
                onCopyHash={() => copyToClipboard(file.camouflagedHash, file.id)}
                copied={copiedId === file.id}
              />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-white/10">
        <InfoCard
          icon={MapPinOff}
          tone="text-blue-400"
          title="Metadados realmente removidos"
        >
          Em vídeo, o container é interpretado de verdade: o bloco de metadados do usuário
          (que guarda a coordenada GPS e a data de gravação) é zerado, e os carimbos de
          criação e modificação dos atomos de cabeçalho são neutralizados. Em imagem, a
          redecodificação para pixels descarta EXIF por construção — não existe caminho pelo
          qual ele sobreviva.
        </InfoCard>

        <InfoCard icon={Ruler} tone="text-emerald-400" title="A mudança visual é medida">
          O que as plataformas comparam não é o hash do arquivo, e sim a impressão digital do
          conteúdo decodificado. Aqui a impressão digital é comparada antes e depois em{' '}
          {HASH_BITS} bits, e a mutação só é aprovada se a distância passar de{' '}
          {MIN_EFFECTIVE_DISTANCE}. Quando não passa, o resultado diz que não passou.
        </InfoCard>

        <InfoCard icon={Sparkles} tone="text-purple-400" title="Por que zoom e não ruído">
          A comparação de células vizinhas é invariante a brilho uniforme e a ruído fino
          depois da redução — medido: brilho dá 1 bit, ruído dá 6, e um simples re-encode sem
          nenhuma alteração dá até 13. Alterar a fase de reamostragem com um zoom de 1% a 4%
          é o que produz mudança mensurável sem diferença visível.
        </InfoCard>
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'emerald' | 'blue' | 'purple';
  hint?: string;
}) {
  const tones = {
    neutral: 'text-white',
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
  };
  return (
    <div className="bg-[#0e1117] border border-white/10 rounded-xl p-4">
      <span className="text-[10px] uppercase font-semibold text-neutral-500">{label}</span>
      <div className={`text-2xl font-bold mt-1 ${tones[tone]}`}>{value}</div>
      {hint && <span className="text-[10px] text-neutral-600 mt-0.5 block">{hint}</span>}
    </div>
  );
}

function FileResultCard({
  file,
  onDownload,
  onCopyHash,
  copied,
}: {
  file: CamouflagedFileResult;
  onDownload: () => void;
  onCopyHash: () => void;
  copied: boolean;
}) {
  const failed = file.status === 'error';

  return (
    <div
      className={`bg-[#0e1117] border rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
        failed ? 'border-red-500/30' : 'border-white/10'
      }`}
    >
      <div className="flex items-start gap-3.5 min-w-0">
        <div className="p-3 rounded-xl bg-white/5 border border-white/10 shrink-0">
          {file.type === 'video' ? (
            <FileVideo className="w-5 h-5 text-purple-400" />
          ) : (
            <FileImage className="w-5 h-5 text-blue-400" />
          )}
        </div>

        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate max-w-[240px] md:max-w-md">
              {failed ? file.originalName : file.camouflagedName}
            </span>
            {failed ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-mono">
                FALHOU
              </span>
            ) : (
              <Badge ok={file.exifStripped} okLabel="METADADOS OK" failLabel="METADADOS PRESENTES" />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs text-neutral-500">
            <span>Orig: {file.originalName}</span>
            <span>•</span>
            <span>
              {formatBytes(file.originalSize)} → {formatBytes(file.camouflagedSize)}
            </span>
            <span>•</span>
            <span className="font-mono text-neutral-400">{file.mimeType}</span>
          </div>

          {failed && file.error && (
            <p className="text-xs text-red-400">{file.error}</p>
          )}

          {!failed && file.notes.map((note, index) => (
            <p key={index} className="text-xs text-amber-400/90 flex items-start gap-1.5">
              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{note}</span>
            </p>
          ))}

          {!failed && file.metadataReport.length > 0 && (
            <details className="text-xs text-neutral-500">
              <summary className="cursor-pointer hover:text-neutral-300 select-none">
                {file.metadataReport.length} registro(s) de metadado tratado(s)
              </summary>
              <ul className="mt-1 space-y-0.5 pl-4 list-disc">
                {file.metadataReport.map((entry, index) => (
                  <li key={index} className="text-neutral-600 break-words">
                    {entry}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>

      {!failed && (
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 text-xs font-mono shrink-0">
          <div className="bg-black/40 border border-white/5 rounded-lg px-3 py-1.5">
            <div className="text-[10px] text-neutral-500 uppercase">Hash anterior</div>
            <div className="text-neutral-500 line-through">
              {file.originalHash.substring(0, 12)}...
            </div>
          </div>

          <div className="bg-black/40 border border-white/5 rounded-lg px-3 py-1.5">
            <div className="text-[10px] text-neutral-500 uppercase">Hash novo (MD5)</div>
            <div className="text-white font-bold flex items-center gap-2">
              {file.camouflagedHash.substring(0, 12)}...
              <button
                onClick={onCopyHash}
                className="text-neutral-400 hover:text-white transition-colors"
                title="Copiar hash completo"
              >
                {copied ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {file.type === 'image' && (
            <div
              className={`rounded-lg px-3 py-1.5 border ${
                file.perceptualMutation
                  ? 'bg-blue-500/10 border-blue-500/25'
                  : 'bg-white/[0.02] border-white/5'
              }`}
            >
              <div className="text-[10px] uppercase text-neutral-500">
                Impressão digital
              </div>
              <div
                className={`font-bold ${
                  file.perceptualMutation ? 'text-blue-300' : 'text-neutral-500'
                }`}
              >
                {file.perceptualDistance > 0
                  ? `${file.perceptualDistance} / ${HASH_BITS} bits`
                  : 'sem alteração'}
              </div>
            </div>
          )}

          <button
            onClick={onDownload}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-black hover:bg-neutral-200 text-xs font-bold transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Baixar
          </button>
        </div>
      )}
    </div>
  );
}

function Badge({ ok, okLabel, failLabel }: { ok: boolean; okLabel: string; failLabel: string }) {
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${
        ok
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      }`}
    >
      {ok ? okLabel : failLabel}
    </span>
  );
}

function InfoCard({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: typeof ShieldCheck;
  tone: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#0e1117] border border-white/5 rounded-xl p-4 space-y-2">
      <div className={`flex items-center gap-2 font-semibold text-xs ${tone}`}>
        <Icon className="w-4 h-4" />
        {title}
      </div>
      <p className="text-xs text-neutral-400 leading-relaxed">{children}</p>
    </div>
  );
}
