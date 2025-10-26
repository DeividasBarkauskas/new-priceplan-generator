// js/features/tariffs/extractTariffs.js
import { normalize } from '../../core/utils.js';

// Pagalbiniai getteriai
function cellText(sheet, addr) {
  const v = sheet?.[addr]?.v;
  return v == null ? '' : String(v).trim();
}

// Randam eilutę, kur stovi lentelės antraštė „Pavadinimas“
function findHeaderRow(sheet) {
  for (let r = 1; r <= 500; r++) {
    const t = cellText(sheet, `A${r}`).toLowerCase();
    if (t === 'pavadinimas') return r;
  }
  return -1;
}

export function extractTariffRowsFromSheet(sheet) {
  const rows = [];

  // 1) Nustatom nuo kur pradėti
  let startHeader = findHeaderRow(sheet); // pvz., 28
  let startRow = startHeader > -1 ? startHeader + 1 : 29;

  let emptyInA = 0;
  let lastTariffRow = startRow - 1;

  // 2) Einam per tarifų zoną ir susirenkam eilutes
  for (let r = startRow; r <= 500; r++) {
    const name = cellText(sheet, `A${r}`);

    if (!name) {
      emptyInA++;
      if (emptyInA >= 3) break; // tikėtina lentelės pabaiga
      continue;
    }
    emptyInA = 0;

    // reikšmė – pirma H, jei ten tuščia – ieškom nuo C iki AA/AB
    let value = cellText(sheet, `H${r}`);
    if (!value) {
      const cols = [
        'C','D','E','F','G','H','I','J','K','L','M','N',
        'O','P','Q','R','S','T','U','V','W','X','Y','Z','AA','AB'
      ];
      for (const c of cols) {
        const v = cellText(sheet, `${c}${r}`);
        if (v) { value = v; break; }
      }
    }

    // kaupiam (identifikavimą daro buildTariffSQL)
    if (name || value) {
      rows.push({ name, value, sort: rows.length + 1 });
      lastTariffRow = r; // atsimenam paskutinę realią tarifo eilutę
    }
  }

  // 3) Dinamiškai ieškom „pastraipos“ – ilgo teksto po paskutinės tarifo eilutės
  // skenuojam 1–3 eilutes žemyn ir C..AB stulpelius
  let paragraphValue = '';
  if (lastTariffRow >= startRow) {
    const searchRows = [lastTariffRow + 1, lastTariffRow + 2, lastTariffRow + 3];
    const cols = [
      'C','D','E','F','G','H','I','J','K','L','M','N',
      'O','P','Q','R','S','T','U','V','W','X','Y','Z','AA','AB'
    ];
    outer:
    for (const rr of searchRows) {
      for (const cc of cols) {
        const txt = cellText(sheet, `${cc}${rr}`);
        if (txt) {
          paragraphValue = txt;
          break outer;
        }
      }
    }
  }

  if (paragraphValue) {
    rows.push({
      name: 'Laisvas tekstas',   // identifiers.js -> "Laisvas tekstas": "paragraph"
      value: paragraphValue,
      sort: rows.length + 1
    });
  }

  return rows;
}
