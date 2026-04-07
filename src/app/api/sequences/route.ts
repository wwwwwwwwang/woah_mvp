import { NextResponse } from "next/server";

import { listSequences } from "@/lib/queries";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sequences = await listSequences(Object.fromEntries(url.searchParams.entries()));

  return NextResponse.json({ data: sequences });
}
