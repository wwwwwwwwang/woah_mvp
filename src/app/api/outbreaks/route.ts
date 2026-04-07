import { NextResponse } from "next/server";

import { listOutbreaks } from "@/lib/queries";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const outbreaks = await listOutbreaks(Object.fromEntries(url.searchParams.entries()));

  return NextResponse.json({ data: outbreaks });
}
