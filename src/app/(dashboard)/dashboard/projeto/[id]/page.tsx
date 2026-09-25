import { auth } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';
import { EditorClient } from '@/components/editor/editor-client';
import { getEditorData } from '@/lib/editor/get-editor-data';

export default async function ProjetoEditorPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user) redirect('/login');

  let targetUserId = session.user.id;
  if (session.user.email) {
    const dbUser = await prisma.user.findFirst({
      where: {
        OR: [
          ...(targetUserId ? [{ id: targetUserId }] : []),
          { email: session.user.email.toLowerCase() },
        ],
      },
      select: { id: true },
    });
    if (dbUser) targetUserId = dbUser.id;
  }

  const editorData = await getEditorData(params.id, targetUserId);
  if (!editorData) {
    redirect('/dashboard/clones');
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
