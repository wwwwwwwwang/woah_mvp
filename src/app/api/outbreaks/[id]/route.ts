import { NextResponse } from "next/server";

import { getOutbreakDetail } from "@/lib/queries";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const outbreak = await getOutbreakDetail(id);

  if (!outbreak) {
    return NextResponse.json({ error: "Outbreak not found" }, { status: 404 });
  }

  return NextResponse.json({ data: outbreak });
}
