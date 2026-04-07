import { NextResponse } from "next/server";

import { getSyncJobDetail } from "@/lib/sync";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const job = await getSyncJobDetail(id);

  if (!job) {
    return NextResponse.json({ error: "Sync job not found" }, { status: 404 });
  }

  return NextResponse.json({ job });
}
