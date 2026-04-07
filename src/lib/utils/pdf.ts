import { PDFParse } from "pdf-parse";

export interface ParsedPdfText {
  pageCount: number;
  text: string;
}

export async function parsePdfText(data: ArrayBuffer | Buffer): Promise<ParsedPdfText> {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const parser = new PDFParse({ data: buffer });

  try {
    const parsed = await parser.getText();
    return {
      pageCount: parsed.total,
      text: parsed.text,
    };
  } finally {
    await parser.destroy();
  }
}
