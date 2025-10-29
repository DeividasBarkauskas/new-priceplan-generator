// js/features/tariffs/discountQuery.js

// === Paverčia tekstą į skaičių saugiai ===
function toNum(val, def = 0) {
  if (val == null) return def;
  const n = Number(String(val).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : def;
}

// === Saugus tekstas SQL'ui (kabutės) ===
function esc(s = '') {
  return String(s).replace(/'/g, "''");
}

// === Pagrindinė funkcija — iš mainVars sukonstruojam pilną SQL ===
window.buildDiscountSQLFromMain = function (mv) {
  if (!mv) return '';

  const group   = toNum(mv.grupe ?? mv.group, 0);
  const periods = String(mv.periods ?? mv.terminai ?? mv.terminal ?? '').trim();
  const macpoc  = String(mv.macpoc_id ?? mv.macpoc ?? '').trim();
  const disc    = toNum(mv.nuolaidos_suma ?? mv.nuolaida ?? mv.discount, NaN);
  const vat     = toNum(mv.vat_rate ?? mv.vat, 0.21);

  console.log('[discount] parsed inputs', { group, periods, macpoc, disc, vat });

  if (!periods || !macpoc || !Number.isFinite(disc)) {
    console.warn('[discount] missing required input', { periods, macpoc, disc });
    return '-- DISCOUNT: NERASTA (missing periods / macpoc / nuolaida)';
  }


  // ---- čia vienintelis įrašomas blokas į SQL (raudonas iš tavo screenshot) ----
  const sql = `/* ==== ĮVESTYS (iš mainVars) ==== */
SET @grupe = ${group};
SET @nuolaidos_suma = ${disc.toFixed(2)};
SET @terminai = '${esc(periods)}';
SET @macpoc_id = '1-2RW25FD';
SET @vat_rate = ${vat};



/* ==== IŠVESTINIAI ==== */
SET @__prefix      := IF(@grupe=2, 'NUOLVS', 'NUOL');
SET @__akp_grp_id  := IF(@grupe=2, 22, 6);
SET @__price_wo        := IF(@grupe=2, @nuolaidos_suma, ROUND(@nuolaidos_suma/(1+@vat_rate), 4));
SET @__price_w         := IF(@grupe=2, ROUND(@nuolaidos_suma*(1+@vat_rate), 4), @nuolaidos_suma);
SET @__amount_for_code := @nuolaidos_suma;
SET @__cents           := ROUND(@__amount_for_code*100);

/* ==== PARUOŠIAM TERMINUS ==== */
DROP TEMPORARY TABLE IF EXISTS tmp_prepared;
CREATE TEMPORARY TABLE tmp_prepared AS
WITH RECURSIVE term_list AS (
  SELECT CAST(SUBSTRING_INDEX(@terminai, ',', 1) AS UNSIGNED) AS period,
         CASE WHEN LOCATE(',', @terminai)=0 THEN '' ELSE SUBSTRING(@terminai, LOCATE(',', @terminai)+1) END AS rest
  UNION ALL
  SELECT CAST(SUBSTRING_INDEX(rest, ',', 1) AS UNSIGNED),
         CASE WHEN LOCATE(',', rest)=0 THEN '' ELSE SUBSTRING(rest, LOCATE(',', rest)+1) END
  FROM term_list
  WHERE rest <> ''
),
prepared AS (
  SELECT
    tl.period,
    CONCAT(@__prefix, '_', @__cents, '_', tl.period) AS code,
    IF(@grupe=2,
       CONCAT(REPLACE(FORMAT(ROUND(@__price_wo,2), 2), ',', ''), ' Eur (be PVM) papildoma nuolaida paslaugoms ', tl.period, ' mėn.'),
       CONCAT(REPLACE(FORMAT(ROUND(@__price_w,2), 2), ',', ''), ' Eur (su PVM) papildoma nuolaida paslaugoms ', tl.period, ' mėn.')
    ) AS name,
    IF(@grupe=2,
       CONCAT('papildoma @ConstantNuolaidaSumaWithoutVat@ Eur (be PVM) nuolaida paslaugoms kiekvieną mėnesį, sudarant @binding_period@ mėn. sutartį. ',
              'Keičiant planą ar užsakytas paslaugas ir /ar sutartį perrašant kitam asmeniui, nuolaida neperkeliama ir gali būti prašoma ją grąžinti pagal Sutarties sąlygas.'),
       CONCAT('papildoma @ConstantNuolaidaSuma@ Eur (su PVM) nuolaida paslaugoms kiekvieną mėnesį, sudarant @binding_period@ mėn. sutartį. ',
              'Keičiant planą ar užsakytas paslaugas ir /ar sutartį perrašant kitam asmeniui, nuolaida neperkeliama ir gali būti prašoma ją grąžinti pagal Sutarties sąlygas.')
    ) AS descr,
    IF(@grupe=2,
       CONCAT('ConstantNuolaidaSuma=', @__price_w, ';binding_period=', tl.period, ';ConstantNuolaidaSumaWithoutVat=', @__price_wo),
       CONCAT('ConstantNuolaidaSuma=', @__price_w, ';binding_period=', tl.period)
    ) AS consts,
    ROUND(@__price_wo,2) AS price_wo,
    ROUND(@__price_w,2)  AS price_w
  FROM term_list tl
)
SELECT * FROM prepared;

/* ==== DUBLIKATAI ==== */
DROP TEMPORARY TABLE IF EXISTS tmp_existing;
CREATE TEMPORARY TABLE tmp_existing AS
SELECT p.code
FROM tmp_prepared p
JOIN sut_akcijos_paslaugos s ON s.akp_directo_kodas = p.code;

SELECT '[VALIDATION ERROR] Šie kodai jau egzistuoja, praleisti:' AS error,
       GROUP_CONCAT(code ORDER BY code) AS existing_codes
FROM tmp_existing
HAVING COUNT(*) > 0;

/* ==== INSERT tik trūkstamų ==== */
INSERT INTO sut_akcijos_paslaugos
(akp_id, akp_pavadinimas, akp_kaina, akp_konstantos, akp_iraso_tipas, akp_aprasymas,
 akp_data_nuo, akp_data_iki, akp_dyleriai, akp_kliento_tipas, akp_directo_kodas, akp_mw_kodas,
 akp_delayed, akp_grupes_id, akp_priority, akp_hide, akp_tariff_charge, akp_product_type,
 price_without_vat, price_with_vat, price_type, akp_pdf_name, akp_sort_order, risk_level,
 akp_warehouse_code, akp_has_order_limit)
SELECT
  NULL, p.name, NULL, p.consts, '15', p.descr,
  NOW(), NULL, '', @grupe, p.code, p.code,
  '0', @__akp_grp_id, '0', '0', NULL, '5',
  p.price_wo, p.price_w, 'recurring', 'Papildoma nuolaida paslaugoms', '0', '0',
  NULL, '1'
FROM tmp_prepared p
LEFT JOIN tmp_existing e ON e.code = p.code
WHERE e.code IS NULL;

/* ==== MAPINIMAS ==== */
INSERT INTO macpoc_vasmap (sut_akcijos_paslaugos_akp_id, sut_akcijos_paslaugos_tariff_id)
SELECT s.akp_id, t.id
FROM tmp_prepared p
JOIN sut_akcijos_paslaugos s        ON s.akp_mw_kodas = p.code
JOIN sut_akcijos_paslaugos_tariff t ON t.macpoc_id = @macpoc_id
WHERE NOT EXISTS (
    SELECT 1 FROM macpoc_vasmap m
    WHERE m.sut_akcijos_paslaugos_akp_id = s.akp_id
      AND m.sut_akcijos_paslaugos_tariff_id = t.id
);

/* ==== REZULTATAS ==== */
SELECT 
  p.period, p.code, s.akp_id,
  CASE WHEN e.code IS NULL THEN 'created' ELSE 'existed' END AS status
FROM tmp_prepared p
JOIN sut_akcijos_paslaugos s ON s.akp_mw_kodas = p.code
LEFT JOIN tmp_existing e     ON e.code = p.code
ORDER BY p.period;`; 

console.log('[discount] returning SQL length=', sql.length);
  return sql;
};

// === automatinis builder'io įjungimas ===
window.discountSQL = '';
if (window.mainVars) {
  window.discountSQL = window.buildDiscountSQLFromMain(window.mainVars);
}

console.log('[discount] discountQuery.js LOADED');

// jau turimą buildDiscountSQLFromMain palik
window.addEventListener('mainVars:ready', (ev) => {
  const mv = ev.detail || window.mainVars;
  const sql = window.buildDiscountSQLFromMain(mv);
  // padedam ir į patį mainVars, ir į patogų aliasą
  window.mainVars.discountSQL = () => window.buildDiscountSQLFromMain(window.mainVars);
  window.discountSQL = sql;
  console.log('[discount] discountSQL ready, length =', sql?.length || 0);
});
