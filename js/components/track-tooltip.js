// track-tooltip.js - Beautiful tooltip for track information display

class TrackTooltip {
    constructor() {
        this.tooltip = null;
        this.currentTrack = null;
        this.isVisible = false;
        this.init();
    }

    init() {
        this.createTooltipElement();
        this.attachEventListeners();

        // Also try to attach listeners after a delay to catch dynamically created elements
        setTimeout(() => {
            this.attachEventListenersToExistingTracks();
        }, 2000);
    }

    createTooltipElement() {
        // Create tooltip element
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'track-tooltip';
        this.tooltip.innerHTML = `
            <div class="track-tooltip-header">
                <h3 class="track-tooltip-title">Spår <span class="track-number"></span></h3>
                <button class="track-tooltip-close" aria-label="Stäng tooltip">&times;</button>
            </div>
            <div class="track-tooltip-content">
                <div class="track-tooltip-section">
                    <h4>Information</h4>
                    <div class="track-info-grid">
                        <div class="track-info-item">
                            <span class="track-info-label">Signal:</span>
                            <span class="track-info-value track-signal-length"></span>
                        </div>
                        <div class="track-info-item track-ledning-row track-segment-first">
                            <span class="track-info-label">Första spårledning:</span>
                            <span class="track-info-value track-first-led"></span>
                        </div>
                        <div class="track-info-item track-ledning-row track-segment-second">
                            <span class="track-info-label">Andra spårledning:</span>
                            <span class="track-info-value track-second-led"></span>
                        </div>
                        <div class="track-info-item">
                            <span class="track-info-label">Plattform:</span>
                            <span class="track-info-value track-platform-length"></span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add to DOM
        document.body.appendChild(this.tooltip);

        // Add close button event listener
        const closeBtn = this.tooltip.querySelector('.track-tooltip-close');
        closeBtn.addEventListener('click', () => this.hide());
    }

    attachEventListeners() {
        // Listen for track clicks
        document.addEventListener('click', (e) => {
            const trackContent = e.target.closest('.track-content');
            if (trackContent) {
                e.stopPropagation();
                const trackNumber = this.getTrackNumberFromElement(trackContent);
                if (trackNumber) {
                    this.show(trackNumber, trackContent);
                }
            } else if (this.isVisible && !e.target.closest('.track-tooltip')) {
                // Click outside tooltip - hide it
                this.hide();
            }
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    attachEventListenersToExistingTracks() {
        const trackContents = document.querySelectorAll('.track-content');

        trackContents.forEach(trackContent => {
            trackContent.addEventListener('click', (e) => {
                e.stopPropagation();
                const trackNumber = this.getTrackNumberFromElement(trackContent);
                if (trackNumber) {
                    this.show(trackNumber, trackContent);
                }
            });

            // Also add visual feedback
            trackContent.style.cursor = 'pointer';
            trackContent.title = 'Klicka för att visa spårinformation';
        });
    }

    getTrackNumberFromElement(trackContent) {
        // Try to get track number from data attribute first
        const trackNumber = trackContent.dataset.trackNumber;
        if (trackNumber) return trackNumber;

        // Try to get from parent elements (track labels)
        const parentTrackLabel = trackContent.closest('.track-label');
        if (parentTrackLabel) {
            const trackNumberElement = parentTrackLabel.querySelector('.track-number') ||
                                      parentTrackLabel.querySelector('.track-name');
            if (trackNumberElement) {
                const text = trackNumberElement.textContent.trim();
                const match = text.match(/(\d+)/);
                if (match) return match[1];
            }
        }

        // Try to get from text content directly
        const trackName = trackContent.querySelector('.track-name');
        if (trackName) {
            const text = trackName.textContent.trim();
            const match = text.match(/(\d+)/);
            if (match) return match[1];
        }

        // Try to find track number in any text content
        const allText = trackContent.textContent.trim();
        const match = allText.match(/(\d+)/);
        if (match) return match[1];

        return null;
    }

    show(trackNumber, targetElement) {
        const trackData = this.getTrackData(trackNumber);
        if (!trackData) {
            console.warn(`Ingen spårdata hittades för spår ${trackNumber}`);
            return;
        }

        this.currentTrack = trackNumber;
        this.updateTooltipContent(trackData);
        this.positionTooltip(targetElement);
        this.tooltip.classList.add('visible');
        this.isVisible = true;
    }

    hide() {
        if (this.tooltip) {
            this.tooltip.classList.remove('visible');
            this.isVisible = false;
            this.currentTrack = null;
        }
    }

    getTrackData(trackNumber) {
        // Import track definitions if available
        if (typeof window.trackDefinitions !== 'undefined') {
            return window.trackDefinitions.find(track =>
                parseInt(track.publicTrackNumber) === parseInt(trackNumber)
            );
        }

        // Fallback: try to load from tracks.js
        if (typeof getTrackDefinition === 'function') {
            return getTrackDefinition(trackNumber);
        }

        return null;
    }

    updateTooltipContent(trackData) {
        if (!trackData) return;

        // Update title
        const titleElement = this.tooltip.querySelector('.track-number');
        titleElement.textContent = trackData.publicTrackNumber;

        const signalEl = this.tooltip.querySelector('.track-signal-length');
        const firstLedEl = this.tooltip.querySelector('.track-first-led');
        const secondLedEl = this.tooltip.querySelector('.track-second-led');
        const platformEl = this.tooltip.querySelector('.track-platform-length');
        if (signalEl) {
            const line = typeof formatTrackSignalLengthDisplay === 'function'
                ? formatTrackSignalLengthDisplay(trackData)
                : `${trackData.totalLengthMeters}m`;
            signalEl.textContent = line;
        }
        const segs = Array.isArray(trackData.trackSegmentMeters) ? trackData.trackSegmentMeters : null;
        const hasSegments = segs && segs.length >= 2;
        const setRow = (el, value, show) => {
            if (!el) return;
            const row = el.closest('.track-info-item');
            if (!row) return;
            if (show) {
                el.textContent = value;
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        };
        // [0] = andra spårledning, [1] = första (samma som vänster/höger i "A+B"-texten)
        if (firstLedEl && secondLedEl) {
            setRow(firstLedEl, hasSegments ? `${segs[1]}m` : '', hasSegments);
            setRow(secondLedEl, hasSegments ? `${segs[0]}m` : '', hasSegments);
        }
        if (platformEl) {
            if (trackData.platformLengthMeters != null) {
                platformEl.textContent = `${trackData.platformLengthMeters}m`;
                platformEl.closest('.track-info-item').style.display = '';
            } else {
                const row = platformEl.closest('.track-info-item');
                if (row) row.style.display = 'none';
            }
        }
    }

    positionTooltip(targetElement) {
        if (!targetElement) return;

        const rect = targetElement.getBoundingClientRect();
        const tooltipRect = this.tooltip.getBoundingClientRect();
        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight
        };

        // Calculate position - prefer right side, fallback to left
        let left = rect.right + 10;
        let top = rect.top;

        // Check if tooltip goes off right edge
        if (left + tooltipRect.width > viewport.width) {
            left = rect.left - tooltipRect.width - 10;
        }

        // Check if tooltip goes off bottom edge
        if (top + tooltipRect.height > viewport.height) {
            top = viewport.height - tooltipRect.height - 10;
        }

        // Ensure tooltip doesn't go above viewport
        if (top < 10) {
            top = 10;
        }

        this.tooltip.style.left = `${left}px`;
        this.tooltip.style.top = `${top}px`;
    }
}

// Initialize tooltip when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.trackTooltip = new TrackTooltip();
});

// Global function to re-attach listeners (for when tracks are re-rendered)
window.reattachTrackTooltipListeners = function() {
    if (window.trackTooltip) {
        window.trackTooltip.attachEventListenersToExistingTracks();
    }
};

// Export for potential use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TrackTooltip;
}
