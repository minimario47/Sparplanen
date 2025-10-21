/**
 * Search Modal - Train Number Search
 * Allows users to search for trains by train number
 * Integrates with trains.js data
 */

class SearchModal {
    constructor() {
        this.modal = null;
        this.backdrop = null;
        this.input = null;
        this.resultsList = null;
        this.clearBtn = null;
        this.isOpen = false;
        this.trains = [];
        this.init();
    }

    init() {
        // Wait for DOM and trains data to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        // Get modal elements
        this.backdrop = document.getElementById('search-modal-backdrop');
        this.modal = document.getElementById('search-modal');
        this.input = document.getElementById('search-modal-input');
        this.resultsList = document.getElementById('search-results-list');
        this.clearBtn = document.getElementById('search-clear-btn');
        this.closeBtn = document.getElementById('search-close-btn');

        if (!this.backdrop || !this.modal || !this.input) {
            console.error('❌ Search modal elements not found');
            return;
        }

        // Load trains data
        this.loadTrainsData();

        // Attach event listeners
        this.attachListeners();

        // Listen for open/close events from search button
        window.addEventListener('openSearch', () => this.open());
        window.addEventListener('closeSearch', () => this.close());

        console.log('✅ Search modal initialized');
    }

    loadTrainsData() {
        // Access global trains array from trains.js
        if (typeof window.trains !== 'undefined') {
            this.trains = window.trains;
            console.log(`📊 Loaded ${this.trains.length} trains for search`);
        } else {
            console.warn('⚠️ Trains data not loaded yet');
            // Try again after a delay
            setTimeout(() => this.loadTrainsData(), 500);
        }
    }

    attachListeners() {
        // Input handlers
        this.input.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
            this.updateClearButton(e.target.value);
        });

        // Enter key to select first result
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const firstResult = this.resultsList.querySelector('.search-result-item');
                if (firstResult) {
                    firstResult.click();
                }
            }
        });

        // Clear button
        this.clearBtn.addEventListener('click', () => {
            this.input.value = '';
            this.input.focus();
            this.clearResults();
            this.updateClearButton('');
        });

        // Close button
        this.closeBtn.addEventListener('click', () => {
            this.close();
        });

        // Backdrop click to close
        this.backdrop.addEventListener('click', (e) => {
            if (e.target === this.backdrop) {
                this.close();
            }
        });

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }

    open() {
        this.isOpen = true;
        this.backdrop.classList.add('open');
        
        // Focus input after animation
        setTimeout(() => {
            this.input.focus();
        }, 150);

        // Show initial results (all trains)
        this.showInitialResults();

        console.log('🔍 Search modal opened');
    }

    close() {
        this.isOpen = false;
        this.backdrop.classList.remove('open');
        this.input.value = '';
        this.clearResults();
        this.updateClearButton('');

        // Dispatch close event
        window.dispatchEvent(new CustomEvent('searchClosed'));

        console.log('🔍 Search modal closed');
    }

    handleSearch(query) {
        if (!query || query.trim() === '') {
            this.showInitialResults();
            return;
        }

        const searchQuery = query.toLowerCase().trim();
        
        // Search trains by train number
        const results = this.trains.filter(train => {
            const trainNumber = train.trainNumber.toString().toLowerCase();
            return trainNumber.includes(searchQuery);
        });

        this.displayResults(results, query);
    }

    showInitialResults() {
        // Show first 10 trains as initial results
        const initialResults = this.trains.slice(0, 10);
        this.displayResults(initialResults, '', true);
    }

    displayResults(results, query = '', isInitial = false) {
        // Clear previous results
        this.resultsList.innerHTML = '';

        if (results.length === 0) {
            this.showEmptyState(query);
            return;
        }

        // Show results count
        const countText = isInitial 
            ? `Visar ${results.length} tåg` 
            : `${results.length} resultat för "${query}"`;
        
        const countEl = document.createElement('div');
        countEl.className = 'search-results-count';
        countEl.textContent = countText;
        this.resultsList.parentElement.insertBefore(countEl, this.resultsList);

        // Display results
        results.forEach((train, index) => {
            const resultItem = this.createResultItem(train, index);
            this.resultsList.appendChild(resultItem);
        });
    }

    createResultItem(train, index) {
        const item = document.createElement('li');
        item.className = 'search-result-item';
        item.setAttribute('data-train-number', train.trainNumber);
        item.setAttribute('tabindex', '0');
        item.setAttribute('role', 'button');
        item.setAttribute('aria-label', `Tåg ${train.trainNumber} på spår ${train.track || 'okänt'}`);

        // Format time
        const startTime = train.startTime || 'N/A';
        const endTime = train.endTime || 'N/A';

        item.innerHTML = `
            <div class="search-result-info">
                <div class="search-result-number">Tåg ${train.trainNumber}</div>
                <div class="search-result-details">
                    <span class="search-result-track">Spår ${train.track || 'N/A'}</span>
                    <span class="search-result-time">${startTime} - ${endTime}</span>
                </div>
            </div>
            <div class="search-result-arrow">→</div>
        `;

        // Click handler
        item.addEventListener('click', () => {
            this.selectTrain(train);
        });

        // Keyboard support
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.selectTrain(train);
            }
        });

        return item;
    }

    selectTrain(train) {
        console.log('🚂 Selected train:', train.trainNumber);

        // Dispatch custom event for other components to handle
        window.dispatchEvent(new CustomEvent('trainSelected', {
            detail: { train }
        }));

        // Highlight train in schedule (if renderer exists)
        if (window.highlightTrain) {
            window.highlightTrain(train.trainNumber);
        }

        // Show notification
        if (window.showNotification) {
            window.showNotification(`Tåg ${train.trainNumber} valt`, 'success');
        }

        // Close modal
        this.close();
    }

    showEmptyState(query) {
        this.resultsList.innerHTML = `
            <div class="search-empty-state">
                <div class="search-empty-icon">🔍</div>
                <div class="search-empty-text">Inga tåg hittades</div>
                <div class="search-empty-hint">Försök med ett annat tågnummer</div>
            </div>
        `;
    }

    clearResults() {
        this.resultsList.innerHTML = '';
        const countEl = document.querySelector('.search-results-count');
        if (countEl) {
            countEl.remove();
        }
    }

    updateClearButton(value) {
        if (value && value.trim() !== '') {
            this.clearBtn.classList.add('visible');
        } else {
            this.clearBtn.classList.remove('visible');
        }
    }

    // Public methods
    isModalOpen() {
        return this.isOpen;
    }

    focusSearch() {
        if (this.isOpen) {
            this.input.focus();
        }
    }
}

// Initialize search modal when script loads
let searchModal;

// Wait for trains data to be loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        searchModal = new SearchModal();
    });
} else {
    searchModal = new SearchModal();
}

// Export for global access
window.searchModal = searchModal;
window.SearchModal = SearchModal;

// Export class for module systems (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SearchModal;
}

