const fs = require('fs');
const { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup, rgb, StandardFonts } = require('pdf-lib');

async function main() {
  const inputPath = process.argv[2] || 'public/templates/troca.pdf';
  const outputPath = process.argv[3] || 'public/templates/troca-form.pdf';

  const bytes = fs.readFileSync(inputPath);
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  const page = pdfDoc.getPage(0);
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Helper: y from top in mm → y from bottom in pontos
  const yMm = (mm) => height - (mm * 2.8346);

  // ─── SOLICITANTE ───
  const campos = [
    { name: 'nome_solicitante',      x: 78,  y: 68,  w: 100, h: 5, label: 'Nome Solicitante' },
    { name: 'cpf_solicitante',       x: 178, y: 68,  w: 40,  h: 5, label: 'CPF Solicitante' },
    { name: 'funcao_solicitante',    x: 225, y: 68,  w: 55,  h: 5, label: 'Função Solicitante' },
    { name: 'data_solicitada',       x: 290, y: 68,  w: 35,  h: 5, label: 'Data Solicitada' },

    // ─── SOLICITADO ───
    { name: 'nome_solicitado',       x: 78,  y: 93,  w: 100, h: 5, label: 'Nome Solicitado' },
    { name: 'cpf_solicitado',        x: 178, y: 93,  w: 40,  h: 5, label: 'CPF Solicitado' },
    { name: 'funcao_solicitado',     x: 225, y: 93,  w: 55,  h: 5, label: 'Função Solicitado' },
    { name: 'data_folga_solicitado', x: 290, y: 93,  w: 35,  h: 5, label: 'Data Folga' },

    // ─── JUSTIFICATIVA EMERGENCIAL ───
    { name: 'justificativa_emergencial', x: 20, y: 108, w: 295, h: 10, label: 'Justificativa Emergencial' },

    // ─── MOTIVO DA TROCA ───
    { name: 'motivo_troca',          x: 20,  y: 140, w: 295, h: 25, label: 'Motivo da Troca' },

    // ─── Datas Autentique (embaixo das assinaturas) ───
    { name: 'data_autentique_1',     x: 25,  y: 252, w: 40, h: 5, label: 'Data Assinatura Solicitante' },
    { name: 'data_autentique_2',     x: 105, y: 252, w: 40, h: 5, label: 'Data Assinatura Solicitado' },
    { name: 'data_autentique_3',     x: 185, y: 252, w: 40, h: 5, label: 'Data Assinatura Chefe Eq.' },
  ];

  for (const c of campos) {
    const field = form.createTextField(c.name);
    const xPt = c.x * 2.8346;
    const yPt = yMm(c.y);
    const wPt = c.w * 2.8346;
    const hPt = c.h * 2.8346;

    field.addToPage(page, { x: xPt, y: yPt - hPt, width: wPt, height: hPt, borderColor: rgb(0.8, 0.8, 0.8) });
    field.enableReadOnly();
    field.setFontSize(8);
  }

  // ─── CHECKBOXES ───
  const checkboxes = [
    { name: 'check_troca_sim',     x: 148, y: 155, label: '✓ Sim' },
    { name: 'check_troca_nao',     x: 180, y: 155, label: '✓ Não' },
    { name: 'check_deferido',      x: 228, y: 155, label: '✓ Deferido' },
    { name: 'check_indeferido',    x: 270, y: 155, label: '✓ Indeferido' },
  ];

  for (const cb of checkboxes) {
    const field = form.createCheckBox(cb.name);
    const xPt = cb.x * 2.8346;
    const yPt = yMm(cb.y);

    field.addToPage(page, { x: xPt, y: yPt - 14, width: 14, height: 14, borderColor: rgb(0.8, 0.8, 0.8) });
  }

  // ─── ASSINATURAS (campos invisíveis para posicionamento) ───
  const assinaturas = [
    { name: 'assinatura_solicitante',       x: 25,  y: 242, w: 65, label: 'Assinatura Solicitante' },
    { name: 'assinatura_solicitado',        x: 105, y: 242, w: 65, label: 'Assinatura Solicitado' },
    { name: 'assinatura_chefe_solicitante', x: 25,  y: 262, w: 65, label: 'Assinatura Chefe Eq. Sol.' },
    { name: 'assinatura_chefe_solicitado',  x: 105, y: 262, w: 65, label: 'Assinatura Chefe Eq. Soli.' },
    { name: 'assinatura_gerente',           x: 185, y: 262, w: 65, label: 'Assinatura Gerente' },
  ];

  for (const a of assinaturas) {
    const field = form.createTextField(a.name);
    const xPt = a.x * 2.8346;
    const yPt = yMm(a.y);
    const wPt = a.w * 2.8346;

    field.addToPage(page, { x: xPt, y: yPt - 14, width: wPt, height: 14, borderColor: rgb(0.9, 0.9, 0.9) });
    field.enableReadOnly();
    field.setFontSize(8);
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);

  const fields = form.getFields();
  console.log(`✅ ${fields.length} campos AcroForm criados!`);
  console.log(`📄 Arquivo salvo: ${outputPath}`);
  console.log('\nCampos criados:');
  fields.forEach(f => console.log(`  - ${f.getName()} (${f.constructor.name})`));
}

main().catch(err => { console.error('❌ Erro:', err.message); process.exit(1); });
