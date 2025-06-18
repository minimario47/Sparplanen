
class TrainDelayIntegration {
    constructor(apiBaseUrl = 'http://localhost:8000') {
        this.apiBaseUrl = apiBaseUrl;
        this.delayData = new Map(); 
        this.isInitialized = false;
        this.updateInterval = null;
        this.updateTimeout = null;
        this.connectionStatus = 'disconnected';
        
        this.initialize();
    }
    
    async initialize() {
        console.log('Initializing Train Delay Integration...');
        
        try {
            await this.connectToAPI();
            this.startPeriodicUpdates();
            this.isInitialized = true;
            console.log('Train Delay Integration initialized successfully');
        } catch (error) {
            console.warn('Could not initialize train delay API:', error);
            console.log('Running without real-time delay data');
        }
    }
    
    async connectToAPI() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/summary`);
            if (response.ok) {
                const data = await response.json();
                this.connectionStatus = 'connected';
                this.updateConnectionStatusUI();
                console.log('Connected to train delay API:', data);
                return true;
            }
        } catch (error) {
            this.connectionStatus = 'disconnected';
            this.updateConnectionStatusUI();
            throw error;
        }
    }
    
    startPeriodicUpdates() {
        this.updateInterval = setInterval(() => {
            this.updateDelayData();
        }, 60000);
        
        this.updateDelayData();
    }
    
    stopPeriodicUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    
    async updateDelayData() {
        if (this.connectionStatus === 'disconnected') return;
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/trains`);
            if (response.ok) {
                const data = await response.json();
                this.processDelayData(data.trains || []);
                
                this.updateDelayVisualizationOnly();
                
                this.connectionStatus = 'connected';
                this.updateConnectionStatusUI();
            }
        } catch (error) {
            console.warn('Failed to update delay data:', error);
            this.connectionStatus = 'disconnected';
            this.updateConnectionStatusUI();
        }
    }
    
    processDelayData(trains) {
        this.delayData.clear();
        
        trains.forEach(train => {
            const trainNumber = train.AdvertisedTrainIdent;
            if (trainNumber) {
                const delayInfo = {
                    delayMinutes: train.DelayMinutes,
                    delayStatus: train.DelayStatus,
                    isCanceled: train.IsCanceled,
                    isReplaced: train.IsReplaced,
                    deviationDescription: train.DeviationDescription,
                    estimatedTime: train.EstimatedTimeAtLocation,
                    advertisedTime: train.AdvertisedTimeAtLocation,
                    actualTime: train.TimeAtLocation,
                    lastUpdated: train.LastUpdated
                };
                
                this.delayData.set(String(trainNumber), delayInfo);
                this.delayData.set(Number(trainNumber), delayInfo);
            }
        });
        
        console.log(`Updated delay data for ${this.delayData.size} trains`);
    }
    
    updateConnectionStatusUI() {
        const statusElement = document.getElementById('delayConnectionStatus');
        if (!statusElement) return;
        
        statusElement.classList.remove('connected', 'disconnected', 'connecting');
        
        switch (this.connectionStatus) {
            case 'connected':
                statusElement.classList.add('connected');
                statusElement.textContent = `Realtid (${this.delayData.size})`;
                statusElement.title = `Ansluten till förseningsdata - ${this.delayData.size} tåg`;
                break;
            case 'disconnected':
                statusElement.classList.add('disconnected');
                statusElement.textContent = 'Frånkopplad';
                statusElement.title = 'Ingen anslutning till förseningsdata';
                break;
            case 'connecting':
            default:
                statusElement.classList.add('connecting');
                statusElement.textContent = 'Ansluter...';
                statusElement.title = 'Ansluter till förseningsdata...';
                break;
        }
    }
    
    applyDelayVisualization() {
        document.querySelectorAll('.train-bar').forEach(trainBar => {
            this.updateTrainBarWithDelay(trainBar);
        });
        console.log(`Applied delay visualization to ${document.querySelectorAll('.train-bar').length} train bars`);
    }
    
    updateDelayVisualizationOnly() {
        document.querySelectorAll('.train-bar').forEach(trainBar => {
            this.removeDelayElements(trainBar);
            this.updateTrainBarWithDelayQuiet(trainBar);
        });
        console.log(`Quietly updated delay visualization for ${document.querySelectorAll('.train-bar').length} trains`);
    }
    
    updateTrainBarWithDelayQuiet(trainBar) {
        const trainId = trainBar.dataset.trainId;
        if (!trainId) return;
        
        const service = window.AppState?.trains?.find(t => t.id.toString() === trainId);
        if (!service) return;
        
        const arrivalNumber = service.arrivalTrainNumber;
        const departureNumber = service.departureTrainNumber;
        
        let delayInfo = null;
        let trainNumber = null;
        
        if (arrivalNumber && this.delayData.has(arrivalNumber)) {
            delayInfo = this.delayData.get(arrivalNumber);
            trainNumber = arrivalNumber;
        } else if (departureNumber && this.delayData.has(departureNumber)) {
            delayInfo = this.delayData.get(departureNumber);
            trainNumber = departureNumber;
        }
        
        if (delayInfo) {
            this.addDelayVisualization(trainBar, delayInfo, service, trainNumber);
        }
    }
    
    updateTrainBarWithDelay(trainBar) {
        const trainId = trainBar.dataset.trainId;
        if (!trainId) return;
        
        const service = window.AppState?.trains?.find(t => t.id.toString() === trainId);
        if (!service) return;
        
        const arrivalNumber = service.arrivalTrainNumber;
        const departureNumber = service.departureTrainNumber;
        
        let delayInfo = null;
        let trainNumber = null;
        
        if (arrivalNumber && (this.delayData.has(arrivalNumber) || this.delayData.has(String(arrivalNumber)) || this.delayData.has(Number(arrivalNumber)))) {
            delayInfo = this.delayData.get(arrivalNumber) || this.delayData.get(String(arrivalNumber)) || this.delayData.get(Number(arrivalNumber));
            trainNumber = arrivalNumber;
        } else if (departureNumber && (this.delayData.has(departureNumber) || this.delayData.has(String(departureNumber)) || this.delayData.has(Number(departureNumber)))) {
            delayInfo = this.delayData.get(departureNumber) || this.delayData.get(String(departureNumber)) || this.delayData.get(Number(departureNumber));
            trainNumber = departureNumber;
        }
        
        if (arrivalNumber || departureNumber) {
            console.log(`Checking train ${trainId}: arrival=${arrivalNumber}, departure=${departureNumber}, found delay=${!!delayInfo}`);
        }
        
        this.removeDelayElements(trainBar);
        
        if (delayInfo) {
            console.log(`Adding delay visualization for train ${trainNumber}:`, delayInfo);
            this.addDelayVisualization(trainBar, delayInfo, service, trainNumber);
        }
    }
    
    removeDelayElements(trainBar) {
        const existingDelayBar = trainBar.querySelector('.delay-bar');
        const existingCancelX = trainBar.querySelector('.cancel-indicator');
        const existingDelayText = trainBar.querySelector('.delay-text');
        
        if (existingDelayBar) existingDelayBar.remove();
        if (existingCancelX) existingCancelX.remove();
        if (existingDelayText) existingDelayText.remove();
    }
    
    addDelayVisualization(trainBar, delayInfo, service, trainNumber) {
        if (delayInfo.isCanceled || delayInfo.isReplaced) {
            this.addCancellationIndicator(trainBar, delayInfo);
        }
        
        if (delayInfo.delayMinutes && Math.abs(delayInfo.delayMinutes) > 2) {
            this.addDelayBar(trainBar, delayInfo, service);
        }

        this.updateTooltipWithDelay(trainBar, delayInfo, service, trainNumber);
    }
    
    addCancellationIndicator(trainBar, delayInfo) {
        const cancelIndicator = document.createElement('div');
        cancelIndicator.className = 'cancel-indicator';
        cancelIndicator.innerHTML = '✕';
        cancelIndicator.title = delayInfo.isCanceled ? 'Tåget är inställt' : 'Tåget är ersatt';
        
        cancelIndicator.style.cssText = `
            position: absolute;
            top: -15px;
            left: 50%;
            transform: translateX(-50%);
            background: #ff4444;
            color: white;
            border-radius: 50%;
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: bold;
            z-index: 10;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        `;
        
        trainBar.appendChild(cancelIndicator);
    }
    
    addDelayBar(trainBar, delayInfo, service) {
        const delayMinutes = delayInfo.delayMinutes;
        const state = window.AppState;
        
        if (!state || !state.pixelsPerMinute) return;
        
        const delayBar = document.createElement('div');
        delayBar.className = 'delay-bar';
        
        const delayPixels = Math.abs(delayMinutes) * state.pixelsPerMinute;
        const isDelayed = delayMinutes > 0;
        const trainBarWidth = parseInt(trainBar.style.width) || 0;
        
        if (isDelayed) {
            delayBar.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                height: 100%;
                background: rgba(255, 68, 68, 0.85);
                border: 2px solid #ff4444;
                z-index: 5;
                pointer-events: none;
                border-radius: 3px;
                box-shadow: 0 0 4px rgba(0,0,0,0.3);
            `;
            
            if (delayPixels > trainBarWidth) {
                delayBar.style.width = `${delayPixels}px`;
            } else {
                delayBar.style.width = `${Math.min(delayPixels, trainBarWidth)}px`;
            }
            
            const delayText = document.createElement('div');
            delayText.className = 'delay-text';
            delayText.textContent = `+${delayMinutes}min`;
            delayText.style.cssText = `
                position: absolute;
                top: -18px;
                right: -5px;
                background: #ff4444;
                color: white;
                padding: 2px 4px;
                border-radius: 3px;
                font-size: 10px;
                font-weight: bold;
                white-space: nowrap;
                z-index: 15;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            `;
            trainBar.appendChild(delayText);
            
        } else {
            delayBar.style.cssText = `
                position: absolute;
                top: 0;
                right: 0;
                height: 100%;
                width: ${Math.min(delayPixels, trainBarWidth)}px;
                background: rgba(34, 197, 94, 0.85);
                border: 2px solid #22c55e;
                z-index: 5;
                pointer-events: none;
                border-radius: 3px;
                box-shadow: 0 0 4px rgba(0,0,0,0.3);
            `;
            
            const earlyText = document.createElement('div');
            earlyText.className = 'delay-text';
            earlyText.textContent = `${delayMinutes}min`;
            earlyText.style.cssText = `
                position: absolute;
                top: -18px;
                left: -5px;
                background: #22c55e;
                color: white;
                padding: 2px 4px;
                border-radius: 3px;
                font-size: 10px;
                font-weight: bold;
                white-space: nowrap;
                z-index: 15;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            `;
            trainBar.appendChild(earlyText);
        }
        
        trainBar.appendChild(delayBar);
    }
    
    updateTooltipWithDelay(trainBar, delayInfo, service, trainNumber) {
        const originalTitle = trainBar.title || '';
        const lines = originalTitle.split('\n');
        
        const filteredLines = lines.filter(line => 
            !line.includes('Försening:') && 
            !line.includes('Status:') && 
            !line.includes('Beräknad tid:')
        );
        
        const delayLines = [];
        
        if (delayInfo.delayMinutes !== null && Math.abs(delayInfo.delayMinutes) > 2) {
            if (delayInfo.delayMinutes > 0) {
                delayLines.push(`Försening: +${delayInfo.delayMinutes} minuter`);
            } else {
                delayLines.push(`Tidig: ${delayInfo.delayMinutes} minuter`);
            }
        }
        
        if (delayInfo.isCanceled) {
            delayLines.push('Status: INSTÄLLT');
        } else if (delayInfo.isReplaced) {
            delayLines.push('Status: ERSATT');
        }
        
        if (delayInfo.estimatedTime) {
            const estimatedTime = new Date(delayInfo.estimatedTime).toLocaleTimeString('sv-SE', {
                hour: '2-digit',
                minute: '2-digit'
            });
            delayLines.push(`Beräknad tid: ${estimatedTime}`);
        }
        
        if (delayInfo.deviationDescription) {
            delayLines.push(`Info: ${delayInfo.deviationDescription}`);
        }
        
        const newTitle = [...filteredLines, ...delayLines].join('\n');
        trainBar.title = newTitle;
    }

    async forceUpdate() {
        if (this.connectionStatus === 'connected') {
            try {
                const response = await fetch(`${this.apiBaseUrl}/api/update`);
                if (response.ok) {
                    console.log('Forced API update');
                    await this.updateDelayData();
                }
            } catch (error) {
                console.warn('Failed to force update:', error);
            }
        }
    }
    
    getConnectionStatus() {
        return {
            status: this.connectionStatus,
            initialized: this.isInitialized,
            dataCount: this.delayData.size
        };
    }
    
    getDelayInfo(trainNumber) {
        return this.delayData.get(trainNumber) || null;
    }
    
    showDelayData() {
        console.table(Array.from(this.delayData.entries()).map(([trainNumber, info]) => ({
            trainNumber,
            delayMinutes: info.delayMinutes,
            status: info.delayStatus,
            canceled: info.isCanceled,
            replaced: info.isReplaced
        })));
    }
    
    refreshDelays() {
        console.log('Lightly refreshing delay visualizations...');
        this.updateDelayVisualizationOnly(); // Light update only
        console.log(`Delay data available for ${this.delayData.size} trains`);
    }
    
    addTestDelays() {
        console.log('Adding test delays for demonstration...');
        
        this.delayData.set('3591', {
            delayMinutes: 5,
            delayStatus: 'DELAYED',
            isCanceled: false,
            isReplaced: false,
            deviationDescription: 'Test försening',
            estimatedTime: null,
            advertisedTime: null,
            actualTime: null,
            lastUpdated: new Date().toISOString()
        });
        
        this.delayData.set('3500', {
            delayMinutes: -3,
            delayStatus: 'EARLY',
            isCanceled: false,
            isReplaced: false,
            deviationDescription: 'Test tidig ankomst',
            estimatedTime: null,
            advertisedTime: null,
            actualTime: null,
            lastUpdated: new Date().toISOString()
        });
        
        this.delayData.set('3501', {
            delayMinutes: null,
            delayStatus: 'CANCELED',
            isCanceled: true,
            isReplaced: false,
            deviationDescription: 'Test inställt',
            estimatedTime: null,
            advertisedTime: null,
            actualTime: null,
            lastUpdated: new Date().toISOString()
        });
        
        this.delayData.set('3505', {
            delayMinutes: null,
            delayStatus: 'REPLACED',
            isCanceled: false,
            isReplaced: true,
            deviationDescription: 'Test ersatt',
            estimatedTime: null,
            advertisedTime: null,
            actualTime: null,
            lastUpdated: new Date().toISOString()
        });
        
        this.updateDelayVisualizationOnly();
        this.updateConnectionStatusUI();
        
        console.log('Test delays added. Check your trains!');
    }
}

let trainDelayIntegration = null;

let delayIntegrationInitialized = false;

document.addEventListener('DOMContentLoaded', () => {
    if (delayIntegrationInitialized) {
        console.log('Train delay integration already initialized, skipping...');
        return;
    }
    
    setTimeout(() => {
        if (!trainDelayIntegration && !delayIntegrationInitialized) {
            delayIntegrationInitialized = true;
            trainDelayIntegration = new TrainDelayIntegration();
            
            window.trainDelayIntegration = trainDelayIntegration;
            
            setTimeout(() => {
                setupDelayRefreshListeners();
            }, 1000);
            
            console.log('Train delay integration initialized once');
        }
    }, 2000);
});

function setupDelayRefreshListeners() {
    if (!trainDelayIntegration) return;

    document.addEventListener('click', (e) => {
        if (e.target.id === 'cancelButton' || e.target.classList.contains('modal-overlay')) {
            setTimeout(() => {
                trainDelayIntegration.updateDelayVisualizationOnly();
            }, 50);
        }
    });
    
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            trainDelayIntegration.updateDelayVisualizationOnly();
        }, 300);
    });
    
    if (window.MutationObserver) {
        const scheduleGrid = document.getElementById('scheduleGrid');
        if (scheduleGrid) {
            let isUpdating = false;
            
            const observer = new MutationObserver((mutations) => {
                if (isUpdating) return;
                
                let newTrainBars = [];
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        for (let node of mutation.addedNodes) {
                            if (node.classList && node.classList.contains('train-bar')) {
                                if (!node.querySelector('.delay-bar, .cancel-indicator')) {
                                    newTrainBars.push(node);
                                }
                            }
                        }
                    }
                });
                
                if (newTrainBars.length > 0) {
                    isUpdating = true;
                    setTimeout(() => {
                        newTrainBars.forEach(trainBar => {
                            trainDelayIntegration.updateTrainBarWithDelayQuiet(trainBar);
                        });
                        isUpdating = false;
                    }, 20);
                }
            });
            
            observer.observe(scheduleGrid, {
                childList: true,
                subtree: false
            });
            
            console.log('Setup light MutationObserver for new train bars only');
        }
    }
    
    console.log('Setup delay refresh listeners');
}

document.addEventListener('DOMContentLoaded', () => {
    const setupTrainBarHook = () => {
        if (window.createTrainBar && !window.createTrainBar.isHooked) {
            const originalCreateTrainBar = window.createTrainBar;
            
            window.createTrainBar = function(service) {
                const trainBar = originalCreateTrainBar(service);
                
                if (trainBar && trainDelayIntegration && trainDelayIntegration.isInitialized) {
                    trainDelayIntegration.updateTrainBarWithDelay(trainBar);
                }
                
                return trainBar;
            };

            window.createTrainBar.isHooked = true;
            console.log('Train delay integration hooked into createTrainBar');
        }
    };
    
    setupTrainBarHook();
    
    setTimeout(setupTrainBarHook, 1000);
    setTimeout(setupTrainBarHook, 3000);
});

document.addEventListener('DOMContentLoaded', () => {
    const setupLightRenderHook = () => {
        if (window.renderAllTrains && !window.renderAllTrains.isHooked) {
            const originalRenderAllTrains = window.renderAllTrains;
            
            window.renderAllTrains = function() {
                const result = originalRenderAllTrains();
                
                if (trainDelayIntegration && trainDelayIntegration.isInitialized) {
                    setTimeout(() => {
                        trainDelayIntegration.updateDelayVisualizationOnly();
                    }, 10);
                }
                
                return result;
            };
            
            window.renderAllTrains.isHooked = true;
            console.log('Train delay integration lightly hooked into renderAllTrains');
        }
    };
    
    setTimeout(setupLightRenderHook, 3000);
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TrainDelayIntegration;
} 