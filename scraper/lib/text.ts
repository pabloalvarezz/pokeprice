// Normalización de texto para comparar títulos de producto entre tiendas e idiomas.

const STOP = new Set(['y', 'and', 'et', 'und', 'e', 'the', 'el', 'la', 'de', 'del', 'of', 'pokemon', 'tcg', 'jcc', 'ptcg']);

/** minúsculas, sin acentos (latinos), sin puntuación, espacios simples. Mantiene CJK/hangul. */
export function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’'`´]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Igual que norm() pero quitando palabras vacías. Se aplica a alias y a títulos por igual. */
export function key(s: string): string {
  return norm(s)
    .split(' ')
    .filter((w) => w && !STOP.has(w))
    .join(' ');
}

export function slug(s: string): string {
  return norm(s).replace(/ /g, '-');
}

export const hasKana = (s: string) => /[぀-ヿ]/.test(s);
export const hasHangul = (s: string) => /[가-힯ᄀ-ᇿ]/.test(s);
export const hasHan = (s: string) => /[一-鿿]/.test(s);

export function stripHtml(s: string | null | undefined): string {
  return (s ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/** "1.234,56 €" | "€1,234.56" | "¥12,800" → número */
export function parsePrice(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  // "19,95 € IVA incl." → "19,95" (sin el punto de "incl.", que lo convertiría en 1995)
  let s = raw.replace(/[^\d.,]/g, '').replace(/^[.,]+|[.,]+$/g, '');
  if (!s) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    // coma decimal (formato europeo) salvo que sea separador de miles (3 cifras detrás)
    const decimals = s.length - lastComma - 1;
    s = decimals === 3 && lastDot === -1 ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // punto decimal, salvo "1.234" (punto de miles europeo: 3 cifras detrás y sin coma)
    const decimals = s.length - lastDot - 1;
    s = decimals === 3 && lastComma === -1 ? s.replace(/\./g, '') : s.replace(/,/g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
