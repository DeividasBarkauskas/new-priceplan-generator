// js/ui.js
import { copyToClipboard } from './core/utils.js';
import { PROCEDURE_BLOCK } from './procedure.js';

// +++ pridėtas 5-as parametras: getExtraSQL (nebūtinas)
// js/ui.js
export function createSheetBlock(sheetName, sql, rootProduct, counterStart = 2, onCopyExtra) {
  
  const container = document.getElementById('outputs');

  const wrapper = document.createElement('div');
  wrapper.className = 'sheet-block';

  // --- Header
  const header = document.createElement('div');
  header.className = 'header';

  const title = document.createElement('div');
  title.textContent = `${sheetName}-${counterStart}`;

  const query = document.createElement('div');
  query.className = 'query';
  query.innerHTML = `
    <span class="keyword">SELECT</span> * 
    <span class="keyword">FROM</span> 
    <span class="table">mokejimo_planai_tariff_all</span> 
    <span class="where">WHERE</span> 
    <span class="table">macpoc_code</span> 
    <span class="keyword">LIKE</span> 
    <span class="value">'%${rootProduct}%'</span>;
  `;
  query.addEventListener('click', () => {
    const plainText = `SELECT * FROM mokejimo_planai_tariff_all WHERE macpoc_code LIKE '%${rootProduct}%';`;
    copyToClipboard(plainText, query);
  });

  const copyBtn = document.createElement('button');
  copyBtn.className = 'copy';
  copyBtn.textContent = 'Kopijuoti';

  header.appendChild(title);
  header.appendChild(query);
  header.appendChild(copyBtn);
  wrapper.appendChild(header);

  // --- Pirmas CodeMirror (SET’ai)
  const varsWrap = document.createElement('div');
  varsWrap.className = 'cm-vars';
  const mainTA = document.createElement('textarea');
  varsWrap.appendChild(mainTA);
  wrapper.appendChild(varsWrap);

  const cmMain = CodeMirror.fromTextArea(mainTA, {
    mode: 'text/x-sql',
    theme: 'dracula',
    lineNumbers: true,
    lineWrapping: true
  });
  cmMain.setValue(sql);
  cmMain.setOption('viewportMargin', Infinity);
  requestAnimationFrame(() => cmMain.refresh());

  // --- Antras CodeMirror (procedūra)
  const procToggle = document.createElement('div');
  procToggle.style.cursor = 'pointer';
  procToggle.style.margin = '8px 0 4px';
  procToggle.style.opacity = '0.85';
  procToggle.textContent = '▶ Procedūra (temp_new_price_plan)';

  const procWrap = document.createElement('div');
  procWrap.style.display = 'none';
  procWrap.className = 'cm-proc';

  const procTA = document.createElement('textarea');
  procWrap.appendChild(procTA);

  wrapper.appendChild(procToggle);
  wrapper.appendChild(procWrap);
  container.appendChild(wrapper);

  let cmProc = null;
  let procOpen = false;

  procToggle.addEventListener('click', () => {
    procOpen = !procOpen;
    procWrap.style.display = procOpen ? 'block' : 'none';
    procToggle.textContent = `${procOpen ? '▼' : '▶'} Procedūra (temp_new_price_plan)`;

    if (procOpen) {
      if (!cmProc) {
        cmProc = CodeMirror.fromTextArea(procTA, {
          mode: 'text/x-sql',
          theme: 'dracula',
          lineNumbers: true,
          lineWrapping: true
        });
        cmProc.setValue(PROCEDURE_BLOCK);
        cmProc.setSize('100%', '420px');
      } else {
        cmProc.refresh();
      }
    }
  });

  // --- Kopijavimas: SET’ai + Procedūra + (nebūtina) papildoma tarifų SQL dalis
  copyBtn.onclick = () => {
  const varsPart = cmMain.getValue().trimEnd();
  let   procPart = (cmProc ? cmProc.getValue() : PROCEDURE_BLOCK).trimStart();

  // paimam papildomą SQL (tarifų priedą), jei pateiktas
  const extra = onCopyExtra ? onCopyExtra().trim() : '';

  if (extra) {
    if (procPart.includes('-- @@TARIFFS_HERE@@')) {
      procPart = procPart.replace('-- @@TARIFFS_HERE@@', extra);
    } else {
      // jei žymeklio nerastų – įdedam prieš COMMIT; kaip „fallback“
      procPart = procPart.replace(/COMMIT;/i, `${extra}\n\nCOMMIT;`);
    }
  }

  copyToClipboard(`${varsPart}\n\n${procPart}`, copyBtn);
};

}
