(() => {
  const copyButton = document.getElementById('copy');
  if (!copyButton) return;

  let resetTimer;

  copyButton.addEventListener('click', () => {
    clearTimeout(resetTimer);

    copyButton.style.backgroundColor = '#16a34a';
    copyButton.style.background = '#16a34a';
    copyButton.style.boxShadow = '0 0 0 3px rgba(22, 163, 74, 0.18)';

    resetTimer = setTimeout(() => {
      copyButton.style.backgroundColor = '';
      copyButton.style.background = '';
      copyButton.style.boxShadow = '';
    }, 1000);
  });
})();
