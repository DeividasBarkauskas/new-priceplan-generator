(() => {
  const copyButton = document.getElementById('copy');
  if (!copyButton) return;

  let resetTimer;
  copyButton.addEventListener('click', () => {
    clearTimeout(resetTimer);
    copyButton.classList.remove('copy-success');
    void copyButton.offsetWidth;
    copyButton.classList.add('copy-success');

    resetTimer = setTimeout(() => {
      copyButton.classList.remove('copy-success');
    }, 650);
  });
})();
