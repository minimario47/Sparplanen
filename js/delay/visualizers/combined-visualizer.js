/**
 * Combined Visualizer - Uses both Offset and Icon modes simultaneously
 * Shows delay extent (offset) and precise delay value (icon) together
 */

class CombinedVisualizer {
    constructor(settings = {}) {
        this.settings = settings;
        this.offsetVisualizer = new OffsetVisualizer(settings);
        this.iconVisualizer = new IconVisualizer(settings);
        
        logger.info('Visualizer', 'CombinedVisualizer initialized');
    }
    
    /**
     * Update settings for both visualizers
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.offsetVisualizer.updateSettings(newSettings);
        this.iconVisualizer.updateSettings(newSettings);
        logger.info('Visualizer', 'CombinedVisualizer settings updated');
    }
    
    /**
     * Apply both visualizations to train bar
     */
    apply(trainBar, train, delayInfo, conflicts = null) {
        if (!trainBar || !train || !delayInfo) return;
        
        // Add mode class for CSS adjustments
        trainBar.classList.add('delay-mode-both');
        
        // Apply offset visualization
        this.offsetVisualizer.apply(trainBar, train, delayInfo, conflicts);
        
        // Apply icon visualization
        this.iconVisualizer.apply(trainBar, train, delayInfo, conflicts);
        
        logger.info('Visualizer', `Applied combined visualization to train ${train.id}`, {
            delay: delayInfo.delayMinutes,
            hasConflict: conflicts?.hasConflict
        });
    }
    
    /**
     * Remove both visualizations from train bar
     */
    remove(trainBar) {
        if (!trainBar) return;
        
        trainBar.classList.remove('delay-mode-both');
        this.offsetVisualizer.remove(trainBar);
        this.iconVisualizer.remove(trainBar);
    }
    
    /**
     * Add cancellation overlay
     */
    addCancellationOverlay(trainBar, delayInfo) {
        // Use offset visualizer's cancellation overlay
        this.offsetVisualizer.addCancellationOverlay(trainBar, delayInfo);
    }
}

// Export for use in other modules
window.CombinedVisualizer = CombinedVisualizer;

