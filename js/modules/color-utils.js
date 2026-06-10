/**
 * Color and Contrast Utilities - WCAG AA compliant
 */

window.ColorUtils = {
    
    /**
     * Read phase: decide the text color for a train (or null to leave CSS alone).
     * Only performs style READS so callers can batch all reads before any writes.
     */
    computeDynamicTextColor(trainElement, userSettings) {
        if (!trainElement) return null;

        // High-contrast theme guarantees readable colors via CSS — an inline
        // color here would override those rules and can make numbers invisible.
        if (document.documentElement.getAttribute('data-theme') === 'high-contrast') return null;

        const visual = trainElement.querySelector('.train-bar-visual');
        const numbers = trainElement.querySelector('.train-numbers');
        if (!visual || !numbers) return null;

        try {
            const bucket = trainElement.dataset.bucket;
            const colorMode = userSettings.trainColorMode || 'length';

            let hasCustomTextColor = false;

            if (colorMode === 'single') {
                hasCustomTextColor = userSettings.singleColor && userSettings.singleColor.text && userSettings.singleColor.text.startsWith('#');
            } else if (bucket) {
                hasCustomTextColor = userSettings.lenColors &&
                                     userSettings.lenColors[bucket] &&
                                     userSettings.lenColors[bucket].text &&
                                     userSettings.lenColors[bucket].text.startsWith('#');
            }

            if (hasCustomTextColor) return null;

            // Contrast against the BACKGROUND the text actually sits on.
            // (Previously this used min(bg, border) luminance, so a light bar
            // with a black border picked white text — invisible on the bar.)
            const styles = getComputedStyle(visual);
            const bgLum = this._getRelativeLuminance(styles.backgroundColor);

            const whiteContrast = this._getContrastRatio(bgLum, 1.0);
            const blackContrast = this._getContrastRatio(bgLum, 0.0);

            const useWhite = whiteContrast >= 4.5 || (whiteContrast > blackContrast && blackContrast < 4.5);
            return useWhite ? '#ffffff' : '#000000';
        } catch (e) {
            console.warn('Error computing dynamic contrast:', e);
            return null;
        }
    },

    /**
     * Apply dynamic text contrast ensuring WCAG AA (4.5:1)
     */
    applyDynamicTextContrast(trainElement, userSettings) {
        const textColor = this.computeDynamicTextColor(trainElement, userSettings);
        if (!textColor) return;
        const numbers = trainElement.querySelector('.train-numbers');
        if (numbers) numbers.style.color = textColor;
    },

    /**
     * Map numeric length to bucket b1..b5
     */
    computeNearestBucket(value, canonicalArray) {
        if (!Array.isArray(canonicalArray) || canonicalArray.length !== 5) return 'b3';
        let nearestIdx = 0;
        let nearestDist = Number.POSITIVE_INFINITY;
        for (let i = 0; i < canonicalArray.length; i++) {
            const dist = Math.abs(value - canonicalArray[i]);
            if (dist < nearestDist) { nearestDist = dist; nearestIdx = i; }
        }
        return 'b' + (nearestIdx + 1);
    },

    /**
     * Internal: Get relative luminance (WCAG formula)
     */
    _getRelativeLuminance(colorString) {
        if (!colorString || colorString === 'transparent') return 0.5;
        
        const rgb = this._parseColorToRGB(colorString);
        if (!rgb) return 0.5;
        
        const r = rgb.r / 255;
        const g = rgb.g / 255;
        const b = rgb.b / 255;
        
        const rsRGB = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
        const gsRGB = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
        const bsRGB = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
        
        return 0.2126 * rsRGB + 0.7152 * gsRGB + 0.0722 * bsRGB;
    },

    /**
     * Internal: Parse CSS color to RGB
     */
    _parseColorToRGB(colorString) {
        const rgbMatch = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (rgbMatch) {
            return { r: parseInt(rgbMatch[1]), g: parseInt(rgbMatch[2]), b: parseInt(rgbMatch[3]) };
        }
        
        const hexMatch = colorString.match(/#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i);
        if (hexMatch) {
            return { r: parseInt(hexMatch[1], 16), g: parseInt(hexMatch[2], 16), b: parseInt(hexMatch[3], 16) };
        }
        
        const shortHexMatch = colorString.match(/#([a-f\d])([a-f\d])([a-f\d])/i);
        if (shortHexMatch) {
            return {
                r: parseInt(shortHexMatch[1] + shortHexMatch[1], 16),
                g: parseInt(shortHexMatch[2] + shortHexMatch[2], 16),
                b: parseInt(shortHexMatch[3] + shortHexMatch[3], 16)
            };
        }
        
        return null;
    },

    /**
     * Internal: Calculate WCAG contrast ratio
     */
    _getContrastRatio(lum1, lum2) {
        const L1 = Math.max(lum1, lum2);
        const L2 = Math.min(lum1, lum2);
        return (L1 + 0.05) / (L2 + 0.05);
    }
};
