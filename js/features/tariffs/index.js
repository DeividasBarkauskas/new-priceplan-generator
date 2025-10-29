// js/features/tariffs/index.js
// (type="module" įkėlimas index.html faile)
// re-export, kad app.js toliau galėtų importuoti iš index.js
export { extractTariffRowsFromSheet } from './extractTariffs.js';
export { buildTariffConfigSQL } from './buildTariffSQL.js';

/* ... žemiau palik visą IIFE su copy handleriu ... */


(function () {
  const q = (sel) => Array.from(document.querySelectorAll(sel));
  const hasMainVars = () => !!(window.mainVars && typeof window.mainVars === 'object');

  function flash(btn, type, ok = '✅ Nukopijuota', err = '⚠️ Nerasta') {
    const orig = btn.dataset.textOrig || btn.textContent;
    if (!btn.dataset.textOrig) btn.dataset.textOrig = orig;
    btn.classList.remove('flash-success','flash-error');

    if (type === 'ok') {
      btn.classList.add('flash-success');
      btn.textContent = ok;
      setTimeout(() => { btn.classList.remove('flash-success'); btn.textContent = btn.dataset.textOrig; }, 900);
    } else {
      btn.classList.add('flash-error');
      btn.textContent = err;
      setTimeout(() => { btn.classList.remove('flash-error'); btn.textContent = btn.dataset.textOrig; }, 1100);
    }
  }

  function setButtonsDisabled(disabled = true) {
    q('[data-copy]').forEach(btn => {
      btn.toggleAttribute('disabled', disabled);
      if (disabled) btn.title = 'Įkelk XLSX – tuomet bus galima kopijuoti';
      else btn.removeAttribute('title');
    });
  }

  // Saugiai paimam lauką iš mainVars. Jei tai funkcija – iškviečiam.
  function resolveField(field) {
    if (!hasMainVars()) return '';
    const raw = window.mainVars[field];

    if (typeof raw === 'function') {
      try {
        const val = raw(window.mainVars);
        return val == null ? '' : String(val);
      } catch (e) {
        console.error('[copy] builder threw for', field, e);
        return '';
      }
    }
    if (raw == null) return '';
    // jei ne stringas – paverskime
    return typeof raw === 'string' ? raw : String(raw);
  }

  async function onCopyClick(e) {
    const btn = e.currentTarget;
    const type  = btn.dataset.copy;   // "sql" | "var" (abu elgsis vienodai)
    const field = btn.dataset.field;  // pvz. "discountSQL" arba "name"

    if (!field) {
      console.warn('[copy] missing data-field on button', btn);
      flash(btn, 'err');
      return;
    }

    const text = resolveField(field);
    console.log(`[copy] field="${field}" type=${typeof window.mainVars?.[field]} length=${text?.length || 0}`);

    if (!text) {
      flash(btn, 'err');
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      flash(btn, 'ok');
    } catch (err) {
      console.error('[copy] clipboard error:', err);
      flash(btn, 'err', '✅', '⚠️ Kopijuoti nepavyko');
    }
  }

  function wire() {
    q('[data-copy]').forEach(btn => {
      btn.removeEventListener('click', onCopyClick);
      btn.addEventListener('click', onCopyClick);
    });
  }

  function init() {
    wire();
    setButtonsDisabled(true);

    // Kai app.js praneša, kad mainVars paruoštas – įjungiame mygtukus
    window.addEventListener('mainVars:ready', () => {
      // jei discountSQL yra stringas, perrašyti nereikia;
      // jei funkcija – viskas tvarkoj, resolveField ją paleis.
      setButtonsDisabled(false);
    });

    console.log('[copy] index.js ready; buttons wired');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
