/**
 * Delay Settings Component
 * Manages user preferences for delay visualization
 */

// Default delay settings
const DEFAULT_DELAY_SETTINGS = {
    mode: 'offset', // 'offset' | 'icon' | 'both'
    visualizationStyle: 'color-coded', // 'color-coded' | 'transparent' | 'dashed'
    turnaroundTime: 10, // minutes
    conflictTolerance: 5, // minutes
    showWarnings: true,
    colorThresholds: {
        minor: 3,
        moderate: 6,
        significant: 11,
        severe: 21
    },
    colors: {
        minor: '#FFA500',
        moderate: '#FF8C00',
        significant: '#FF4500',
        severe: '#DC143C',
        early: '#22C55E'
    }
};

/**
 * Ensure toggle UI reflects checked state, supporting both legacy markup and SettingsControls helper
 */
function setToggleChecked(toggleElement, value) {
    if (!toggleElement) return;
    
    const checked = Boolean(value);

    if (window.SettingsControls && typeof window.SettingsControls.setToggleValue === 'function') {
        window.SettingsControls.setToggleValue(toggleElement.id, checked);
    } else {
        toggleElement.classList.toggle('checked', checked);
        toggleElement.classList.toggle('active', checked);
        toggleElement.setAttribute('aria-checked', checked ? 'true' : 'false');
    }
}

/**
 * Read toggle state, accounting for both SettingsControls helper and plain DOM usage
 */
function isToggleChecked(toggleElement) {
    if (!toggleElement) return false;

    if (window.SettingsControls && typeof window.SettingsControls.getToggleValue === 'function') {
        return Boolean(window.SettingsControls.getToggleValue(toggleElement.id));
    }

    if (toggleElement.classList.contains('checked')) return true;
    if (toggleElement.classList.contains('active')) return true;
    return toggleElement.getAttribute('aria-checked') === 'true';
}

/**
 * Load delay settings from localStorage
 */
function loadDelaySettings() {
    try {
        const stored = localStorage.getItem('sparplanen-delay-settings');
        if (stored) {
            const parsed = JSON.parse(stored);
            const merged = { ...DEFAULT_DELAY_SETTINGS, ...parsed };
            logger.info('DelaySettings', 'Loaded settings from localStorage', merged);
            return merged;
        }
    } catch (error) {
        logger.error('DelaySettings', 'Error loading settings', error);
    }
    
    logger.info('DelaySettings', 'Using default settings');
    return { ...DEFAULT_DELAY_SETTINGS };
}

/**
 * Save delay settings to localStorage
 */
function saveDelaySettings(settings) {
    try {
        localStorage.setItem('sparplanen-delay-settings', JSON.stringify(settings));
        logger.info('DelaySettings', 'Saved settings to localStorage', settings);
        
        // Emit event for listeners
        window.dispatchEvent(new CustomEvent('delay-settings-changed', {
            detail: settings
        }));
        
        return true;
    } catch (error) {
        logger.error('DelaySettings', 'Error saving settings', error);
        return false;
    }
}

/**
 * Reset delay settings to defaults
 */
function resetDelaySettings() {
    const defaults = { ...DEFAULT_DELAY_SETTINGS };
    saveDelaySettings(defaults);
    logger.info('DelaySettings', 'Reset settings to defaults');
    return defaults;
}

/**
 * Initialize delay settings UI
 */
function initializeDelaySettingsUI() {
    logger.info('DelaySettings', 'Initializing delay settings UI');
    
    const settings = loadDelaySettings();
    
    // Get UI elements
    const modeRadios = document.querySelectorAll('input[name="delay-mode"]');
    const turnaroundSlider = document.getElementById('delay-turnaround-time');
    const turnaroundValue = document.getElementById('delay-turnaround-value');
    const toleranceSlider = document.getElementById('delay-conflict-tolerance');
    const toleranceValue = document.getElementById('delay-tolerance-value');
    const visualizationStyleSelect = document.getElementById('delay-visualization-style');
    const showWarningsToggle = document.getElementById('delay-show-warnings');
    
    // Set initial values
    if (modeRadios.length > 0) {
        modeRadios.forEach(radio => {
            if (radio.value === settings.mode) {
                radio.checked = true;
            }
        });
    }
    
    if (turnaroundSlider) {
        turnaroundSlider.value = settings.turnaroundTime;
        if (turnaroundValue) turnaroundValue.textContent = `${settings.turnaroundTime} min`;
    }
    
    if (toleranceSlider) {
        toleranceSlider.value = settings.conflictTolerance;
        if (toleranceValue) toleranceValue.textContent = `${settings.conflictTolerance} min`;
    }
    
    if (visualizationStyleSelect) {
        visualizationStyleSelect.value = settings.visualizationStyle || 'color-coded';
    }
    
    if (showWarningsToggle) {
        setToggleChecked(showWarningsToggle, settings.showWarnings);
    }
    
    // Add event listeners
    modeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            settings.mode = radio.value;
            saveDelaySettings(settings);
            logger.info('DelaySettings', `Mode changed to: ${radio.value}`);
        });
    });
    
    if (turnaroundSlider) {
        turnaroundSlider.addEventListener('input', () => {
            settings.turnaroundTime = parseInt(turnaroundSlider.value, 10);
            if (turnaroundValue) turnaroundValue.textContent = `${settings.turnaroundTime} min`;
        });
        
        turnaroundSlider.addEventListener('change', () => {
            saveDelaySettings(settings);
            logger.info('DelaySettings', `Turnaround time changed to: ${settings.turnaroundTime}`);
        });
    }
    
    if (toleranceSlider) {
        toleranceSlider.addEventListener('input', () => {
            settings.conflictTolerance = parseInt(toleranceSlider.value, 10);
            if (toleranceValue) toleranceValue.textContent = `${settings.conflictTolerance} min`;
        });
        
        toleranceSlider.addEventListener('change', () => {
            saveDelaySettings(settings);
            logger.info('DelaySettings', `Conflict tolerance changed to: ${settings.conflictTolerance}`);
        });
    }
    
    if (visualizationStyleSelect) {
        visualizationStyleSelect.addEventListener('change', () => {
            settings.visualizationStyle = visualizationStyleSelect.value;
            saveDelaySettings(settings);
            logger.info('DelaySettings', `Visualization style changed to: ${settings.visualizationStyle}`);
        });
    }
    
    if (showWarningsToggle) {
        const applyShowWarningsSetting = (checked) => {
            settings.showWarnings = Boolean(checked);
            setToggleChecked(showWarningsToggle, settings.showWarnings);
            saveDelaySettings(settings);
            logger.info('DelaySettings', `Show warnings changed to: ${settings.showWarnings}`);
        };

        showWarningsToggle.addEventListener('click', () => {
            if (window.SettingsControls && typeof window.SettingsControls.getToggleValue === 'function') {
                // Allow SettingsControls to update the visual state first
                setTimeout(() => {
                    applyShowWarningsSetting(isToggleChecked(showWarningsToggle));
                }, 0);
            } else {
                // Fallback for environments without SettingsControls helper
                const nextState = !isToggleChecked(showWarningsToggle);
                applyShowWarningsSetting(nextState);
            }
        });

        window.addEventListener('delay-settings-changed', (event) => {
            const updatedSettings = event.detail;
            if (!updatedSettings || typeof updatedSettings.showWarnings === 'undefined') return;

            // Sync UI if external updates (e.g., reset) modify the setting
            setToggleChecked(showWarningsToggle, updatedSettings.showWarnings);
            settings.showWarnings = Boolean(updatedSettings.showWarnings);
        });
    }

    logger.info('DelaySettings', 'Delay settings UI initialized');
}

// Export functions
window.loadDelaySettings = loadDelaySettings;
window.saveDelaySettings = saveDelaySettings;
window.resetDelaySettings = resetDelaySettings;
window.initializeDelaySettingsUI = initializeDelaySettingsUI;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDelaySettingsUI);
} else {
    // DOM already loaded
    setTimeout(initializeDelaySettingsUI, 100);
}
