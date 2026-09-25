'use client';

import { useState, useMemo } from 'react';
import { 
  Newspaper, 
  Sparkles, 
  Eye, 
  Download, 
  Globe, 
  Smartphone, 
  Monitor, 
  CheckCircle2, 
  Clock, 
  ExternalLink, 
  Plus, 
  Trash2,
  Copy,
  Layers,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { 
  AdvertorialConfig, 
  DEFAULT_COMMENTS, 
  generateAdvertorialHtml 
} from '@/lib/advertorial-templates';

export default function AdvertoriaisPage() {
  const [template, setTemplate] = useState<'g1' | 'r7' | 'uol' | 'neutro'>('g1');
  const [headline, setHeadline] = useState('Médicos e Especialistas Revelam Descoberta Inédita que Está Mudando a Vida de Brasileiros');
  const [subheadline, setSubheadline] = useState('Nova fórmula desenvolvida em laboratório nacional alcança 97.4% de eficácia em testes práticos e vira febre no país.');
  const [authorName, setAuthorName] = useState('Juliana Brandão');
  const [authorRole, setAuthorRole] = useState('Jornalista Especialista em Saúde');
  const [category, setCategory] = useState('BEM-ESTAR & SAÚDE');
  const [coverImage, setCoverImage] = useState('https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1200&auto=format&fit=crop&q=80');
  const [coverCaption, setCoverCaption] = useState('Especialistas durante a apresentação dos dados laboratoriais que comprovaram a eficiência do novo tratamento.');
  
  const [bodyText, setBodyText] = useState(
    `Nos últimos meses, um novo método vem chamando a atenção de profissionais e da comunidade médica em todo o país após a publicação de estudos independentes.\n\n` +
    `De acordo com os pesquisadores, a solução age diretamente na raiz do problema, proporcionando alívio e resultados visíveis logo nas primeiras semanas de aplicação contínua.\n\n` +
    `"Ficamos impressionados com a velocidade com que os voluntários relataram melhora significativa", explicou a equipe científica responsável pela supervisão clínica.\n\n` +
    `Com a alta procura provocada pela repercussão nas redes sociais e em canais de notícias, a distribuidora autorizada anunciou que está liberando as últimas unidades do lote promocional com envio prioritário para todo o Brasil.`
  );
  
  const [highlightQuote, setHighlightQuote] = useState('Os resultados superaram todas as expectativas iniciais dos ensaios clínicos.');
  const [ctaText, setCtaText] = useState('QUERO EXPERIMENTAR COM DESCONTO HOJE');
  const [ctaUrl, setCtaUrl] = useState('https://seusite.com/checkout');
  const [ctaSubtext, setCtaSubtext] = useState('Compra 100% Segura • Garantia Incondicional de 30 Dias');
  const [ctaDelaySeconds, setCtaDelaySeconds] = useState(0);
  const [urgencyText, setUrgencyText] = useState('Atenção: Apenas 17 frascos disponíveis no estoque nacional');
  const [comments, setComments] = useState(DEFAULT_COMMENTS);

  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Divide o texto do corpo em parágrafos
  const bodyParagraphs = useMemo(() => {
    return bodyText.split('\n\n').filter((p) => p.trim().length > 0);
  }, [bodyText]);

  // Monta a configuração do Advertorial
  const config: AdvertorialConfig = useMemo(() => {
    return {
      template,
      headline,
      subheadline,
      authorName,
      authorRole,
      category,
      coverImage,
      coverCaption,
      bodyParagraphs,
      highlightQuote,
      ctaText,
      ctaUrl,
      ctaSubtext,
      ctaDelaySeconds,
      urgencyText,
      comments,
    };
  }, [
    template,
    headline,
    subheadline,
    authorName,
    authorRole,
    category,
    coverImage,
    coverCaption,
    bodyParagraphs,
    highlightQuote,
    ctaText,
    ctaUrl,
    ctaSubtext,
    ctaDelaySeconds,
    urgencyText,
    comments,
  ]);

  const generatedHtml = useMemo(() => {
    return generateAdvertorialHtml(config);
  }, [config]);

  // Publicar no ROI Clone
  const handlePublish = async () => {
    setIsPublishing(true);
    setPublishedUrl(null);
    try {
      const res = await fetch('/api/advertoriais/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: headline.substring(0, 80),
          html: generatedHtml,
          config,
        }),
      });

      const data = await res.json();
      if (res.ok && data.url) {
        setPublishedUrl(data.url);
      } else {
        alert(data.error || 'Erro ao publicar advertorial.');
      }
    } catch (err: any) {
      alert('Erro de conexão ao publicar.');
    } finally {
      setIsPublishing(false);
    }
  };

  // Baixar código HTML puro
  const handleDownloadHtml = () => {
    const blob = new Blob([generatedHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `advertorial_${template}_${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyPublishedLink = () => {
    if (!publishedUrl) return;
    const fullUrl = `${window.location.origin}${publishedUrl}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
              <Newspaper className="w-5 h-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              Gerador de Advertoriais & Presells
            </h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30">
              Alta Conversão
            </span>
          </div>
          <p className="text-sm text-neutral-400">
            Crie páginas em estilo de reportagem jornalística (G1, R7, UOL) com comentários com fotos de brasileiros reais e delay de CTA para infoprodutos e e-commerce.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadHtml}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-neutral-300 transition-colors"
          >
            <Download className="w-4 h-4" />
            Baixar HTML
          </button>

          <button
            onClick={handlePublish}
            disabled={isPublishing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-xs font-bold text-white shadow-lg shadow-orange-600/20 transition-all disabled:opacity-50"
          >
            <Globe className="w-4 h-4" />
            {isPublishing ? 'Publicando...' : 'Publicar no ROI Clone'}
          </button>
        </div>
      </div>

      {/* Modal de Sucesso após Publicação */}
      {publishedUrl && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Advertorial Publicado com Sucesso!</h3>
              <p className="text-xs text-neutral-400">
                Sua reportagem já está no ar e pronta para receber tráfego direto ou ser usada no Cloaker.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyPublishedLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
            >
              {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedLink ? 'Copiado!' : 'Copiar Link'}
            </button>

            <a
              href={publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Abrir Página
            </a>

            <Link
              href="/dashboard/cloaker"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600/30 border border-blue-500/40 hover:bg-blue-600/40 text-blue-300 text-xs font-semibold transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              Vincular ao Cloaker
            </Link>
          </div>
        </div>
      )}

      {/* Grid Principal: Formulário na Esquerda, Preview na Direita */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Coluna de Configuração (Formulário) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Seletor de Modelo */}
          <div className="bg-[#0e1117] border border-white/10 rounded-2xl p-5 space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 block">
              Escolha o Formato da Notícia
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: 'g1', name: 'G1 Notícias', color: 'border-red-500 text-red-400', badge: 'Mais Vendido' },
                { id: 'r7', name: 'R7 Notícias', color: 'border-orange-500 text-orange-400', badge: 'Urgente' },
                { id: 'uol', name: 'UOL VivaBem', color: 'border-yellow-500 text-yellow-400', badge: 'Saúde' },
                { id: 'neutro', name: 'Portal Neutro', color: 'border-blue-500 text-blue-400', badge: 'Científico' },
              ].map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => setTemplate(tpl.id as any)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    template === tpl.id 
                      ? `bg-white/10 ${tpl.color} font-bold shadow-sm` 
                      : 'border-white/5 bg-white/[0.02] text-neutral-400 hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white">{tpl.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-neutral-400">
                      {tpl.badge}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Dados Principais da Matéria */}
          <div className="bg-[#0e1117] border border-white/10 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Conteúdo da Notícia
            </h3>

            <div>
              <label className="text-xs text-neutral-400 block mb-1.5">Manchete / Título Principal</label>
              <textarea
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                rows={2}
                className="w-full bg-[#141822] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-400 block mb-1.5">Subtítulo / Olho da Matéria</label>
              <textarea
                value={subheadline}
                onChange={(e) => setSubheadline(e.target.value)}
                rows={2}
                className="w-full bg-[#141822] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-neutral-400 block mb-1.5">Categoria / Editoria</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-[#141822] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-400 block mb-1.5">Nome do Repórter/Autor</label>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  className="w-full bg-[#141822] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-neutral-400 block mb-1.5">Imagem de Capa (URL)</label>
              <input
                type="text"
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                className="w-full bg-[#141822] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-400 block mb-1.5">Legenda da Foto de Capa</label>
              <input
                type="text"
                value={coverCaption}
                onChange={(e) => setCoverCaption(e.target.value)}
                className="w-full bg-[#141822] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-400 block mb-1.5">Corpo da Notícia (separe por linha em branco)</label>
              <textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={6}
                className="w-full bg-[#141822] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-orange-500 font-sans"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-400 block mb-1.5">Citação em Destaque</label>
              <input
                type="text"
                value={highlightQuote}
                onChange={(e) => setHighlightQuote(e.target.value)}
                className="w-full bg-[#141822] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Configuração da Oferta e CTA */}
          <div className="bg-[#0e1117] border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Botão de Oferta (CTA) & Pitch Delay
              </h3>
            </div>

            <div>
              <label className="text-xs text-neutral-400 block mb-1.5">Texto do Botão de Compra</label>
              <input
                type="text"
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                className="w-full bg-[#141822] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-400 block mb-1.5">Link de Destino / Checkout Oficial</label>
              <input
                type="url"
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="https://pay.hotmart.com/... ou seu checkout"
                className="w-full bg-[#141822] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-neutral-400 block mb-1.5">
                  Delay do Pitch (Segundos)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={600}
                    value={ctaDelaySeconds}
                    onChange={(e) => setCtaDelaySeconds(Number(e.target.value))}
                    className="w-full bg-[#141822] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <Clock className="w-4 h-4 text-neutral-500 shrink-0" />
                </div>
                <span className="text-[10px] text-neutral-500 mt-1 block">0 = aparece imediatamente</span>
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1.5">Gatilho de Urgência</label>
                <input
                  type="text"
                  value={urgencyText}
                  onChange={(e) => setUrgencyText(e.target.value)}
                  className="w-full bg-[#141822] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Coluna de Visualização ao Vivo (Preview) */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div className="flex items-center justify-between bg-[#0e1117] border border-white/10 rounded-xl px-4 py-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300">
              <Eye className="w-4 h-4 text-blue-400" />
              <span>Preview em Tempo Real</span>
            </div>

            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
              <button
                onClick={() => setPreviewMode('desktop')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  previewMode === 'desktop' ? 'bg-white/15 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                Desktop
              </button>
              <button
                onClick={() => setPreviewMode('mobile')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  previewMode === 'mobile' ? 'bg-white/15 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                Celular
              </button>
            </div>
          </div>

          {/* Container do Iframe */}
          <div className="bg-neutral-900 border border-white/10 rounded-2xl flex-1 min-h-[640px] flex items-center justify-center p-4 overflow-hidden shadow-2xl">
            <div
              className={`bg-white rounded-xl overflow-hidden shadow-2xl transition-all duration-300 ${
                previewMode === 'mobile' 
                  ? 'w-[375px] h-[680px] border-8 border-neutral-800 rounded-[36px]' 
                  : 'w-full h-[680px]'
              }`}
            >
              <iframe
                srcDoc={generatedHtml}
                title="Advertorial Preview"
                className="w-full h-full border-0 bg-white"
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
