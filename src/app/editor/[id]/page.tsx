import { redirect } from 'next/navigation';

export default async function EditorPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  redirect(`/dashboard/projeto/${params.id}`);
}
