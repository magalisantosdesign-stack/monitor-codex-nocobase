(() => {
  const runtime = typeof browser !== 'undefined' ? browser.runtime : chrome.runtime;
  const promises = typeof browser !== 'undefined';
  const selector = 'button[data-codex-monitor-control="connect"]';
  const mark = () => document.querySelectorAll(selector).forEach(button => button.setAttribute('data-codex-monitor-bridge', 'ready'));
  mark();
  new MutationObserver(mark).observe(document.documentElement, {childList: true, subtree: true});
  document.addEventListener('click', event => {
    const button = event.target.closest?.(selector);
    if (!event.isTrusted || !button || button.disabled || button.getAttribute('data-codex-monitor-demo') === 'true' || button.getAttribute('data-codex-monitor-result') === 'pending') return;
    button.setAttribute('data-codex-monitor-result', 'pending');
    const finish = (result, error) => {
      button.setAttribute('data-codex-monitor-result', !error && result?.ok === true ? 'started' : result?.code || 'BRIDGE_UNAVAILABLE');
    };
    if (promises) runtime.sendMessage({action: 'start'}).then(result => finish(result, false), () => finish(null, true));
    else runtime.sendMessage({action: 'start'}, result => finish(result, runtime.lastError));
  }, true);
})();
