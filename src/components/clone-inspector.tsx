'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Download,
  HardDriveDownload,
  Activity,
  Image as ImageIcon,
  Loader2,
  ChevronRight,
} from 'lucide-react';

interface HealthIssue {
  kind: string;
  url: string;
  status: number | null;
  severity: string;
  detail: string;
}

interface HealthReport {
  ok: boolean;
  checked: number;
  broken: number;
  externalOrigins: string[];
  externalCount: number;
  issues: HealthIssue[];
  notes: string[];
}

interface MirrorInventory {
  total: number;
  bytes: number;
  byStatus: Array<{ status: string; count: number; bytes: number }>;
}

interface CaptureInventory {
  recorded: number;
  byStatus: Array<{ status: string; count: number; bytes: number }>;
}

export function CloneInspector({ pageId }: { pageId: string }) {
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [mirror, setMirror] = useState<MirrorInventory | null>(null);
  const [capture, setCapture] = useState<CaptureInventory | null>(null);
  const [checking, setChecking] = useState(false);
  const [mirroring, setMirroring] = useState(false);
  const [message, setMessage] = useState<{ tone: 'erro' | 'ok' | 'neutro'; text: string } | null>(null);

  const loadInventory = useCallback(async () => {
    try {
      const [mirrorRes, captureRes] = await Promise.all([
        fetch(`/api/pages/${pageId}/mirror`),
        fetch(`/api/pages/${pageId}/capture`),
      ]);
      if (mirrorRes.ok) setMirror(await mirrorRes.json());
      if (captureRes.ok) setCapture(await captureRes.json());
    } catch {
      setMessage({ tone: 'erro', text: 'Falha ao carregar o inventário.' });
    }
  }, [pageId]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const runHealthCheck = async () => {
    setChecking(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/pages/${pageId}/health`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ tone: 'erro', text: data?.error ?? 'Falha na verificação.' });
        return;
      }
      setHealth(data.report);
      setMessage(
        data.report.ok
          ? { tone: 'ok', text: `${data.report.checked} recurso(s) verificado(s), nenhum quebrado.` }
          : { tone: 'erro', text: `${data.report.broken} de ${data.report.checked} recurso(s) não respondem.` }
      );
    } catch {
      setMessage({ tone: 'erro', text: 'Não foi possível rodar a verificação.' });
    } finally {
      setChecking(false);
    }
  };

  const runMirror = async (refresh: boolean) => {
    setMirroring(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/pages/${pageId}/mirror`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ tone: 'erro', text: data?.error ?? 'Falha ao espelhar.' });
        return;
      }
      await loadInventory();
      setMessage({
        tone: data.report.stored > 0 ? 'ok' : 'neutro',
        text: data.report.stored > 0
          ? `${data.report.stored} recurso(s) espelhado(s), ${formatBytes(data.report.bytesStored)}. ${data.report.referencesRewritten} referência(s) reescrita(s).`
          : `Nada foi espelhado. ${data.report.notes.join(' ')}`,
      });
    } catch {
      setMessage({ tone: 'erro', text: 'Não foi possível espelhar os recursos.' });
    } finally {
      setMirroring(false);
    }
  };

  const readyAssets = mirror?.byStatus.find((s) => s.status === 'READY');
  const failedAssets = mirror?.byStatus.find((s) => s.status === 'FAILED');
  const largeAssets = mirror?.byStatus.find((s) => s.status === 'SKIPPED_TOO_LARGE');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          icon={ShieldCheck}
          tone="text-emerald-400"
          label="Saúde do clone"
          value={health ? (health.ok ? 'OK' : `${health.broken} falhas`) : '—'}
          hint={health ? `${health.checked} recursos verificados` : 'não verificado ainda'}
        />
        <StatCard
          icon={HardDriveDownload}
          tone="text-blue-400"
          label="Recursos espelhados"
          value={readyAssets ? readyAssets.count : 0}
          hint={readyAssets ? formatBytes(readyAssets.bytes) : 'nenhum armazenado'}
        />
        <StatCard
          icon={Activity}
          tone="text-purple-400"
          label="Chamadas de API gravadas"
          value={capture?.recorded ?? 0}
          hint={capture?.recorded ? 'replay ativo' : 'sem captura'}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ActionButton onClick={runHealthCheck} busy={checking} icon={ShieldCheck} tone="emerald">
          Verificar saúde do clone
        </ActionButton>
        <ActionButton onClick={() => runMirror(false)} busy={mirroring} icon={Download} tone="blue">
          Espelhar recursos
        </ActionButton>
        <ActionButton onClick={() => runMirror(true)} busy={mirroring} icon={RefreshCw} tone="neutral">
          Re-espelhar do zero
        </ActionButton>
        {checking && <span className="text-[11px] text-neutral-500">Sonda cada recurso; leva alguns segundos.</span>}
      </div>

      {message && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
            message.tone === 'ok'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : message.tone === 'erro'
                ? 'bg-red-500/10 border-red-500/30 text-red-300'
                : 'bg-white/[0.03] border-white/10 text-neutral-300'
          }`}
        >
          {message.tone === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {health && (
        <div className="space-y-3">
          {health.notes.map((note, index) => (
            <p key={index} className="text-[11px] text-neutral-500 flex items-start gap-1.5">
              <ChevronRight className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{note}</span>
            </p>
          ))}

          {health.issues.length > 0 && (
            <div className="bg-[#0e1117] border border-white/10 rounded-xl divide-y divide-white/5 max-h-72 overflow-y-auto">
              {health.issues.map((issue, index) => (
                <div key={index} className="px-3 py-2.5 flex items-start gap-3">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
                    {issue.status ?? 'ERRO'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-neutral-200">
                      {issue.kind} — {issue.detail}
                    </p>
                    <p className="text-[10px] text-neutral-600 font-mono break-all mt-0.5">
                      {issue.url.length > 150 ? `${issue.url.slice(0, 150)}…` : issue.url}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(failedAssets || largeAssets) && (
        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-[11px] text-amber-300 space-y-1">
          {failedAssets && <p>{failedAssets.count} recurso(s) falharam no download e continuam apontando para a origem.</p>}
          {largeAssets && <p>{largeAssets.count} recurso(s) acima do limite de tamanho não foram armazenados.</p>}
        </div>
      )}

      {capture?.recorded === 0 && (
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 text-[11px] text-neutral-400 flex items-start gap-2">
          <ImageIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            Nenhuma chamada de API foi gravada. A gravação exige o motor com navegador real — o
            caminho HTTP não observa requisições. Se esta página é uma SPA, ela provavelmente
            depende do backend original.
          </span>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: typeof ShieldCheck;
  tone: string;
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div className="bg-[#0e1117] border border-white/10 rounded-xl p-4">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3.5 h-3.5 ${tone}`} />
        <span className="text-[10px] uppercase font-semibold text-neutral-500">{label}</span>
      </div>
      <div className="text-xl font-bold text-white">{value}</div>
      <span className="text-[10px] text-neutral-600">{hint}</span>
    </div>
  );
}

function ActionButton({
  onClick,
  busy,
  icon: Icon,
  tone,
  children,
}: {
  onClick: () => void;
  busy: boolean;
  icon: typeof ShieldCheck;
  tone: 'emerald' | 'blue' | 'neutral';
  children: React.ReactNode;
}) {
  const tones = {
    emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20',
    blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20',
    neutral: 'bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors disabled:opacity-50 ${tones[tone]}`}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      {children}
    </button>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export default CloneInspector;
