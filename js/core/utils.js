export function extractOfferFeeFromText(text) {
  const match = (text || '').match(/([\d.,]+)\s*eur/i);
  return match ? match[1].replace(',', '.') : '0';
}

export function copyToClipboard(text, element) {
  navigator.clipboard.writeText(text).then(() => {
    if (element) {
      element.classList.add('copied');
      setTimeout(() => element.classList.remove('copied'), 1500);
    }
  });
}

export function normalizeThreshold(input) {
  const s = (input || '').toLowerCase().trim();
  if (/\bstandar[dt]\s*\+/.test(s)) return 'Standard+';
  if (/\bstandar[dt]\b/.test(s)) return 'Standard';
  return '';
}

export function extractThresholdFromRow(row) {
  if (!row) return '';
  const allText = Object.values(row)
    .map(v => (v == null ? '' : String(v)))
    .join(' ');
  return normalizeThreshold(allText);
}

export function extractThresholdFromSheet(sheet) {
  if (!sheet) return '';
  const allText = Object.keys(sheet)
    .filter(k => !k.startsWith('!'))
    .map(k => sheet[k]?.v)
    .map(v => (v == null ? '' : String(v)))
    .join(' ');
  return normalizeThreshold(allText);
}

// js/core/utils.js

export function normalize(str = '') {
  return String(str)
    .toLowerCase()
    .normalize('NFD') // išskaido diakritikus (pvz. ą -> a + diakritikas)
    .replace(/[\u0300-\u036f]/g, '') // pašalina diakritikus
    .replace(/\s+/g, ' ') // kelis tarpus paverčia į vieną
    .replace(/[^a-z0-9 ]/gi, '') // išvalo simbolius
    .trim();
}
