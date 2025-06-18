// persistenceEngine.js - Local Storage Management

class PersistenceEngine {
    constructor() {
        this.storageKeys = {
            main: 'gothenburgDispatchAppState',
            backup: 'gothenburgDispatchAppState_backup',
            settings: 'gothenburgDispatchAppSettings'
        };
        this.debounceTimeout = null;
        this.debounceDelay = 1000; // 1 second delay for batching saves
    }

    /**
     * Save the complete application state to localStorage
     * @param {Object} state - The complete application state
     * @param {boolean} immediate - Skip debouncing if true
     */
    saveStateToLocalStorage(state, immediate = false) {
        const saveOperation = () => {
            try {
                // Create backup of current state before overwriting
                const existingData = localStorage.getItem(this.storageKeys.main);
                if (existingData) {
                    localStorage.setItem(this.storageKeys.backup, existingData);
                }

                // Save new state
                const serializedState = JSON.stringify({
                    version: '2.0',
                    timestamp: new Date().toISOString(),
                    data: state
                });

                localStorage.setItem(this.storageKeys.main, serializedState);
                
                console.log('State saved successfully at', new Date().toLocaleTimeString());
                
                // Dispatch custom event for other components to listen to
                window.dispatchEvent(new CustomEvent('stateSaved', { detail: { timestamp: new Date() } }));
                
            } catch (error) {
                console.error('Failed to save state to localStorage:', error);
                
                // Try to free up space by removing backup and retrying
                if (error.name === 'QuotaExceededError') {
                    console.warn('Storage quota exceeded, removing backup and retrying...');
                    localStorage.removeItem(this.storageKeys.backup);
                    try {
                        localStorage.setItem(this.storageKeys.main, JSON.stringify({
                            version: '2.0',
                            timestamp: new Date().toISOString(),
                            data: state
                        }));
                        console.log('State saved successfully after cleanup');
                    } catch (retryError) {
                        console.error('Still failed to save state after cleanup:', retryError);
                        this.showStorageError();
                    }
                } else {
                    this.showStorageError();
                }
            }
        };

        if (immediate) {
            // Clear any pending debounced save
            if (this.debounceTimeout) {
                clearTimeout(this.debounceTimeout);
                this.debounceTimeout = null;
            }
            saveOperation();
        } else {
            // Debounce the save operation
            if (this.debounceTimeout) {
                clearTimeout(this.debounceTimeout);
            }
            
            this.debounceTimeout = setTimeout(() => {
                saveOperation();
                this.debounceTimeout = null;
            }, this.debounceDelay);
        }
    }

    /**
     * Load application state from localStorage
     * @returns {Object|null} The loaded state or null if not found/invalid
     */
    loadStateFromLocalStorage() {
        try {
            const storedData = localStorage.getItem(this.storageKeys.main);
            
            if (!storedData) {
                console.log('No saved state found in localStorage');
                return null;
            }

            const parsedData = JSON.parse(storedData);
            
            // Handle different versions
            if (parsedData.version === '2.0') {
                console.log('Loaded state from', parsedData.timestamp);
                return parsedData.data;
            } else if (parsedData.version) {
                console.warn('Loading state from older version:', parsedData.version);
                return this.migrateFromOlderVersion(parsedData);
            } else {
                // Legacy format (no version)
                console.warn('Loading legacy state format');
                return this.migrateLegacyState(parsedData);
            }
            
        } catch (error) {
            console.error('Failed to load state from localStorage:', error);
            
            // Try to load backup
            try {
                const backupData = localStorage.getItem(this.storageKeys.backup);
                if (backupData) {
                    console.log('Attempting to load from backup...');
                    const parsedBackup = JSON.parse(backupData);
                    return parsedBackup.data || parsedBackup;
                }
            } catch (backupError) {
                console.error('Backup is also corrupted:', backupError);
            }
            
            return null;
        }
    }

    /**
     * Save user settings separately (preferences, view settings, etc.)
     */
    saveSettings(settings) {
        try {
            localStorage.setItem(this.storageKeys.settings, JSON.stringify({
                version: '1.0',
                timestamp: new Date().toISOString(),
                settings: settings
            }));
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }

    /**
     * Load user settings
     */
    loadSettings() {
        try {
            const settingsData = localStorage.getItem(this.storageKeys.settings);
            if (settingsData) {
                const parsed = JSON.parse(settingsData);
                return parsed.settings || parsed;
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
        return null;
    }

    /**
     * Clear all stored data
     */
    clearAllData() {
        try {
            localStorage.removeItem(this.storageKeys.main);
            localStorage.removeItem(this.storageKeys.backup);
            localStorage.removeItem(this.storageKeys.settings);
            console.log('All stored data cleared');
            return true;
        } catch (error) {
            console.error('Failed to clear stored data:', error);
            return false;
        }
    }

    /**
     * Reset to initial data - clears saved data and reloads with trains.js data
     */
    resetToInitialData() {
        try {
            // Clear all localStorage data
            const cleared = this.clearAllData();
            if (cleared) {
                console.log('Resetting to initial train data...');
                
                // Reload the page to start fresh with trains.js data
                if (typeof showNotification !== 'undefined') {
                    showNotification('🔄 Återställer till ursprungsdata...', 'info', 2000);
                }
                
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
                
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to reset to initial data:', error);
            if (typeof showNotification !== 'undefined') {
                showNotification('Återställning misslyckades', 'error');
            }
            return false;
        }
    }

    /**
     * Get storage usage information
     */
    getStorageInfo() {
        const info = {
            mainSize: 0,
            backupSize: 0,
            settingsSize: 0,
            totalSize: 0,
            available: true
        };

        try {
            const mainData = localStorage.getItem(this.storageKeys.main);
            const backupData = localStorage.getItem(this.storageKeys.backup);
            const settingsData = localStorage.getItem(this.storageKeys.settings);

            info.mainSize = mainData ? new Blob([mainData]).size : 0;
            info.backupSize = backupData ? new Blob([backupData]).size : 0;
            info.settingsSize = settingsData ? new Blob([settingsData]).size : 0;
            info.totalSize = info.mainSize + info.backupSize + info.settingsSize;

            // Try to estimate remaining space
            try {
                const testKey = 'test_storage_space';
                const testData = 'x'.repeat(1024); // 1KB test
                localStorage.setItem(testKey, testData);
                localStorage.removeItem(testKey);
            } catch (testError) {
                info.available = false;
            }

        } catch (error) {
            console.error('Error getting storage info:', error);
            info.available = false;
        }

        return info;
    }

    /**
     * Export state as downloadable file
     */
    exportStateAsFile(state, filename = null) {
        try {
            const exportData = {
                version: '2.0',
                exportTimestamp: new Date().toISOString(),
                applicationName: 'Göteborg Central Dispatch System',
                data: state
            };

            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename || `dispatch_state_${new Date().toISOString().split('T')[0]}.json`;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            URL.revokeObjectURL(url);
            
            console.log('State exported successfully');
            return true;
        } catch (error) {
            console.error('Failed to export state:', error);
            return false;
        }
    }

    /**
     * Import state from file
     */
    async importStateFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    const importedData = JSON.parse(event.target.result);
                    
                    // Validate the imported data
                    if (importedData.data && importedData.version) {
                        console.log('Successfully imported state from file');
                        resolve(importedData.data);
                    } else {
                        // Try to handle as legacy format
                        if (importedData.trains || importedData.services) {
                            console.log('Importing legacy format file');
                            resolve(this.migrateLegacyState(importedData));
                        } else {
                            reject(new Error('Invalid file format'));
                        }
                    }
                } catch (error) {
                    reject(new Error('Failed to parse file: ' + error.message));
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsText(file);
        });
    }

    /**
     * Migrate from older versions
     */
    migrateFromOlderVersion(oldData) {
        // Add migration logic here as new versions are released
        console.warn('Migration from older versions not yet implemented');
        return oldData.data || oldData;
    }

    /**
     * Migrate legacy state format
     */
    migrateLegacyState(legacyData) {
        // Convert old format to new format
        const migratedState = {
            trains: legacyData.trains || legacyData.services || [],
            nextTrainId: legacyData.nextTrainId || this.calculateNextId(legacyData.trains || legacyData.services || []),
            selectedTrainId: null,
            swappingState: { active: false, sourceTrainId: null },
            currentStartHour: legacyData.currentStartHour || 0,
            viewHours: legacyData.viewHours || 3,
            pixelsPerMinute: legacyData.pixelsPerMinute || 4,
            trackHeight: legacyData.trackHeight || 40,
            actionHistory: [],
            historyPointer: -1
        };

        // Convert old train format to new service format if needed
        migratedState.trains = migratedState.trains.map(train => {
            if (!train.trainSet && train.trainNumber) {
                // Legacy format detected, create basic trainSet
                return {
                    ...train,
                    arrivalTrainNumber: train.trainNumber,
                    departureTrainNumber: train.trainNumber,
                    scheduledArrivalTime: train.startTime,
                    scheduledDepartureTime: train.endTime,
                    trainSet: {
                        vehicleTypeID: this.guessVehicleType(train.trainNumber),
                        count: 1
                    }
                };
            }
            return train;
        });

        console.log('Migrated legacy state successfully');
        return migratedState;
    }

    /**
     * Guess vehicle type from train number (for migration)
     */
    guessVehicleType(trainNumber) {
        if (trainNumber.includes('X2')) return 'X2';
        if (trainNumber.includes('IC')) return 'SJ3000';
        if (trainNumber.includes('Väst')) return 'REGINA';
        if (trainNumber.includes('PT')) return 'PENDELTAG';
        if (trainNumber.includes('Öresund')) return 'ORESUND';
        if (trainNumber.includes('Cargo') || trainNumber.includes('DB')) return 'LOCOMOTIVE_CARGO';
        if (trainNumber.includes('Service') || trainNumber.includes('Maint')) return 'MAINTENANCE';
        return 'REGINA'; // Default fallback
    }

    /**
     * Calculate next ID from existing trains
     */
    calculateNextId(trains) {
        if (!trains || trains.length === 0) return 1;
        return Math.max(...trains.map(t => t.id || 0)) + 1;
    }

    /**
     * Show storage error to user
     */
    showStorageError() {
        // This would typically integrate with your notification system
        console.error('Storage error - consider exporting your data');
        
        // Create a simple notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #e74c3c;
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            z-index: 10000;
            max-width: 300px;
        `;
        notification.innerHTML = `
            <strong>Lagringsfel!</strong><br>
            Kunde inte spara ändringar. Överväg att exportera dina data.
            <button onclick="this.parentElement.remove()" style="float: right; background: none; border: none; color: white; cursor: pointer;">✕</button>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 10000);
    }
}

// Create global instance
const persistenceEngine = new PersistenceEngine(); 