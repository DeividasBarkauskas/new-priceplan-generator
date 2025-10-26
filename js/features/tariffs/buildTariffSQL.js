import { matchIdentifier } from '../../data/identifiers.js';

export function buildTariffConfigSQL(planIdExpr, rows) {
  if (!rows || !rows.length) {
    return '-- (Tarifų priedas nerastas šiame lape)\n';
  }

  const inserts = rows.map((r, i) => {
    const name  = r?.name ?? '';
    const value = (r?.value ?? '').toString().replace(/'/g, "''");
    const identifier = matchIdentifier(name);
    const warn = (identifier === 'N/A')
      ? ` -- ❌ nerastas price_plan_tariff (pavadinimas: "${name}")`
      : '';

    return (
`INSERT INTO price_plan_tariff_configuration (id, price_plan_id, price_plan_tariff_id, value, sort_order_number)
VALUES (
NULL, ${planIdExpr},(SELECT id FROM price_plan_tariff 
WHERE identifier='${identifier}'),'${value}','${i + 1}');${warn}`);
  }).join('\n\n');

  const paragraph =
``;

  const attribute =
`/* INSERT INTO price_plan_attribute (price_plan_id, name, value)
VALUES (${planIdExpr}, 'generate_document', '2'); */`;

  return `-- ==== Tarifų priedas (PDF santrauka) ====\n${inserts}\n\n${paragraph}\n\n${attribute}\n`;
}
