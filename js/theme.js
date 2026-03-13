/* Theme management */

function initTheme() {
    // The inline script in <head> already set data-theme before first paint.
    // Read back what was applied so we're in sync.
    const appliedTheme = document.documentElement.getAttribute('data-theme') || 'light';
    // Persist if it was set by the system preference fallback
    if (!localStorage.getItem('sparplannen-theme')) {
        localStorage.setItem('sparplannen-theme', appliedTheme);
    }

    // Theme display names (Swedish)
    const themeNames = {
        'light': 'Ljust läge',
        'dark': 'Mörkt läge',
        'high-contrast': 'Högkontrast'
    };

    const themeToggleBtn = document.getElementById('theme-toggle-btn');

    function updateButtonLabel(theme) {
        if (!themeToggleBtn) return;
        const themes = ['light', 'dark', 'high-contrast'];
        const nextIdx = (themes.indexOf(theme) + 1) % themes.length;
        const nextName = themeNames[themes[nextIdx]] || themes[nextIdx];
        themeToggleBtn.setAttribute('aria-label', `Byt tema – växla till ${nextName}`);
        themeToggleBtn.setAttribute('title', `Byt tema – växla till ${nextName}`);
    }

    if (themeToggleBtn) {
        // Set initial label
        updateButtonLabel(appliedTheme);

        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const themes = ['light', 'dark', 'high-contrast'];
            const currentIndex = themes.indexOf(currentTheme);
            const nextTheme = themes[(currentIndex + 1) % themes.length];

            // Enable transitions for the duration of the theme change only
            document.documentElement.classList.add('theme-transitioning');
            document.documentElement.setAttribute('data-theme', nextTheme);
            localStorage.setItem('sparplannen-theme', nextTheme);
            setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 300);

            updateButtonLabel(nextTheme);

            // Show user-friendly notification
            const themeName = themeNames[nextTheme] || nextTheme;
            if (window.showNotification) {
                window.showNotification(`Tema ändrat: ${themeName}`, 'success');
            }

            console.log(`Theme changed to: ${nextTheme} (${themeName})`);
        });
    }

    console.log(`Theme initialized: ${appliedTheme}`);
}


