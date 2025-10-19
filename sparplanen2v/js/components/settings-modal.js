/* Settings Modal - Main modal controller */

(function() {
    'use strict';

    // Modal state
    let isOpen = false;
    let currentTab = 'time';

    // Predefined color themes for length-based coloring
    const lengthThemes = {
        standard: {
            name: 'Standard (tema-anpassad)',
            colors: {
                b1: { bg: '', border: '', text: '' },
                b2: { bg: '', border: '', text: '' },
                b3: { bg: '', border: '', text: '' },
                b4: { bg: '', border: '', text: '' },
                b5: { bg: '', border: '', text: '' }
            }
        },
        modern: {
            name: 'Modern (ljust grå)',
            colors: {
                b1: { bg: '#f0f4f8', border: '#7c8c9e', text: '#1a2332' },
                b2: { bg: '#e8eef5', border: '#6b7d91', text: '#1a2332' },
                b3: { bg: '#dfe7f0', border: '#5a6d7f', text: '#1a2332' },
                b4: { bg: '#d6e1eb', border: '#495e6d', text: '#1a2332' },
                b5: { bg: '#cddae6', border: '#384e5b', text: '#1a2332' }
            }
        },
        highvis: {
            name: 'Högsynlighet',
            colors: {
                b1: { bg: '#fff3cd', border: '#ff8c00', text: '#000000' },
                b2: { bg: '#d4edda', border: '#28a745', text: '#000000' },
                b3: { bg: '#d1ecf1', border: '#17a2b8', text: '#000000' },
                b4: { bg: '#f8d7da', border: '#dc3545', text: '#000000' },
                b5: { bg: '#e7d4f5', border: '#6f42c1', text: '#000000' }
            }
        },
        dark: {
            name: 'Mörka färger',
            colors: {
                b1: { bg: '#1a2332', border: '#4a90e2', text: '#ffffff' },
                b2: { bg: '#1e2a3a', border: '#50c878', text: '#ffffff' },
                b3: { bg: '#1a2e2e', border: '#20b2aa', text: '#ffffff' },
                b4: { bg: '#2e1a2e', border: '#ba55d3', text: '#ffffff' },
                b5: { bg: '#3a1a1a', border: '#ff6b6b', text: '#ffffff' }
            }
        },
        simon: {
            name: 'Simon-läge 🎨',
            colors: {
                b1: { bg: '#ff00ff', border: '#00ff00', text: '#ffff00' },
                b2: { bg: '#00ffff', border: '#ff0000', text: '#0000ff' },
                b3: { bg: '#ffff00', border: '#ff00ff', text: '#00ffff' },
                b4: { bg: '#ff0000', border: '#00ff00', text: '#ffffff' },
                b5: { bg: '#00ff00', border: '#0000ff', text: '#ff00ff' }
            }
        }
    };

    // Predefined color themes for single-color mode
    const singleThemes = {
        standard: {
            name: 'Standard (tema-anpassad)',
            color: { bg: '', border: '', text: '' }
        },
        neutral: {
            name: 'Neutral grå',
            color: { bg: '#e8eef5', border: '#6b7d91', text: '#1a2332' }
        },
        blue: {
            name: 'Klassiskt blå',
            color: { bg: '#cfe2ff', border: '#0d6efd', text: '#052c65' }
        },
        green: {
            name: 'Trafikgrön',
            color: { bg: '#d1e7dd', border: '#28a745', text: '#0f5132' }
        },
        amber: {
            name: 'Varningsgul',
            color: { bg: '#fff3cd', border: '#ffc107', text: '#664d03' }
        },
        simon: {
            name: 'Simon-läge 🎨',
            color: { bg: '#ff00ff', border: '#00ff00', text: '#ffff00' }
        }
    };

    // Default settings
    const defaultSettings = {
        offsetPercentage: 20,
        followMode: false,
        updateInterval: '60',
        // Train coloring settings
        trainColorMode: 'length',       // 'length' | 'single'
        trainColorDimension: 'base',    // 'base' | 'total'
        canonicalLengths: [50, 75, 80, 107, 135],
        lengthTheme: 'standard',
        singleTheme: 'standard',
        lenColors: {
            b1: { bg: '', border: '', text: '' },
            b2: { bg: '', border: '', text: '' },
            b3: { bg: '', border: '', text: '' },
            b4: { bg: '', border: '', text: '' },
            b5: { bg: '', border: '', text: '' }
        },
        singleColor: { bg: '', border: '', text: '' }
    };

    // Current settings (loaded from localStorage or defaults)
    let currentSettings = { ...defaultSettings };

    // DOM elements (will be initialized on DOMContentLoaded)
    let elements = {
        backdrop: null,
        modal: null,
        closeBtn: null,
        tabs: [],
        tabPanels: [],
        resetBtn: null,
        cancelBtn: null,
        saveBtn: null
    };

    /**
     * Initialize the settings modal
     */
    function init() {
        // Get DOM elements
        elements.backdrop = document.getElementById('settings-backdrop');
        elements.modal = document.getElementById('settings-modal');
        elements.closeBtn = document.getElementById('settings-close-btn');
        elements.tabs = Array.from(document.querySelectorAll('.settings-tab'));
        elements.tabPanels = Array.from(document.querySelectorAll('.settings-tab-panel'));
        elements.resetBtn = document.getElementById('settings-reset-btn');
        elements.cancelBtn = document.getElementById('settings-cancel-btn');
        elements.saveBtn = document.getElementById('settings-save-btn');

        if (!elements.backdrop || !elements.modal) {
            console.warn('Settings modal elements not found');
            return;
        }

        // Load saved settings
        loadSettings();

        // Set up event listeners
        setupEventListeners();

        console.log('✅ Settings modal initialized');
    }

    /**
     * Set up all event listeners
     */
    function setupEventListeners() {
        // Close button
        if (elements.closeBtn) {
            elements.closeBtn.addEventListener('click', closeModal);
        }

        // Backdrop click (close modal)
        if (elements.backdrop) {
            elements.backdrop.addEventListener('click', (e) => {
                if (e.target === elements.backdrop) {
                    closeModal();
                }
            });
        }

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isOpen) {
                closeModal();
            }
        });

        // Tab switching
        elements.tabs.forEach((tab) => {
            tab.addEventListener('click', () => {
                const tabName = tab.getAttribute('data-tab');
                switchTab(tabName);
            });
        });

        // Footer buttons
        if (elements.resetBtn) {
            elements.resetBtn.addEventListener('click', resetSettings);
        }

        if (elements.cancelBtn) {
            elements.cancelBtn.addEventListener('click', closeModal);
        }

        if (elements.saveBtn) {
            elements.saveBtn.addEventListener('click', saveSettings);
        }

        // Listen for settings button click in header
        const settingsBtn = document.querySelector('.settings-button');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', openModal);
        } else {
            console.warn('Settings button not found in DOM');
        }

        // Advanced toggle button
        const showAdvancedBtn = document.getElementById('show-advanced-btn');
        const advancedSection = document.getElementById('advanced-train-colors');
        if (showAdvancedBtn && advancedSection) {
            let advancedVisible = false;
            showAdvancedBtn.addEventListener('click', () => {
                advancedVisible = !advancedVisible;
                advancedSection.style.display = advancedVisible ? 'block' : 'none';
                showAdvancedBtn.textContent = advancedVisible ? 'Dölj avancerat' : 'Visa avancerat';
            });
        }

        // Color mode change (show/hide single color controls and theme selectors)
        const colorModeSelect = document.getElementById('train-color-mode');
        const singleColorControls = document.getElementById('single-color-controls');
        const lengthThemeControls = document.getElementById('length-theme-controls');
        if (colorModeSelect) {
            colorModeSelect.addEventListener('change', () => {
                const isSingle = colorModeSelect.value === 'single';
                if (singleColorControls) singleColorControls.style.display = isSingle ? 'block' : 'none';
                if (lengthThemeControls) lengthThemeControls.style.display = isSingle ? 'none' : 'block';
                updatePreview();
            });
        }

        // Theme selector change handlers
        const lengthThemeSelect = document.getElementById('length-theme');
        if (lengthThemeSelect) {
            lengthThemeSelect.addEventListener('change', () => {
                applyLengthTheme(lengthThemeSelect.value);
            });
        }

        const singleThemeSelect = document.getElementById('single-theme');
        if (singleThemeSelect) {
            singleThemeSelect.addEventListener('change', () => {
                applySingleTheme(singleThemeSelect.value);
            });
        }

        // Update preview on any color input change
        document.querySelectorAll('#panel-display input[type="color"]').forEach(input => {
            input.addEventListener('input', updatePreview);
        });
    }

    /**
     * Open the settings modal
     */
    function openModal() {
        if (!elements.backdrop || !elements.modal) {
            console.error('Modal elements not found');
            return;
        }

        isOpen = true;
        elements.backdrop.classList.remove('hidden', 'closing');
        
        // Load current settings into controls
        updateControlsFromSettings();

        // Update preview and visibility
        updatePreview();
        
        // Show/hide controls based on mode
        const colorMode = document.getElementById('train-color-mode')?.value;
        const isSingle = colorMode === 'single';
        const singleControls = document.getElementById('single-color-controls');
        const lengthControls = document.getElementById('length-theme-controls');
        if (singleControls) singleControls.style.display = isSingle ? 'block' : 'none';
        if (lengthControls) lengthControls.style.display = isSingle ? 'none' : 'block';

        // Focus management
        trapFocus();
    }

    /**
     * Close the settings modal
     */
    function closeModal() {
        if (!elements.backdrop || !elements.modal) return;

        // Add closing animation
        elements.backdrop.classList.add('closing');

        // Wait for animation to finish before hiding
        setTimeout(() => {
            elements.backdrop.classList.add('hidden');
            elements.backdrop.classList.remove('closing');
            isOpen = false;
        }, 200); // Match animation duration

        console.log('Settings modal closed');
    }

    /**
     * Switch between tabs
     */
    function switchTab(tabName) {
        currentTab = tabName;

        // Update tab buttons
        elements.tabs.forEach((tab) => {
            if (tab.getAttribute('data-tab') === tabName) {
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
            } else {
                tab.classList.remove('active');
                tab.setAttribute('aria-selected', 'false');
            }
        });

        // Update tab panels
        elements.tabPanels.forEach((panel) => {
            if (panel.getAttribute('data-tab-panel') === tabName) {
                panel.classList.add('active');
                panel.removeAttribute('hidden');
            } else {
                panel.classList.remove('active');
                panel.setAttribute('hidden', 'true');
            }
        });

        console.log(`Switched to tab: ${tabName}`);
    }

    /**
     * Load settings from localStorage
     */
    function loadSettings() {
        try {
            const saved = localStorage.getItem('sparplannen-settings');
            if (saved) {
                currentSettings = { ...defaultSettings, ...JSON.parse(saved) };
                console.log('✅ Settings loaded from localStorage', currentSettings);
            } else {
                currentSettings = { ...defaultSettings };
                console.log('Using default settings');
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            currentSettings = { ...defaultSettings };
        }
    }

    /**
     * Save settings to localStorage
     */
    function saveSettings() {
        // Get current values from controls
        currentSettings = getSettingsFromControls();

        try {
            localStorage.setItem('sparplannen-settings', JSON.stringify(currentSettings));
            console.log('✅ Settings saved', currentSettings);

            // Dispatch event for other components to react to
            window.dispatchEvent(new CustomEvent('settingsChanged', {
                detail: currentSettings
            }));

            // Show success notification (if notification system exists)
            if (window.showNotification) {
                window.showNotification('Inställningar sparade', 'success');
            }

            closeModal();
        } catch (error) {
            console.error('Error saving settings:', error);
            if (window.showNotification) {
                window.showNotification('Kunde inte spara inställningar', 'error');
            }
        }
    }

    /**
     * Apply a length theme
     */
    function applyLengthTheme(themeId) {
        const theme = lengthThemes[themeId];
        if (!theme) {
            console.error('Unknown length theme:', themeId);
            return;
        }
        
        currentSettings.lengthTheme = themeId;
        currentSettings.lenColors = JSON.parse(JSON.stringify(theme.colors));
        updateControlsFromSettings();
        updatePreview();
        console.log('🎨 Applied length theme:', theme.name);
    }

    /**
     * Apply a single-color theme
     */
    function applySingleTheme(themeId) {
        const theme = singleThemes[themeId];
        if (!theme) {
            console.error('Unknown single theme:', themeId);
            return;
        }
        
        currentSettings.singleTheme = themeId;
        currentSettings.singleColor = JSON.parse(JSON.stringify(theme.color));
        updateControlsFromSettings();
        updatePreview();
        console.log('🎨 Applied single theme:', theme.name);
    }

    /**
     * Reset settings to defaults
     */
    function resetSettings() {
        if (confirm('Är du säker på att du vill återställa alla inställningar till standardvärden?')) {
            currentSettings = JSON.parse(JSON.stringify(defaultSettings));
            
            // Reset colors to empty (theme defaults)
            currentSettings.lenColors = {
                b1: { bg: '', border: '', text: '' },
                b2: { bg: '', border: '', text: '' },
                b3: { bg: '', border: '', text: '' },
                b4: { bg: '', border: '', text: '' },
                b5: { bg: '', border: '', text: '' }
            };
            currentSettings.singleColor = { bg: '', border: '', text: '' };
            
            updateControlsFromSettings();
            updatePreview();
            
            // Apply to UI immediately
            if (window.SettingsControls) {
                window.SettingsControls.setSliderValue(defaultSettings.offsetPercentage);
                window.SettingsControls.setToggleValue('follow-mode', defaultSettings.followMode);
                window.SettingsControls.setSelectValue('update-interval', defaultSettings.updateInterval);
            }
            
            console.log('⚙️ Settings reset to defaults');
        }
    }

    /**
     * Get current settings from controls
     */
    function getSettingsFromControls() {
        // Read display panel controls if present
        const doc = document;
        const getVal = (id, fallback) => {
            const el = doc.getElementById(id);
            return el ? (el.type === 'checkbox' ? el.checked : el.value) : fallback;
        };

        const readColorTriple = (prefix) => ({
            bg: getVal(`${prefix}-bg`, ''),
            border: getVal(`${prefix}-border`, ''),
            text: getVal(`${prefix}-text`, '')
        });

        const canonical = [
            Number(getVal('len-canon-1', 50)),
            Number(getVal('len-canon-2', 75)),
            Number(getVal('len-canon-3', 80)),
            Number(getVal('len-canon-4', 107)),
            Number(getVal('len-canon-5', 135))
        ];

        return {
            offsetPercentage: window.SettingsControls ? window.SettingsControls.getSliderValue() : defaultSettings.offsetPercentage,
            followMode: window.SettingsControls ? window.SettingsControls.getToggleValue('follow-mode') : defaultSettings.followMode,
            updateInterval: window.SettingsControls ? window.SettingsControls.getSelectValue('update-interval') : defaultSettings.updateInterval,
            trainColorMode: getVal('train-color-mode', defaultSettings.trainColorMode),
            trainColorDimension: getVal('train-color-dimension', defaultSettings.trainColorDimension),
            canonicalLengths: canonical,
            lengthTheme: getVal('length-theme', defaultSettings.lengthTheme),
            singleTheme: getVal('single-theme', defaultSettings.singleTheme),
            lenColors: {
                b1: readColorTriple('len-b1'),
                b2: readColorTriple('len-b2'),
                b3: readColorTriple('len-b3'),
                b4: readColorTriple('len-b4'),
                b5: readColorTriple('len-b5')
            },
            singleColor: readColorTriple('single')
        };
    }

    /**
     * Update controls to reflect current settings
     */
    function updateControlsFromSettings() {
        if (window.SettingsControls) {
            window.SettingsControls.setSliderValue(currentSettings.offsetPercentage);
            window.SettingsControls.setToggleValue('follow-mode', currentSettings.followMode);
            window.SettingsControls.setSelectValue('update-interval', currentSettings.updateInterval);
        }
        // Push values into display tab controls if present
        const doc = document;
        const setVal = (id, value) => { const el = doc.getElementById(id); if (el) { if (el.type === 'checkbox') el.checked = !!value; else el.value = value; } };
        setVal('train-color-mode', currentSettings.trainColorMode);
        setVal('train-color-dimension', currentSettings.trainColorDimension);
        setVal('length-theme', currentSettings.lengthTheme || defaultSettings.lengthTheme);
        setVal('single-theme', currentSettings.singleTheme || defaultSettings.singleTheme);
        const canon = currentSettings.canonicalLengths || defaultSettings.canonicalLengths;
        setVal('len-canon-1', canon[0]);
        setVal('len-canon-2', canon[1]);
        setVal('len-canon-3', canon[2]);
        setVal('len-canon-4', canon[3]);
        setVal('len-canon-5', canon[4]);
        
        // Helper: convert stored color OR fetch computed CSS variable as hex
        const getColorHex = (stored, cssVar) => {
            if (stored && stored.startsWith('#')) return stored;
            // Compute from CSS variable
            const computed = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
            return rgbToHex(computed) || '#000000';
        };
        
        const writeColorTriple = (prefix, triple, cssVarPrefix) => {
            const bg = (triple && triple.bg) || getColorHex(null, `--${cssVarPrefix}-bg`);
            const border = (triple && triple.border) || getColorHex(null, `--${cssVarPrefix}-border`);
            const text = (triple && triple.text) || getColorHex(null, `--${cssVarPrefix}-text`);
            setVal(`${prefix}-bg`, bg);
            setVal(`${prefix}-border`, border);
            setVal(`${prefix}-text`, text);
        };
        
        writeColorTriple('len-b1', currentSettings.lenColors && currentSettings.lenColors.b1, 'len-b1');
        writeColorTriple('len-b2', currentSettings.lenColors && currentSettings.lenColors.b2, 'len-b2');
        writeColorTriple('len-b3', currentSettings.lenColors && currentSettings.lenColors.b3, 'len-b3');
        writeColorTriple('len-b4', currentSettings.lenColors && currentSettings.lenColors.b4, 'len-b4');
        writeColorTriple('len-b5', currentSettings.lenColors && currentSettings.lenColors.b5, 'len-b5');
        writeColorTriple('single', currentSettings.singleColor, 'train-single');
    }

    /**
     * Trap focus within modal for accessibility
     */
    function trapFocus() {
        if (!elements.modal) return;

        const focusableElements = elements.modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];

        // Focus first element
        if (firstFocusable) {
            setTimeout(() => firstFocusable.focus(), 100);
        }

        // Tab trap
        elements.modal.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                if (document.activeElement === firstFocusable) {
                    e.preventDefault();
                    lastFocusable.focus();
                }
            } else {
                if (document.activeElement === lastFocusable) {
                    e.preventDefault();
                    firstFocusable.focus();
                }
            }
        });
    }

    /**
     * Get current settings (for external use)
     */
    function getCurrentSettings() {
        return { ...currentSettings };
    }

    /**
     * Convert RGB/RGBA string to hex (for color inputs)
     */
    function rgbToHex(rgb) {
        if (!rgb || rgb === 'transparent') return null;
        // Match rgb(r, g, b) or rgba(r, g, b, a)
        const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!match) {
            // Already hex or named color
            if (rgb.startsWith('#')) return rgb;
            return null;
        }
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        return '#' + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    /**
     * Update preview trains in display tab
     */
    function updatePreview() {
        const preview = document.getElementById('train-preview');
        if (!preview) return;

        const mode = document.getElementById('train-color-mode')?.value || 'length';
        const trains = preview.querySelectorAll('.preview-train');

        trains.forEach((train, idx) => {
            const bucket = `b${idx + 1}`;
            let bg, border, text;

            if (mode === 'single') {
                bg = document.getElementById('single-bg')?.value || getComputedStyle(document.documentElement).getPropertyValue('--train-single-bg');
                border = document.getElementById('single-border')?.value || getComputedStyle(document.documentElement).getPropertyValue('--train-single-border');
                text = document.getElementById('single-text')?.value || getComputedStyle(document.documentElement).getPropertyValue('--train-single-text');
            } else {
                bg = document.getElementById(`len-${bucket}-bg`)?.value || getComputedStyle(document.documentElement).getPropertyValue(`--len-${bucket}-bg`);
                border = document.getElementById(`len-${bucket}-border`)?.value || getComputedStyle(document.documentElement).getPropertyValue(`--len-${bucket}-border`);
                text = document.getElementById(`len-${bucket}-text`)?.value || getComputedStyle(document.documentElement).getPropertyValue(`--len-${bucket}-text`);
            }

            train.style.backgroundColor = bg;
            train.style.borderColor = border;
            train.style.color = text;
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose API
    window.SettingsModal = {
        open: openModal,
        close: closeModal,
        getCurrentSettings: getCurrentSettings
    };


})();

