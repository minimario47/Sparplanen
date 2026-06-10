/* Theme management
 *
 * NOTE: The visible theme dial and all theme *switching* live in
 * js/components/theme-switch.js (it replaces #theme-toggle-btn with its own
 * control). This file only syncs the initial state that the pre-paint inline
 * script in index.html applied. Do not add click handlers here — they would
 * be attached to a button that theme-switch.js removes.
 */

function initTheme() {
    // The inline script in <head> already set data-theme before first paint.
    // Read back what was applied so we're in sync.
    const appliedTheme = document.documentElement.getAttribute('data-theme') || 'light';
    // Persist if it was set by the system preference fallback
    if (!localStorage.getItem('sparplannen-theme')) {
        localStorage.setItem('sparplannen-theme', appliedTheme);
    }

    console.log(`Theme initialized: ${appliedTheme}`);
}
