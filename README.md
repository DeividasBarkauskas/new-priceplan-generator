# New Price Plan Generator – README

**Kas tai?**  Web įrankis, kuris iš pateikto **Excel šablono** automatiškai sugeneruoja **SQL procedūrą** naujam plano kūrimui.

**Kam skirtas?** Kad be rankinio SQL rašymo greitai gautume paruoštą procedūrą ir galėtme ją įvykdyti DB.

---

## Projekto esmė (ką šitas įrankis daro)
**Tikslas:** greitai ir be SQL klaidų sugeneruoti naujo plano kūrimo procedūrą pagal nustatytą verslo logiką.

**Kaip veikia:**
1. **Excel template** (užsakovas jį užpildo: planų pavadinimai, kainos, laikotarpiai, VAS ID, flag'ai – FUP/5G/IS ir t. t.).
2. Svetainėje **pasirenkamas Excel failas** → JS parseris ištraukia laukus.
3. Įrankis **užpildo kintamųjų bloką** (viršuje) ir **sugeneruoja procedūrą** pagal šabloną.
4. Vartotojas **peržiūri** visą „Procedūra“ bloką.
5. Paspaudžia **„Kopijuoti“** → gaunamas visas `CREATE PROCEDURE … CALL … DROP …` SQL, kurį galima **įkelti į DB**.

**Kur rasti online:**
- Live: **https://deividasbarkauskas.github.io/new-priceplan-generator/**


**Kodėl naudinga:**
- vienodas procedūrų formatas, mažiau klaidų; 
- sutrumpina laiką nuo Excel užpildymo iki galutinės SQL procedūros; 
- aiški periodų/VAS logika ir validacijos.

**Pastaba:** Įrankis niekur nekviečia DB – viskas vyksta naršyklėje, o SQL vykdomas tik jūsų kliente.

---

## Ką pildo Tele2 Excel'e
Minimalūs laukų tipai, kuriuos naudoja generatorius:
- **Plan info:** pavadinimai (`@pavadinimas`, `@spausdinamas_pavadinimas`, `@pdf_name`), `@kodas`, `@grupe` (1/2), `@plano_grupe`.
- **Kainos:** `@root_product_fee`, `@offer_fee`.
- **Tarifas:** `@root_product` (Siebel kodas; turi egzistuoti `mokejimo_planai_tariff_all`).
- **Laikotarpiai:** `@periods` (pvz. `18,24`), pasirinktinai `@wsc_period`.
- **Flag'ai:** `@fair_usage_policy`, `@internet_security`, `@is_5g`, `@gb_campaign`, `@threshold_value`.
- **VAS:** `@services` – VAS ID sąrašas didėjančia tvarka.

> **Pastaba:** Excel šablono stulpelių pavadinimai turi sutapti su įrankyje laukiamais „keys“. Jei pavadinimai pasikeis – atnaujink JS map'ą.

---

## Step-by-step: kaip naudotis UI
1. Atidaryk: **https://deividasbarkauskas.github.io/new-priceplan-generator/**
2. Paspausk **„Choose file“** ir įkelk **Excel template**.
3. Patikrink, ar **Kintamųjų** blokas užsipildė teisingai.
4. Išskleisk **„Procedūra“** – vizualiai peržvelk logiką (VAS/periodai/atributai).
5. Spausk **„Kopijuoti“** → įklijuok į savo SQL klientą (Workbench/DBeaver) ir **paleisk**.
6. Patikrink rezultatą lentelėse (`mokejimo_planai`, `mokejimo_planai_services`, `package_codes`).

> Jei Excel'e yra VAS su periodais, kurie nesutampa su tavo `@periods`, pažiūrėk 4 skyrių – kaip suvienodinti parsinimą arba išplėsti `@periods`.

---

## Reikalavimai
- **MySQL 8.0+** (naudojamas `JSON_TABLE` ir kitos 8.x funkcijos)
- Prieiga prie Tele2 schemos su lentelėmis: `mokejimo_planai`, `sut_kl_tipai_mok_planai`, `sut_mok_planai_kl_tipai_laikotarpiai`, `sut_akcijos_paslaugos`, `mokejimo_planai_services`, `mokejimo_planai_package_map`, `mokejimo_planai_package_config`, `package_codes`, `price_plan_attribute`, `price_plan_tariff_configuration`, ir t. t.
- Teisės: `CREATE PROCEDURE`, `CREATE TEMPORARY TABLE`, `INSERT`, `UPDATE`, `DELETE`.

---

## Kintamųjų santrauka

| Kintamasis | Paskirtis | Pastabos |
|---|---|---|
| `@pavadinimas`, `@spausdinamas_pavadinimas`, `@pdf_name` | Plano pavadinimai | Rodomi UI/PDF |
| `@kodas` | Unikalus plano kodas | Validuojamas, negali kartotis |
| `@grupe` | Kliento grupė | **1=B2C**, **2=B2B** |
| `@plano_grupe` | Plano tipas | **1=Voice**, **2=MBB**, 3=Prepaid, 5=Fix, 7=Budget, 8=M2M, 14=FTTP |
| `@root_product`, `@root_product_fee` | Tarifas ir kaina | Turi egzistuoti `mokejimo_planai_tariff_all` |
| `@offer_fee` | Plano kaina su nuolaida | Naudojama skaičiavimams su/ be PVM |
| `@default_plan` | Default plano flag | Paprastai `2` |
| `@risk_level`, `@bucket_size` | Rizikos lygis / duomenų kiekis | Pagal poreikį |
| `@fair_usage_policy` | 0/1 | Jei 1 – pridedamas FUP VAS (9971) ir `Threshold` validacija |
| `@threshold_value` | `Standard` arba `Standard+` | Privaloma kai FUP=1 |
| `@internet_security` | 0/1 | Jei 1 – pridedama `@internet_security_vas` (B2C=10747, B2B=10763) |
| `@is_5g` | 0/1 | Jei 1 – pridedama 5G VAS (10700) |
| `@gb_campaign` | 0/1 | Jei 1 – pridedama VAS 7512 |
| `@plan_promotion_product` | promos kodas | Jei tuščia – praleidžiama |
| `@periods` | Pvz. `'18,24'` | **Naudojama JSON_TABLE** generuoti laikotarpiams |
| `@wsc_period` | Papildomas WSC periodas | Pasirinktinai; turi būti iš `@periods` |
| `@services` | VAS ID sąrašas | Naudojamas pririšimui ir `package_codes` generavimui |

---

## Validacijos ir dažniausios klaidos

- **`[VALIDATION ERROR] mokejimo_planai.kodas exists`** – toks `@kodas` jau yra. Pasirink naują.
- **`mokejimo_planai_tariff_all.tariff_desc does not exist`** – `@root_product` neteisingas / neegzistuoja.
- **FUP ir `Threshold`** – kai `@fair_usage_policy=1`, `@threshold_value` **privalo** būti `Standard` arba `Standard+`.

Naudingi diagnostiniai SELECT’ai:
```sql
-- Patikrinti VAS MW kodus
SELECT akp_id, akp_mw_kodas FROM sut_akcijos_paslaugos WHERE akp_id IN ( ... tavo VAS ... );

-- Patikrinti ką įkrovė į mps
SELECT plan_id, akp_id FROM mokejimo_planai_services WHERE plan_id=@price_plan_id ORDER BY akp_id;

-- Pamatyti, kokį periodą aptiko parsinimas
SELECT * FROM temp_service_with_periods ORDER BY service_id;
```


## Web įrankis
Jei naudoji UI generatorių (HTML/CSS/JS), jis publikuotas per **GitHub Pages**:

- **Live:** `https://deividasbarkauskas.github.io/new-priceplan-generator/`
- Kaip atnaujinti turinį:
  ```bash
  git pull --rebase origin main
  git add -A
  git commit -m "UI: atnaujinimai"
  git push origin main
  ```
- GitHub Pages nuorodą ir SSL nustatymus rasi **Settings → Pages**.

**Svetainė (GitHub Pages / statinis hostingas)**
-  Įrankis **nėra prijungtas prie vidinės DB** – DB komandos paleidžiamos tik **tavo SQL kliente**.
-  Nėra formų, siunčiančių duomenis į serverį (jokio backend).

**DB pusė**
-  Prieigos teisės: procedūras paleidinėk **dev/test** prieš **prod**. 

---


