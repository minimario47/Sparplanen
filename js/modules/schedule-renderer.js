/**
 * Schedule Renderer - Main orchestrator
 * Refactored for clarity - delegates to specialized modules
 */

window.currentPixelsPerHour = 200;
let cachedTracks = [];
window.cachedTrains = [];
let timelineStart = null;
let userSettings = null;
let scheduleSelection = null;

function initializeSchedule() {
    if (!window.TimeManager) {
        console.error('❌ TimeManager not found!');
        return;
    }
    
    if (window.__DEBUG_SCHEDULE_RENDER) {
        console.log('📅 Initializing schedule...');
    }
    
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

    window.addEventListener('user-trains-changed', () => {
        prepareTrainData();
        renderFullSchedule();
    });
    window.addEventListener('user-closures-changed', () => {
        renderFullSchedule();
    });
    
    if (window.__DEBUG_SCHEDULE_RENDER) {
        console.log('✅ Schedule initialized:', cachedTrains.length, 'trains');
    }
}

function prepareTrackData() {
    const fmt = typeof formatTrackSignalLengthDisplay === 'function'
        ? formatTrackSignalLengthDisplay
        : (typeof formatTrackLengthDisplay === 'function'
            ? formatTrackLengthDisplay
            : (t) => `${t.totalLengthMeters}m`);
    cachedTracks = trackDefinitions.map(track => ({
        id: parseInt(track.publicTrackNumber),
        name: `Spår ${track.publicTrackNumber}`,
        type: track.properties.includes('regional_platform') ? 'main' :
              track.properties.includes('commuter_platform') ? 'side' : 'main',
        length: track.totalLengthMeters,
        lengthDisplay: fmt(track)
    }));
    window.cachedTracks = cachedTracks;
}

function normalizeTrainSet(trainSet) {
    if (!trainSet || typeof trainSet !== 'object') {
        return { vehicleTypeID: 'X40', count: 1 };
    }
    const copy = { ...trainSet };
    const count = parseInt(copy.count, 10);
    copy.count = Number.isFinite(count) && count > 0 ? count : 1;
    if (!copy.vehicleTypeID && !copy.customComposition) {
        copy.vehicleTypeID = 'X40';
    }
    return copy;
}

function getVehicleCount(trainSet) {
    const count = parseInt(trainSet?.count, 10);
    return Number.isFinite(count) && count > 0 ? count : 1;
}

function formatTimeKey(date) {
    if (!(date instanceof Date)) return '';
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function assignConnectionGroups(trains) {
    const groups = new Map();

    const add = (key, train) => {
        if (!key || !train) return;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(train);
    };

    trains.forEach(train => {
        const track = String(train.trackId);
        const arrNum = String(train.arrivalTrainNumber || '').trim();
        const depNum = String(train.departureTrainNumber || '').trim();
        const arrTime = formatTimeKey(train.arrTime);
        const depTime = formatTimeKey(train.depTime);

        if (arrNum && arrTime) add(`track:${track}:arr:${arrNum}:${arrTime}`, train);
        if (depNum && depTime) add(`track:${track}:dep:${depNum}:${depTime}`, train);

        const startTime = arrTime || depTime;
        if (startTime && (!arrNum || !depNum)) {
            add(`track:${track}:start:${startTime}:partial`, train);
        }
    });

    let groupSeq = 1;
    const seenGroups = [];

    groups.forEach((members) => {
        if (members.length < 2) return;
        const sorted = members.slice().sort((a, b) => {
            const subDiff = (a.subTrackIndex || 0) - (b.subTrackIndex || 0);
            return subDiff || String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
        });

        const hasAdjacentSubRows = sorted.some((train, i) => {
            if (i === 0) return false;
            return Math.abs((train.subTrackIndex || 0) - (sorted[i - 1].subTrackIndex || 0)) <= 1;
        });
        const hasSameNumber = sorted.some((a, i) => sorted.some((b, j) => {
            if (i === j) return false;
            return (a.arrivalTrainNumber && a.arrivalTrainNumber === b.arrivalTrainNumber) ||
                (a.departureTrainNumber && a.departureTrainNumber === b.departureTrainNumber);
        }));

        if (!hasAdjacentSubRows && !hasSameNumber) return;

        const ids = sorted.map(t => String(t.id));
        const groupId = `cg-${groupSeq++}`;
        seenGroups.push({ groupId, ids });
        sorted.forEach(train => {
            const existing = train.connectedTo ? String(train.connectedTo).split(',').filter(Boolean) : [];
            const merged = Array.from(new Set(existing.concat(ids.filter(id => id !== String(train.id)))));
            train.connectedTo = merged.length ? merged.join(',') : null;
            train.connectionGroupId = train.connectionGroupId || groupId;
            train.connectionGroupSize = Math.max(train.connectionGroupSize || 1, sorted.length);
        });
    });

    return seenGroups;
}

function prepareTrainData() {
    const resolved = (window.SparplanenResolve && typeof window.SparplanenResolve.parseScheduleNow === 'function')
        ? window.SparplanenResolve.parseScheduleNow()
        : { usedBundle: false, services: null, anchorStr: null };
    let timeBase;
    if (resolved.usedBundle && resolved.anchorStr) {
        const p = String(resolved.anchorStr).split('-').map(Number);
        timeBase = new Date(p[0], p[1] - 1, p[2], 0, 0, 0, 0);
    } else {
        timeBase = new Date();
    }
    scheduleSelection = {
        week: resolved.week || null,
        day: resolved.day || null,
        anchorStr: resolved.anchorStr || null,
        qaOverride: !!resolved.qaOverride,
        qaTime: resolved.qaTime || null
    };
    window.currentScheduleSelection = scheduleSelection;
    const serviceInput = (resolved.usedBundle && Array.isArray(resolved.services)) ? resolved.services : initialServiceData;
    
    function parseTimeToDate(timeStr, baseDate) {
        if (!timeStr) return null;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hours, minutes);
    }
    
    const trainData = serviceInput
        .filter(service => service.trackId >= 1 && service.trackId <= 16)
        .map(service => {
            let arrTime = parseTimeToDate(service.scheduledArrivalTime, timeBase);
            let depTime = parseTimeToDate(service.scheduledDepartureTime, timeBase);
            
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
            const trainSet = normalizeTrainSet(service.trainSet);
            const vehicleCount = getVehicleCount(trainSet);
            const subTrackIndex = parseInt(service.subTrackIndex, 10);
            
            try {
                if (trainSet) {
                    lengthMeters = calculateTrainSetLength(trainSet) || 0;
                    if (trainSet.vehicleTypeID) {
                        const vDef = getVehicleDefinition(trainSet.vehicleTypeID);
                        baseUnitLengthMeters = vDef ? (vDef.baseLengthMeters || 0) : 0;
                    } else if (trainSet.customComposition && trainSet.customComposition.length > 0) {
                        const first = trainSet.customComposition[0];
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
            
            if (trainSet && trainSet.vehicleTypeID) {
                const vehicleDef = getVehicleDefinition(trainSet.vehicleTypeID);
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
                arrivalLabel: service.arrivalLabel || '',
                departureLabel: service.departureLabel || '',
                type: type,
                lengthMeters: lengthMeters,
                lengthClass: lengthClass,
                trackId: parseInt(service.trackId, 10),
                subTrackIndex: Number.isFinite(subTrackIndex) ? subTrackIndex : 0,
                trainSet,
                vehicleCount,
                arrTime: arrTime,
                depTime: depTime,
                origin: service.origin || '',
                dest: service.destination || '',
                status: 'on-time',
                hasConflict: false,
                connectedTo: null,
                connectionGroupId: null,
                connectionGroupSize: 1,
                movementKind: service.arrivalTrainNumber && service.departureTrainNumber
                    ? 'through'
                    : (service.arrivalTrainNumber ? 'arrival' : (service.departureTrainNumber ? 'departure' : 'operation'))
            };
        });
    
    const userTrains = (window.UserTrainsStore && typeof window.UserTrainsStore.getAll === 'function')
        ? window.UserTrainsStore.getAll()
        : [];

    const mergedTrains = trainData.concat(userTrains.map(serviceLikeToTrain).filter(Boolean));
    assignConnectionGroups(mergedTrains);

    window.cachedTrains = mergedTrains;
}

/**
 * Map a user-added service-shaped record (from UserTrainsStore) into the
 * same "train" object shape that prepareTrainData produces, so the renderer
 * can treat user trains identically.
 */
function serviceLikeToTrain(service) {
    if (!service || typeof service !== 'object') return null;
    const now = new Date();

    const parseTimeToDate = (timeStr) => {
        if (!timeStr) return null;
        const [hours, minutes] = String(timeStr).split(':').map(Number);
        if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
    };

    let arrTime = parseTimeToDate(service.scheduledArrivalTime);
    let depTime = parseTimeToDate(service.scheduledDepartureTime);

    if (arrTime && depTime && depTime < arrTime) {
        depTime = new Date(depTime.getTime() + 24 * 60 * 60 * 1000);
    } else if (!arrTime && depTime) {
        const depHour = parseInt(String(service.scheduledDepartureTime).split(':')[0], 10);
        if (depHour >= 0 && depHour < 6) {
            depTime = new Date(depTime.getTime() + 24 * 60 * 60 * 1000);
        }
    }

    if (!arrTime && !depTime) return null;

    let lengthMeters = 0;
    let baseUnitLengthMeters = 0;
    let type = 'regional';
    const trainSet = normalizeTrainSet(service.trainSet);
    const vehicleCount = getVehicleCount(trainSet);
    const subTrackIndex = parseInt(service.subTrackIndex, 10);

    try {
        if (trainSet && typeof calculateTrainSetLength === 'function') {
            lengthMeters = calculateTrainSetLength(trainSet) || 0;
        }
        if (trainSet && trainSet.vehicleTypeID && typeof getVehicleDefinition === 'function') {
            const vDef = getVehicleDefinition(trainSet.vehicleTypeID);
            if (vDef) {
                baseUnitLengthMeters = vDef.baseLengthMeters || 0;
                if (vDef.category === 'high_speed') type = 'long-distance';
                else if (vDef.category === 'commuter') type = 'regional';
                else if (vDef.category === 'cargo') type = 'freight';
            }
        }
    } catch (_) { /* ignore vehicle resolution failures */ }

    const dimension = (userSettings && userSettings.trainColorDimension === 'total')
        ? lengthMeters
        : (baseUnitLengthMeters || lengthMeters);

    const canonical = (userSettings && Array.isArray(userSettings.canonicalLengths) && userSettings.canonicalLengths.length === 5)
        ? userSettings.canonicalLengths
        : [50, 75, 80, 107, 135];

    const lengthClass = (window.ColorUtils && typeof window.ColorUtils.computeNearestBucket === 'function')
        ? window.ColorUtils.computeNearestBucket(dimension, canonical)
        : 'b1';

    return {
        id: service.id,
        arrivalTrainNumber: service.arrivalTrainNumber || '',
        departureTrainNumber: service.departureTrainNumber || '',
        arrivalLabel: service.arrivalLabel || '',
        departureLabel: service.departureLabel || '',
        type,
        lengthMeters,
        lengthClass,
        trackId: parseInt(service.trackId, 10),
        subTrackIndex: Number.isFinite(subTrackIndex) ? subTrackIndex : 0,
        trainSet,
        vehicleCount,
        arrTime,
        depTime,
        origin: service.origin || '',
        dest: service.destination || '',
        status: 'on-time',
        hasConflict: false,
        connectedTo: null,
        connectionGroupId: null,
        connectionGroupSize: 1,
        userAdded: true,
        kind: service.kind || 'train',
        movementKind: service.arrivalTrainNumber && service.departureTrainNumber
            ? 'through'
            : (service.arrivalTrainNumber ? 'arrival' : (service.departureTrainNumber ? 'departure' : 'operation'))
    };
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
        singleColor: { bg: null, border: null, text: null },
        hoverTooltipEnabled: true
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
    let { viewTime, timeRange } = state;
    
    const timelineStartHours = 30;
    const now = scheduleSelection?.anchorStr
        ? (() => {
            const p = String(scheduleSelection.anchorStr).split('-').map(Number);
            return new Date(p[0], p[1] - 1, p[2], 0, 0, 0, 0);
        })()
        : new Date();

    if (scheduleSelection?.qaOverride && scheduleSelection.anchorStr) {
        const [h, m] = String(scheduleSelection.qaTime || '19:00').split(':').map(Number);
        if (Number.isFinite(h) && Number.isFinite(m)) {
            viewTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
        }
    }
    
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
    if (window.ClosureRenderer) {
        window.ClosureRenderer.render(
            trackLayouts,
            timelineStart,
            window.currentPixelsPerHour,
            viewWindowStart,
            viewWindowEnd
        );
    }
    updateCurrentTimeLine();
    
    scrollToViewTime(viewTime, timelineStart, window.currentPixelsPerHour, state.isFollowingMode, state.offsetPercentage);
    
    if (window.__DEBUG_SCHEDULE_RENDER) {
        const viewWindowHours = timeRange + (bufferHours * 2);
        console.log(`🔄 View: ${viewWindowHours}h (${timeRange}h + ${bufferHours}h buffer)`);
        console.log(`🌙 Trains: ${visibleTrains.length}/${window.cachedTrains.length}`);
    }
    
    if (window.delayIntegration && window.delayIntegration.isInitialized) {
        setTimeout(() => window.delayIntegration.updateAllVisualizations(), 100);
    }

    window.scheduleState = {
        timelineStart,
        pixelsPerHour: window.currentPixelsPerHour,
        trackLayouts,
        viewWindowStart,
        viewWindowEnd
    };
    window.dispatchEvent(new CustomEvent('schedule:rendered'));
}

window.scheduleRenderer = window.scheduleRenderer || {};
window.scheduleRenderer.refresh = function refreshSchedule() {
    renderFullSchedule();
};

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

let cachedCanvasHeight = 0;

function startCurrentTimeUpdater() {
    const canvas = document.getElementById('timeline-canvas');
    if (canvas && typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(entries => {
            cachedCanvasHeight = entries[0].contentRect.height;
        }).observe(canvas);
        cachedCanvasHeight = canvas.offsetHeight;
    }
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

    const canvasHeight = cachedCanvasHeight || timelineCanvas.offsetHeight;
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
