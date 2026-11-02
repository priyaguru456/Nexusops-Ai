import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";

async function generatePdf() {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Page 1
  const page1 = pdfDoc.addPage([600, 400]);
  page1.drawText("NexusOps General Workplace Standards and Guidelines", {
    x: 50,
    y: 350,
    size: 16,
    font,
    color: rgb(0, 0, 0),
  });
  page1.drawText("Section 1: Core values, operating principles, and office communications.", {
    x: 50,
    y: 310,
    size: 12,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });

  // Page 2
  const page2 = pdfDoc.addPage([600, 400]);
  page2.drawText("NexusOps Leave Policy: Full-time employees receive 25 days of paid annual leave.", {
    x: 50,
    y: 350,
    size: 14,
    font,
    color: rgb(0, 0, 0),
  });
  page2.drawText("Annual leave accrues monthly and requires standard manager approval.", {
    x: 50,
    y: 310,
    size: 12,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });

  const pdfBytes = await pdfDoc.save({ useObjectStreams: false });

  const paths = [
    path.resolve(__dirname, "../tests/fixtures/leave-policy.pdf"),
    path.resolve(__dirname, "../apps/web/tests/fixtures/leave-policy.pdf"),
    path.resolve(__dirname, "../apps/api/tests/fixtures/leave-policy.pdf"),
  ];

  for (const p of paths) {
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, pdfBytes);
    console.log("Saved fixture PDF to:", p);
  }
}

generatePdf().catch(console.error);
