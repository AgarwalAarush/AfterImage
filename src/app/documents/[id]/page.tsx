import { DocumentReader } from "@/components/document-reader";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DocumentReader id={id} />;
}
