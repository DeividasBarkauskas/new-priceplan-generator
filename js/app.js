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

function escapeSql(value = '') {
  return String(value).replace(/'/g, "''");
}

function sqlNumber(value, fallback = 0) {
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n.toFixed(2) : Number(fallback).toFixed(2);
}

function readForm() {
  return Object.fromEntries(Object.values(fieldMap).map(id => [id, $(id).value.trim()]));
}

function validate(data) {
  const required = ['planName', 'customerGroup', 'planCode', 'sourceProduct', 'offerPrice'];
  return required.filter(key => !data[key]);
}

function normalizeCustomerGroup(value) {
  const v = String(value || '').trim().toUpperCase();
  if (['B2B', 'BUS', '2'].includes(v)) return 2;
  return 1;
}

function normalizePlanType(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v.includes('data') || v.includes('mbb') || v === '2') return 2;
  return 1;
}

function buildSql(data) {
  const missing = validate(data);
  if (missing.length) return `-- Missing required fields: ${missing.join(', ')}`;

  const group = normalizeCustomerGroup(data.customerGroup);
  const planType = normalizePlanType(data.planType);
  const services = data.serviceIds.split(',').map(v => v.trim()).filter(Boolean);
  const serviceList = services.length ? services.join(',') : '1001,1002,1003';

  return `-- ================================================================
-- SANITIZED PORTFOLIO DEMO
-- Full price-plan configuration procedure
-- All schemas, identifiers, service IDs and business data are synthetic.
-- This script is generated for demonstration only.
-- ================================================================

SET @plan_name = '${escapeSql(data.planName)}';
SET @print_name = '${escapeSql(data.planName)}';
SET @document_name = '${escapeSql(data.planName)}';
SET @plan_code = '${escapeSql(data.planCode)}';
SET @customer_group = ${group};
SET @plan_type = ${planType};
SET @fair_usage_policy = 0;
SET @threshold_value = '';
SET @internet_security = 1;
SET @is_5g = 1;
SET @data_campaign = 1;
SET @regular_price = ${sqlNumber(data.regularPrice)};
SET @source_product = '${escapeSql(data.sourceProduct)}';
SET @offer_price = ${sqlNumber(data.offerPrice)};
SET @default_plan = '2';
SET @risk_level = '0';
SET @bucket_size = '12288';
SET @promotion_product = '${escapeSql(data.promotionCode)}';
SET @periods = '${escapeSql(data.periods || '18,24')}';
SET @online_period = '';
SET @services = '${escapeSql(serviceList)}';
SET @primary_product_id = '${escapeSql(data.productId)}';

-- The generated procedure intentionally uses generic demo tables.
DELIMITER $$

DROP PROCEDURE IF EXISTS demo_create_price_plan $$

CREATE PROCEDURE demo_create_price_plan()
BEGIN
    START TRANSACTION;

    -- ============================================================
    -- 1. INPUT VALIDATION
    -- ============================================================

    IF @plan_code IS NULL OR TRIM(@plan_code) = '' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = '[VALIDATION ERROR] plan_code is required';
    END IF;

    IF LENGTH(@plan_code) > 50 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = '[VALIDATION ERROR] demo_price_plans.plan_code exceeds 50 characters';
    END IF;

    IF @plan_name IS NULL OR TRIM(@plan_name) = '' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = '[VALIDATION ERROR] plan_name is required';
    END IF;

    IF @customer_group NOT IN (1, 2) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = '[VALIDATION ERROR] customer_group must be 1 or 2';
    END IF;

    IF @plan_type NOT IN (1, 2) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = '[VALIDATION ERROR] plan_type must be 1 or 2';
    END IF;

    IF @offer_price < 0 OR @regular_price < 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = '[VALIDATION ERROR] prices cannot be negative';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM demo_price_plans
        WHERE plan_code = @plan_code
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = '[VALIDATION ERROR] demo_price_plans.plan_code already exists';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM demo_product_catalog
        WHERE product_code = @source_product
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = '[VALIDATION ERROR] source product does not exist in demo catalog';
    ELSE
        SET @source_product_id = (
            SELECT id
            FROM demo_product_catalog
            WHERE product_code = @source_product
            ORDER BY id DESC
            LIMIT 1
        );
    END IF;

    -- ============================================================
    -- 2. PRICE CALCULATION
    -- ============================================================

    IF @fair_usage_policy = 1 THEN
        SET @spending_limit_modifier = 'FUP';
    ELSE
        SET @spending_limit_modifier = 'STD';
    END IF;

    SET @offer_price_with_tax =
        IF(@customer_group = 1, @offer_price, @offer_price * 1.21);

    SET @offer_price_without_tax =
        IF(@customer_group = 1, @offer_price / 1.21, @offer_price);

    SET @regular_price_with_tax =
        IF(@customer_group = 1, @regular_price, @regular_price * 1.21);

    SET @regular_price_without_tax =
        IF(@customer_group = 1, @regular_price / 1.21, @regular_price);

    SET @consumer_price = @offer_price_with_tax;
    SET @business_price = @offer_price_without_tax;

    -- ============================================================
    -- 3. CREATE PRICE PLAN
    -- ============================================================

    INSERT INTO demo_price_plans (
        id,
        plan_name,
        print_name,
        document_name,
        plan_code,
        customer_group,
        plan_type,
        source_product_id,
        regular_price_with_tax,
        regular_price_without_tax,
        offer_price_with_tax,
        offer_price_without_tax,
        consumer_price,
        business_price,
        default_plan,
        risk_level,
        bucket_size,
        spending_limit_modifier,
        active
    )
    SELECT
        NULL,
        @plan_name,
        @print_name,
        @document_name,
        @plan_code,
        @customer_group,
        @plan_type,
        @source_product_id,
        @regular_price_with_tax,
        @regular_price_without_tax,
        @offer_price_with_tax,
        @offer_price_without_tax,
        @consumer_price,
        @business_price,
        @default_plan,
        @risk_level,
        @bucket_size,
        @spending_limit_modifier,
        1;

    IF NOT EXISTS (
        SELECT 1
        FROM demo_price_plans
        WHERE plan_code = @plan_code
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = '[VALIDATION ERROR] price plan was not created';
    ELSE
        SET @price_plan_id = (
            SELECT id
            FROM demo_price_plans
            WHERE plan_code = @plan_code
            LIMIT 1
        );
    END IF;

    -- ============================================================
    -- 4. OPTIONAL PROMOTION MAPPING
    -- ============================================================

    IF @promotion_product <> '' THEN
        IF NOT EXISTS (
            SELECT 1
            FROM demo_promotions
            WHERE promotion_code = @promotion_product
        ) THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '[VALIDATION ERROR] promotion does not exist';
        ELSE
            SET @promotion_id = (
                SELECT id
                FROM demo_promotions
                WHERE promotion_code = @promotion_product
                LIMIT 1
            );

            INSERT INTO demo_plan_promotion_map (
                promotion_id,
                plan_id,
                use_binding,
                active
            )
            SELECT
                @promotion_id,
                @price_plan_id,
                1,
                1;
        END IF;
    END IF;

    -- ============================================================
    -- 5. CUSTOMER / SALES SCENARIOS
    -- Synthetic scenario codes replace internal production values.
    -- ============================================================

    CREATE TEMPORARY TABLE temp_demo_scenarios (
        customer_group INT,
        scenario_code INT,
        scenario_name VARCHAR(255)
    );

    INSERT INTO temp_demo_scenarios
        (customer_group, scenario_code, scenario_name)
    VALUES
        (0, 9000, 'Default'),
        (1, 9101, 'Consumer - New agreement'),
        (2, 9201, 'Business - New agreement'),
        (1, 9102, 'Consumer - Number transfer'),
        (2, 9202, 'Business - Number transfer'),
        (1, 9103, 'Consumer - Plan change'),
        (2, 9203, 'Business - Plan change'),
        (1, 9104, 'Consumer - Prolongation'),
        (2, 9204, 'Business - Prolongation'),
        (1, 9105, 'Consumer - Ownership transfer'),
        (2, 9205, 'Business - Ownership transfer'),
        (1, 9106, 'Consumer - Add-on'),
        (2, 9206, 'Business - Add-on'),
        (1, 9111, 'Consumer - Online new agreement'),
        (2, 9211, 'Business - Online new agreement'),
        (1, 9112, 'Consumer - Online number transfer'),
        (2, 9212, 'Business - Online number transfer'),
        (1, 9113, 'Consumer - Online plan change'),
        (2, 9213, 'Business - Online plan change'),
        (1, 9114, 'Consumer - Online prolongation'),
        (2, 9214, 'Business - Online prolongation'),
        (1, 9115, 'Consumer - Online ownership transfer'),
        (2, 9215, 'Business - Online ownership transfer'),
        (1, 9116, 'Consumer - Online add-on'),
        (2, 9216, 'Business - Online add-on');

    INSERT INTO demo_plan_scenarios (
        scenario_code,
        plan_id
    )
    SELECT
        scenario_code,
        @price_plan_id
    FROM temp_demo_scenarios
    WHERE customer_group IN (@customer_group, 0)
    ORDER BY scenario_code;

    DROP TEMPORARY TABLE IF EXISTS temp_demo_scenarios;

    -- ============================================================
    -- 6. CONTRACT PERIODS
    -- ============================================================

    CREATE TEMPORARY TABLE temp_demo_periods (
        period INT
    );

    INSERT INTO temp_demo_periods (period)
    SELECT period
    FROM JSON_TABLE(
        CONCAT('["', REPLACE(@periods, ',', '","'), '"]'),
        '$[*]' COLUMNS (
            period INT PATH '$'
        )
    ) AS parsed_periods;

    INSERT INTO demo_plan_scenario_periods (
        plan_scenario_id,
        contract_period
    )
    SELECT
        scenarios.id,
        periods.period
    FROM demo_plan_scenarios scenarios
    JOIN temp_demo_periods periods
    WHERE scenarios.plan_id = @price_plan_id
      AND scenarios.scenario_code NOT IN (9106, 9206, 9116, 9216);

    INSERT INTO demo_plan_scenario_periods (
        plan_scenario_id,
        contract_period
    )
    SELECT
        scenarios.id,
        -1
    FROM demo_plan_scenarios scenarios
    WHERE scenarios.plan_id = @price_plan_id
      AND scenarios.scenario_code IN (9106, 9206, 9116, 9216);

    IF @online_period <> '' THEN
        INSERT INTO demo_plan_scenario_periods (
            plan_scenario_id,
            contract_period
        )
        SELECT
            scenarios.id,
            @online_period
        FROM demo_plan_scenarios scenarios
        WHERE scenarios.plan_id = @price_plan_id
          AND scenarios.scenario_code IN (
              9111, 9211,
              9112, 9212,
              9113, 9213,
              9114, 9214,
              9115, 9215
          );
    END IF;

    -- ============================================================
    -- 7. OPTIONAL SERVICE RULES
    -- ============================================================

    CREATE TEMPORARY TABLE temp_demo_optional_rules (
        rule_name VARCHAR(255),
        customer_group INT,
        plan_type INT,
        scenario_code INT
    );

    INSERT INTO temp_demo_optional_rules VALUES
        ('backup_sim',       1, 0, 9102),
        ('backup_sim',       2, 0, 9202),
        ('backup_sim',       1, 0, 9112),
        ('backup_sim',       2, 0, 9212),
        ('early_extension',  1, 0, 9104),
        ('early_extension',  2, 0, 9204),
        ('early_extension',  1, 0, 9114),
        ('early_extension',  2, 0, 9214);

    INSERT INTO temp_demo_optional_rules VALUES
        ('new_number', 1, 0, 9101),
        ('new_number', 1, 0, 9102),
        ('new_number', 1, 0, 9103),
        ('new_number', 1, 0, 9105),
        ('new_number', 1, 0, 9111),
        ('new_number', 1, 0, 9112),
        ('new_number', 1, 0, 9113),
        ('new_number', 1, 0, 9114),
        ('new_number', 1, 0, 9115),
        ('new_number', 2, 0, 9201),
        ('new_number', 2, 0, 9202),
        ('new_number', 2, 0, 9203),
        ('new_number', 2, 0, 9205),
        ('new_number', 2, 0, 9211),
        ('new_number', 2, 0, 9212),
        ('new_number', 2, 0, 9213),
        ('new_number', 2, 0, 9214),
        ('new_number', 2, 0, 9215);

    INSERT INTO temp_demo_optional_rules VALUES
        ('existing_number', 1, 0, 9104),
        ('existing_number', 1, 0, 9106),
        ('existing_number', 1, 0, 9116),
        ('existing_number', 2, 0, 9204),
        ('existing_number', 2, 0, 9206),
        ('existing_number', 2, 0, 9216);

    INSERT INTO temp_demo_optional_rules VALUES
        ('online_buckets', 1, 0, 9116),
        ('online_buckets', 2, 0, 9216);

    -- ============================================================
    -- 8. SYNTHETIC OPTIONAL SERVICE CATALOG
    -- All IDs below are invented demo identifiers.
    -- ============================================================

    CREATE TEMPORARY TABLE temp_demo_optional_services (
        rule_name VARCHAR(255),
        customer_group INT,
        plan_type INT,
        service_id INT
    );

    INSERT INTO temp_demo_optional_services VALUES
        ('backup_sim', 0, 0, 20001),
        ('early_extension', 0, 0, 20002);

    INSERT INTO temp_demo_optional_services VALUES
        ('new_number', 1, 1, 20101),
        ('new_number', 1, 1, 20102),
        ('new_number', 1, 1, 20103),
        ('new_number', 1, 1, 20104),
        ('new_number', 1, 1, 20105),
        ('new_number', 1, 1, 20106),
        ('new_number', 1, 1, 20107),
        ('new_number', 1, 1, 20108),
        ('new_number', 1, 1, 20109),
        ('new_number', 1, 1, 20110),
        ('new_number', 1, 2, 20201),
        ('new_number', 1, 2, 20202),
        ('new_number', 1, 2, 20203),
        ('new_number', 1, 2, 20204),
        ('new_number', 1, 2, 20205),
        ('new_number', 2, 1, 20301),
        ('new_number', 2, 1, 20302),
        ('new_number', 2, 1, 20303),
        ('new_number', 2, 1, 20304),
        ('new_number', 2, 2, 20401),
        ('new_number', 2, 2, 20402),
        ('new_number', 2, 2, 20403);

    INSERT INTO temp_demo_optional_services VALUES
        ('existing_number', 1, 1, 21101),
        ('existing_number', 1, 1, 21102),
        ('existing_number', 1, 1, 21103),
        ('existing_number', 1, 2, 21201),
        ('existing_number', 1, 2, 21202),
        ('existing_number', 1, 2, 21203),
        ('existing_number', 2, 1, 21301),
        ('existing_number', 2, 1, 21302),
        ('existing_number', 2, 2, 21401),
        ('existing_number', 2, 2, 21402);

    INSERT INTO temp_demo_optional_services VALUES
        ('online_buckets', 1, 1, 22101),
        ('online_buckets', 1, 1, 22102),
        ('online_buckets', 1, 1, 22103),
        ('online_buckets', 1, 2, 22201),
        ('online_buckets', 1, 2, 22202),
        ('online_buckets', 2, 1, 22301),
        ('online_buckets', 2, 1, 22302),
        ('online_buckets', 2, 2, 22401),
        ('online_buckets', 2, 2, 22402);

    -- ============================================================
    -- 9. APPLY OPTIONAL SERVICES
    -- ============================================================

    INSERT IGNORE INTO demo_scenario_services (
        scenario_period_id,
        service_id,
        relation_type
    )
    SELECT
        periods.id,
        services.service_id,
        'optional'
    FROM demo_plan_scenario_periods periods
    JOIN demo_plan_scenarios scenarios
      ON periods.plan_scenario_id = scenarios.id
    JOIN temp_demo_optional_rules rules
      ON scenarios.scenario_code = rules.scenario_code
    JOIN temp_demo_optional_services services
      ON rules.rule_name = services.rule_name
    WHERE scenarios.plan_id = @price_plan_id
      AND rules.customer_group = @customer_group
      AND services.customer_group IN (@customer_group, 0)
      AND rules.plan_type IN (@plan_type, 0)
      AND services.plan_type IN (@plan_type, 0);

    DROP TEMPORARY TABLE IF EXISTS temp_demo_optional_services;
    DROP TEMPORARY TABLE IF EXISTS temp_demo_optional_rules;

    -- ============================================================
    -- 10. REQUIRED SYSTEM SERVICES
    -- ============================================================

    IF @internet_security = 1 THEN
        SET @internet_security_service =
            IF(@customer_group = 1, 23001, 23002);

        INSERT IGNORE INTO demo_scenario_services (
            scenario_period_id,
            service_id,
            relation_type
        )
        SELECT
            periods.id,
            @internet_security_service,
            'required'
        FROM demo_plan_scenario_periods periods
        JOIN demo_plan_scenarios scenarios
          ON periods.plan_scenario_id = scenarios.id
        WHERE scenarios.plan_id = @price_plan_id
          AND scenarios.scenario_code = 9000;
    END IF;

    IF @is_5g = 1 THEN
        SET @five_g_service = 23003;

        INSERT IGNORE INTO demo_scenario_services (
            scenario_period_id,
            service_id,
            relation_type
        )
        SELECT
            periods.id,
            @five_g_service,
            'required'
        FROM demo_plan_scenario_periods periods
        JOIN demo_plan_scenarios scenarios
          ON periods.plan_scenario_id = scenarios.id
        WHERE scenarios.plan_id = @price_plan_id
          AND scenarios.scenario_code = 9000;

        INSERT INTO demo_plan_services (
            plan_id,
            service_id,
            package_type,
            hidden
        )
        SELECT
            @price_plan_id,
            @five_g_service,
            2,
            1;
    END IF;

    IF @fair_usage_policy = 1 THEN
        SET @fair_usage_service = 23004;

        INSERT IGNORE INTO demo_scenario_services (
            scenario_period_id,
            service_id,
            relation_type
        )
        SELECT
            periods.id,
            @fair_usage_service,
            'required'
        FROM demo_plan_scenario_periods periods
        JOIN demo_plan_scenarios scenarios
          ON periods.plan_scenario_id = scenarios.id
        WHERE scenarios.plan_id = @price_plan_id
          AND scenarios.scenario_code = 9000;
    END IF;

    IF @data_campaign = 1 THEN
        SET @campaign_service = 23005;

        INSERT IGNORE INTO demo_scenario_services (
            scenario_period_id,
            service_id,
            relation_type
        )
        SELECT
            periods.id,
            @campaign_service,
            'required'
        FROM demo_plan_scenario_periods periods
        JOIN demo_plan_scenarios scenarios
          ON periods.plan_scenario_id = scenarios.id
        WHERE scenarios.plan_id = @price_plan_id
          AND scenarios.scenario_code = 9000;
    END IF;

    -- ============================================================
    -- 11. SERVICES FROM EXCEL TEMPLATE
    -- ============================================================

    CREATE TEMPORARY TABLE temp_demo_services (
        service_id INT
    );

    INSERT INTO temp_demo_services (service_id)
    SELECT service_id
    FROM JSON_TABLE(
        CONCAT('["', REPLACE(@services, ',', '","'), '"]'),
        '$[*]' COLUMNS (
            service_id INT PATH '$'
        )
    ) AS parsed_services;

    CREATE TEMPORARY TABLE temp_demo_services_with_periods (
        service_id INT,
        period INT
    );

    INSERT INTO temp_demo_services_with_periods
        (service_id, period)
    SELECT
        selected.service_id,
        CASE
            WHEN REGEXP_LIKE(catalog.service_code, '_[0-9]+$') THEN
                CASE
                    WHEN FIND_IN_SET(
                        SUBSTRING_INDEX(catalog.service_code, '_', -1),
                        @periods
                    ) > 0
                    THEN CAST(
                        SUBSTRING_INDEX(catalog.service_code, '_', -1)
                        AS UNSIGNED
                    )
                    ELSE NULL
                END
            ELSE NULL
        END AS period
    FROM temp_demo_services selected
    LEFT JOIN demo_service_catalog catalog
      ON catalog.id = selected.service_id;

    -- Services with an explicit contract period.
    INSERT IGNORE INTO demo_scenario_services (
        scenario_period_id,
        service_id,
        relation_type
    )
    SELECT
        periods.id,
        services.service_id,
        'required'
    FROM demo_plan_scenario_periods periods
    JOIN demo_plan_scenarios scenarios
      ON periods.plan_scenario_id = scenarios.id
    JOIN temp_demo_services_with_periods services
      ON periods.contract_period = services.period
    WHERE services.period IS NOT NULL
      AND scenarios.scenario_code = 9000
      AND scenarios.plan_id = @price_plan_id;

    -- Services without a period apply to all default periods.
    INSERT IGNORE INTO demo_scenario_services (
        scenario_period_id,
        service_id,
        relation_type
    )
    SELECT
        periods.id,
        services.service_id,
        'required'
    FROM demo_plan_scenario_periods periods
    JOIN demo_plan_scenarios scenarios
      ON periods.plan_scenario_id = scenarios.id
    JOIN temp_demo_services_with_periods services
      ON services.period IS NULL
    WHERE scenarios.scenario_code = 9000
      AND scenarios.plan_id = @price_plan_id;

    -- ============================================================
    -- 12. PLAN SERVICE / PACKAGE CONFIGURATION
    -- ============================================================

    INSERT INTO demo_plan_services (
        plan_id,
        service_id,
        package_type,
        hidden
    )
    SELECT
        @price_plan_id,
        service_id,
        2,
        1
    FROM temp_demo_services_with_periods;

    INSERT INTO demo_plan_package_map (
        plan_service_id,
        package_config_id
    )
    SELECT
        plan_services.id,
        package_config.id
    FROM demo_plan_services plan_services
    LEFT JOIN temp_demo_services_with_periods selected
      ON plan_services.service_id = selected.service_id
    LEFT JOIN demo_package_config package_config
      ON (
          selected.period = package_config.period
          OR (
              selected.period IS NULL
              AND package_config.period IS NULL
          )
      )
      AND package_config.document_type = 0
    WHERE plan_services.plan_id = @price_plan_id;

    -- Generate one synthetic package code per period.
    INSERT INTO demo_package_codes (
        package_code,
        active,
        external_code
    )
    SELECT
        CONCAT(
            'demo_',
            @price_plan_id,
            '_',
            GROUP_CONCAT(
                plan_services.service_id
                ORDER BY plan_services.service_id
                SEPARATOR '_'
            )
        ),
        1,
        CONCAT('demo_', @price_plan_id, '_', periods.period)
    FROM temp_demo_periods periods
    JOIN demo_plan_services plan_services
    LEFT JOIN temp_demo_services_with_periods selected
      ON plan_services.service_id = selected.service_id
    WHERE plan_services.plan_id = @price_plan_id
      AND (
          selected.period = periods.period
          OR selected.period IS NULL
      )
    GROUP BY periods.period;

    DROP TEMPORARY TABLE IF EXISTS temp_demo_services;
    DROP TEMPORARY TABLE IF EXISTS temp_demo_services_with_periods;
    DROP TEMPORARY TABLE IF EXISTS temp_demo_periods;

    -- ============================================================
    -- 13. PLAN ATTRIBUTES
    -- ============================================================

    IF @fair_usage_policy = 1 THEN
        IF @threshold_value IN ('Standard', 'Standard+') THEN
            INSERT INTO demo_plan_attributes (
                plan_id,
                attribute_name,
                attribute_value
            )
            VALUES
                (@price_plan_id, 'generate_document', '2'),
                (@price_plan_id, 'threshold', @threshold_value);
        ELSE
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                '[VALIDATION ERROR] threshold must be Standard or Standard+';
        END IF;
    ELSE
        INSERT INTO demo_plan_attributes (
            plan_id,
            attribute_name,
            attribute_value
        )
        VALUES
            (@price_plan_id, 'generate_document', '2');
    END IF;

    -- ============================================================
    -- 14. PLAN CHANGE MATRIX
    -- ============================================================

    IF @customer_group IN (1, 2)
       AND @plan_type IN (1, 2) THEN

        INSERT INTO demo_plan_change_matrix (
            plan_from,
            plan_to,
            change_window,
            customer_group,
            source
        )
        SELECT DISTINCT
            plan_from.id,
            plan_to.id,
            0,
            @customer_group,
            'demo'
        FROM demo_price_plans plan_from
        JOIN demo_price_plans plan_to
        WHERE (
            plan_from.id = @price_plan_id
            AND plan_to.customer_group = @customer_group
            AND plan_to.plan_type = @plan_type
        )
        OR (
            plan_from.customer_group = @customer_group
            AND plan_from.plan_type = @plan_type
            AND plan_to.id = @price_plan_id
        );

        INSERT INTO demo_plan_change_matrix (
            plan_from,
            plan_to,
            change_window,
            customer_group,
            source
        )
        SELECT DISTINCT
            plan_from.id,
            plan_to.id,
            1,
            @customer_group,
            'demo'
        FROM demo_price_plans plan_from
        JOIN demo_price_plans plan_to
        WHERE (
            plan_from.id = @price_plan_id
            AND plan_to.customer_group = @customer_group
            AND plan_to.plan_type = @plan_type
        )
        OR (
            plan_from.customer_group = @customer_group
            AND plan_from.plan_type = @plan_type
            AND plan_to.id = @price_plan_id
        );

        INSERT INTO demo_plan_change_matrix (
            plan_from,
            plan_to,
            change_window,
            customer_group,
            source
        )
        SELECT DISTINCT
            plan_from.id,
            plan_to.id,
            2,
            @customer_group,
            'demo'
        FROM demo_price_plans plan_from
        JOIN demo_price_plans plan_to
        WHERE (
            plan_from.id = @price_plan_id
            AND plan_to.customer_group = @customer_group
            AND plan_to.plan_type = @plan_type
        )
        OR (
            plan_from.customer_group = @customer_group
            AND plan_from.plan_type = @plan_type
            AND plan_to.id = @price_plan_id
        );
    END IF;

    -- ============================================================
    -- 15. PRIMARY PRODUCT MAPPING
    -- ============================================================

    IF @primary_product_id <> '' THEN
        INSERT INTO demo_product_mapping (
            plan_id,
            product_code
        )
        SELECT
            @price_plan_id,
            @primary_product_id
        WHERE NOT EXISTS (
            SELECT 1
            FROM demo_product_mapping
            WHERE plan_id = @price_plan_id
              AND product_code = @primary_product_id
        );
    END IF;

    -- ============================================================
    -- 16. TARIFF / DOCUMENT SUMMARY
    -- Synthetic labels and values only.
    -- ============================================================

    INSERT INTO demo_tariff_configuration (
        plan_id,
        tariff_key,
        tariff_value,
        sort_order
    )
    VALUES
        (@price_plan_id, 'price_with_discount', CONCAT(ROUND(@offer_price_with_tax, 2), ' EUR'), 1),
        (@price_plan_id, 'regular_price', CONCAT(ROUND(@regular_price_with_tax, 2), ' EUR'), 2),
        (@price_plan_id, 'discount_amount', CONCAT(ROUND(@regular_price_with_tax - @offer_price_with_tax, 2), ' EUR'), 3),
        (@price_plan_id, 'included_minutes', 'Unlimited demo minutes', 4),
        (@price_plan_id, 'included_messages', 'Unlimited demo messages', 5),
        (@price_plan_id, 'included_data', '12 GB demo data', 6),
        (@price_plan_id, 'multimedia_message_price', '0.10 EUR', 7),
        (@price_plan_id, 'video_call_price', '0.20 EUR/min', 8),
        (@price_plan_id, 'international_message_price', '0.15 EUR', 9),
        (@price_plan_id, 'special_number_price', '0.12 EUR/min', 10),
        (@price_plan_id, 'late_payment_admin_fee', '2.00 EUR', 11),
        (@price_plan_id, 'reactivation_admin_fee', '5.00 EUR', 12),
        (@price_plan_id, 'regional_data_allowance', '10 GB demo data', 13),
        (@price_plan_id, 'general_information', 'Synthetic portfolio text. No real operator terms or conditions.', 14);

    -- ============================================================
    -- 17. FINAL VALIDATION / RESULT
    -- ============================================================

    SELECT
        @price_plan_id AS created_plan_id,
        @plan_code AS created_plan_code,
        @plan_name AS created_plan_name,
        'SUCCESS' AS result;

    COMMIT;
END $$

DELIMITER ;

CALL demo_create_price_plan();

DROP PROCEDURE IF EXISTS demo_create_price_plan;

-- ================================================================
-- END OF SANITIZED PORTFOLIO DEMO
-- ================================================================`;
}

function fillFromRows(rows) {
  const values = {};
  rows.slice(1).forEach(row => {
    if (row && row[0] != null) values[String(row[0]).trim()] = row[1] ?? '';
  });

  Object.entries(fieldMap).forEach(([label, id]) => {
    $(id).value = values[label] ?? '';
  });

  $('status').textContent =
    'Template parsed successfully. Review values and generate the full demo SQL procedure.';
  $('sql').textContent = buildSql(readForm());
}

$('file').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: true
    });

    fillFromRows(rows);
  } catch (error) {
    $('status').textContent = 'Could not parse the Excel file.';
    console.error(error);
  }
});

$('generate').addEventListener('click', () => {
  $('sql').textContent = buildSql(readForm());
});

$('copy').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('sql').textContent);
  $('status').textContent = 'Generated SQL copied to clipboard.';
});
