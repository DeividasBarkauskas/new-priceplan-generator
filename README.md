# New Price Plan Generator — Portfolio Demo

A browser-based JavaScript tool that reads a structured Excel template, validates plan data and generates standardized SQL for a demo price-plan workflow.

This repository is a **sanitized portfolio version** of an internal automation idea. All company-specific database schema, identifiers, product/service mappings, internal business rules and real operational data have been replaced with synthetic examples.

## What it demonstrates

- Excel/XLSX parsing in the browser
- input normalization and validation
- plan/service data extraction
- dynamic SQL generation
- duplicate-prevention logic
- human review before SQL execution
- JavaScript, HTML/CSS, SQL and Git workflow

## How to use

1. Open `index.html` or the GitHub Pages version.
2. Upload `Test-Template.xlsx`.
3. Review the parsed fields.
4. Generate and inspect the demo SQL.
5. Copy the SQL if needed.

The browser application does **not** connect to any database. It only generates SQL text.

## Demo data

The included template uses synthetic values such as:

- plan code: `PLAN-TEST-001`
- source product: `1-TESTNR1`
- primary product ID: `1-TESTNR2`
- service IDs: `1001,1002,1003`

The SQL uses generic tables such as `demo_price_plans`, `demo_services` and `demo_plan_services`.

## Project structure

```text
new-priceplan-generator/
├── index.html
├── css/
│   └── styles.css
├── js/
│   └── app.js
├── Test-Template.xlsx
└── README.md
```

## Confidentiality

No real customer data, credentials, production URLs, internal database table names, proprietary identifiers or company-specific mappings are included in this public version.
