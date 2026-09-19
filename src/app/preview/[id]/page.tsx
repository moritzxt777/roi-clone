import { auth } from '@/lib/auth';
import { notFound } from 'next/navigation';
import { getEditorData } from '@/lib/editor/get-editor-data';

export default async function PreviewPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth();

  const editorData = await getEditorData(params.id, session?.user?.id || '');
  if (!editorData) notFound();

  // Inject base href so all original images and styles resolve
  let fullHtml = editorData.html || '';
  if (editorData.sourceUrl && !fullHtml.includes('<base')) {
    const baseTag = `<base href="${editorData.sourceUrl}" />`;
    if (fullHtml.includes('<head>')) {
      fullHtml = fullHtml.replace('<head>', `<head>${baseTag}`);
    } else {
      fullHtml = baseTag + fullHtml;
    }
  }

  return (
    <div className="w-screen h-screen m-0 p-0 overflow-auto">
      <iframe
        srcDoc={fullHtml}
        title="Live Preview"
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    </div>
  );
}
