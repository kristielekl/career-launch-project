// Apply saved choice before paint. With no override, CSS follows the system.
(() => {
  const key = 'careerlaunch-theme';
  let choice = 'system';
  try { choice = localStorage.getItem(key) || 'system'; } catch {}
  if (choice !== 'light' && choice !== 'dark') choice = 'system';
  function apply() {
    if (choice === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = choice;
  }
  apply();
  document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('themeChoice');
    select.value = choice;
    select.addEventListener('change', () => {
      choice = select.value;
      apply();
      try {
        if (choice === 'system') localStorage.removeItem(key);
        else localStorage.setItem(key, choice);
      } catch {} // Theme still works when browser storage is unavailable.
    });
  });
})();
