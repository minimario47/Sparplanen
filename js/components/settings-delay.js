/**
 * settings-delay.js — bridge for DelayIntegration
 * Canonical storage lives in settings-modal.js under localStorage key sparplannen-settings.
 */

(function () {
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
        showWarnings: true,
        visualizationStyle: 'color-coded',
        turnaroundTime: 10,
        conflictTolerance: 5
    };

    window.loadDelaySettings = function () {
        try {
            const raw = localStorage.getItem('sparplannen-settings');
            if (!raw) {
                return { ...DEFAULT_DELAY_SETTINGS };
            }
            const saved = JSON.parse(raw);
            return {
                ...DEFAULT_DELAY_SETTINGS,
                mode: saved.delayMode ?? DEFAULT_DELAY_SETTINGS.mode,
                visualizationStyle:
                    saved.delayVisualizationStyle ?? DEFAULT_DELAY_SETTINGS.visualizationStyle,
                turnaroundTime: saved.turnaroundTime ?? DEFAULT_DELAY_SETTINGS.turnaroundTime,
                conflictTolerance: saved.conflictTolerance ?? DEFAULT_DELAY_SETTINGS.conflictTolerance,
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
