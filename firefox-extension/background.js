const allowedOrigins = new Set(['http://127.0.0.1:13000', 'http://localhost:13000']);
const monitorRuntime = typeof browser !== 'undefined' ? browser.runtime : chrome.runtime;
const monitorPromises = typeof browser !== 'undefined';
monitorRuntime.onMessage.addListener((message, sender, reply) => {
  let origin;
  try { origin = new URL(sender.url).origin; } catch { return false; }
  if (!allowedOrigins.has(origin) || sender.frameId !== 0 || sender.id !== monitorRuntime.id || message?.action !== 'start' || Object.keys(message).length !== 1) return false;
  const normalize = result => result?.ok === true ? {ok: true} : {ok: false, code: 'START_FAILED'};
  if (monitorPromises) {
    return monitorRuntime.sendNativeMessage('local.codex_monitor', {action: 'start'}).then(normalize, () => ({ok: false, code: 'BRIDGE_UNAVAILABLE'}));
  }
  monitorRuntime.sendNativeMessage('local.codex_monitor', {action: 'start'}, result => {
    if (monitorRuntime.lastError) { reply({ok: false, code: 'BRIDGE_UNAVAILABLE'}); return; }
    reply(result?.ok === true ? {ok: true} : {ok: false, code: 'START_FAILED'});
  });
  return true;
});
