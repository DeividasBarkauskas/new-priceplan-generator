// Fresh entrypoint for the full sanitized portfolio generator.
// A unique query parameter forces GitHub Pages/browser caches to fetch the current full generator.
(() => {
  const script = document.createElement('script');
  script.src = 'js/app.js?full-generator=20261021-2';
  script.onload = () => console.info('Full SQL generator loaded.');
  script.onerror = () => {
    const status = document.getElementById('status');
    if (status) status.textContent = 'Could not load the full SQL generator. Please refresh the page.';
  };
  document.body.appendChild(script);
})();
