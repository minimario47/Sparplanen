/**
 * Debug Logger - Comprehensive logging system for SpårplanV2
 * Provides categorized, timestamped logging with event emission
 */

class DebugLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 1000;
        this.enabled = true;
        this.listeners = [];
    }
    
    /**
     * Core logging method
     */
    log(category, level, message, data = null) {
        if (!this.enabled) return;
        
        const entry = {
            timestamp: new Date().toISOString(),
            time: new Date().toLocaleTimeString('sv-SE'),
            category,
            level,
            message,
            data
        };
        
        // Store in memory
        this.logs.push(entry);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        // Console output with appropriate method
        const prefix = `[${entry.time}] [${category}]`;
        switch (level) {
            case 'error':
                console.error(prefix, message, data || '');
                break;
            case 'warn':
                console.warn(prefix, message, data || '');
                break;
            default:
                console.log(prefix, message, data || '');
        }
        
        // Notify listeners
        this.emit('log-added', entry);
        
        return entry;
    }
    
    /**
     * Debug level log (verbose)
     */
    debug(category, message, data) {
        return this.log(category, 'debug', message, data);
    }
    
    /**
     * Info level log
     */
    info(category, message, data) {
        return this.log(category, 'info', message, data);
    }
    
    /**
     * Warning level log
     */
    warn(category, message, data) {
        return this.log(category, 'warn', message, data);
    }
    
    /**
     * Error level log
     */
    error(category, message, data) {
        return this.log(category, 'error', message, data);
    }
    
    /**
     * Get all logs
     */
    getLogs() {
        return [...this.logs];
    }
    
    /**
     * Get logs filtered by category
     */
    getLogsByCategory(category) {
        return this.logs.filter(log => log.category === category);
    }
    
    /**
     * Get logs filtered by level
     */
    getLogsByLevel(level) {
        return this.logs.filter(log => log.level === level);
    }
    
    /**
     * Clear all logs
     */
    clear() {
        this.logs = [];
        this.emit('logs-cleared');
        this.info('Logger', 'Logs cleared');
    }
    
    /**
     * Export logs as JSON string
     */
    exportAsJSON() {
        return JSON.stringify(this.logs, null, 2);
    }
    
    /**
     * Export logs as CSV string
     */
    exportAsCSV() {
        const headers = ['Timestamp', 'Category', 'Level', 'Message'];
        const rows = this.logs.map(log => [
            log.timestamp,
            log.category,
            log.level,
            log.message.replace(/,/g, ';')
        ]);
        
        return [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');
    }
    
    /**
     * Add event listener
     */
    on(event, callback) {
        this.listeners.push({ event, callback });
    }
    
    /**
     * Remove event listener
     */
    off(event, callback) {
        this.listeners = this.listeners.filter(
            listener => listener.event !== event || listener.callback !== callback
        );
    }
    
    /**
     * Emit event to listeners
     */
    emit(event, data) {
        this.listeners
            .filter(listener => listener.event === event)
            .forEach(listener => {
                try {
                    listener.callback(data);
                } catch (error) {
                    console.error('[Logger] Error in event listener:', error);
                }
            });
    }
    
    /**
     * Enable/disable logging
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        this.info('Logger', `Logging ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    /**
     * Get statistics
     */
    getStats() {
        return {
            total: this.logs.length,
            byLevel: {
                info: this.logs.filter(l => l.level === 'info').length,
                warn: this.logs.filter(l => l.level === 'warn').length,
                error: this.logs.filter(l => l.level === 'error').length
            },
            byCategory: this.logs.reduce((acc, log) => {
                acc[log.category] = (acc[log.category] || 0) + 1;
                return acc;
            }, {})
        };
    }
}

// Create global logger instance
window.logger = window.logger || new DebugLogger();

// Initialize message
window.logger.info('Logger', 'Debug logger initialized');

