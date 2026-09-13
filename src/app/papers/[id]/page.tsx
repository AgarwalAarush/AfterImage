import { PaperView } from "@/components/paper-view";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PaperView id={decodeURIComponent(id)} />;
}
