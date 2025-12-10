/**
 * Delay Settings Component - Updated for new form components
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
 * Load delay settings from localStorage
 */
function loadDelaySettings() {
    try {
        const stored = localStorage.getItem('sparplanen-delay-settings');
        if (stored) {
            const parsed = JSON.parse(stored);
            const merged = { ...DEFAULT_DELAY_SETTINGS, ...parsed };
            console.log('✅ Delay settings loaded:', merged);
            return merged;
        }
    } catch (error) {
        console.error('❌ Error loading delay settings:', error);
    }
    
    return { ...DEFAULT_DELAY_SETTINGS };
}

/**
 * Save delay settings to localStorage
 */
function saveDelaySettings(settings) {
    try {
        localStorage.setItem('sparplanen-delay-settings', JSON.stringify(settings));
        console.log('✅ Delay settings saved:', settings);
        
        // Emit event for listeners
        window.dispatchEvent(new CustomEvent('delay-settings-changed', {
            detail: settings
        }));
        
        return true;
    } catch (error) {
        console.error('❌ Error saving delay settings:', error);
        return false;
    }
}

/**
 * Initialize delay settings UI with new components
 */
function initializeDelaySettingsUI() {
    console.log('📅 Initializing delay settings UI');
    
    const settings = loadDelaySettings();
    
    // Get UI elements
    const modeRadios = document.querySelectorAll('input[name="delay-mode"]');
    const turnaroundSlider = document.getElementById('delay-turnaround-time');
    const toleranceSlider = document.getElementById('delay-conflict-tolerance');
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
    }
    
    if (toleranceSlider) {
        toleranceSlider.value = settings.conflictTolerance;
    }
    
    if (showWarningsToggle) {
        if (settings.showWarnings) {
            showWarningsToggle.classList.add('checked');
            showWarningsToggle.setAttribute('aria-checked', 'true');
        }
    }
    
    // Add event listeners for radio buttons
    modeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            settings.mode = radio.value;
            saveDelaySettings(settings);
            console.log(`✅ Delay mode changed to: ${radio.value}`);
        });
    });
    
    // Add event listener for turnaround slider
    if (turnaroundSlider) {
        turnaroundSlider.addEventListener('change', () => {
            settings.turnaroundTime = parseInt(turnaroundSlider.value, 10);
            saveDelaySettings(settings);
            console.log(`✅ Turnaround time changed to: ${settings.turnaroundTime} min`);
        });
    }
    
    // Add event listener for tolerance slider
    if (toleranceSlider) {
        toleranceSlider.addEventListener('change', () => {
            settings.conflictTolerance = parseInt(toleranceSlider.value, 10);
            saveDelaySettings(settings);
            console.log(`✅ Conflict tolerance changed to: ${settings.conflictTolerance} min`);
        });
    }
    
    // Add event listener for custom select
    if (visualizationStyleSelect) {
        const selectContainer = visualizationStyleSelect.closest('.custom-select');
        if (selectContainer) {
            const options = selectContainer.querySelectorAll('.custom-select-option');
            options.forEach(option => {
                option.addEventListener('click', () => {
                    settings.visualizationStyle = option.getAttribute('data-value') || 'color-coded';
                    saveDelaySettings(settings);
                    console.log(`✅ Visualization style changed to: ${settings.visualizationStyle}`);
                });
            });
        }
    }
    
    // Add event listener for toggle
    if (showWarningsToggle) {
        showWarningsToggle.addEventListener('click', () => {
            setTimeout(() => {
                settings.showWarnings = showWarningsToggle.classList.contains('checked');
                saveDelaySettings(settings);
                console.log(`✅ Show warnings toggled to: ${settings.showWarnings}`);
            }, 100);
        });
    }
    
    console.log('✅ Delay settings UI initialized');
}

// Export functions
window.loadDelaySettings = loadDelaySettings;
window.saveDelaySettings = saveDelaySettings;
window.initializeDelaySettingsUI = initializeDelaySettingsUI;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initializeDelaySettingsUI, 200);
    });
} else {
    setTimeout(initializeDelaySettingsUI, 200);
}
