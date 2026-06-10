/**
 * settings-delay.js — bridge for DelayIntegration
 * Canonical storage lives in settings-modal.js under localStorage key sparplannen-settings.
 */

(function () {
    // Defaults must mirror defaultSettings in settings-modal.js (single source of truth).
    const DEFAULT_DELAY_SETTINGS = {
        mode: 'offset',
        colorThresholds: { minor: 3, moderate: 6, significant: 11, severe: 21 },
        colors: {
            minor: '#FFA500',
            moderate: '#FF8C00',
            significant: '#FF4500',
            severe: '#DC143C',
            early: '#22C55E'
        },
        showWarnings: false,
        visualizationStyle: 'color-coded',
        turnaroundTime: 10,
        conflictTolerance: 5,
        turnaroundEnabled: false,
        conflictToleranceEnabled: false
    };

    window.loadDelaySettings = function () {
        try {
            const raw = localStorage.getItem('sparplannen-settings');
            if (!raw) {
                return { ...DEFAULT_DELAY_SETTINGS };
            }
            const saved = JSON.parse(raw);
            const keep = (val, fallback) => (val === undefined || val === null) ? fallback : val;
            return {
                ...DEFAULT_DELAY_SETTINGS,
                mode: keep(saved.delayMode, DEFAULT_DELAY_SETTINGS.mode),
                visualizationStyle:
                    keep(saved.delayVisualizationStyle, DEFAULT_DELAY_SETTINGS.visualizationStyle),
                turnaroundTime: keep(saved.turnaroundTime, DEFAULT_DELAY_SETTINGS.turnaroundTime),
                conflictTolerance: keep(saved.conflictTolerance, DEFAULT_DELAY_SETTINGS.conflictTolerance),
                turnaroundEnabled: keep(saved.turnaroundEnabled, DEFAULT_DELAY_SETTINGS.turnaroundEnabled),
                conflictToleranceEnabled: keep(saved.conflictToleranceEnabled, DEFAULT_DELAY_SETTINGS.conflictToleranceEnabled),
                showWarnings:
                    saved.showWarnings !== undefined ? saved.showWarnings : DEFAULT_DELAY_SETTINGS.showWarnings
            };
        } catch (e) {
            return { ...DEFAULT_DELAY_SETTINGS };
        }
    };

    window.saveDelaySettings = function () {
        return false;
    };
    window.initializeDelaySettingsUI = function () {};
})();
