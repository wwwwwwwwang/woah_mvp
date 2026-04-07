import { NextResponse } from "next/server";
import { z } from "zod";

import { startManualSync } from "@/lib/sync";

export const runtime = "nodejs";

const syncSchema = z.object({
  sourceSystem: z.enum(["NCBI", "WHO", "WOAH", "CHINACDC"]),
  pathogenCode: z.enum(["NIPAH", "H5N1", "RVF", "XHFV"]),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = syncSchema.parse(body);
    const job = await startManualSync(input);

    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 500;

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown sync error" },
      { status },
    );
  }
}
