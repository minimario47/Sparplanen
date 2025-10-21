/**
 * Debug Logs Modal - Real-time log viewer
 * Displays categorized, filterable logs from the debug logger
 */

class DebugLogsModal {
    constructor() {
        this.isOpen = false;
        this.modal = null;
        this.filterCategory = 'all';
        this.filterLevel = 'all';
        this.autoScroll = true;
        
        this.createModal();
        this.setupEventListeners();
        
        logger.info('DebugLogs', 'Debug logs modal initialized');
    }
    
    /**
     * Create modal HTML structure
     */
    createModal() {
        const modal = document.createElement('div');
        modal.className = 'debug-logs-modal hidden';
        modal.id = 'debug-logs-modal';
        
        modal.innerHTML = `
            <div class="debug-logs-backdrop"></div>
            <div class="debug-logs-container">
                <div class="debug-logs-header">
                    <h2>Debug Logs</h2>
                    <button class="debug-logs-close" aria-label="Stäng loggar">✕</button>
                </div>
                
                <div class="debug-logs-controls">
                    <div class="debug-logs-filters">
                        <label>
                            Kategori:
                            <select id="log-filter-category">
                                <option value="all">Alla</option>
                                <option value="DelayAPI">DelayAPI</option>
                                <option value="DelayData">DelayData</option>
                                <option value="Conflict">Conflict</option>
                                <option value="Visualizer">Visualizer</option>
                                <option value="Integration">Integration</option>
                                <option value="DelaySettings">DelaySettings</option>
                                <option value="Logger">Logger</option>
                            </select>
                        </label>
                        
                        <label>
                            Nivå:
                            <select id="log-filter-level">
                                <option value="all">Alla</option>
                                <option value="info">Info</option>
                                <option value="warn">Warning</option>
                                <option value="error">Error</option>
                            </select>
                        </label>
                        
                        <label class="debug-logs-checkbox">
                            <input type="checkbox" id="log-auto-scroll" checked>
                            Auto-scroll
                        </label>
                    </div>
                    
                    <div class="debug-logs-actions">
                        <button id="log-export-btn" class="btn btn-secondary btn-sm">Exportera</button>
                        <button id="log-clear-btn" class="btn btn-secondary btn-sm">Rensa</button>
                    </div>
                </div>
                
                <div class="debug-logs-stats">
                    <span id="log-stats-total">0 loggar</span>
                    <span id="log-stats-errors">0 fel</span>
                    <span id="log-stats-warnings">0 varningar</span>
                </div>
                
                <div class="debug-logs-content" id="debug-logs-content"></div>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.modal = modal;
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Close button
        this.modal.querySelector('.debug-logs-close').addEventListener('click', () => {
            this.close();
        });
        
        // Backdrop click
        this.modal.querySelector('.debug-logs-backdrop').addEventListener('click', () => {
            this.close();
        });
        
        // Filter changes
        document.getElementById('log-filter-category').addEventListener('change', (e) => {
            this.filterCategory = e.target.value;
            this.renderLogs();
        });
        
        document.getElementById('log-filter-level').addEventListener('change', (e) => {
            this.filterLevel = e.target.value;
            this.renderLogs();
        });
        
        // Auto-scroll toggle
        document.getElementById('log-auto-scroll').addEventListener('change', (e) => {
            this.autoScroll = e.target.checked;
        });
        
        // Export button
        document.getElementById('log-export-btn').addEventListener('click', () => {
            this.exportLogs();
        });
        
        // Clear button
        document.getElementById('log-clear-btn').addEventListener('click', () => {
            window.logger.clear();
            this.renderLogs();
        });
        
        // Listen to logger events
        window.logger.on('log-added', () => {
            if (this.isOpen) {
                this.renderLogs();
            }
        });
        
        window.logger.on('logs-cleared', () => {
            if (this.isOpen) {
                this.renderLogs();
            }
        });
        
        // Keyboard shortcut (Escape to close)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }
    
    /**
     * Open modal
     */
    open() {
        this.isOpen = true;
        this.modal.classList.remove('hidden');
        this.renderLogs();
        logger.info('DebugLogs', 'Debug logs modal opened');
    }
    
    /**
     * Close modal
     */
    close() {
        this.isOpen = false;
        this.modal.classList.add('hidden');
        logger.info('DebugLogs', 'Debug logs modal closed');
    }
    
    /**
     * Toggle modal
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
    
    /**
     * Render logs to modal
     */
    renderLogs() {
        const content = document.getElementById('debug-logs-content');
        if (!content) return;
        
        // Get filtered logs
        let logs = window.logger.getLogs();
        
        if (this.filterCategory !== 'all') {
            logs = logs.filter(log => log.category === this.filterCategory);
        }
        
        if (this.filterLevel !== 'all') {
            logs = logs.filter(log => log.level === this.filterLevel);
        }
        
        // Update stats
        this.updateStats();
        
        // Render logs
        content.innerHTML = logs.map(log => this.renderLogEntry(log)).join('');
        
        // Auto-scroll to bottom
        if (this.autoScroll) {
            content.scrollTop = content.scrollHeight;
        }
    }
    
    /**
     * Render single log entry
     */
    renderLogEntry(log) {
        const levelClass = `log-level-${log.level}`;
        const dataStr = log.data ? `\nData: ${JSON.stringify(log.data, null, 2)}` : '';
        
        return `
            <div class="log-entry ${levelClass}">
                <span class="log-time">${log.time}</span>
                <span class="log-category">[${log.category}]</span>
                <span class="log-level">${log.level.toUpperCase()}</span>
                <span class="log-message">${this.escapeHtml(log.message)}</span>
                ${dataStr ? `<pre class="log-data">${this.escapeHtml(dataStr)}</pre>` : ''}
            </div>
        `;
    }
    
    /**
     * Update statistics
     */
    updateStats() {
        const stats = window.logger.getStats();
        
        document.getElementById('log-stats-total').textContent = `${stats.total} loggar`;
        document.getElementById('log-stats-errors').textContent = `${stats.byLevel.error} fel`;
        document.getElementById('log-stats-warnings').textContent = `${stats.byLevel.warn} varningar`;
    }
    
    /**
     * Export logs
     */
    exportLogs() {
        const format = confirm('Exportera som JSON? (Klicka OK för JSON, Avbryt för CSV)') ? 'json' : 'csv';
        
        let content, filename, mimeType;
        
        if (format === 'json') {
            content = window.logger.exportAsJSON();
            filename = `sparplanen-logs-${new Date().toISOString()}.json`;
            mimeType = 'application/json';
        } else {
            content = window.logger.exportAsCSV();
            filename = `sparplanen-logs-${new Date().toISOString()}.csv`;
            mimeType = 'text/csv';
        }
        
        // Create download link
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        
        logger.info('DebugLogs', `Exported logs as ${format.toUpperCase()}`);
    }
    
    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Create global instance
window.debugLogsModal = new DebugLogsModal();

// Add click handler to header elements to open logs
document.addEventListener('DOMContentLoaded', () => {
    // Click on app title/logo to open logs
    const logoElement = document.querySelector('.header-logo');
    const titleElement = document.querySelector('.header-title');
    const statusElement = document.getElementById('api-status');
    
    [logoElement, titleElement, statusElement].forEach(el => {
        if (el) {
            el.addEventListener('click', (e) => {
                // Don't interfere with normal link behavior
                if (e.target.tagName === 'A') return;
                e.preventDefault();
                window.debugLogsModal.toggle();
            });
            el.style.cursor = 'pointer';
            el.title = 'Klicka för att öppna debug-loggar';
        }
    });
    
    logger.info('DebugLogs', 'Click handlers for debug logs added');
});

