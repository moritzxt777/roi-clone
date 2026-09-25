import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import { EditorClient } from '@/components/editor/editor-client';
import { getEditorData } from '@/lib/editor/get-editor-data';

export default async function ProjetoEditorPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user) redirect('/login');

  let targetUserId = session.user.id;
  let isAdmin = false;

  if (session.user.email) {
    const emailLower = session.user.email.toLowerCase();
    const dbUser = await prisma.user.findFirst({
      where: {
        OR: [
          ...(targetUserId ? [{ id: targetUserId }] : []),
          { email: emailLower },
        ],
      },
      select: { id: true, role: true },
    });
    if (dbUser) {
      targetUserId = dbUser.id;
      isAdmin =
        dbUser.role === 'ADMIN' ||
        emailLower === 'moritzadmin777roi@gmail.com' ||
        emailLower === 'moritzdoblack@proton.me';
    }
  }

  try {
    const editorData = await getEditorData(params.id, isAdmin ? undefined : targetUserId);
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
  } catch (err) {
    console.error('ProjetoEditorPage error:', err);
    redirect('/dashboard/clones');
  }
}
