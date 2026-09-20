import { auth } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';
import { EditorClient } from '@/components/editor/editor-client';
import { getEditorData } from '@/lib/editor/get-editor-data';

export default async function EditorPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user) redirect('/login');

  const editorData = await getEditorData(params.id, session.user.id);
  if (!editorData) {
    redirect('/dashboard');
  }

  return (
    <EditorClient 
      pageId={editorData.pageId}
      cloneId={editorData.cloneId}
      sourceUrl={editorData.sourceUrl}
      initialElements={editorData.initialElements} 
      projectName={editorData.projectName}
      css={editorData.css}
      html={editorData.html}
      availablePages={editorData.availablePages}
      discoveredSubpages={editorData.discoveredSubpages}
      meta={editorData.meta}
    />
  );
}
