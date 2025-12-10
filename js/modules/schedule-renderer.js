/**
 * Schedule Renderer - Main orchestrator
 * Refactored for clarity - delegates to specialized modules
 */

window.currentPixelsPerHour = 200;
let cachedTracks = [];
window.cachedTrains = [];
let timelineStart = null;
let userSettings = null;

function initializeSchedule() {
    if (!window.TimeManager) {
        console.error('❌ TimeManager not found!');
        return;
    }
    
    console.log('📅 Initializing schedule...');
    
    window.TimeManager.addListener(handleTimeManagerChange);
    
    loadUserSettings();
    window.addEventListener('settingsChanged', (e) => {
        userSettings = e.detail || userSettings;
        applyTrainColorSettings();
        prepareTrainData();
        renderFullSchedule();
    });
    
    prepareTrackData();
    prepareTrainData();
    renderFullSchedule();
    setupScrollSynchronization();
    startCurrentTimeUpdater();
    
    console.log('✅ Schedule initialized:', cachedTrains.length, 'trains');
}

function prepareTrackData() {
    cachedTracks = trackDefinitions.map(track => ({
        id: parseInt(track.publicTrackNumber),
        name: `Spår ${track.publicTrackNumber}`,
        type: track.properties.includes('regional_platform') ? 'main' : 
              track.properties.includes('commuter_platform') ? 'side' : 'main',
        length: track.totalLengthMeters
    }));
}

function prepareTrainData() {
    const now = new Date();
    
    function parseTimeToDate(timeStr, baseDate) {
        if (!timeStr) return null;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hours, minutes);
    }
    
    const trainData = initialServiceData
        .filter(service => service.trackId >= 1 && service.trackId <= 16)
        .map(service => {
            let arrTime = parseTimeToDate(service.scheduledArrivalTime, now);
            let depTime = parseTimeToDate(service.scheduledDepartureTime, now);
            
            if (arrTime && depTime && depTime < arrTime) {
                depTime = new Date(depTime.getTime() + 24 * 60 * 60 * 1000);
            } else if (!arrTime && depTime) {
                const depHour = parseInt(service.scheduledDepartureTime.split(':')[0]);
                if (depHour >= 0 && depHour < 6) {
                    depTime = new Date(depTime.getTime() + 24 * 60 * 60 * 1000);
                }
            }
            
            let type = 'regional';
            let lengthMeters = 0;
            let baseUnitLengthMeters = 0;
            
            try {
                if (service.trainSet) {
                    lengthMeters = calculateTrainSetLength(service.trainSet) || 0;
                    if (service.trainSet.vehicleTypeID) {
                        const vDef = getVehicleDefinition(service.trainSet.vehicleTypeID);
                        baseUnitLengthMeters = vDef ? (vDef.baseLengthMeters || 0) : 0;
                    } else if (service.trainSet.customComposition && service.trainSet.customComposition.length > 0) {
                        const first = service.trainSet.customComposition[0];
                        const vDefFirst = getVehicleDefinition(first.vehicleTypeID);
                        baseUnitLengthMeters = vDefFirst ? (vDefFirst.baseLengthMeters || 0) : 0;
                    }
                }
            } catch (e) {
                lengthMeters = 0;
            }
            
            const effectiveLengthForColor = (userSettings && userSettings.trainColorDimension === 'total')
                ? lengthMeters
                : (baseUnitLengthMeters || lengthMeters);

            const canonical = (userSettings && Array.isArray(userSettings.canonicalLengths) && userSettings.canonicalLengths.length === 5)
                ? userSettings.canonicalLengths
                : [50, 75, 80, 107, 135];
            const lengthClass = window.ColorUtils.computeNearestBucket(effectiveLengthForColor, canonical);
            
            if (service.trainSet && service.trainSet.vehicleTypeID) {
                const vehicleDef = getVehicleDefinition(service.trainSet.vehicleTypeID);
                if (vehicleDef) {
                    if (vehicleDef.category === 'high_speed') type = 'long-distance';
                    else if (vehicleDef.category === 'commuter') type = 'regional';
                    else if (vehicleDef.category === 'cargo') type = 'freight';
                }
            }
            
            return {
                id: service.id,
                arrivalTrainNumber: service.arrivalTrainNumber || '',
                departureTrainNumber: service.departureTrainNumber || '',
                type: type,
                lengthMeters: lengthMeters,
                lengthClass: lengthClass,
                trackId: service.trackId,
                arrTime: arrTime,
                depTime: depTime,
                origin: service.origin,
                dest: service.destination,
                status: 'on-time',
                hasConflict: false,
                connectedTo: null
            };
        });
    
    trainData.forEach(train => {
        if (train.departureTrainNumber) {
            const connected = trainData.filter(other => 
                other.id !== train.id &&
                other.trackId === train.trackId &&
                other.departureTrainNumber === train.departureTrainNumber &&
                other.departureTrainNumber !== ''
            );
            
            if (connected.length > 0) {
                train.connectedTo = connected.map(t => t.id).join(',');
            }
        }
    });
    
    window.cachedTrains = trainData;
}

function loadUserSettings() {
    const defaults = {
        trainColorMode: 'length',
        trainColorDimension: 'base',
        canonicalLengths: [50, 75, 80, 107, 135],
        lenColors: {
            b1: { bg: null, border: null, text: null },
            b2: { bg: null, border: null, text: null },
            b3: { bg: null, border: null, text: null },
            b4: { bg: null, border: null, text: null },
            b5: { bg: null, border: null, text: null }
        },
        singleColor: { bg: null, border: null, text: null }
    };
    try {
        const saved = localStorage.getItem('sparplannen-settings');
        userSettings = saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch (e) {
        userSettings = defaults;
    }
    applyTrainColorSettings();
}

function applyTrainColorSettings() {
    const root = document.documentElement;
    if (!userSettings) return;
    
    const mode = userSettings.trainColorMode || 'length';
    root.setAttribute('data-train-color-mode', mode === 'single' ? 'single' : 'length');

    const setVar = (name, value) => { if (value) root.style.setProperty(name, value); };
    const lc = userSettings.lenColors || {};
    if (lc.b1) { setVar('--len-b1-bg', lc.b1.bg); setVar('--len-b1-border', lc.b1.border); setVar('--len-b1-text', lc.b1.text); }
    if (lc.b2) { setVar('--len-b2-bg', lc.b2.bg); setVar('--len-b2-border', lc.b2.border); setVar('--len-b2-text', lc.b2.text); }
    if (lc.b3) { setVar('--len-b3-bg', lc.b3.bg); setVar('--len-b3-border', lc.b3.border); setVar('--len-b3-text', lc.b3.text); }
    if (lc.b4) { setVar('--len-b4-bg', lc.b4.bg); setVar('--len-b4-border', lc.b4.border); setVar('--len-b4-text', lc.b4.text); }
    if (lc.b5) { setVar('--len-b5-bg', lc.b5.bg); setVar('--len-b5-border', lc.b5.border); setVar('--len-b5-text', lc.b5.text); }

    const sc = userSettings.singleColor || {};
    setVar('--train-single-bg', sc.bg);
    setVar('--train-single-border', sc.border);
    setVar('--train-single-text', sc.text);
}

function handleTimeManagerChange(event) {
    const { type, state, data } = event;
    
    switch (type) {
        case 'navigate_previous':
        case 'navigate_next':
        case 'jump_to_now':
        case 'range_changed':
            renderFullSchedule();
            break;
            
        case 'following_update':
            if (!timelineStart || !window.currentPixelsPerHour) {
                renderFullSchedule();
                break;
            }
            
            try {
                scrollToViewTime(
                    state.viewTime, 
                    timelineStart, 
                    window.currentPixelsPerHour, 
                    true,
                    state.offsetPercentage
                );
                updateCurrentTimeLine();
            } catch (error) {
                console.error('❌ Following update error:', error);
                renderFullSchedule();
            }
            break;
    }
}

function renderFullSchedule() {
    const state = window.TimeManager.getState();
    const { viewTime, timeRange } = state;
    
    const timelineStartHours = 30;
    const now = new Date();
    
    timelineStart = new Date(now);
    timelineStart.setHours(0, 0, 0, 0);
    
    const timelineEnd = new Date(timelineStart);
    timelineEnd.setHours(timelineEnd.getHours() + timelineStartHours);
    
    const targetViewportWidth = 1400; 
    window.currentPixelsPerHour = targetViewportWidth / timeRange;
    
    const totalCanvasWidth = timelineStartHours * window.currentPixelsPerHour;
    
    const bufferHours = 3;
    const viewWindowStart = new Date(viewTime.getTime() - ((timeRange / 2) + bufferHours) * 60 * 60 * 1000);
    const viewWindowEnd = new Date(viewTime.getTime() + ((timeRange / 2) + bufferHours) * 60 * 60 * 1000);
    
    const visibleTrains = window.cachedTrains.filter(train => {
        if (!train.arrTime && !train.depTime) return false;
        const trainStart = train.arrTime || train.depTime;
        const trainEnd = train.depTime || train.arrTime;
        return trainStart < viewWindowEnd && trainEnd >= viewWindowStart;
    });
    
    const trackLayouts = window.TrainPositioning.calculateTrackLayouts(cachedTracks, visibleTrains);
    
    window.TimelineRenderer.renderTimelineHours(timelineStart, timelineStartHours, window.currentPixelsPerHour);
    window.TimelineRenderer.renderTrackLabels(trackLayouts, cachedTracks);

    if (typeof window.reattachTrackTooltipListeners === 'function') {
        window.reattachTrackTooltipListeners();
    }

    window.TimelineRenderer.renderTimelineGrid(trackLayouts, totalCanvasWidth, window.currentPixelsPerHour);
    window.TrainRenderer.renderTrains(visibleTrains, trackLayouts, timelineStart, window.currentPixelsPerHour, userSettings);
    updateCurrentTimeLine();
    
    scrollToViewTime(viewTime, timelineStart, window.currentPixelsPerHour, state.isFollowingMode, state.offsetPercentage);
    
    const viewWindowHours = timeRange + (bufferHours * 2);
    console.log(`🔄 View: ${viewWindowHours}h (${timeRange}h + ${bufferHours}h buffer)`);
    console.log(`🌙 Trains: ${visibleTrains.length}/${window.cachedTrains.length}`);
    
    if (window.delayIntegration && window.delayIntegration.isInitialized) {
        setTimeout(() => window.delayIntegration.updateAllVisualizations(), 100);
    }
}

function scrollToViewTime(viewTime, timelineStart, pixelsPerHour, isFollowingMode, offsetPercentage) {
    const scheduleWrapper = document.querySelector('.schedule-wrapper');
    if (!scheduleWrapper) return;
    
    const minutesFromMidnight = (viewTime - timelineStart) / 60000;
    const viewTimePosition = (minutesFromMidnight / 60) * pixelsPerHour;
    
    if (isFollowingMode) {
        const viewportWidth = scheduleWrapper.clientWidth;
        const targetPosition = (offsetPercentage / 100) * viewportWidth;
        const scrollLeft = viewTimePosition - targetPosition;
        
        isProgrammaticScroll = true;
        scheduleWrapper.scrollLeft = Math.max(0, scrollLeft);
        setTimeout(() => { isProgrammaticScroll = false; }, 100);
    } else {
        const viewportWidth = scheduleWrapper.clientWidth;
        const scrollLeft = viewTimePosition - (viewportWidth / 2);
        scheduleWrapper.scrollLeft = Math.max(0, scrollLeft);
    }
}

function startCurrentTimeUpdater() {
    updateCurrentTimeLine();
    setInterval(updateCurrentTimeLine, 1000);
}

function updateCurrentTimeLine() {
    if (!window.TimeManager || !timelineStart) return;
    
    const state = window.TimeManager.getState();
    const now = new Date();
    const { offsetPercentage, isFollowingMode } = state;
    
    const timelineCanvas = document.getElementById('timeline-canvas');
    const timelineHours = document.getElementById('timeline-hours');
    
    if (!timelineCanvas || !timelineHours) return;

    let currentTimeLine = document.getElementById('current-time-line');
    if (!currentTimeLine) {
        currentTimeLine = document.createElement('div');
        currentTimeLine.id = 'current-time-line';
        currentTimeLine.className = 'timeline-current-time';
        timelineCanvas.appendChild(currentTimeLine);
    }

    currentTimeLine.style.display = 'block';

    const nowMinutes = (now.getTime() - timelineStart.getTime()) / 60000;
    const linePositionOnCanvas = (nowMinutes / 60) * window.currentPixelsPerHour;

    const canvasHeight = timelineCanvas.offsetHeight;
    currentTimeLine.style.left = `${linePositionOnCanvas}px`;
    currentTimeLine.style.top = '0px';
    currentTimeLine.style.height = `${canvasHeight}px`;

    let timeLabel = timelineHours.querySelector('.current-time-label');
    if (!timeLabel) {
        timeLabel = document.createElement('div');
        timeLabel.className = 'current-time-label';
        timelineHours.appendChild(timeLabel);
    }
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    timeLabel.textContent = `${hours}:${minutes}`;
    
    timeLabel.style.left = `${linePositionOnCanvas}px`;

    if (isFollowingMode) {
        const scheduleWrapper = document.querySelector('.schedule-wrapper');
        if (!scheduleWrapper) return;
        
        const viewportWidth = scheduleWrapper.clientWidth;
        const redLineFixedPositionInViewport = (offsetPercentage / 100) * viewportWidth;
        const desiredScrollLeft = linePositionOnCanvas - redLineFixedPositionInViewport;

        if (Math.abs(scheduleWrapper.scrollLeft - desiredScrollLeft) > 1) {
            isProgrammaticScroll = true;
            scheduleWrapper.scrollLeft = Math.max(0, desiredScrollLeft);
            setTimeout(() => { isProgrammaticScroll = false; }, 100);
        }
    }
}

let isProgrammaticScroll = false;

function setupScrollSynchronization() {
    const scheduleWrapper = document.querySelector('.schedule-wrapper');
    if (!scheduleWrapper) return;

    scheduleWrapper.addEventListener('scroll', () => {
        if (window.TimeManager && window.TimeManager.isFollowingMode && !isProgrammaticScroll) {
            window.TimeManager.deactivateFollowingMode();
        }
    }, { passive: true });

    console.log('✅ Scroll sync ready');
}
