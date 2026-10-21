const $ = id => document.getElementById(id);

const fieldMap = {
  'Plan name': 'planName',
  'Customer group': 'customerGroup',
  'Plan type': 'planType',
  'Source system plan code': 'sourceProduct',
  'Plan code': 'planCode',
  'Regular price': 'regularPrice',
  'Offer price': 'offerPrice',
  'Contract periods': 'periods',
  'Promotion code': 'promotionCode',
  'Service IDs': 'serviceIds',
  'Primary product ID': 'productId'
};

function escapeSql(value='') {
  return String(value).replace(/'/g, "''");
}

function readForm() {
  return Object.fromEntries(Object.values(fieldMap).map(id => [id, $(id).value.trim()]));
}

function validate(data) {
  const required = ['planName','customerGroup','planCode','sourceProduct','offerPrice'];
  return required.filter(key => !data[key]);
}

function buildSql(data) {
  const missing = validate(data);
  if (missing.length) return `-- Missing required fields: ${missing.join(', ')}`;

  const services = data.serviceIds.split(',').map(v => v.trim()).filter(Boolean);
  const serviceRows = services.length
    ? services.map(id => `(@plan_id, '${escapeSql(id)}')`).join(',\n  ')
    : '';

  return `-- SANITIZED PORTFOLIO DEMO
-- Generic schema and synthetic identifiers only.
START TRANSACTION;

SET @plan_code = '${escapeSql(data.planCode)}';
SET @plan_name = '${escapeSql(data.planName)}';
SET @customer_group = '${escapeSql(data.customerGroup)}';
SET @plan_type = '${escapeSql(data.planType)}';
SET @source_product = '${escapeSql(data.sourceProduct)}';
SET @primary_product_id = '${escapeSql(data.productId)}';
SET @regular_price = ${Number(data.regularPrice || 0).toFixed(2)};
SET @offer_price = ${Number(data.offerPrice || 0).toFixed(2)};
SET @contract_periods = '${escapeSql(data.periods)}';
SET @promotion_code = '${escapeSql(data.promotionCode)}';

-- Prevent duplicate plan codes.
INSERT INTO demo_price_plans
(plan_code, plan_name, customer_group, plan_type, source_product, regular_price, offer_price)
SELECT @plan_code, @plan_name, @customer_group, @plan_type, @source_product, @regular_price, @offer_price
WHERE NOT EXISTS (
  SELECT 1 FROM demo_price_plans WHERE plan_code = @plan_code
);

SET @plan_id = (
  SELECT id FROM demo_price_plans WHERE plan_code = @plan_code LIMIT 1
);

${serviceRows ? `-- Link synthetic demo services to the plan.\nINSERT INTO demo_plan_services (plan_id, service_code) VALUES\n  ${serviceRows};` : '-- No optional demo services supplied.'}

-- Example product mapping.
INSERT INTO demo_product_mapping (plan_id, product_code)
SELECT @plan_id, @primary_product_id
WHERE @primary_product_id <> ''
  AND NOT EXISTS (
    SELECT 1 FROM demo_product_mapping
    WHERE plan_id = @plan_id AND product_code = @primary_product_id
  );

COMMIT;`;
}

function fillFromRows(rows) {
  const values = {};
  rows.slice(1).forEach(row => {
    if (row && row[0] != null) values[String(row[0]).trim()] = row[1] ?? '';
  });
  Object.entries(fieldMap).forEach(([label,id]) => $(id).value = values[label] ?? '');
  $('status').textContent = 'Template parsed successfully. Review values and generate SQL.';
  $('sql').textContent = buildSql(readForm());
}

$('file').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, {type:'array'});
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    fillFromRows(XLSX.utils.sheet_to_json(sheet, {header:1, raw:true}));
  } catch (error) {
    $('status').textContent = 'Could not parse the Excel file.';
    console.error(error);
  }
});

$('generate').addEventListener('click', () => $('sql').textContent = buildSql(readForm()));
$('copy').addEventListener('click', async () => navigator.clipboard.writeText($('sql').textContent));
