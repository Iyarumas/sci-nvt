-- Certificações: PDFs que são figura (escaneados, foto, "Microsoft Print to PDF" de uma imagem) e
-- fotos JPG/PNG passam a ser lidos com OCR. Marca quando o texto veio da leitura da imagem.
ALTER TABLE drive_datas ADD COLUMN IF NOT EXISTS lido_por_ocr BOOLEAN NOT NULL DEFAULT false;
