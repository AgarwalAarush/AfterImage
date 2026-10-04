import { notFound } from "next/navigation";
import { WorkspaceReview } from "@/components/workspace-review";
export const dynamic = "force-dynamic";
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <WorkspaceReview />;
}
