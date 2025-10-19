/* Theme management */

function initTheme() {
    const savedTheme = localStorage.getItem('sparplannen-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Theme display names
    const themeNames = {
        'light': 'Ljust läge',
        'dark': 'Mörkt läge',
        'high-contrast': 'Simon läge 💀'
    };
    
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const themes = ['light', 'dark', 'high-contrast'];
            const currentIndex = themes.indexOf(currentTheme);
            const nextTheme = themes[(currentIndex + 1) % themes.length];
            
            document.documentElement.setAttribute('data-theme', nextTheme);
            localStorage.setItem('sparplannen-theme', nextTheme);
            
            // Show user-friendly notification
            const themeName = themeNames[nextTheme] || nextTheme;
            if (window.showNotification) {
                window.showNotification(`Tema ändrat: ${themeName}`, 'success');
            }
            
            console.log(`🌓 Theme changed to: ${nextTheme} (${themeName})`);
        });
    }
    
    console.log(`🎨 Theme initialized: ${savedTheme}`);
}


