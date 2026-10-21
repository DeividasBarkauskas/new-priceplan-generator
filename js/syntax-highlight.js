(() => {
  const sql = document.getElementById('sql');
  if (!sql || !window.Prism) return;

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      observer.disconnect();
      Prism.highlightElement(sql);
      observer.observe(sql, { childList: true, characterData: true, subtree: true });
    });
  });

  observer.observe(sql, { childList: true, characterData: true, subtree: true });
  Prism.highlightElement(sql);
})();
