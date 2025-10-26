export const PROCEDURE_BLOCK = `
DELIMITER $$ 

CREATE PROCEDURE temp_new_price_plan() 

BEGIN 

    START TRANSACTION; 

    IF LENGTH(@kodas) > 50 THEN 

        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '[VALIDATION ERROR] LENGTH(mokejimo_planai.kodas) > 50'; 

    END IF; 

    IF EXISTS (SELECT 1 FROM mokejimo_planai WHERE kodas = @kodas) THEN 

        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '[VALIDATION ERROR] mokejimo_planai.kodas exists'; 

    END IF; 

    IF @fair_usage_policy = 1 THEN 

      SET @spending_limit_modifier = 'PAG'; 

    ELSE 

      SET @spending_limit_modifier = 'SAG'; 

    END IF; 

    IF NOT EXISTS (SELECT 1 FROM mokejimo_planai_tariff_all WHERE tariff_code = @root_product) THEN 

        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '[VALIDATION ERROR] mokejimo_planai_tariff_all.tariff_desc does not exist'; 

    ELSE  

        SET @tariff_id = (SELECT id FROM mokejimo_planai_tariff_all WHERE tariff_code = @root_product ORDER BY id DESC LIMIT 1); 

    END IF; 

-- Price plans 

    SET @offer_price_with_vat = IF(@grupe = 1, @offer_fee, @offer_fee / 1.21); 

    SET @offer_price_without_vat = IF(@grupe = 1, @offer_fee / 1.21, @offer_fee); 

    SET @private_price = @offer_price_with_vat; 

    SET @business_price = @offer_price_without_vat; 

    SET @plan_fee_with_vat = @root_product_fee; 

    SET @plan_fee_without_vat = @root_product_fee / 1.21; 

    INSERT INTO mokejimo_planai ( 

        id, pavadinimas, spausdinamas_pavadinimas, tipas, 

        kodas, grupe, plano_grupe, sms_siusti, 

        sms_text, kliento_tipas, status, matomas_sutartis, 

        web, nuolaidos_lubos_men, plano_tipas, macpoc_product_name, 

        macpoc_product_type, hardware_group, plan_fee_with_vat, plan_fee_without_vat, 

        plan_fee, default_plan, tariff_id, filterable,  

        product_type, offer_price_with_vat, offer_price_without_vat, offer_fee,  

        flat_rate, private_price, business_price, pdf_name, 

        risk_level, bucket_size, sales_channel, spending_limit_modifier 

    ) 

    SELECT  

        NULL, @pavadinimas, @spausdinamas_pavadinimas, 2, 

        @kodas, @grupe, @plano_grupe, 0, 

        1, 0, NULL, 1, 

        1, 0, NULL, NULL, 

        @plano_grupe, 1, @plan_fee_with_vat, @plan_fee_without_vat, 

        @root_product_fee, @default_plan, @tariff_id, 2,  

        0, @offer_price_with_vat, @offer_price_without_vat, @offer_fee,  

        NULL, @private_price, @business_price, @pdf_name, 

        @risk_level, @bucket_size, NULL, @spending_limit_modifier;  

    IF NOT EXISTS (SELECT 1 FROM mokejimo_planai WHERE kodas = @kodas) THEN 

        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '[VALIDATION ERROR] mokejimo_planai does not exist'; 

    ELSE  

        SET @price_plan_id = (SELECT id FROM mokejimo_planai WHERE kodas = @kodas); 

    END IF; 



    IF @plan_promotion_product <> '' THEN 

        IF NOT EXISTS (SELECT 1 FROM promotions WHERE macpoc_code = @plan_promotion_product) THEN 

            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '[VALIDATION ERROR] Promotion does not exist'; 

        ELSE 

            SET @promotion_id = (SELECT id FROM promotions WHERE macpoc_code = @plan_promotion_product); 

            INSERT INTO mp_promotion_map (promotion_id, mp_id, use_binding, active) 

            SELECT @promotion_id, @price_plan_id, '2', '1'; 

        END IF; 

    END IF; 

-- Scenarios 

    CREATE TEMPORARY TABLE temp_scenarios (client_group INT, scenario INT, name VARCHAR(255)); 

    INSERT INTO temp_scenarios (client_group, scenario, name) 

    VALUES 

    (0,999,'Default'), 

    (1,1,'B2C New Agreement'), 

    (2,2,'B2B New Agreement'), 

    (1,11,'B2C MNP'), 

    (2,12,'B2B MNP'), 

    (1,21,'B2C VP'), 

    (2,22,'B2B VP'), 

    (1,101,'B2C Prolongation'), 

    (2,102,'B2B Prolongation'), 

    (1,201,'B2C Transfer'), 

    (2,202,'B2B Transfer'), 

    (1,401,'B2C Addon'), 

    (2,402,'B2B Addon'), 

    (1,601,'B2C Online'), 

    (2,602,'B2B Online'), 

    (1,611,'B2C Online MNP'), 

    (2,612,'B2B Online MNP'), 

    (1,621,'B2C Online VP'), 

    (2,622,'B2B Online VP'), 

    (1,701,'B2C Online Prolongation'), 

    (2,702,'B2B Online Prolongation'), 

    (1,801,'B2C Online Transfer'), 

    (2,802,'B2B Online Transfer'), 

    (1,1001,'B2C Online Addon'), 

    (2,1002,'B2B Online Addon'); 

    INSERT INTO sut_kl_tipai_mok_planai (kmp_klt_id, kmp_mpl_id) 

    SELECT temp_scenarios.scenario, @price_plan_id 

    FROM temp_scenarios 

    WHERE temp_scenarios.client_group IN (@grupe, 0) 

    ORDER BY temp_scenarios.scenario DESC; 

    DROP TEMPORARY TABLE IF EXISTS temp_scenarios; 

-- Periods 

    CREATE TEMPORARY TABLE temp_periods (period INT); 

    INSERT INTO temp_periods (period) 

    SELECT period  

    FROM JSON_TABLE(CONCAT('["', REPLACE(@periods, ',', '","'), '"]'), '$[*]'  

        COLUMNS (period INT PATH '$')) AS t; 

    INSERT INTO sut_mok_planai_kl_tipai_laikotarpiai (mkl_kmp_id, mkl_laikotarpiai) 

    SELECT sut_kl_tipai_mok_planai.kmp_id, temp_periods.period 

    FROM sut_kl_tipai_mok_planai 

    JOIN temp_periods 

    WHERE sut_kl_tipai_mok_planai.kmp_mpl_id = @price_plan_id 

    AND sut_kl_tipai_mok_planai.kmp_klt_id NOT IN (1001,1002); 

    INSERT INTO sut_mok_planai_kl_tipai_laikotarpiai (mkl_kmp_id, mkl_laikotarpiai) 

    SELECT sut_kl_tipai_mok_planai.kmp_id, '-1' 

    FROM sut_kl_tipai_mok_planai 

    WHERE sut_kl_tipai_mok_planai.kmp_mpl_id = @price_plan_id 

    AND sut_kl_tipai_mok_planai.kmp_klt_id IN (401,402,1001,1002); 

    IF @wsc_period <> '' THEN 

      INSERT INTO sut_mok_planai_kl_tipai_laikotarpiai (mkl_kmp_id, mkl_laikotarpiai) 

      SELECT sut_kl_tipai_mok_planai.kmp_id, @wsc_period 

      FROM sut_kl_tipai_mok_planai 

      WHERE sut_kl_tipai_mok_planai.kmp_mpl_id = @price_plan_id 

      AND sut_kl_tipai_mok_planai.kmp_klt_id IN (1001,1002); 

    END IF; 

--    DROP TEMPORARY TABLE IF EXISTS temp_periods; 

-- Optional services 

    CREATE TEMPORARY TABLE temp_optional_services_rules(rule VARCHAR(255), client_group INT, plan_type INT, scenario INT); 

    INSERT INTO temp_optional_services_rules (rule, client_group, plan_type, scenario) 

    VALUES  

    ('backup_sim',1,0,11), 

    ('backup_sim',2,0,12), 

    ('backup_sim',1,0,611), 

    ('backup_sim',2,0,612), 

    ('early_extension',1,0,101), 

    ('early_extension',2,0,102), 

    ('early_extension',1,0,701), 

    ('early_extension',2,0,702); 

    INSERT INTO temp_optional_services_rules (rule, client_group, plan_type, scenario) 

    VALUES  

    ('new_msisdn',1,0,1), 

    ('new_msisdn',1,0,11), 

    ('new_msisdn',1,0,21), 

    ('new_msisdn',1,0,201), 

    ('new_msisdn',1,0,601), 

    ('new_msisdn',1,0,611), 

    ('new_msisdn',1,0,621), 

    ('new_msisdn',1,0,701), 

    ('new_msisdn',1,0,801); 

    INSERT INTO temp_optional_services_rules (rule, client_group, plan_type, scenario) 

    VALUES  

    ('existing_msisdn',1,0,101), 

    ('existing_msisdn',1,0,401), 

    ('existing_msisdn',1,0,1001); 

    INSERT INTO temp_optional_services_rules (rule, client_group, plan_type, scenario) 

    VALUES  

    ('wsc_buckets',1,0,1001); 

    INSERT INTO temp_optional_services_rules (rule, client_group, plan_type, scenario) 

    VALUES  

    ('new_msisdn',2,0,2), 

    ('new_msisdn',2,0,12), 

    ('new_msisdn',2,0,22), 

    ('new_msisdn',2,0,202), 

    ('new_msisdn',2,0,602), 

    ('new_msisdn',2,0,612), 

    ('new_msisdn',2,0,622), 

    ('new_msisdn',2,0,702), 

    ('new_msisdn',2,0,802); 

    INSERT INTO temp_optional_services_rules (rule, client_group, plan_type, scenario) 

    VALUES  

    ('existing_msisdn',2,0,102), 

    ('existing_msisdn',2,0,402), 

    ('existing_msisdn',2,0,1002); 

    INSERT INTO temp_optional_services_rules (rule, client_group, plan_type, scenario) 

    VALUES  

    ('wsc_buckets',2,0,1002); 

    CREATE TEMPORARY TABLE temp_optional_services(rule VARCHAR(255), client_group INT, plan_type INT, service INT); 

    INSERT INTO temp_optional_services (rule, client_group, plan_type, service) 

    VALUES 

    ('backup_sim',0,0,164), 

    ('early_extension',0,0,4003); 

    INSERT INTO temp_optional_services (rule, client_group, plan_type, service) 

    SELECT 'new_msisdn', 1, 1, sap.akp_id 

    FROM sut_akcijos_paslaugos sap  

    WHERE sap.akp_id IN(23, 35, 525, 613, 615, 4604, 7179, 7246, 7247, 9161, 7249, 8090, 8091, 8092, 8093, 8094, 8095, 8096, 8097, 8099, 8100, 8127, 8128, 8185, 8186, 8187, 8188, 8189, 8190, 8191, 8192, 8194, 8195, 8196, 8279, 8422, 7095, 9159, 9605, 9607, 9609, 9610, 9611, 9612, 9717, 9718, 9719, 9810, 9811, 9830, 9831, 9973, 10008, 10013, 10014, 10015, 10513, 10508, 10507, 10501, 10500, 10499, 10498, 10497, 10496, 10495, 10494, 10004, 10003,10286,10502,10503,10504,10505,10537,10543,10544,10545,10546,10559,10576,10601,10636,10637,10702,10747,10739,10740,10821,10825,10868); 

    INSERT INTO temp_optional_services (rule, client_group, plan_type, service) 

    SELECT 'new_msisdn', 1, 2, sap.akp_id 

    FROM sut_akcijos_paslaugos sap  

    WHERE sap.akp_id IN(6898,6900,6901,6903,6905,6667,4604,35,613,730,7095,8279,9810,9811,10015,10014,10013,10008,10004,10003,9973,9831,9830,9814,9813,9719,9718,9717,9612,9611,9610,9609,9608,9607,9606,9605,9078,8585,8583,8581,8422,8196,8195,8194,8193,8192,8191,8190,8189,8188,8187,8186,8185,7698,7697,7696,7695,10513,10508,10507,10501,10500,10499,10498,10497,10496,10495,10494,10008,10004,10003,10286,10502,10503,10504,10505,10537,10543,10544,10545,10546,10559,10576,10601,10636,10637,10702,10747,10739,10740,10821,10825,10868); 

    INSERT INTO temp_optional_services (rule, client_group, plan_type, service) 

    SELECT 'new_msisdn', 2, 1, sap.akp_id 

    FROM sut_akcijos_paslaugos sap  

    WHERE sap.akp_id IN(23, 35, 325, 326, 525, 613, 615, 4604, 7246, 7247, 9161, 7249, 7348, 7349, 8105, 8410, 8546,8547,8548,8549,8550,10763,11830); 

    INSERT INTO temp_optional_services (rule, client_group, plan_type, service) 

    SELECT 'new_msisdn', 2, 2, sap.akp_id 

    FROM sut_akcijos_paslaugos sap  

    WHERE sap.akp_id IN(4604,35,613,730,6667,10763); 

    INSERT INTO temp_optional_services (rule, client_group, plan_type, service) 

    SELECT 'existing_msisdn', 1, 1, sap.akp_id 

    FROM sut_akcijos_paslaugos sap  

    WHERE sap.akp_id IN(23, 35, 525, 613, 615, 4604, 7179, 7246, 7247, 9161, 7249, 8090, 8091, 8092, 8093, 8094, 8095, 8096, 8097, 8099, 8100, 8127, 8128, 8185, 8186, 8187, 8188, 8189, 8190, 8191, 8192, 8194, 8195, 8196, 8279, 8422, 7095, 9159, 9605, 9607, 9609, 9610, 9611, 9612, 9717, 9718, 9719, 9810, 9811, 9830, 9831, 9973, 10008, 10013, 10014, 10015, 10513, 10508, 10507, 10501, 10500, 10499, 10498, 10497, 10496, 10495, 10494, 10004, 10003,10286,10502,10503,10504,10505,10537,10543,10544,10545,10546,10559,10576,10601,10636,10637,10702,10747,10739,10740,10821,10825,10868); 

    INSERT INTO temp_optional_services (rule, client_group, plan_type, service) 

    SELECT 'existing_msisdn', 1, 2, sap.akp_id 

    FROM sut_akcijos_paslaugos sap  

    WHERE sap.akp_id IN(6898,6900,6901,6903,6905,4604,4522,613,730,7146,7095,9810,9811,8279,10015,10014,10013,10008,10004,10003,9973,9831,9830,9814,9813,9719,9718,9717,9612,9611,9610,9609,9608,9607,9606,9605,9078,8585,8583,8581,8422,8196,8195,8194,8193,8192,8191,8190,8189,8188,8187,8186,8185,7698,7697,7696,7695,10513,10508,10507,10501,10500,10499,10498,10497,10496,10495,10494,10008,10004,10003,10286,10502,10503,10504,10505,10537,10543,10544,10545,10546,10559,10576,10601,10636,10637,10702,10747,10739,10740,10821,10825,10868); 

    INSERT INTO temp_optional_services (rule, client_group, plan_type, service) 

    SELECT 'existing_msisdn', 2, 1, sap.akp_id 

    FROM sut_akcijos_paslaugos sap  

    WHERE sap.akp_id IN(23, 326,525,613,615,4604,7023,7246,7247,9161,7249,7348,7349,8105,8410,8546,8547,8548,8549,8550,10763,11830); 

    INSERT INTO temp_optional_services (rule, client_group, plan_type, service) 

    SELECT 'existing_msisdn', 2, 2, sap.akp_id 

    FROM sut_akcijos_paslaugos sap  

    WHERE sap.akp_id IN(4604,613,730,10763); 

    INSERT INTO temp_optional_services (rule, client_group, plan_type, service) 

    SELECT 'wsc_buckets', 1, 1, sap.akp_id 

    FROM sut_akcijos_paslaugos sap  

    WHERE sap.akp_id IN(7057,7058,7059,8283,8284,8285,8286,8435,8437,8438,9730,9731,9732,9416,9417,9418,10726,10727,10728); 

    INSERT INTO temp_optional_services (rule, client_group, plan_type, service) 

    SELECT 'wsc_buckets', 1, 2, sap.akp_id 

    FROM sut_akcijos_paslaugos sap  

    WHERE sap.akp_id IN(8985,8987,8989,8991,8993,8994,10041,10052,10055,10726,10727,10728); 

    INSERT INTO temp_optional_services (rule, client_group, plan_type, service) 

    SELECT 'wsc_buckets', 2, 1, sap.akp_id 

    FROM sut_akcijos_paslaugos sap  

    WHERE sap.akp_id IN(7212,7213,7214,10092,10094,10095,10098); 

    INSERT INTO temp_optional_services (rule, client_group, plan_type, service) 

    SELECT 'existing_msisdn', 2, 2, sap.akp_id 

    FROM sut_akcijos_paslaugos sap  

    WHERE sap.akp_id IN(6901,6900,6898,8182,8183,8184,10081,10074,10067,10063); 

    INSERT IGNORE INTO sut_mkl_akcijos_paslaugos (mpa_mkl_id, mpa_akp_id, mpa_relation_type) 

    SELECT periods.mkl_id, tos.service, 'optional' 

    FROM sut_mok_planai_kl_tipai_laikotarpiai periods 

    LEFT JOIN sut_kl_tipai_mok_planai scenarios ON periods.mkl_kmp_id = scenarios.kmp_id 

    JOIN temp_optional_services_rules tor ON scenarios.kmp_klt_id = tor.scenario 

    LEFT JOIN temp_optional_services tos ON tor.rule = tos.rule 

    WHERE scenarios.kmp_mpl_id = @price_plan_id 

    AND tor.rule = 'new_msisdn' 

    AND tor.client_group = @grupe 

    AND tos.client_group IN(@grupe, 0) 

    AND tor.plan_type IN(@plano_grupe, 0); 

    INSERT IGNORE INTO sut_mkl_akcijos_paslaugos (mpa_mkl_id, mpa_akp_id, mpa_relation_type) 

    SELECT periods.mkl_id, tos.service, 'optional' 

    FROM sut_mok_planai_kl_tipai_laikotarpiai periods 

    LEFT JOIN sut_kl_tipai_mok_planai scenarios ON periods.mkl_kmp_id = scenarios.kmp_id 

    JOIN temp_optional_services_rules tor ON scenarios.kmp_klt_id = tor.scenario 

    LEFT JOIN temp_optional_services tos ON tor.rule = tos.rule 

    WHERE scenarios.kmp_mpl_id = @price_plan_id 

    AND tor.rule = 'existing_msisdn' 

    AND tor.client_group = @grupe 

    AND tos.client_group IN(@grupe, 0) 

    AND tor.plan_type IN(@plano_grupe, 0); 

    INSERT IGNORE INTO sut_mkl_akcijos_paslaugos (mpa_mkl_id, mpa_akp_id, mpa_relation_type) 

    SELECT periods.mkl_id, tos.service, 'optional' 

    FROM sut_mok_planai_kl_tipai_laikotarpiai periods 

    LEFT JOIN sut_kl_tipai_mok_planai scenarios ON periods.mkl_kmp_id = scenarios.kmp_id 

    JOIN temp_optional_services_rules tor ON scenarios.kmp_klt_id = tor.scenario 

    LEFT JOIN temp_optional_services tos ON tor.rule = tos.rule 

    WHERE scenarios.kmp_mpl_id = @price_plan_id 

    AND tor.rule = 'backup_sim' 

    AND tor.client_group = @grupe 

    AND tos.client_group IN(@grupe, 0) 

    AND tor.plan_type IN(@plano_grupe, 0); 

    INSERT IGNORE INTO sut_mkl_akcijos_paslaugos (mpa_mkl_id, mpa_akp_id, mpa_relation_type) 

    SELECT periods.mkl_id, tos.service, 'optional' 

    FROM sut_mok_planai_kl_tipai_laikotarpiai periods 

    LEFT JOIN sut_kl_tipai_mok_planai scenarios ON periods.mkl_kmp_id = scenarios.kmp_id 

    JOIN temp_optional_services_rules tor ON scenarios.kmp_klt_id = tor.scenario 

    LEFT JOIN temp_optional_services tos ON tor.rule = tos.rule 

    WHERE scenarios.kmp_mpl_id = @price_plan_id 

    AND tor.rule = 'early_extension' 

    AND tor.client_group = @grupe 

    AND tos.client_group IN(@grupe, 0) 

    AND tor.plan_type IN(@plano_grupe, 0); 

    INSERT IGNORE INTO sut_mkl_akcijos_paslaugos (mpa_mkl_id, mpa_akp_id, mpa_relation_type) 

    SELECT periods.mkl_id, tos.service, 'optional' 

    FROM sut_mok_planai_kl_tipai_laikotarpiai periods 

    LEFT JOIN sut_kl_tipai_mok_planai scenarios ON periods.mkl_kmp_id = scenarios.kmp_id 

    JOIN temp_optional_services_rules tor ON scenarios.kmp_klt_id = tor.scenario 

    LEFT JOIN temp_optional_services tos ON tor.rule = tos.rule 

    WHERE scenarios.kmp_mpl_id = @price_plan_id 

    AND tor.rule = 'wsc_buckets' 

    AND tor.client_group = @grupe 

    AND tos.client_group IN(@grupe, 0) 

    AND tor.plan_type IN(@plano_grupe, 0); 

    DROP TEMPORARY TABLE IF EXISTS temp_optional_services; 

    DROP TEMPORARY TABLE IF EXISTS temp_optional_services_rules; 

-- Required services 

    IF @internet_security = 1 THEN 

      IF @grupe = 1 THEN 

        SET @internet_security_vas = 10747; 

      END IF; 

      IF @grupe = 2 THEN  

        SET @internet_security_vas = 10763; 

      END IF; 

      INSERT INTO sut_mkl_akcijos_paslaugos (mpa_mkl_id, mpa_akp_id, mpa_relation_type) 

      SELECT pr.mkl_id, vas.akp_id, 'required' 

      FROM sut_mok_planai_kl_tipai_laikotarpiai pr 

      JOIN sut_kl_tipai_mok_planai sc ON pr.mkl_kmp_id = sc.kmp_id 

      JOIN sut_akcijos_paslaugos vas 

      WHERE sc.kmp_mpl_id = @price_plan_id 

      AND sc.kmp_klt_id = 999  

      AND vas.akp_id = @internet_security_vas; 

    END IF; 

    IF @is_5g = 1 THEN 

      SET @is_5g_vas = 10700; 

      INSERT INTO sut_mkl_akcijos_paslaugos (mpa_mkl_id, mpa_akp_id, mpa_relation_type) 

      SELECT pr.mkl_id, vas.akp_id, 'required' 

      FROM sut_mok_planai_kl_tipai_laikotarpiai pr 

      JOIN sut_kl_tipai_mok_planai sc ON pr.mkl_kmp_id = sc.kmp_id 

      JOIN sut_akcijos_paslaugos vas 

      WHERE sc.kmp_mpl_id = @price_plan_id 

      AND sc.kmp_klt_id = 999  

      AND vas.akp_id = @is_5g_vas; 

      INSERT INTO mokejimo_planai_services (plan_id, akp_id, package, hide) 

      SELECT @price_plan_id, @is_5g_vas, '2', '1'; 

      INSERT INTO mokejimo_planai_package_map (mokejimo_planai_services_id, package_config_id) 

      SELECT pps.id, mppc.id 

      FROM mokejimo_planai_services pps 

      JOIN mokejimo_planai_package_config mppc 

      JOIN sut_akcijos_paslaugos vas 

      WHERE pps.plan_id = @price_plan_id 

      AND mppc.period IS NULL  

      AND mppc.document_type = 0 

      AND vas.akp_id = @is_5g_vas; 

    END IF; 

    IF @fair_usage_policy = 1 THEN 

      SET @fair_usage_policy_vas = 9971; 

      INSERT INTO sut_mkl_akcijos_paslaugos (mpa_mkl_id, mpa_akp_id, mpa_relation_type) 

      SELECT pr.mkl_id, vas.akp_id, 'required' 

      FROM sut_mok_planai_kl_tipai_laikotarpiai pr 

      JOIN sut_kl_tipai_mok_planai sc ON pr.mkl_kmp_id = sc.kmp_id 

      JOIN sut_akcijos_paslaugos vas 

      WHERE sc.kmp_mpl_id = @price_plan_id 

      AND sc.kmp_klt_id = 999 

      AND vas.akp_id = @fair_usage_policy_vas; 

      INSERT INTO mokejimo_planai_services (plan_id, akp_id, package, hide) 

      SELECT @price_plan_id, @fair_usage_policy_vas, '2', '1'; 

      INSERT INTO mokejimo_planai_package_map (mokejimo_planai_services_id, package_config_id) 

      SELECT pps.id, mppc.id 

      FROM mokejimo_planai_services pps 

      JOIN mokejimo_planai_package_config mppc 

      JOIN sut_akcijos_paslaugos vas 

      WHERE pps.plan_id = @price_plan_id 

      AND mppc.period IS NULL  

      AND mppc.document_type = 0 

      AND vas.akp_id = @fair_usage_policy_vas; 

    END IF; 

    IF @gb_campaign = 1 THEN 

      SET @gb_campaign_vas = 7512; 

      INSERT INTO sut_mkl_akcijos_paslaugos (mpa_mkl_id, mpa_akp_id, mpa_relation_type) 

      SELECT pr.mkl_id, vas.akp_id, 'required' 

      FROM sut_mok_planai_kl_tipai_laikotarpiai pr 

      JOIN sut_kl_tipai_mok_planai sc ON pr.mkl_kmp_id = sc.kmp_id 

      JOIN sut_akcijos_paslaugos vas 

      WHERE sc.kmp_mpl_id = @price_plan_id 

      AND sc.kmp_klt_id = 999 

      AND vas.akp_id = @gb_campaign_vas; 

    END IF; 

    CREATE TEMPORARY TABLE temp_services (service_id INT); 

    INSERT INTO temp_services (service_id) 

    SELECT service 

    FROM JSON_TABLE(CONCAT('["', REPLACE(@services, ',', '","'), '"]'), '$[*]'  

    COLUMNS (service INT PATH '$')) AS t; 

    CREATE TEMPORARY TABLE temp_service_with_periods (service_id INT, period INT); 

    INSERT INTO temp_service_with_periods 

    SELECT temp_services.service_id,  

          CASE  

              WHEN akp_mw_kodas LIKE '%\_%'  

              THEN SUBSTRING_INDEX(sut_akcijos_paslaugos.akp_mw_kodas, '_', -1)  

              ELSE NULL  

          END AS period 

    FROM temp_services 

    LEFT JOIN sut_akcijos_paslaugos ON temp_services.service_id = sut_akcijos_paslaugos.akp_id; 

    -- Terminated services insert 

    INSERT IGNORE INTO sut_mkl_akcijos_paslaugos (mpa_mkl_id, mpa_akp_id, mpa_relation_type) 

    SELECT periods.mkl_id, temp_service_with_periods.service_id, 'required' 

    FROM sut_mok_planai_kl_tipai_laikotarpiai periods 

    LEFT JOIN sut_kl_tipai_mok_planai scenarios ON periods.mkl_kmp_id = scenarios.kmp_id 

    JOIN temp_service_with_periods 

    WHERE periods.mkl_laikotarpiai = temp_service_with_periods.period 

    AND temp_service_with_periods.period IS NOT NULL 

    AND scenarios.kmp_klt_id = 999 

    AND scenarios.kmp_mpl_id = @price_plan_id; 

    -- Unterminated services insert 

    INSERT IGNORE INTO sut_mkl_akcijos_paslaugos (mpa_mkl_id, mpa_akp_id, mpa_relation_type) 

    SELECT periods.mkl_id, temp_service_with_periods.service_id, 'required' 

    FROM sut_mok_planai_kl_tipai_laikotarpiai periods 

    LEFT JOIN sut_kl_tipai_mok_planai scenarios ON periods.mkl_kmp_id = scenarios.kmp_id 

    JOIN temp_service_with_periods 

    WHERE temp_service_with_periods.period IS NULL 

    AND scenarios.kmp_klt_id = 999 

    AND scenarios.kmp_mpl_id = @price_plan_id; 

    INSERT INTO mokejimo_planai_services (plan_id, akp_id, package, hide) 

    SELECT @price_plan_id, service_id, '2', '1' 

    FROM temp_service_with_periods; 

    INSERT INTO mokejimo_planai_package_map (mokejimo_planai_services_id, package_config_id) 

    SELECT mps.id, mppc.id 

    FROM mokejimo_planai_services mps  

    LEFT JOIN temp_service_with_periods tswd  

      ON mps.akp_id = tswd.service_id 

    LEFT JOIN mokejimo_planai_package_config mppc  

      ON (tswd.period = mppc.period OR (tswd.period IS NULL AND mppc.period IS NULL))  

      AND mppc.document_type = 0 

    WHERE mps.plan_id = @price_plan_id; 

    INSERT INTO package_codes (package_code, active, siebel_code) 

    SELECT CONCAT('mp_',CONCAT(@price_plan_id, '_'),GROUP_CONCAT(mps.akp_id ORDER BY mps.akp_id ASC SEPARATOR '_')),'1',CONCAT('mp_', CONCAT(@price_plan_id, '_'),tp.period) 

    FROM temp_periods tp 

    JOIN mokejimo_planai_services mps  

    LEFT JOIN temp_service_with_periods tswp ON mps.akp_id = tswp.service_id 

    WHERE mps.plan_id = @price_plan_id 

    AND (tswp.period = tp.period OR tswp.period IS NULL) 

    GROUP BY tp.period; 

    DROP TABLE IF EXISTS temp_services; 

    DROP TABLE IF EXISTS temp_service_with_periods; 

    DROP TABLE IF EXISTS temp_periods; 

    IF @fair_usage_policy = 1 THEN  

      IF @threshold_value NOT IN('Standard', 'Standard+') THEN 

        INSERT INTO price_plan_attribute (price_plan_id,name,value) 

        VALUES  

        (@price_plan_id,'generate_document','2'), 

        (@price_plan_id,'Threshold', @threshold_value); 

      ELSE  

        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '[VALIDATION ERROR] if fair_usage_policy is set to 1, @threshold_value has to be set to \`Standard\` OR \`Standard+\`'; 

      END IF; 

    ELSE  

      INSERT INTO price_plan_attribute (price_plan_id,name,value) 

      VALUES  

      (@price_plan_id,'generate_document','2'); 

    END IF; 

    -- Salestool for B2C Voice and B2C MBB 

    IF @grupe = 1 AND @plano_grupe IN(1,2) THEN 

      INSERT INTO mokejimo_planai_change (plan_from, plan_to, time, client_type, source) 

      SELECT DISTINCT pp_from.id AS plan_from, pp_to.id AS plan_to, '0' AS time, @grupe AS client_type, '1' AS source 

      FROM mokejimo_planai pp_from 

      JOIN mokejimo_planai pp_to 

      LEFT JOIN sut_kl_tipai_mok_planai ON sut_kl_tipai_mok_planai.kmp_mpl_id = pp_to.id 

      LEFT JOIN sut_mok_planai_kl_tipai_laikotarpiai ON sut_mok_planai_kl_tipai_laikotarpiai.mkl_kmp_id = sut_kl_tipai_mok_planai.kmp_id 

      WHERE (pp_from.id = @price_plan_id AND pp_to.grupe = @grupe AND pp_to.plano_grupe = @plano_grupe) 

      OR (pp_from.grupe = @grupe AND pp_from.plano_grupe = @plano_grupe AND pp_to.id = @price_plan_id); 

      INSERT INTO mokejimo_planai_change (\`plan_from\`, \`plan_to\`, \`time\`, \`client_type\`, \`source\`) 

      SELECT DISTINCT pp_from.id AS \`plan_from\`, pp_to.id AS \`plan_to\`, '1' AS \`time\`, @grupe AS \`client_type\`, '1' AS \`source\` 

      FROM mokejimo_planai pp_from 

      JOIN mokejimo_planai pp_to 

      LEFT JOIN sut_kl_tipai_mok_planai ON sut_kl_tipai_mok_planai.kmp_mpl_id = pp_to.id 

      LEFT JOIN sut_mok_planai_kl_tipai_laikotarpiai ON sut_mok_planai_kl_tipai_laikotarpiai.mkl_kmp_id = sut_kl_tipai_mok_planai.kmp_id 

      WHERE (pp_from.id = @price_plan_id AND pp_to.grupe = @grupe AND pp_to.plano_grupe = @plano_grupe) 

      OR (pp_from.grupe = @grupe AND pp_from.plano_grupe = @plano_grupe AND pp_to.id = @price_plan_id); 

      INSERT INTO mokejimo_planai_change (\`plan_from\`, \`plan_to\`, \`time\`, \`client_type\`, \`source\`) 

      SELECT DISTINCT pp_from.id AS \`plan_from\`, pp_to.id AS \`plan_to\`, '2' AS \`time\`, @grupe AS \`client_type\`, '1' AS \`source\` 

      FROM mokejimo_planai pp_from 

      JOIN mokejimo_planai pp_to 

      LEFT JOIN sut_kl_tipai_mok_planai ON sut_kl_tipai_mok_planai.kmp_mpl_id = pp_to.id 

      LEFT JOIN sut_mok_planai_kl_tipai_laikotarpiai ON sut_mok_planai_kl_tipai_laikotarpiai.mkl_kmp_id = sut_kl_tipai_mok_planai.kmp_id 

      WHERE (pp_from.id = @price_plan_id AND pp_to.grupe = @grupe AND pp_to.plano_grupe = @plano_grupe) 

      OR (pp_from.grupe = @grupe AND pp_from.plano_grupe = @plano_grupe AND pp_to.id = @price_plan_id); 

    END IF;  

    -- Salestool B2B Voice 

    IF @grupe = 2 AND @plano_grupe = 1 THEN 

      INSERT INTO mokejimo_planai_change (\`plan_from\`, \`plan_to\`, \`time\`, \`client_type\`, \`source\`) 

      SELECT DISTINCT pp_from.id AS \`plan_from\`, pp_to.id AS \`plan_to\`, '0' AS \`time\`, @grupe AS \`client_type\`, '1' AS \`source\` 

      FROM mokejimo_planai pp_from 

      JOIN mokejimo_planai pp_to 

      LEFT JOIN sut_kl_tipai_mok_planai ON sut_kl_tipai_mok_planai.kmp_mpl_id = pp_to.id 

      LEFT JOIN sut_mok_planai_kl_tipai_laikotarpiai ON sut_mok_planai_kl_tipai_laikotarpiai.mkl_kmp_id = sut_kl_tipai_mok_planai.kmp_id 

      WHERE (pp_from.id = @price_plan_id AND pp_to.grupe = @grupe AND pp_to.plano_grupe = @plano_grupe) 

      OR (pp_from.grupe = @grupe AND pp_from.plano_grupe = @plano_grupe AND pp_to.id = @price_plan_id); 

      INSERT INTO mokejimo_planai_change (\`plan_from\`, \`plan_to\`, \`time\`, \`client_type\`, \`source\`) 

      SELECT DISTINCT pp_from.id AS \`plan_from\`, pp_to.id AS \`plan_to\`, '1' AS \`time\`, @grupe AS \`client_type\`, '1' AS \`source\` 

      FROM mokejimo_planai pp_from 

      JOIN mokejimo_planai pp_to 

      LEFT JOIN sut_kl_tipai_mok_planai ON sut_kl_tipai_mok_planai.kmp_mpl_id = pp_to.id 

      LEFT JOIN sut_mok_planai_kl_tipai_laikotarpiai ON sut_mok_planai_kl_tipai_laikotarpiai.mkl_kmp_id = sut_kl_tipai_mok_planai.kmp_id 

      WHERE (pp_from.id = @price_plan_id AND pp_to.grupe = @grupe AND pp_to.plano_grupe = @plano_grupe) 

      OR (pp_from.grupe = @grupe AND pp_from.plano_grupe = @plano_grupe AND pp_to.id = @price_plan_id); 

      INSERT INTO mokejimo_planai_change (\`plan_from\`, \`plan_to\`, \`time\`, \`client_type\`, \`source\`) 

      SELECT DISTINCT pp_from.id AS \`plan_from\`, pp_to.id AS \`plan_to\`, '2' AS \`time\`, @grupe AS \`client_type\`, '1' AS \`source\` 

      FROM mokejimo_planai pp_from 

      JOIN mokejimo_planai pp_to 

      LEFT JOIN sut_kl_tipai_mok_planai ON sut_kl_tipai_mok_planai.kmp_mpl_id = pp_to.id 

      LEFT JOIN sut_mok_planai_kl_tipai_laikotarpiai ON sut_mok_planai_kl_tipai_laikotarpiai.mkl_kmp_id = sut_kl_tipai_mok_planai.kmp_id 

      WHERE (pp_from.id = @price_plan_id AND pp_to.grupe = @grupe AND pp_to.plano_grupe = @plano_grupe) 

      OR (pp_from.grupe = @grupe AND pp_from.plano_grupe = @plano_grupe AND pp_to.id = @price_plan_id); 

    END IF;  

    SELECT 'New Price plan inserted successfully.'; 

    -- @@TARIFFS_HERE@@

    COMMIT; 

END $$ 

DELIMITER ; 

CALL temp_new_price_plan(); 

DROP PROCEDURE IF EXISTS temp_new_price_plan;
`;