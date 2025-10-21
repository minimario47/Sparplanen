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
                            <span class="track-info-label">Längd:</span>
                            <span class="track-info-value track-length"></span>
                        </div>
                        <div class="track-info-item">
                            <span class="track-info-label">Signalområde:</span>
                            <span class="track-info-value track-signal-length"></span>
                        </div>
                        <div class="track-info-item">
                            <span class="track-info-label">Delspår:</span>
                            <span class="track-info-value track-subtracks"></span>
                        </div>
                    </div>
                </div>
                <div class="track-tooltip-section">
                    <h4>Användning</h4>
                    <div class="track-properties"></div>
                    <p class="track-description"></p>
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

        // Update lengths
        const lengthElement = this.tooltip.querySelector('.track-length');
        lengthElement.textContent = `${trackData.totalLengthMeters}m`;

        const signalLengthElement = this.tooltip.querySelector('.track-signal-length');
        signalLengthElement.textContent = `${trackData.signalVisibleLengthMeters}m`;

        // Update subtracks
        const subtracksElement = this.tooltip.querySelector('.track-subtracks');
        subtracksElement.textContent = trackData.subTrackCount;

        // Update properties
        const propertiesElement = this.tooltip.querySelector('.track-properties');
        propertiesElement.innerHTML = this.formatProperties(trackData.properties);

        // Update description
        const descriptionElement = this.tooltip.querySelector('.track-description');
        descriptionElement.textContent = trackData.description;
    }

    formatProperties(properties) {
        if (!properties || !Array.isArray(properties)) return '';

        const propertyLabels = {
            'regional_platform': 'Regionalplattform',
            'high_speed_platform': 'Höghastighetsplattform',
            'long_distance': 'Långdistanstrafik',
            'intercity_platform': 'InterCity-plattform',
            'commuter_platform': 'Pendeltågsplattform',
            'cargo': 'Godstrafik',
            'maintenance': 'Underhåll',
            'maintenance_only': 'Endast underhåll',
            'limited': 'Begränsad användning'
        };

        return properties.map(prop => {
            const label = propertyLabels[prop] || prop;
            return `<span class="track-property">${label}</span>`;
        }).join('');
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
