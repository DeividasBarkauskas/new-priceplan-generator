// js/app.js
import { extractOfferFeeFromText, extractThresholdFromRow, extractThresholdFromSheet } from './core/utils.js';
import { createSheetBlock } from './ui.js';
import { tariffList } from './data/tariffs.js';
import { identifierMap } from './data/identifiers.js';
import { extractTariffRowsFromSheet, buildTariffConfigSQL } from './features/tariffs/index.js';



// globalus numeratorių skaitiklis (pavadinimams)
let globalCounter = 2;

document.getElementById('default-query').addEventListener('click', function () {
  const q = `SELECT * FROM mokejimo_planai_tariff_all WHERE macpoc_code LIKE '%1-AXJB9J%';`;
  navigator.clipboard.writeText(q);
  this.classList.add('copied');
  setTimeout(() => this.classList.remove('copied'), 1200);
});

document.getElementById('input').addEventListener('change', function (e) {
  document.getElementById('outputs').innerHTML = '';
  document.getElementById('default-banner').style.display = 'none';

  const file = e.target.files[0];
  document.getElementById('filename').textContent = file?.name || '';

  const reader = new FileReader();
  reader.onload = function (ev) {
    const data = new Uint8Array(ev.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    globalCounter = 2;

    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      // 1) „vienos eilutės“ formatas (su stulpelių pavadinimais)
      // === po to, kai pasiskaičiuoji kintamuosius iš Excel ===


      if (rows.length && Object.keys(rows[0]).includes('Plano pavadinimas per Salestool')) {
        rows.forEach(row => {
          const name       = row['Plano pavadinimas per Salestool'];
          const printName  = row['Plano pavadinimas sutarties dokumentuose'];
          const siebel     = row['Plano bazės produkto kodas'];
          const kodas      = row['Plano kodas'];

          const klientas   = row['Plano kliento grupė'].toUpperCase() === 'B2B' ? 2 : 1;
          const tipas      = row['Plano tipas'].toLowerCase() === 'voice' ? 1 : 2; // jei nori — pasikeisi į platesnį map'ą
          const is5g       = row['Ar planui taikomas 5G ryšys?'].toLowerCase() === 'taip' ? 1 : 0;
          const fup        = row['Ar planui taikomas sąžiningo naudojimo perviršis?'].toLowerCase() === 'taip' ? 1 : 0;
          const netSecurity= row['Ar planas taikoma Interneto apsauga + promotion?'].toLowerCase() === 'taip' ? 1 : 0;

          const offerFee   = extractOfferFeeFromText(name);
          const threshold  = extractThresholdFromRow(row);

          const rootProductFee = tariffList[siebel]?.price || 'NULL /* ❌ TARIFAS NERASTAS */';

          // GB kibiras
          const pavadReiksme = (name || '').toLowerCase();
          const gbMatches = [...pavadReiksme.matchAll(/(\d{1,3})(?=\s*gb)/gi)].map(m => parseInt(m[1], 10));
          const bucketSize = gbMatches.length
            ? gbMatches.reduce((a, b) => a + b, 0) * 1024
            : pavadReiksme.includes('neriboti')
              ? 5242880
              : 'Netinkamas formatas';

          

          // periodai
          const periods = (row['Plano Terminai'] || '').toString();
          const wsc     = (row['Plano WSC Terminas'] || '').toString();

          // paslaugos
          const services = (row['Privalomos paketinės paslaugos'] || '')
            .toString()
            .split(',')
            .map(s => s.trim())
            .filter(s => /^\d+$/.test(s))
            .sort((a, b) => a - b)
            .join(',');

// --- NUOLAIDA iš eilutės (header’ių formatui) ---
const discountRaw = (
  row['Nuolaida'] ??
  row['Plano nuolaida'] ??
  row['Nuolaida mėn.'] ??
  row['Plan discount'] ?? ''
).toString().replace(',', '.');

const discountAmount = Number(discountRaw) || 0;


            
          const sql = 
`-- Salestool new price plan db procedure
SET @nuolaida = ${discountAmount};
SET @pavadinimas = '${name}';
SET @spausdinamas_pavadinimas = '${printName}';
SET @pdf_name = '${printName}';
SET @kodas = '${kodas}';
SET @grupe = ${klientas};
SET @plano_grupe = ${tipas}; -- 1-Voice; 2-MBB; 3-Prepaid; 5-Fix; 7-Budget; 8-M2M; 14-FTTP
SET @fair_usage_policy = ${fup}; -- FUP
SET @threshold_value = '${threshold}'; -- standard arba standard+
SET @internet_security = ${netSecurity};
SET @is_5g = ${is5g};
SET @gb_campaign = 1; -- ‼️Keisti rankiniu budu 1-YES; 0-NO
SET @root_product_fee = ${rootProductFee};
SET @root_product = '${siebel}';
SET @offer_fee = ${offerFee};
SET @default_plan = '2';
SET @risk_level = '0';
SET @bucket_size = '${bucketSize}';
SET @plan_promotion_product = '';
SET @periods = '${periods}';
SET @wsc_period = '${wsc}';
SET @services = '${services}';
-- Toliau galima vykdyti CALL temp_new_price_plan();`;

const tariffRows = extractTariffRowsFromSheet(sheet);
const tariffSQL = buildTariffConfigSQL('-{_1_}-', tariffRows);

// ❌ ŠITĄ IŠMESK
// copyBtn.onclick = () => { ... };

// ✅ Vietoje to:
createSheetBlock(
  sheetName,
  sql,
  siebel,
  globalCounter++,
  () => {
    const rows = extractTariffRowsFromSheet(sheet);
    // jei procedūra grąžina naujo plano id – naudok @new_price_plan_id,
    // jei ne – kol kas '-{_1_}-' (vėliau pakeisi ranka)
    return buildTariffConfigSQL('-{_1_}-', rows);
  }
);

        });
        return; // šitam formate jau viską sugeneravom
      }

      // 2) „celių koordinačių“ formatas (F1, F3, H5, H6, ...)
      const get = c => sheet[c]?.v?.toString().trim() || '';
      const threshold  = extractThresholdFromSheet(sheet) || '';
      const name       = get('F1');
      const printName  = get('F3');
      const offerFee   = extractOfferFeeFromText(name);

      let kodas  = get('H6');
      let siebel = get('H5');

      const klientas = get('C5').toUpperCase() === 'B2B' ? 2 : 1;

      const typeMap = { voice:1, mbb:2, prepaid:3, fix:5, budget:7, m2m:8, fttp:14 };
      const tipasText = get('C6').toLowerCase().trim();
      const tipas = typeMap[tipasText] || 0;

      const is5g        = get('G7').toLowerCase() === 'taip' ? 1 : 0;
      const fup         = get('I8').toLowerCase() === 'taip' ? 1 : 0;
      const netSecurity = get('G9').toLowerCase() === 'taip' ? 1 : 0;

      // periodai: bet kokius skirtukus -> kableliai
      const rawPeriods = get('V5');
      const periods = (rawPeriods || '')
        .split(/[^0-9]+/)
        .filter(Boolean)
        .join(',');

      const wsc = get('V6');

      // jei H5/H6 sukeisti – tvarkom
      if (siebel.length > kodas.length) [kodas, siebel] = [siebel, kodas];

      // GB kibiras
      const pavadReiksme = (name || '').toLowerCase();
      const gbMatches = [...pavadReiksme.matchAll(/(\d{1,3})(?=\s*gb)/gi)].map(m => parseInt(m[1], 10));
      const bucketSize = gbMatches.length
        ? gbMatches.reduce((a, b) => a + b, 0) * 1024
        : pavadReiksme.includes('neriboti')
          ? 5242880
          : 'Netinkamas formatas';

      // paslaugos (A14.., B14..)
      const services = [];
      let r = 14;
      while (true) {
        const id = sheet[`A${r}`]?.v;
        const label = sheet[`B${r}`]?.v?.toString().toLowerCase() || '';
        if (!id || isNaN(id) || label.includes('non-package') || label.includes('ne standartinės')) break;
        services.push(parseInt(id));
        r++;
      }

      // wsc turi būti vienas iš periods – kitaip ''
      const periodList = periods.split(',').map(p => p.trim()).filter(Boolean);
      const wscValid = periodList.includes(wsc) ? wsc : '';

      const rootProductFee = tariffList[siebel]?.price || 'NULL';

// --- NUOLAIDA iš lapo (tvirti paieškos ir parsinimo įrankiai) ---
const normalizeLabel = (s = "") =>
  s.toString()
   .trim()
   .toLowerCase()
   .normalize("NFD")
   .replace(/[\u0300-\u036f]/g, "")      // šalina diakritikus
   .replace(/[^a-z0-9% ]+/g, "")         // šalina nereikalingus simbolius
   .replace(/\s+/g, " ");                 // suvienodina tarpus

const colToNum = (col) => {
  let n = 0;
  for (let i = 0; i < col.length; i++) n = n * 26 + (col.charCodeAt(i) - 64);
  return n;
};
const numToCol = (n) => {
  let col = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    n = Math.floor((n - 1) / 26);
  }
  return col;
};
const nextColumn = (addr) => {
  const m = /^([A-Z]+)(\d+)$/.exec(addr);
  if (!m) return null;
  const col = m[1], row = m[2];
  return numToCol(colToNum(col) + 1) + row;
};

// Ieškom etiketės „nuolaida“ (leidžiame įvairius variantus)
let discountAmount = 0;
let discountFound = false;
try {
  const keys = Object.keys(sheet || {}).filter(k => /^[A-Z]+[0-9]+$/.test(k));
  const labelKey = keys.find(k => {
    const cell = sheet[k] || {};
    const text = normalizeLabel(cell.w ?? cell.v ?? "");
    // tiks "nuolaida", "nuolaida %", "nuolaida (%)", t.t.
    return text.startsWith("nuolaida");
  });

  let valueCellAddr = null;

  if (labelKey) {
    const maybeRight = nextColumn(labelKey);
    if (maybeRight && sheet[maybeRight]) {
      valueCellAddr = maybeRight;
    } else {
      // jei dešinėje tuščia, pabandom dar per 2–3 stulpelius
      for (let hop = 2; hop <= 3; hop++) {
        const m = /^([A-Z]+)(\d+)$/.exec(labelKey);
        const probe = numToCol(colToNum(m[1]) + hop) + m[2];
        if (sheet[probe]) { valueCellAddr = probe; break; }
      }
    }
  }

  // Jei etiketės neradom — fallback į žinomą langelį (prireikus pasikeisk)
  if (!valueCellAddr) valueCellAddr = "O9";

  const rawCell = sheet[valueCellAddr] || {};
  let rawStr = String(rawCell.w ?? rawCell.v ?? "").trim();

  // Normalizuojam skaičių: pašalinam tarpus, tūkst. skirtukus, kablelius paverčiam į tašką
  const hasPercent = /%/.test(rawStr);
  rawStr = rawStr
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}\b)/g, "")    // . kaip tūkst. skirtukas
    .replace(/,(?=\d)/g, ".")         // , kaip dešimt. skirtukas
    .replace(/[^0-9.+-]/g, "");       // paliekam tik skaičiaus simbolius

  let num = parseFloat(rawStr);
  if (Number.isFinite(num)) {
    // Jei procentas – parsinam į procentinę reikšmę (pvz., "15%" -> 15)
    if (hasPercent && num <= 1) num = num * 100;
    discountAmount = num;
    discountFound = true;
  } else {
    discountAmount = 0;
  }
} catch (_) {
  discountAmount = 0;
  discountFound = false;
}
      const sql =
`-- Salestool new price plan db procedure
SET @nuolaida = ${discountAmount};
SET @pavadinimas = '${name}';
SET @spausdinamas_pavadinimas = '${printName}';
SET @pdf_name = '${printName}';
SET @kodas = '${kodas}'; -- Plano kodas
SET @grupe = ${klientas}; -- RES ar BUS
SET @plano_grupe = ${tipas}; -- 1-Voice; 2-MBB; 3-Prepaid; 5-Fix; 7-Budget; 8-M2M; 14-FTTP
SET @fair_usage_policy = ${fup}; -- FUP
SET @threshold_value = '${threshold}'; -- standard arba standard+
SET @internet_security = ${netSecurity};
SET @is_5g = ${is5g};
SET @gb_campaign = 1;  -- ‼️Keisti rankiniu budu 1-YES; 0-NO
SET @root_product_fee = ${rootProductFee};${!tariffList[siebel]?.price || tariffList[siebel]?.price === 'NERASTA' ? ' -- ❌ TARIFAS NERASTAS' : ''} -- Yra Query viršuje
SET @root_product = '${siebel}'; -- Siebel plano kodas
SET @offer_fee = ${offerFee}; -- plano kaina su nuolaida
SET @default_plan = '2';
SET @risk_level = '0';
SET @bucket_size = '${bucketSize}';
SET @plan_promotion_product = ''; -- jei nėra paliekam tuščias kabutes
SET @periods = '${periods}';
SET @wsc_period = '${wscValid}'; -- eSHOP terminas privalo sutapti su vienu iš \`periods\`
SET @services = '${services.sort((a,b)=>a-b).join(',')}'; -- ⚠️Paslaugos plius nuolaidos didėjančia tvarka

-- Toliau galima vykdyti CALL temp_new_price_plan();`;

// kai jau turi reikšmes (klientas, periods, kodas, discountAmount ir t.t.)
window.mainVars = {
  grupe: klientas,              // 1 arba 2
  periods: periods,             // pvz. "12,24,36"
  macpoc_id: kodas,             // pvz. "1-8E873M9%"
  nuolaidos_suma: discountAmount,
  vat_rate: 0.21,

  // kiti tavo laukai – jei reikia
};

// svarbu: suteikiam builderį, kurį skaitys mygtukas
window.mainVars.discountSQL = () => window.buildDiscountSQLFromMain(window.mainVars);

// log'as (privaloma, kad matytum)
console.log('[discount] mainVars set =', window.mainVars);

// pranešam UI (copy mygtukai įsijungs)
window.dispatchEvent(new CustomEvent('mainVars:ready', { detail: window.mainVars }));



const tariffRows = extractTariffRowsFromSheet(sheet);
const tariffSQL  = buildTariffConfigSQL('@price_plan_id', tariffRows);

// Perduodam į UI, kad nukopijuojant įstatytų į procedūrą
createSheetBlock(sheetName, sql, siebel, globalCounter++, () => tariffSQL);


    });
  };

  reader.readAsArrayBuffer(file);
  
});
