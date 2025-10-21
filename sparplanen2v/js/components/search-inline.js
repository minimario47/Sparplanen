/**
 * Inline Search - SVG animated search bar
 * Behaviors:
 * - Input emits 'trainSearchQuery' event for train searching
 * - ESC clears the search
 */

(function () {
  let form, input;

  function init() {
    form = document.getElementById('search-form');
    if (!form) return;

    input = document.getElementById('search-input');
    if (!input) return;

    attachListeners();
  }

  function attachListeners() {
    // Input typing -> emit query
    input.addEventListener('input', () => {
      emitQuery(input.value);
    });

    // Keyboard support
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // ESC clears search and closes search bar
        input.value = '';
        input.blur();
        emitQuery('');
      } else if (e.key === 'Enter') {
        // ENTER keeps current search results and closes search bar
        e.preventDefault();
        input.blur();
        console.log('🔍 Sökning låst, sökfält stängt');
      }
    });
  }

  function emitQuery(query) {
    window.dispatchEvent(new CustomEvent('trainSearchQuery', {
      detail: { query: String(query || '').trim() }
    }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
