/**
 * Delay Settings Component
 * Manages user preferences for delay visualization
 */

// Default delay settings
const DEFAULT_DELAY_SETTINGS = {
    mode: 'offset', // 'offset' | 'icon' | 'both'
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
    
    if (showWarningsToggle) {
        showWarningsToggle.checked = settings.showWarnings;
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
    
    if (showWarningsToggle) {
        showWarningsToggle.addEventListener('change', () => {
            settings.showWarnings = showWarningsToggle.checked;
            saveDelaySettings(settings);
            logger.info('DelaySettings', `Show warnings changed to: ${settings.showWarnings}`);
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

