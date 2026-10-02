"use client";

import { useParams } from "next/navigation";
import { PaperView } from "@/components/paper-view";

// Known papers already live in the shared provider. Render them while the route
// loads, so neither the route request nor the queue write holds up the reader.
export default function Loading() {
  const { id } = useParams<{ id: string }>();
  return <PaperView id={decodeURIComponent(id)} />;
}
