import { QuestPage } from '@/components/Pages';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuestPage base="/iso" id={id} />;
}
