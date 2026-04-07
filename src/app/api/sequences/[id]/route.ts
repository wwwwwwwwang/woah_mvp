import { NextResponse } from "next/server";

import { getSequenceDetail } from "@/lib/queries";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const sequence = await getSequenceDetail(id);

  if (!sequence) {
    return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
  }

  return NextResponse.json({ data: sequence });
}
