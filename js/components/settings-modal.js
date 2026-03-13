/* Settings Modal - Main modal controller */

(function() {
    'use strict';

    // Modal state
    let isOpen = false;
    let currentTab = 'time';

    // Predefined color themes for length-based coloring
    const lengthThemes = {
        custom: {
            name: 'Anpassad',
            colors: {
                b1: { bg: '#f0f4f8', border: '#7c8c9e', text: '#1a2332' },
                b2: { bg: '#e8eef5', border: '#6b7d91', text: '#1a2332' },
                b3: { bg: '#dfe7f0', border: '#5a6d7f', text: '#1a2332' },
                b4: { bg: '#d6e1eb', border: '#495e6d', text: '#1a2332' },
                b5: { bg: '#cddae6', border: '#384e5b', text: '#1a2332' }
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
        custom: {
            name: 'Anpassad',
            color: { bg: '#e8eef5', border: '#6b7d91', text: '#1a2332' }
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

    // Default settings (includes delay settings - single source of truth)
    const defaultSettings = {
        offsetPercentage: 20,
        followMode: false,
        updateInterval: '60',
        // Train coloring
        trainColorMode: 'length',
        trainColorDimension: 'base',
        canonicalLengths: [50, 75, 80, 107, 135],
        lengthTheme: 'modern',
        singleTheme: 'neutral',
        lenColors: {
            b1: { bg: '#f0f4f8', border: '#7c8c9e', text: '#1a2332' },
            b2: { bg: '#e8eef5', border: '#6b7d91', text: '#1a2332' },
            b3: { bg: '#dfe7f0', border: '#5a6d7f', text: '#1a2332' },
            b4: { bg: '#d6e1eb', border: '#495e6d', text: '#1a2332' },
            b5: { bg: '#cddae6', border: '#384e5b', text: '#1a2332' }
        },
        singleColor: { bg: '#e8eef5', border: '#6b7d91', text: '#1a2332' },
        // Delay settings (merged from settings-delay.js)
        delayMode: 'offset',
        delayVisualizationStyle: 'color-coded',
        turnaroundTime: 10,
        conflictTolerance: 5,
        showWarnings: true
    };

    let currentSettings = { ...defaultSettings };

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

    // Track mousedown origin for reliable backdrop-click-to-close
    let _backdropMousedownTarget = null;

    /**
     * Initialize the settings modal
     */
    function init() {
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

        loadSettings();
        setupEventListeners();
        setupRadioGroupHighlights();
        setupColorModeListener();
        initSettingsViz();

        console.log('✅ Settings modal initialized');
    }

    /**
     * Position the sliding highlight for all radio groups
     */
    function updateRadioGroupHighlight(group) {
        if (!group) return;
        const inputs = group.querySelectorAll('.radio-group-input');
        inputs.forEach((input, idx) => {
            if (input.checked) {
                group.style.setProperty('--highlight-index', idx);
            }
        });
    }

    function setupRadioGroupHighlights() {
        document.querySelectorAll('.radio-group').forEach(group => {
            updateRadioGroupHighlight(group);
            group.querySelectorAll('.radio-group-input').forEach(input => {
                input.addEventListener('change', () => updateRadioGroupHighlight(group));
            });
        });
    }

    /**
     * Set up event listeners for the color mode and theme selects
     */
    function setupColorModeListener() {
        // Color mode: listen on native radio change (no dependency on forms.js timing)
        document.querySelectorAll('input[name="train-color-mode"]').forEach(input => {
            input.addEventListener('change', () => {
                if (!input.checked) return;
                currentSettings.trainColorMode = input.value;
                const themeToUse = input.value === 'single' ? currentSettings.singleTheme : currentSettings.lengthTheme;
                updateVisibility(input.value, themeToUse || 'modern');
                updatePreview();
            });
        });

        // Length theme select
        const lengthThemeContainer = document.querySelector('#length-theme')?.closest('.custom-select');
        if (lengthThemeContainer) {
            lengthThemeContainer.addEventListener('change', (e) => {
                e.stopPropagation();
                applyLengthTheme(e.detail.value);
                updateVisibility('length', e.detail.value);
                updatePreview();
            });
        }

        // Single theme select
        const singleThemeContainer = document.querySelector('#single-theme')?.closest('.custom-select');
        if (singleThemeContainer) {
            singleThemeContainer.addEventListener('change', (e) => {
                e.stopPropagation();
                applySingleTheme(e.detail.value);
                updateVisibility('single', e.detail.value);
                updatePreview();
            });
        }

        // Color inputs: update preview and mark as custom
        document.querySelectorAll('#panel-display input[type="color"]').forEach(input => {
            input.addEventListener('input', () => {
                updatePreview();
                if (currentSettings.trainColorMode === 'single') {
                    currentSettings.singleTheme = 'custom';
                } else {
                    currentSettings.lengthTheme = 'custom';
                }
            });
        });
    }

    /**
     * Set up all event listeners
     */
    function setupEventListeners() {
        if (elements.closeBtn) {
            elements.closeBtn.addEventListener('click', closeModal);
        }

        // Scroll-safe backdrop close: only fire if BOTH mousedown and mouseup were on backdrop
        if (elements.backdrop) {
            elements.backdrop.addEventListener('mousedown', (e) => {
                _backdropMousedownTarget = e.target;
            });
            elements.backdrop.addEventListener('mouseup', (e) => {
                if (
                    _backdropMousedownTarget === elements.backdrop &&
                    e.target === elements.backdrop
                ) {
                    closeModal();
                }
                _backdropMousedownTarget = null;
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isOpen) {
                closeModal();
            }
        });

        elements.tabs.forEach((tab) => {
            tab.addEventListener('click', () => {
                switchTab(tab.getAttribute('data-tab'));
            });
        });

        if (elements.resetBtn) {
            elements.resetBtn.addEventListener('click', resetSettings);
        }

        if (elements.cancelBtn) {
            elements.cancelBtn.addEventListener('click', closeModal);
        }

        if (elements.saveBtn) {
            elements.saveBtn.addEventListener('click', saveSettings);
        }

        // Settings button in header
        const settingsBtn = document.querySelector('.settings-button');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openModal();
            });
        } else {
            setTimeout(() => {
                const retryBtn = document.querySelector('.settings-button');
                if (retryBtn) {
                    retryBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openModal();
                    });
                }
            }, 500);
        }

        // Advanced toggle
        const showAdvancedBtn = document.getElementById('show-advanced-btn');
        const advancedSection = document.getElementById('advanced-train-colors');
        if (showAdvancedBtn && advancedSection) {
            let advancedVisible = false;
            showAdvancedBtn.addEventListener('click', () => {
                advancedVisible = !advancedVisible;
                advancedSection.style.display = advancedVisible ? 'block' : 'none';
                showAdvancedBtn.textContent = advancedVisible ? 'Dölj anpassning' : 'Anpassa färger manuellt';
            });
        }
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
        void elements.backdrop.offsetHeight; // force reflow for animation

        updateControlsFromSettings();
        updatePreview();

        const colorMode = currentSettings.trainColorMode || 'length';
        const theme = colorMode === 'single' ? currentSettings.singleTheme : currentSettings.lengthTheme;
        updateVisibility(colorMode, theme || 'modern');

        // Re-sync radio group highlights after setting values
        document.querySelectorAll('.radio-group').forEach(updateRadioGroupHighlight);

        trapFocus();
    }

    /**
     * Close the settings modal
     */
    function closeModal() {
        if (!elements.backdrop || !elements.modal) return;

        elements.backdrop.classList.add('closing');
        setTimeout(() => {
            elements.backdrop.classList.add('hidden');
            elements.backdrop.classList.remove('closing');
            isOpen = false;
        }, 200);
    }

    /**
     * Switch between tabs
     */
    function switchTab(tabName) {
        currentTab = tabName;
        elements.tabs.forEach((tab) => {
            const isActive = tab.getAttribute('data-tab') === tabName;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', String(isActive));
        });
        elements.tabPanels.forEach((panel) => {
            const isActive = panel.getAttribute('data-tab-panel') === tabName;
            panel.classList.toggle('active', isActive);
            if (isActive) {
                panel.removeAttribute('hidden');
            } else {
                panel.setAttribute('hidden', 'true');
            }
        });
    }

    /**
     * Load settings from localStorage. Migrates old delay settings key if present.
     */
    function loadSettings() {
        try {
            const saved = localStorage.getItem('sparplannen-settings');
            if (saved) {
                currentSettings = { ...defaultSettings, ...JSON.parse(saved) };
            } else {
                currentSettings = { ...defaultSettings };
            }

            // Migrate old separate delay settings if they exist
            const oldDelay = localStorage.getItem('sparplanen-delay-settings');
            if (oldDelay) {
                try {
                    const parsed = JSON.parse(oldDelay);
                    currentSettings.delayMode = parsed.mode ?? currentSettings.delayMode;
                    currentSettings.delayVisualizationStyle = parsed.visualizationStyle ?? currentSettings.delayVisualizationStyle;
                    currentSettings.turnaroundTime = parsed.turnaroundTime ?? currentSettings.turnaroundTime;
                    currentSettings.conflictTolerance = parsed.conflictTolerance ?? currentSettings.conflictTolerance;
                    currentSettings.showWarnings = parsed.showWarnings ?? currentSettings.showWarnings;
                    localStorage.removeItem('sparplanen-delay-settings');
                } catch (_) { /* ignore malformed old data */ }
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            currentSettings = { ...defaultSettings };
        }
    }

    /**
     * Save current control values to localStorage
     */
    function saveSettings() {
        currentSettings = getSettingsFromControls();

        try {
            localStorage.setItem('sparplannen-settings', JSON.stringify(currentSettings));

            window.dispatchEvent(new CustomEvent('settingsChanged', {
                detail: currentSettings
            }));

            // Keep delay-settings-changed event for any existing listeners
            window.dispatchEvent(new CustomEvent('delay-settings-changed', {
                detail: {
                    mode: currentSettings.delayMode,
                    visualizationStyle: currentSettings.delayVisualizationStyle,
                    turnaroundTime: currentSettings.turnaroundTime,
                    conflictTolerance: currentSettings.conflictTolerance,
                    showWarnings: currentSettings.showWarnings
                }
            }));

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
        if (!theme) return;
        currentSettings.lengthTheme = themeId;
        currentSettings.lenColors = JSON.parse(JSON.stringify(theme.colors));
        updateControlsFromSettings();
        updatePreview();
    }

    /**
     * Apply a single-color theme
     */
    function applySingleTheme(themeId) {
        const theme = singleThemes[themeId];
        if (!theme) return;
        currentSettings.singleTheme = themeId;
        currentSettings.singleColor = JSON.parse(JSON.stringify(theme.color));
        updateControlsFromSettings();
        updatePreview();
    }

    /**
     * Reset settings to defaults with inline confirm
     */
    function resetSettings() {
        const btn = elements.resetBtn;
        if (!btn) return;

        if (btn.dataset.confirming === 'true') {
            // Confirmed — reset
            currentSettings = JSON.parse(JSON.stringify(defaultSettings));
            updateControlsFromSettings();
            updatePreview();
            updateVisibility(defaultSettings.trainColorMode, defaultSettings.lengthTheme);
            document.querySelectorAll('.radio-group').forEach(updateRadioGroupHighlight);
            saveSettings();
            btn.textContent = 'Återställ';
            btn.dataset.confirming = 'false';
        } else {
            // Ask for confirmation
            btn.textContent = 'Bekräfta återställning?';
            btn.dataset.confirming = 'true';
            // Auto-cancel after 4s if no response
            setTimeout(() => {
                if (btn.dataset.confirming === 'true') {
                    btn.textContent = 'Återställ';
                    btn.dataset.confirming = 'false';
                }
            }, 4000);
        }
    }

    /**
     * Read current values from all controls
     */
    function getSettingsFromControls() {
        const doc = document;
        const getVal = (id, fallback) => {
            const el = doc.getElementById(id);
            return el ? (el.type === 'checkbox' ? el.checked : el.value) : fallback;
        };
        const getRadio = (name, fallback) =>
            doc.querySelector(`input[name="${name}"]:checked`)?.value ?? fallback;

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
            offsetPercentage: parseInt(doc.getElementById('offset-slider')?.value ?? defaultSettings.offsetPercentage, 10),
            followMode: doc.getElementById('follow-mode')?.classList.contains('checked') ?? defaultSettings.followMode,
            updateInterval: getRadio('update-interval', defaultSettings.updateInterval),
            trainColorMode: getRadio('train-color-mode', defaultSettings.trainColorMode),
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
            singleColor: readColorTriple('single'),
            // Delay settings
            delayMode: getRadio('delay-mode', defaultSettings.delayMode),
            delayVisualizationStyle: getRadio('delay-style', defaultSettings.delayVisualizationStyle),
            turnaroundTime: parseInt(doc.getElementById('delay-turnaround-time')?.value ?? defaultSettings.turnaroundTime, 10),
            conflictTolerance: parseInt(doc.getElementById('delay-conflict-tolerance')?.value ?? defaultSettings.conflictTolerance, 10),
            showWarnings: doc.getElementById('delay-show-warnings')?.classList.contains('checked') ?? defaultSettings.showWarnings
        };
    }

    /**
     * Programmatically select an option in a custom-select
     */
    function setSelectOption(buttonId, value) {
        const button = document.getElementById(buttonId);
        if (!button) return;
        const select = button.closest('.custom-select');
        if (!select) return;
        const options = select.querySelectorAll('.custom-select-option');
        options.forEach(opt => {
            const isMatch = opt.getAttribute('data-value') === value;
            opt.classList.toggle('selected', isMatch);
            opt.setAttribute('aria-selected', isMatch ? 'true' : 'false');
            if (isMatch) {
                button.textContent = opt.textContent.trim();
                const chevron = document.createElement('div');
                chevron.className = 'custom-select-chevron';
                chevron.innerHTML = '▼';
                button.appendChild(chevron);
            }
        });
    }

    /**
     * Push current settings values into all controls
     */
    function updateControlsFromSettings() {
        // Offset slider
        const offsetSlider = document.getElementById('offset-slider');
        if (offsetSlider) {
            offsetSlider.value = currentSettings.offsetPercentage;
            offsetSlider.dispatchEvent(new Event('input'));
        }

        // Follow mode toggle
        const followToggle = document.getElementById('follow-mode');
        if (followToggle) {
            followToggle.classList.toggle('checked', !!currentSettings.followMode);
            followToggle.setAttribute('aria-checked', String(!!currentSettings.followMode));
        }

        // Update interval radio group
        const uiInput = document.querySelector(`input[name="update-interval"][value="${currentSettings.updateInterval}"]`);
        if (uiInput) uiInput.checked = true;

        // Train color mode radio group
        const cmInput = document.querySelector(`input[name="train-color-mode"][value="${currentSettings.trainColorMode}"]`);
        if (cmInput) cmInput.checked = true;

        // Length and single theme selects
        setSelectOption('length-theme', currentSettings.lengthTheme || defaultSettings.lengthTheme);
        setSelectOption('single-theme', currentSettings.singleTheme || defaultSettings.singleTheme);

        // Train color dimension select
        setSelectOption('train-color-dimension', currentSettings.trainColorDimension);

        // Canonical lengths
        const canon = currentSettings.canonicalLengths || defaultSettings.canonicalLengths;
        ['len-canon-1', 'len-canon-2', 'len-canon-3', 'len-canon-4', 'len-canon-5'].forEach((id, i) => {
            const el = document.getElementById(id);
            if (el) el.value = canon[i];
        });

        // Color picker helper
        const getColorHex = (stored, cssVar) => {
            if (stored && stored.startsWith('#')) return stored;
            const computed = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
            return rgbToHex(computed) || '#000000';
        };

        const writeColorTriple = (prefix, triple, cssVarPrefix) => {
            const bg = (triple && triple.bg) || getColorHex(null, `--${cssVarPrefix}-bg`);
            const border = (triple && triple.border) || getColorHex(null, `--${cssVarPrefix}-border`);
            const text = (triple && triple.text) || getColorHex(null, `--${cssVarPrefix}-text`);
            const setV = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
            setV(`${prefix}-bg`, bg);
            setV(`${prefix}-border`, border);
            setV(`${prefix}-text`, text);
        };

        writeColorTriple('len-b1', currentSettings.lenColors?.b1, 'len-b1');
        writeColorTriple('len-b2', currentSettings.lenColors?.b2, 'len-b2');
        writeColorTriple('len-b3', currentSettings.lenColors?.b3, 'len-b3');
        writeColorTriple('len-b4', currentSettings.lenColors?.b4, 'len-b4');
        writeColorTriple('len-b5', currentSettings.lenColors?.b5, 'len-b5');
        writeColorTriple('single', currentSettings.singleColor, 'train-single');

        // Delay settings
        const dmInput = document.querySelector(`input[name="delay-mode"][value="${currentSettings.delayMode}"]`);
        if (dmInput) dmInput.checked = true;

        const dsInput = document.querySelector(`input[name="delay-style"][value="${currentSettings.delayVisualizationStyle}"]`);
        if (dsInput) dsInput.checked = true;

        const turnaroundSlider = document.getElementById('delay-turnaround-time');
        if (turnaroundSlider) {
            turnaroundSlider.value = currentSettings.turnaroundTime;
            turnaroundSlider.dispatchEvent(new Event('input'));
        }

        const toleranceSlider = document.getElementById('delay-conflict-tolerance');
        if (toleranceSlider) {
            toleranceSlider.value = currentSettings.conflictTolerance;
            toleranceSlider.dispatchEvent(new Event('input'));
        }

        const warningsToggle = document.getElementById('delay-show-warnings');
        if (warningsToggle) {
            warningsToggle.classList.toggle('checked', !!currentSettings.showWarnings);
            warningsToggle.setAttribute('aria-checked', String(!!currentSettings.showWarnings));
        }
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

        if (firstFocusable) {
            setTimeout(() => firstFocusable.focus(), 100);
        }

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
     * Convert RGB/RGBA string to hex
     */
    function rgbToHex(rgb) {
        if (!rgb || rgb === 'transparent') return null;
        const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!match) {
            if (rgb.startsWith('#')) return rgb;
            return null;
        }
        return '#' + [match[1], match[2], match[3]].map(x => {
            const hex = parseInt(x).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    /**
     * Show/hide controls based on color mode and theme
     */
    function updateVisibility(colorMode, themeId) {
        const singleColorControls = document.getElementById('single-color-controls');
        const lengthThemeControls = document.getElementById('length-theme-controls');
        const advancedToggleWrapper = document.getElementById('advanced-toggle-wrapper');
        const advancedSection = document.getElementById('advanced-train-colors');
        const showAdvancedBtn = document.getElementById('show-advanced-btn');

        const isSingle = colorMode === 'single';
        if (singleColorControls) singleColorControls.style.display = isSingle ? 'block' : 'none';
        if (lengthThemeControls) lengthThemeControls.style.display = isSingle ? 'none' : 'block';

        const isCustom = themeId === 'custom';

        if (advancedToggleWrapper) {
            advancedToggleWrapper.style.display = (!isSingle && !isCustom) ? 'block' : 'none';
        }

        if (advancedSection) {
            if (isSingle) {
                advancedSection.style.display = 'none';
            } else if (isCustom) {
                advancedSection.style.display = 'block';
                if (showAdvancedBtn) showAdvancedBtn.textContent = 'Dölj anpassning';
            } else {
                advancedSection.style.display = 'none';
            }
        }
    }

    /**
     * Update color preview trains
     */
    function updatePreview() {
        const preview = document.getElementById('train-preview');
        if (!preview) return;

        const mode = document.querySelector('input[name="train-color-mode"]:checked')?.value || 'length';
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

    /**
     * Initialize reactive visualizations inside settings controls
     */
    function initSettingsViz() {
        // Viz 1 — Offset slider → now-line position
        const offsetSlider = document.getElementById('offset-slider');
        if (offsetSlider) {
            offsetSlider.addEventListener('input', () => {
                const pct = offsetSlider.value;
                const line = document.getElementById('viz-offset-line');
                const label = document.getElementById('viz-offset-label');
                if (line) line.style.left = pct + '%';
                if (label) label.textContent = pct + '%';
            });
        }

        // Viz 2 — Follow mode toggle
        const followToggle = document.getElementById('follow-mode');
        if (followToggle) {
            const updateFollowViz = () => {
                const isChecked = followToggle.classList.contains('checked');
                const viz = document.getElementById('viz-follow');
                const caption = document.getElementById('viz-follow-caption');
                if (viz) viz.dataset.follow = isChecked;
                if (caption) caption.textContent = isChecked
                    ? 'Auto — vyn följer nu-linjen automatiskt'
                    : 'Manuellt — nu-linjen kan glida ur bild';
            };
            // Observe class changes on the toggle
            const observer = new MutationObserver(updateFollowViz);
            observer.observe(followToggle, { attributes: true, attributeFilter: ['class'] });
            updateFollowViz();
        }

        // Viz 3 — Turnaround time slider
        const turnaroundSlider = document.getElementById('delay-turnaround-time');
        if (turnaroundSlider) {
            turnaroundSlider.addEventListener('input', () => {
                const val = parseInt(turnaroundSlider.value, 10);
                const pct = 12 + ((val - 5) / 25) * 32;
                const viz = document.getElementById('viz-turnaround');
                const timer = document.getElementById('viz-ta-timer');
                if (viz) viz.style.setProperty('--ta-zone-w', pct + '%');
                if (timer) timer.textContent = val + ' min';
            });
        }

        // Viz 4 — Conflict tolerance slider + show-warnings toggle
        const conflictSlider = document.getElementById('delay-conflict-tolerance');
        if (conflictSlider) {
            conflictSlider.addEventListener('input', () => {
                const val = parseInt(conflictSlider.value, 10);
                const pct = (val / 15) * 28;
                const viz = document.getElementById('viz-conflict');
                const timer = document.getElementById('viz-conflict-timer');
                if (viz) viz.style.setProperty('--conflict-zone-w', pct + '%');
                if (timer) timer.textContent = val + ' min';
            });
        }

        const warningsToggle = document.getElementById('delay-show-warnings');
        if (warningsToggle) {
            const updateWarningsViz = () => {
                const isChecked = warningsToggle.classList.contains('checked');
                const viz = document.getElementById('viz-conflict');
                const caption = document.getElementById('viz-conflict-caption');
                if (viz) viz.dataset.warnings = isChecked;
                if (caption) caption.textContent = isChecked
                    ? 'Tåg 3545 anländer för nära 3429'
                    : 'Varningar inaktiverade — inga zoner visas';
            };
            const observer = new MutationObserver(updateWarningsViz);
            observer.observe(warningsToggle, { attributes: true, attributeFilter: ['class'] });
            updateWarningsViz();
        }

        // Viz 5 — Delay mode radio
        document.querySelectorAll('input[name="delay-mode"]').forEach(input => {
            input.addEventListener('change', () => {
                if (!input.checked) return;
                const viz = document.getElementById('viz-delay-mode');
                if (viz) viz.dataset.mode = input.value;
            });
        });

        // Viz 6 — Delay style radio
        document.querySelectorAll('input[name="delay-style"]').forEach(input => {
            input.addEventListener('change', () => {
                if (!input.checked) return;
                const viz = document.getElementById('viz-delay-style');
                if (viz) viz.dataset.style = input.value;
            });
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Public API
    window.SettingsModal = {
        open: openModal,
        close: closeModal,
        getCurrentSettings: getCurrentSettings
    };

})();
