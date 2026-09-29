import { NextResponse } from "next/server";
import { authenticated } from "@/lib/auth";
import { searchPapers } from "@/lib/paper-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await authenticated()))
    return NextResponse.json(
      { error: "Sign in to search papers." },
      { status: 401 },
    );
  const query = new URL(request.url).searchParams.get("q") || "";
  if (query.trim().length < 2 || query.length > 160)
    return NextResponse.json(
      { error: "Enter between 2 and 160 characters." },
      { status: 400 },
    );
  try {
    return NextResponse.json(await searchPapers(query), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Live paper search is temporarily unavailable." },
      { status: 503 },
    );
  }
}
