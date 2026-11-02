const fs = require("fs");
const path = require("path");

// Construct a valid, standard 2-page PDF 1.4 document
function generateTwoPagePdf(page1Text, page2Text) {
  const content1 = `BT /F1 12 Tf 50 700 Td (${page1Text}) Tj ET`;
  const content2 = `BT /F1 12 Tf 50 700 Td (${page2Text}) Tj ET`;

  const objects = [];
  function addObject(str) {
    const objNum = objects.length + 1;
    objects.push({ num: objNum, str });
    return objNum;
  }

  // 1: Catalog
  addObject("<< /Type /Catalog /Pages 2 0 R >>");
  // 2: Pages
  addObject("<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>");
  // 3: Page 1
  addObject("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>");
  // 4: Page 2
  addObject("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>");
  // 5: Font Helvetica
  addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  // 6: Content Page 1
  addObject(`<< /Length ${content1.length} >>\nstream\n${content1}\nendstream`);
  // 7: Content Page 2
  addObject(`<< /Length ${content2.length} >>\nstream\n${content2}\nendstream`);

  let pdf = "%PDF-1.4\n";
  const xrefOffsets = [];

  for (const obj of objects) {
    xrefOffsets.push(Buffer.byteLength(pdf, "binary"));
    pdf += `${obj.num} 0 obj\n${obj.str}\nendobj\n`;
  }

  const xrefStart = Buffer.byteLength(pdf, "binary");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of xrefOffsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(pdf, "binary");
}

const p1 = "NexusOps Enterprise Operational Standards - Section 1 Introduction";
const p2 = "NexusOps Leave Policy: Full-time employees receive 25 days of paid annual leave.";

const pdfBuffer = generateTwoPagePdf(p1, p2);

const targetDirs = [
  path.resolve(__dirname, "../tests/fixtures"),
  path.resolve(__dirname, "../apps/web/tests/fixtures"),
  path.resolve(__dirname, "../apps/api/tests/fixtures"),
];

for (const dir of targetDirs) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "leave-policy.pdf"), pdfBuffer);
  console.log("Wrote fixture PDF to:", path.join(dir, "leave-policy.pdf"));
}
