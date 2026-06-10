/**
 * Theme Switcher - 3-position rotating dial with PNG icons
 * Cycles between: light → dark → high-contrast
 */

class ThemeSwitcher {
    constructor() {
        this.themes = ['light', 'dark', 'high-contrast'];
        this.tooltips = {
            'light': 'Ljust läge',
            'dark': 'Mörkt läge',
            'high-contrast': 'Simon läge'
        };
        this.currentThemeIndex = 0;
        this.container = null;
        this.init();
    }

    init() {
        // Load saved theme or default to light
        const savedTheme = localStorage.getItem('sparplannen-theme') || 'light';
        this.currentThemeIndex = this.themes.indexOf(savedTheme);
        if (this.currentThemeIndex === -1) this.currentThemeIndex = 0;

        // Apply theme immediately
        this.applyTheme(this.themes[this.currentThemeIndex]);

        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.render());
        } else {
            this.render();
        }
    }

    render() {
        // Find the theme toggle button in header
        const oldButton = document.getElementById('theme-toggle-btn');
        if (!oldButton) {
            console.error('Theme toggle button not found');
            return;
        }

        // Create theme switcher component
        this.container = document.createElement('div');
        this.container.className = 'theme-switcher';
        this.container.setAttribute('data-theme', this.themes[this.currentThemeIndex]);
        this.container.setAttribute('data-tooltip', this.tooltips[this.themes[this.currentThemeIndex]]);

        // Build HTML structure with PNG icons
        this.container.innerHTML = `
            <input type="checkbox" class="theme-switcher-input" id="theme-switcher-input" aria-label="Byt tema">
            <label for="theme-switcher-input" class="theme-dial" role="button" tabindex="0">
                <div class="theme-indicator">
                    <div class="theme-icons">
                        <img src="assets/Icons/sun.png" alt="Sun" class="theme-icon theme-icon-sun">
                        <img src="assets/Icons/moon.png" alt="Moon" class="theme-icon theme-icon-moon">
                        <img src="assets/Icons/deadface.png" alt="Skull" class="theme-icon theme-icon-skull">
                    </div>
                </div>
            </label>
        `;

        // Replace old button
        oldButton.replaceWith(this.container);

        // Add event listeners
        this.attachListeners();

        console.log('✅ Theme switcher initialized');
    }

    attachListeners() {
        const input = this.container.querySelector('.theme-switcher-input');
        const label = this.container.querySelector('.theme-dial');

        // Click handler
        label.addEventListener('click', (e) => {
            e.preventDefault();
            this.cycleTheme();
        });

        // Keyboard support
        label.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.cycleTheme();
            }
        });

        // Touch support
        label.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.cycleTheme();
        });
    }

    cycleTheme() {
        // Move to next theme
        this.currentThemeIndex = (this.currentThemeIndex + 1) % this.themes.length;
        const newTheme = this.themes[this.currentThemeIndex];

        // Update visual state
        this.container.setAttribute('data-theme', newTheme);
        this.container.setAttribute('data-tooltip', this.tooltips[newTheme]);

        // Apply theme
        this.applyTheme(newTheme);

        // Save preference
        localStorage.setItem('sparplannen-theme', newTheme);

        console.log(`🎨 Theme switched to: ${newTheme}`);
    }

    applyTheme(theme) {
        // Animate the switch only when the board is small enough that a 300ms
        // transition is cheaper than it looks — on dense schedules (or weak
        // Citrix machines) an instant switch beats animating thousands of nodes.
        const root = document.documentElement;
        const trainCount = document.querySelectorAll('.train-bar').length;
        const animate = trainCount > 0 && trainCount <= 300;

        if (animate) {
            root.classList.add('theme-transitioning');
            clearTimeout(this._transitionTimer);
            this._transitionTimer = setTimeout(
                () => root.classList.remove('theme-transitioning'), 300
            );
        }

        root.setAttribute('data-theme', theme);

        // Dispatch event for other components
        window.dispatchEvent(new CustomEvent('themeChanged', {
            detail: { theme }
        }));
    }

    getCurrentTheme() {
        return this.themes[this.currentThemeIndex];
    }
}

// Initialize theme switcher
window.themeSwitcher = new ThemeSwitcher();

// Export for global access
window.ThemeSwitcher = ThemeSwitcher;
