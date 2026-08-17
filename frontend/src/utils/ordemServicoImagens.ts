export function parseOrdemServicoImagens(value: string | null | undefined): string[] {
  const raw = (value || '').trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((imagem): imagem is string => typeof imagem === 'string' && !!imagem.trim());
    }
    if (typeof parsed === 'string' && parsed.trim()) return [parsed];
  } catch {
    return [raw];
  }

  return [];
}

export function serializeOrdemServicoImagens(imagens: string[]): string {
  const clean = imagens.filter(imagem => imagem.trim());
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean[0];
  return JSON.stringify(clean);
}
