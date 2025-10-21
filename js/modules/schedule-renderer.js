/**
 * Schedule Renderer - Displays tracks, timeline, and trains
 * Integrated with TimeManager for dynamic time navigation
 */

window.currentPixelsPerHour = 200; // Make globally accessible for delay visualization
let cachedTracks = [];
window.cachedTrains = []; // Make globally accessible for delay integration
let timelineStart = null; // Global timeline start (midnight)
let userSettings = null; // Settings impacting rendering (colors, buckets)

function initializeSchedule() {
    if (!window.TimeManager) {
        console.error('❌ TimeManager not found! Schedule cannot initialize.');
        return;
    }
    
    console.log('📅 Initializing schedule renderer...');
    
    // Listen to TimeManager state changes
    window.TimeManager.addListener(handleTimeManagerChange);
    
    // Load visual settings (train coloring, buckets) and listen to changes
    loadUserSettings();
    window.addEventListener('settingsChanged', (e) => {
        console.log('🔄 settingsChanged event received:', e.detail);
        userSettings = e.detail || userSettings;
        applyTrainColorSettings();
        // Rebuild train data to recalculate buckets if needed
        prepareTrainData();
        // Force full re-render
        window.cachedTrains = [];
        cachedTracks = [];
        prepareTrackData();
        prepareTrainData();
        renderFullSchedule();
        console.log('✅ Settings applied and schedule re-rendered');
    });
    
    // Prepare data
    prepareTrackData();
    prepareTrainData();
    
    // Initial render
    renderFullSchedule();
    
    // Set up scroll synchronization
    setupScrollSynchronization();
    
    // Start current time updater
    startCurrentTimeUpdater();
    
    console.log('✅ Schedule initialized with', cachedTrains.length, 'trains on', cachedTracks.length, 'tracks');
}

/**
 * Prepare track data from tracks.js
 */
function prepareTrackData() {
    // Show all tracks from tracks.js (16 tracks)
    cachedTracks = trackDefinitions.map(track => ({
        id: parseInt(track.publicTrackNumber),
        name: `Spår ${track.publicTrackNumber}`,
        type: track.properties.includes('regional_platform') ? 'main' : 
              track.properties.includes('commuter_platform') ? 'side' : 'main',
        length: track.totalLengthMeters
    }));
}

/**
 * Prepare train data from trains.js
 */
function prepareTrainData() {
    const now = new Date();
    
    // Parse time string "HH:MM" and create Date object
    function parseTimeToDate(timeStr, baseDate) {
        if (!timeStr) return null;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hours, minutes);
    }
    
    // Convert service data to display format (all tracks 1-16)
    const trainData = initialServiceData
        .filter(service => service.trackId >= 1 && service.trackId <= 16)
        .map(service => {
            let arrTime = parseTimeToDate(service.scheduledArrivalTime, now);
            let depTime = parseTimeToDate(service.scheduledDepartureTime, now);
            
            // Handle trains that cross midnight
            // Logic: If a train arrives at 23:33 and departs at 00:03, the departure is NEXT day
            //        If a train has only arrival time in early morning (00:00-05:59), it's from previous day
            if (arrTime && depTime) {
                // Both times exist - check if departure is before arrival in clock time
                if (depTime < arrTime) {
                    // Departure time is numerically smaller (e.g. arr=23:33, dep=00:03)
                    // This means departure is NEXT day
                    const oldDep = depTime.toTimeString().substring(0, 5);
                    depTime = new Date(depTime.getTime() + 24 * 60 * 60 * 1000);
                    console.log(`🌙 Tåg ${service.arrivalTrainNumber || '?'}→${service.departureTrainNumber || '?'} går över midnatt: arr ${service.scheduledArrivalTime} → dep ${oldDep} (avgång justerad till nästa dag)`);
                }
                // Normal case: arrival before departure on same day - do nothing
            } else if (arrTime && !depTime) {
                // Arrival only - check if it's early morning (00:00-05:59)
                // These trains likely arrived late night and stay until morning
                const arrHour = parseInt(service.scheduledArrivalTime.split(':')[0]);
                if (arrHour >= 0 && arrHour < 6) {
                    // Don't add 24h here - it's a terminus train that arrived early morning
                    // Keep original time
                    console.log(`🌙 Tåg ${service.arrivalTrainNumber || '?'} anländer tidigt på morgonen: ${service.scheduledArrivalTime} (stannar på spår)`);
                }
            } else if (!arrTime && depTime) {
                // Departure only - check if it's early morning (00:00-05:59)
                // These trains start their journey in the morning
                const depHour = parseInt(service.scheduledDepartureTime.split(':')[0]);
                if (depHour >= 0 && depHour < 6) {
                    // Add 24h to show it's next day
                    depTime = new Date(depTime.getTime() + 24 * 60 * 60 * 1000);
                    console.log(`🌙 Tåg ${service.departureTrainNumber || '?'} avgår tidigt nästa morgon: ${service.scheduledDepartureTime} (avgång nästa dag)`);
                }
            }
            
            let type = 'regional';
            let lengthMeters = 0; // total consist length (for info)
            let baseUnitLengthMeters = 0; // vehicle base length (for coloring if chosen)
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
            // Determine effective length for coloring (base unit vs total consist)
            const effectiveLengthForColor = (userSettings && userSettings.trainColorDimension === 'total')
                ? lengthMeters
                : (baseUnitLengthMeters || lengthMeters);

            // Compute 5-length bucket by nearest canonical lengths (user-configurable)
            const canonical = (userSettings && Array.isArray(userSettings.canonicalLengths) && userSettings.canonicalLengths.length === 5)
                ? userSettings.canonicalLengths
                : [50, 75, 80, 107, 135];
            const lengthClass = computeNearestBucket(effectiveLengthForColor, canonical);
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
                connectedTo: null // Add this for future connection support
            };
        });
    
    // CASE 5: Detect connected trains (same departure number on same track)
    trainData.forEach(train => {
        if (train.departureTrainNumber) {
            // Find other trains with the same departure number on the same track
            const connected = trainData.filter(other => 
                other.id !== train.id &&
                other.trackId === train.trackId &&
                other.departureTrainNumber === train.departureTrainNumber &&
                other.departureTrainNumber !== ''
            );
            
            if (connected.length > 0) {
                // Mark this train as connected
                train.connectedTo = connected.map(t => t.id).join(',');
                console.log(`🔗 Kopplat tåg: ${train.arrivalTrainNumber} → ${train.departureTrainNumber} (spår ${train.trackId})`);
            }
        }
    });
    
    window.cachedTrains = trainData;
}

/**
 * Load user settings from localStorage or fall back to defaults
 */
function loadUserSettings() {
    const defaults = {
        trainColorMode: 'length', // 'length' | 'single'
        trainColorDimension: 'base', // 'base' | 'total'
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

/**
 * Apply train coloring settings to DOM (data attributes and CSS variables)
 */
function applyTrainColorSettings() {
    const root = document.documentElement;
    if (!userSettings) return;
    // Data attribute for single color mode
    const mode = userSettings.trainColorMode || 'length';
    root.setAttribute('data-train-color-mode', mode === 'single' ? 'single' : 'length');

    // Custom colors for buckets (if provided)
    const setVar = (name, value) => { if (value) root.style.setProperty(name, value); };
    const lc = userSettings.lenColors || {};
    if (lc.b1) { setVar('--len-b1-bg', lc.b1.bg); setVar('--len-b1-border', lc.b1.border); setVar('--len-b1-text', lc.b1.text); }
    if (lc.b2) { setVar('--len-b2-bg', lc.b2.bg); setVar('--len-b2-border', lc.b2.border); setVar('--len-b2-text', lc.b2.text); }
    if (lc.b3) { setVar('--len-b3-bg', lc.b3.bg); setVar('--len-b3-border', lc.b3.border); setVar('--len-b3-text', lc.b3.text); }
    if (lc.b4) { setVar('--len-b4-bg', lc.b4.bg); setVar('--len-b4-border', lc.b4.border); setVar('--len-b4-text', lc.b4.text); }
    if (lc.b5) { setVar('--len-b5-bg', lc.b5.bg); setVar('--len-b5-border', lc.b5.border); setVar('--len-b5-text', lc.b5.text); }

    // Single-color variables
    const sc = userSettings.singleColor || {};
    setVar('--train-single-bg', sc.bg);
    setVar('--train-single-border', sc.border);
    setVar('--train-single-text', sc.text);
}

/**
 * Map a numeric length to one of five buckets b1..b5 by nearest canonical
 */
function computeNearestBucket(value, canonicalArray) {
    if (!Array.isArray(canonicalArray) || canonicalArray.length !== 5) return 'b3';
    let nearestIdx = 0;
    let nearestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < canonicalArray.length; i++) {
        const dist = Math.abs(value - canonicalArray[i]);
        if (dist < nearestDist) { nearestDist = dist; nearestIdx = i; }
    }
    // Buckets: index 0..4 => b1..b5
    return 'b' + (nearestIdx + 1);
}

/**
 * Apply dynamic text contrast to ensure WCAG AA compliance (4.5:1)
 * Reads actual background color and sets text to black or white for best contrast
 * ONLY applies if user hasn't set a custom text color in settings
 */
function applyDynamicTextContrast(trainElement) {
    if (!trainElement) return;
    
    const visual = trainElement.querySelector('.train-bar-visual');
    const numbers = trainElement.querySelector('.train-numbers');
    if (!visual || !numbers) return;
    
    try {
        // Check if user has set custom text color in settings
        const bucket = trainElement.dataset.bucket;
        const colorMode = userSettings.trainColorMode || 'length';
        
        let hasCustomTextColor = false;
        
        if (colorMode === 'single') {
            // Check if user set a custom text color for single mode
            hasCustomTextColor = userSettings.singleColor && userSettings.singleColor.text && userSettings.singleColor.text.startsWith('#');
        } else if (bucket) {
            // Check if user set a custom text color for this bucket
            hasCustomTextColor = userSettings.lenColors && 
                                 userSettings.lenColors[bucket] && 
                                 userSettings.lenColors[bucket].text && 
                                 userSettings.lenColors[bucket].text.startsWith('#');
        }
        
        // If user has set a custom text color, respect it and don't override
        if (hasCustomTextColor) {
            return;
        }
        
        // Otherwise, calculate optimal contrast automatically
        // Get computed background color
        const styles = getComputedStyle(visual);
        const bgColor = styles.backgroundColor;
        const borderColor = styles.borderColor;
        
        // Calculate luminance
        const bgLum = getRelativeLuminance(bgColor);
        const borderLum = getRelativeLuminance(borderColor);
        
        // Use the darker of bg/border for conservative calculation
        const effectiveLum = Math.min(bgLum, borderLum);
        
        // Calculate contrast ratios
        const whiteLum = 1.0;
        const blackLum = 0.0;
        const whiteContrast = getContrastRatio(effectiveLum, whiteLum);
        const blackContrast = getContrastRatio(effectiveLum, blackLum);
        
        // Choose color with best contrast (prefer white if both are similar)
        const useWhite = whiteContrast >= 4.5 || (whiteContrast > blackContrast && blackContrast < 4.5);
        const textColor = useWhite ? '#ffffff' : '#000000';
        
        // Apply inline (overrides CSS for custom colors)
        numbers.style.color = textColor;
        
    } catch (e) {
        console.warn('Error applying dynamic contrast:', e);
    }
}

/**
 * Get relative luminance from CSS color string (WCAG 2.1 formula)
 */
function getRelativeLuminance(colorString) {
    if (!colorString || colorString === 'transparent') return 0.5;
    
    const rgb = parseColorToRGB(colorString);
    if (!rgb) return 0.5;
    
    // Convert to 0-1 range
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    
    // Apply sRGB companding
    const rsRGB = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
    const gsRGB = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
    const bsRGB = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
    
    // Calculate relative luminance
    return 0.2126 * rsRGB + 0.7152 * gsRGB + 0.0722 * bsRGB;
}

/**
 * Parse CSS color string to RGB object
 */
function parseColorToRGB(colorString) {
    // Match rgb(r, g, b) or rgba(r, g, b, a)
    const rgbMatch = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
        return { r: parseInt(rgbMatch[1]), g: parseInt(rgbMatch[2]), b: parseInt(rgbMatch[3]) };
    }
    
    // Match hex #RRGGBB or #RGB
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
}

/**
 * Calculate WCAG contrast ratio between two luminance values
 */
function getContrastRatio(lum1, lum2) {
    const L1 = Math.max(lum1, lum2);
    const L2 = Math.min(lum1, lum2);
    return (L1 + 0.05) / (L2 + 0.05);
}

/**
 * Handle TimeManager state changes
 */
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
            // In following mode, only scroll the view - DON'T re-render everything
            // This preserves user state (selected trains, tooltips, open modals, etc.)
            console.log('🔄 [Following Mode Update] Triggered at', new Date().toLocaleTimeString());
            console.log('   - timelineStart:', timelineStart ? 'defined' : 'UNDEFINED');
            console.log('   - currentPixelsPerHour:', window.currentPixelsPerHour || 'UNDEFINED');
            console.log('   - state.viewTime:', state?.viewTime);
            
            // Check if schedule has been rendered (timelineStart exists)
            if (!timelineStart || !window.currentPixelsPerHour) {
                console.warn('⚠️ Following mode update but schedule not yet rendered - doing full render');
                renderFullSchedule();
                break;
            }
            
            const strategy = data?.strategy || 'smooth';
            console.log('🔄 Following mode update - scrolling view WITHOUT re-render (strategy:', strategy + ')');
            
            try {
                scrollToViewTime(
                    state.viewTime, 
                    timelineStart, 
                    window.currentPixelsPerHour, 
                    true, // isFollowingMode
                    state.offsetPercentage
                );
                console.log('   ✅ Scroll completed successfully');
                
                // Update the current time line position
                updateCurrentTimeLine();
                console.log('   ✅ Time line updated successfully');
                console.log('   ✅ Following mode update complete - NO PAGE RELOAD');
            } catch (error) {
                console.error('❌ Error during following mode update:', error);
                console.error('   Error stack:', error.stack);
                // Fall back to full render if something goes wrong
                console.warn('⚠️ Falling back to full render due to error');
                renderFullSchedule();
            }
            break;
    }
}

/**
 * Render the complete schedule based on TimeManager state
 * Timeline is now CONTINUOUS - timeRange is zoom level, not boundary
 */
function renderFullSchedule() {
    const state = window.TimeManager.getState();
    const { viewTime, timeRange } = state;
    
    // CONTINUOUS TIMELINE: Create a 30-hour canvas to handle trains crossing midnight
    // 00:00 today -> 06:00 tomorrow (to show late-night trains that extend into next day)
    const timelineStartHours = 30; // Extended to 30 hours to handle overnight trains
    const now = new Date();
    
    // Timeline base starts at midnight of today
    timelineStart = new Date(now);
    timelineStart.setHours(0, 0, 0, 0);
    
    // Timeline extends for 30 hours (to 06:00 next day)
    const timelineEnd = new Date(timelineStart);
    timelineEnd.setHours(timelineEnd.getHours() + timelineStartHours);
    
    const targetViewportWidth = 1400; 
    window.currentPixelsPerHour = targetViewportWidth / timeRange;
    
    const totalCanvasWidth = timelineStartHours * window.currentPixelsPerHour;
    
    // --- NEW: Pre-calculate track layouts and heights ---
    const trackLayouts = calculateTrackLayouts(cachedTracks, window.cachedTrains);
    
    // Filter trains to show all trains that overlap with the extended timeline
    const allTrains = window.cachedTrains.filter(train => {
        if (!train.arrTime && !train.depTime) return false;
        const trainStart = train.arrTime || train.depTime;
        const trainEnd = train.depTime || train.arrTime;
        // Show train if it starts before timeline ends AND ends after timeline starts
        return trainStart < timelineEnd && trainEnd >= timelineStart;
    });
    
    // Render components with FULL timeline and dynamic layouts
    renderTimelineHours(timelineStart, timelineStartHours, window.currentPixelsPerHour);
    renderTrackLabels(trackLayouts);

    // Re-attach track tooltip listeners after rendering
    if (typeof window.reattachTrackTooltipListeners === 'function') {
        window.reattachTrackTooltipListeners();
    }

    renderTimelineGrid(trackLayouts, totalCanvasWidth);
    renderTrains(allTrains, trackLayouts, timelineStart, window.currentPixelsPerHour);
    updateCurrentTimeLine();
    
    scrollToViewTime(viewTime, timelineStart, window.currentPixelsPerHour, state.isFollowingMode, state.offsetPercentage);
    
    // Log rendering statistics with case information
    const caseStats = analyzeCases(allTrains);
    console.log(`🔄 Schedule rendered: ${timelineStartHours}h timeline (00:00-06:00+1), zoomed to ${timeRange}h view`);
    console.log(`📊 Tåg statistik:`, caseStats);
    console.log(`🎯 Max samtidiga tåg per spår:`, caseStats.maxTrainsOnTrack);
    console.log(`✅ Dynamisk höjd: Varje tåg får korrekt höjd baserat på sina verkliga överlapp i tid`);
    console.log(`🌙 Tåg som visas: ${allTrains.length} av ${window.cachedTrains.length} (inkl. tåg över midnatt)`);
    
    // Apply delay visualizations after trains are rendered
    if (window.delayIntegration && window.delayIntegration.isInitialized) {
        setTimeout(() => {
            window.delayIntegration.updateAllVisualizations();
        }, 100); // Small delay to ensure DOM is fully updated
    }
}

/**
 * Analyzes train data to identify which of the 10 railway cases are present.
 * Returns statistics about the current train layout for debugging and monitoring.
 */
function analyzeCases(trains) {
    const stats = {
        total: trains.length,
        byType: { regional: 0, 'long-distance': 0, freight: 0 },
        byStatus: { 'on-time': 0, delayed: 0, conflict: 0 },
        cases: {
            arrivalOnly: 0,      // Case 8
            departureOnly: 0,    // Case 9
            veryShort: 0,        // Case 7 (< 5 min duration)
            connected: 0,        // Case 5
            delayed: 0,          // Case 10
            conflict: 0          // Case 6
        },
        tracksWithMultiple: 0,   // Cases 2, 3, 4
        maxTrainsOnTrack: 0
    };

    // Analyze each train
    trains.forEach(train => {
        // Count by type
        if (train.type) stats.byType[train.type]++;
        
        // Count by status
        if (train.status) stats.byStatus[train.status]++;
        
        // Case 8: Arrival only
        if (train.arrivalTrainNumber && !train.departureTrainNumber) {
            stats.cases.arrivalOnly++;
        }
        
        // Case 9: Departure only
        if (!train.arrivalTrainNumber && train.departureTrainNumber) {
            stats.cases.departureOnly++;
        }
        
        // Case 7: Very short duration (< 10 minutes)
        if (train.arrTime && train.depTime) {
            const duration = (train.depTime - train.arrTime) / (1000 * 60);
            if (duration < 10) stats.cases.veryShort++;
        }
        
        // Case 5: Connected trains
        if (train.connectedTo) stats.cases.connected++;
        
        // Case 10: Delayed
        if (train.status === 'delayed') stats.cases.delayed++;
        
        // Case 6: Conflict
        if (train.status === 'conflict') stats.cases.conflict++;
    });

    // Analyze track occupancy (Cases 1, 2, 3, 4)
    const trainsByTrack = trains.reduce((acc, train) => {
        acc[train.trackId] = (acc[train.trackId] || 0) + 1;
        return acc;
    }, {});
    
    Object.values(trainsByTrack).forEach(count => {
        if (count > 1) stats.tracksWithMultiple++;
        if (count > stats.maxTrainsOnTrack) stats.maxTrainsOnTrack = count;
    });

    return stats;
}

/**
 * Pre-calculates the vertical layout (height and top position) for each track.
 * Height is based on the MAXIMUM number of SIMULTANEOUSLY overlapping trains at any point in time.
 * 
 * CRITICAL: This calculates TIME-BASED overlaps, not total train count per day!
 */
function calculateTrackLayouts(tracks, trains) {
    const layouts = [];
    let currentTop = 0;

    const getTrackHeight = (maxSimultaneous) => {
        // Smaller heights to fit all 16 tracks on screen
        if (maxSimultaneous === 1) return 48;
        if (maxSimultaneous === 2) return 48;
        if (maxSimultaneous === 3) return 52;
        if (maxSimultaneous === 4) return 56;
        return 60;
    };

    // Group trains by track
    const trainsByTrack = trains.reduce((acc, train) => {
        acc[train.trackId] = acc[train.trackId] || [];
        acc[train.trackId].push(train);
        return acc;
    }, {});
    
    tracks.forEach(track => {
        const trackTrains = trainsByTrack[track.id] || [];
        
        // Calculate the MAXIMUM simultaneous overlap for this track
        const maxOverlapping = calculateMaxSimultaneousTrains(trackTrains);
        const height = getTrackHeight(maxOverlapping);
        
        layouts.push({
            id: track.id,
            top: currentTop,
            height: height
        });
        
        currentTop += height;
    });
    
    return layouts;
}

/**
 * Calculates the maximum number of trains that overlap at any single point in time.
 * This is the key to dynamic height calculation!
 * 
 * Example: If 5 trains exist on a track but only 2 ever overlap, returns 2.
 */
function calculateMaxSimultaneousTrains(trains) {
    if (trains.length === 0) return 0;
    if (trains.length === 1) return 1;
    
    // Create events for all train arrivals and departures
    const events = [];
    trains.forEach(train => {
        if (train.arrTime) events.push({ time: train.arrTime, type: 'arrive' });
        if (train.depTime) events.push({ time: train.depTime, type: 'depart' });
    });
    
    // Sort events by time
    events.sort((a, b) => a.time - b.time);
    
    // Sweep through events to find maximum overlap
    let current = 0;
    let maximum = 0;
    
    events.forEach(event => {
        if (event.type === 'arrive') {
            current++;
            maximum = Math.max(maximum, current);
        } else {
            current--;
        }
    });
    
    return maximum;
}

/**
 * Scroll the timeline to show the viewTime at the appropriate position
 */
function scrollToViewTime(viewTime, timelineStart, pixelsPerHour, isFollowingMode, offsetPercentage) {
    const scheduleWrapper = document.querySelector('.schedule-wrapper');
    if (!scheduleWrapper) return;
    
    // Calculate where viewTime is on the timeline
    const minutesFromMidnight = (viewTime - timelineStart) / 60000;
    const viewTimePosition = (minutesFromMidnight / 60) * pixelsPerHour;
    
    if (isFollowingMode) {
        // In follow mode, position viewTime at the offset percentage
        const viewportWidth = scheduleWrapper.clientWidth;
        const targetPosition = (offsetPercentage / 100) * viewportWidth;
        const scrollLeft = viewTimePosition - targetPosition;
        
        isProgrammaticScroll = true;
        scheduleWrapper.scrollLeft = Math.max(0, scrollLeft);
        setTimeout(() => { isProgrammaticScroll = false; }, 100);
    } else {
        // In manual mode, center the viewTime in the viewport
        const viewportWidth = scheduleWrapper.clientWidth;
        const scrollLeft = viewTimePosition - (viewportWidth / 2);
        
        scheduleWrapper.scrollLeft = Math.max(0, scrollLeft);
    }
}

function formatTime(date) {
    return date.toTimeString().substring(0, 5);
}

/**
 * Render timeline hours across the FULL continuous timeline
 */
function renderTimelineHours(timelineStart, totalHours, pixelsPerHour) {
    const timelineHours = document.getElementById('timeline-hours');
    if (!timelineHours) return;
    
    timelineHours.innerHTML = '';
    
    // Set total width to match full timeline canvas
    const totalWidth = totalHours * pixelsPerHour;
    timelineHours.style.width = totalWidth + 'px';
    timelineHours.style.position = 'relative';
    
    const currentHour = new Date().getHours();
    
    // Render hour marker for each hour in the timeline
    for (let i = 0; i <= totalHours; i++) {
        const hourTime = new Date(timelineStart);
        hourTime.setHours(hourTime.getHours() + i);
        const hour = hourTime.getHours();
        
        const leftPosition = i * pixelsPerHour;
        
        const hourDiv = document.createElement('div');
        hourDiv.className = 'timeline-hour' + (hour === currentHour ? ' current' : '');
        hourDiv.style.position = 'absolute';
        hourDiv.style.left = leftPosition + 'px';
        hourDiv.style.width = pixelsPerHour + 'px';
        hourDiv.innerHTML = `<span class="timeline-hour-label">${hour.toString().padStart(2, '0')}:00</span>`;
        
        timelineHours.appendChild(hourDiv);
    }
}

function renderTrackLabels(trackLayouts) {
    const trackLabels = document.getElementById('track-labels');
    trackLabels.innerHTML = '';
    
    trackLayouts.forEach(layout => {
        const trackDiv = document.createElement('div');
        trackDiv.className = 'track-row';
        trackDiv.style.height = `${layout.height}px`;

        const trackInfo = cachedTracks.find(t => t.id === layout.id);
        if (!trackInfo) return;

        trackDiv.innerHTML = `
            <div class="track-content">
                <div class="track-name">${trackInfo.name}</div>
                <div class="track-info">
                    <span class="track-length">
                        <span class="track-length-icon"></span>
                        ${trackInfo.length}m
                    </span>
                </div>
            </div>
        `;
        trackLabels.appendChild(trackDiv);
    });
}

function renderTimelineGrid(trackLayouts, totalWidth) {
    const timelineCanvas = document.getElementById('timeline-canvas');
    if (!timelineCanvas) return;

    // Clear previous track rows and grid lines, but preserve the current time line
    const currentTimeLine = document.getElementById('current-time-line');
    const existingTrackRows = timelineCanvas.querySelectorAll('.timeline-track-row');
    existingTrackRows.forEach(row => row.remove());

    const totalHeight = trackLayouts.length > 0 ? trackLayouts[trackLayouts.length - 1].top + trackLayouts[trackLayouts.length - 1].height : 0;
    
    timelineCanvas.style.width = totalWidth + 'px';
    timelineCanvas.style.height = totalHeight + 'px';
    
    // Total hours is inferred from totalWidth and pixelsPerHour
    const totalHours = totalWidth / window.currentPixelsPerHour;

    // Add track row backgrounds and their internal grid lines
    trackLayouts.forEach(layout => {
        const trackRow = document.createElement('div');
        trackRow.className = 'timeline-track-row';
        trackRow.style.top = `${layout.top}px`;
        trackRow.style.height = `${layout.height}px`;
        trackRow.style.width = '100%';
        trackRow.style.position = 'absolute';

        // Draw grid lines every 15 minutes inside this track row
        const totalQuarterHours = totalHours * 4;
        for (let i = 0; i <= totalQuarterHours; i++) {
            const gridLine = document.createElement('div');
            gridLine.className = 'grid-line';
            const leftPercentage = (i / totalQuarterHours) * 100;
            gridLine.style.left = `${leftPercentage}%`;

            // Add extra styling for hour lines (every 4 quarter-hours = 1 hour)
            if (i % 4 === 0) {
                gridLine.className = 'grid-line grid-line-hour'; // Add hour class
                gridLine.style.opacity = '1'; // Full opacity for hour lines
                gridLine.style.width = '4px';
                gridLine.style.backgroundColor = 'var(--neutral-400)'; // Darker for hour lines
            }

            trackRow.appendChild(gridLine);
        }

        timelineCanvas.appendChild(trackRow);
    });
}

/**
 * ═══════════════════════════════════════════════════════════════════════
 * TRAIN RENDERING ENGINE - Complete Implementation of 10 Railway Cases
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * This function renders trains with complete support for all operational
 * scenarios found in real railway dispatch systems. Each case has been
 * carefully designed based on railway signaling standards and dispatcher needs.
 * 
 * ───────────────────────────────────────────────────────────────────────
 * 📋 THE 10 CASES EXPLAINED:
 * ───────────────────────────────────────────────────────────────────────
 * 
 * CASE 1: Single Train (Full Height - 64px)
 * ────────────────────────────────────────────
 * Most common scenario. One train occupies the entire track.
 * Visual: Full 64px height, both arrival and departure numbers visible
 * Example: Train arrives 12:10, departs 12:45
 * Use: Normal operations, standard traffic
 * 
 * CASE 2: Two Trains Stacked (32px each)
 * ────────────────────────────────────────────
 * Two trains on same track at overlapping times.
 * Visual: Bottom train = first arrival (departs last)
 *         Top train = last arrival (departs first)
 * Example: Bottom: arrives 12:05, departs 12:50
 *          Top: arrives 12:15, departs 12:35
 * Use: Platform sharing, waiting for departure slot
 * 
 * CASE 3: Three Trains Stacked (21px each)
 * ────────────────────────────────────────────
 * Three trains compressed but readable.
 * Visual: Vertically stacked, font size reduced to 12px
 * Example: Bottom, middle, top = chronological arrival order
 * Use: Peak hours, busy station operations
 * 
 * CASE 4: Five Trains - Maximum Density (14px each)
 * ────────────────────────────────────────────
 * Extreme edge case showing system limits.
 * Visual: Very compressed (14px), font reduced to 9px
 * Example: 5 trains stacked, all visible but minimal
 * Use: Major disruptions, delays causing backup
 * 
 * CASE 5: Connected Trains (Departing Together) 🔗
 * ────────────────────────────────────────────
 * Two trains coupled or departing as one service.
 * Visual: Link icon (🔗) in top-right corner of both trains
 * Example: Two trains with same departure time, connectedTo property
 * Use: Train splitting/joining, coupled services
 * 
 * CASE 6: Conflict Warning (Red Alert) ⚠️
 * ────────────────────────────────────────────
 * CRITICAL: Two trains physically can't occupy same space.
 * Visual: Red borders, warning triangle icon (⚠️)
 * Example: Two trains with overlapping times causing safety issue
 * Use: Scheduling errors, platform conflicts - MUST BE RESOLVED
 * 
 * CASE 7: Very Short Duration (Narrow Bar)
 * ────────────────────────────────────────────
 * Train stops for very short time (< 10 minutes).
 * Visual: Narrow bar (< 60px), tooltip shows full info on hover
 * Example: Train arrives 12:20, departs 12:25 (5 minutes)
 * Use: Express trains, quick platform changes
 * 
 * CASE 8: Arrival Only (No Departure) - Terminus
 * ────────────────────────────────────────────
 * Train arrives but doesn't leave (end of line).
 * Visual: Shows only LEFT number (arrival), width = 80px
 * Example: Train 6601 arrives, no departure number
 * Use: End-of-line stations, overnight parking
 * 
 * CASE 9: Departure Only (No Arrival) - Origin
 * ────────────────────────────────────────────
 * Train starts journey here (no arrival).
 * Visual: Shows only RIGHT number (departure), width = 80px
 * Example: Train 8808 departs, no arrival number
 * Use: Origin stations, morning first services
 * 
 * CASE 10: Delayed Train (Orange Warning)
 * ────────────────────────────────────────────
 * Train running late from schedule.
 * Visual: 4px orange stripe on RIGHT edge
 * Example: Any train with status = 'delayed'
 * Use: Operational delays, dispatcher re-planning
 * 
 * ───────────────────────────────────────────────────────────────────────
 * 🎨 VISUAL HIERARCHY:
 * ───────────────────────────────────────────────────────────────────────
 * • Bottom train = First arrival (locked in by others)
 * • Top train = Last arrival (departs first - not blocked)
 * • Left number = Arrival train number
 * • Right number = Departure train number
 * • Hover = Show detailed tooltip
 * • Click = Select train (highlights, logs to console)
 * 
 * ───────────────────────────────────────────────────────────────────────
 * 🎯 SMART FEATURES:
 * ───────────────────────────────────────────────────────────────────────
 * • Dynamic font sizing based on height and width compression
 * • Automatic tooltip for narrow bars (< 60px width)
 * • Color-coded by train type (regional, long-distance, freight)
 * • Full theme support (light, dark, high-contrast)
 * • Status icons positioned to not obscure train numbers
 * • Z-index ordering ensures top trains are clickable
 * 
 * ═══════════════════════════════════════════════════════════════════════
 */
function renderTrains(trains, trackLayouts, startTime, pixelsPerHour) {
    const timelineCanvas = document.getElementById('timeline-canvas');
    if (!timelineCanvas) return;
    
    // CASE-SPECIFIC: Height mapping for different train counts
    const getTrainHeight = (totalTrains) => {
        if (totalTrains === 1) return 48; // Case 1: Full height for single train (reduced to fit 16 tracks)
        if (totalTrains === 2) return 24; // Case 2: Two trains stacked
        if (totalTrains === 3) return 16; // Case 3: Three trains compressed
        if (totalTrains === 4) return 12; // Case 4: Four trains tight
        return 10; // Case 4: Five+ trains maximum density
    };

    // Group trains by track ID
    const trainsByTrack = trains.reduce((acc, train) => {
        if (!acc[train.trackId]) {
            acc[train.trackId] = [];
        }
        acc[train.trackId].push(train);
        return acc;
    }, {});

    // Render trains for each track
    for (const trackId in trainsByTrack) {
        const trackTrains = trainsByTrack[trackId];
        const trackLayout = trackLayouts.find(t => t.id === parseInt(trackId));
        if (!trackLayout) continue;

        // CRITICAL FIX: Calculate exact position for each train based on actual overlaps
        const trainPositions = calculateTrainPositions(trackTrains);
        
        // Debug: Log positioning for this track
        if (trainPositions.length > 0) {
            const maxOverlap = Math.max(...trainPositions.map(tp => tp.totalOverlapping));
            console.log(`🚂 Spår ${trackId}: Max ${maxOverlap} tåg samtidigt`);
            
            // Show detailed positioning for tracks with overlaps
            if (maxOverlap > 1) {
                trainPositions.forEach(({ train, position, totalOverlapping }) => {
                    const trainNum = train.arrivalTrainNumber || train.departureTrainNumber;
                    const arrTime = train.arrTime ? train.arrTime.toTimeString().substring(0,5) : '--';
                    const depTime = train.depTime ? train.depTime.toTimeString().substring(0,5) : '--';
                    console.log(`  Tåg ${trainNum} (${arrTime}-${depTime}): Position ${position}, Max samtidiga ${totalOverlapping}`);
                });
            }
        }
        
        // Render each train with its calculated position
        trainPositions.forEach(({ train, position, totalOverlapping }) => {
            const trainHeight = getTrainHeight(totalOverlapping);
            const bottomOffset = position * trainHeight;
            const totalTrainsInGroup = totalOverlapping; // For compression logic
            
            // Debug positioning for connected trains
            if (train.connectedTo) {
                console.log(`  🔗 Positionering: ${train.arrivalTrainNumber} - Position ${position}, Height ${trainHeight}px, Offset ${bottomOffset}px`);
            }

            // --- CASE 7, 8, 9: Calculate horizontal position and width ---
        const arrMinutes = train.arrTime ? (train.arrTime - startTime) / (1000 * 60) : null;
        const depMinutes = train.depTime ? (train.depTime - startTime) / (1000 * 60) : null;
        
            let left = 0, width = 0;
            const minWidthPx = 40; // Minimum visible width for very short durations
            const arrivalOnlyWidth = 80; // Width for arrival-only trains (Case 8)
            const departureOnlyWidth = 80; // Width for departure-only trains (Case 9)

            // CASE 7 & Standard: Both arrival and departure times
        if (arrMinutes !== null && depMinutes !== null) {
            left = (arrMinutes / 60) * pixelsPerHour;
                const calculatedWidth = ((depMinutes - arrMinutes) / 60) * pixelsPerHour;
                width = Math.max(calculatedWidth, minWidthPx); // Ensure minimum width for Case 7
            } 
            // CASE 8: Arrival only (terminus station - train stays)
            else if (arrMinutes !== null && !train.departureTrainNumber) {
            left = (arrMinutes / 60) * pixelsPerHour;
                width = arrivalOnlyWidth;
            } 
            // CASE 9: Departure only (origin station - train starts here)
            else if (depMinutes !== null && !train.arrivalTrainNumber) {
                left = (depMinutes / 60) * pixelsPerHour - departureOnlyWidth;
                width = departureOnlyWidth;
            } 
            else {
                return; // Skip trains with no valid time data
            }

            // --- Create Train Element ---
        const trainDiv = document.createElement('div');
            trainDiv.className = `train-bar type-${train.type}`;
            trainDiv.style.left = `${left}px`;
            trainDiv.style.width = `${width}px`;
            
            // Add 3px vertical padding to prevent overlap with adjacent tracks
            // Reduce inner vertical padding when multiple trains are stacked to unlock more text space
            const verticalPadding = totalTrainsInGroup >= 3 ? 1 : (totalTrainsInGroup === 2 ? 2 : 3);
            trainDiv.style.height = `${Math.max(trainHeight - verticalPadding * 2, 8)}px`;
            trainDiv.style.top = `${trackLayout.top + (trackLayout.height - bottomOffset - trainHeight) + verticalPadding}px`;
            trainDiv.style.zIndex = 10 + position;
            
            // Store train data for debugging/interaction
            trainDiv.dataset.trainId = train.id;
            trainDiv.dataset.arrival = train.arrivalTrainNumber || '';
            trainDiv.dataset.departure = train.departureTrainNumber || '';

            // CASE 6: Conflict status (critical safety issue)
            if (train.status === 'conflict') trainDiv.classList.add('has-conflict');
            
            // CASE 10: Delayed status (operational warning)
            if (train.status === 'delayed') trainDiv.classList.add('is-delayed');
            
            // CASE 5: Connected trains (departing together)
            if (train.connectedTo) trainDiv.classList.add('has-connection');

            // --- Determine text display strategy based on width and height ---
            const isVeryNarrow = width < 60; // Case 7: Show tooltip instead
            const isNarrow = width < 100;
            const isCompressed = totalTrainsInGroup >= 3; // Cases 3 & 4
            
            // Smart number display logic
            const hasArrival = !!train.arrivalTrainNumber;
            const hasDeparture = !!train.departureTrainNumber;
            const sameNumber = train.arrivalTrainNumber === train.departureTrainNumber;
            
            // Display single number if: same number, very narrow, or only one number exists
            const displaySingleNumber = sameNumber || isVeryNarrow || !(hasArrival && hasDeparture);
            const singleNumber = train.arrivalTrainNumber || train.departureTrainNumber;

            // Dynamic font sizing based on compression level
            let fontSize = '14px';
            if (isCompressed || isNarrow) fontSize = '12px';
            if (trainHeight < 20) fontSize = '10px'; // Cases 3, 4
            if (trainHeight < 16) fontSize = '9px'; // Case 4: Maximum density

            // Build number display HTML
            let numbersHTML = '';
            let singleAlignClass = '';
            if (displaySingleNumber) {
                // Single number aligned by type (arrival left, departure right)
                if (hasArrival && !hasDeparture) {
                    singleAlignClass = 'single-left';
                } else if (!hasArrival && hasDeparture) {
                    singleAlignClass = 'single-right';
                } else {
                    singleAlignClass = 'single-centered';
                }
                numbersHTML = `<div class="train-number-value">${singleNumber || ''}</div>`;
            } else {
                // CASE 8 & 9: Handle arrival-only or departure-only
                // Standard: Show both numbers (left = arrival, right = departure)
                numbersHTML = `
                    <div class="train-number-value">${train.arrivalTrainNumber || ''}</div>
                    <div class="train-number-value">${train.departureTrainNumber || ''}</div>
                `;
            }

            // --- Build Status Icons ---
            // CASE 6: Conflict warning triangle (⚠️)
            const statusIconHTML = train.status === 'conflict' 
                ? '<div class="status-icon" title="Konflikt! ⚠️"></div>' 
                : '';
            
            // CASE 5: Connection link icon (🔗)
            const connectionIconHTML = train.connectedTo 
                ? '<div class="connection-icon" title="Kopplad tåg 🔗"></div>' 
                : '';
            
            // CASE 10: Delayed stripe indicator (already styled in CSS)
            // The orange stripe is automatically shown via .is-delayed class

            // --- CASE 7: Tooltip for narrow bars ---
            const showTooltip = isVeryNarrow || !hasArrival || !hasDeparture;
            const tooltipHTML = showTooltip ? `
                <div class="train-tooltip">
                    ${hasArrival ? `Ank: ${train.arrivalTrainNumber}` : ''}
                    ${hasArrival && hasDeparture ? ' → ' : ''}
                    ${hasDeparture ? `Avg: ${train.departureTrainNumber}` : ''}
                    ${train.origin ? `<br>Från: ${train.origin}` : ''}
                    ${train.dest ? `<br>Till: ${train.dest}` : ''}
                </div>
            ` : '';

            // --- Build Complete Train Bar HTML ---
        // Determine density class for CSS tweaks (borders, text readability)
        const densityClass = totalTrainsInGroup >= 3 ? 'density-3' : (totalTrainsInGroup === 2 ? 'density-2' : 'density-1');

        trainDiv.innerHTML = `
                <div class="train-bar-visual">
                    ${statusIconHTML}
                    ${connectionIconHTML}
                    <div class="train-numbers ${displaySingleNumber ? singleAlignClass : ''}" style="font-size: ${fontSize};">
                        ${numbersHTML}
            </div>
            </div>
                ${tooltipHTML}
            `;

            // Apply length and density classes for theming
            trainDiv.classList.add(`len-${train.lengthClass}`, densityClass);

            // --- Add Interactive Event Listeners ---
            trainDiv.addEventListener('mouseenter', () => {
                trainDiv.classList.add('is-hovered');
            });
            trainDiv.addEventListener('mouseleave', () => {
                trainDiv.classList.remove('is-hovered');
            });
            trainDiv.addEventListener('click', () => {
                // Toggle selection - deselect others, select this one
                document.querySelectorAll('.train-bar.is-selected').forEach(el => {
                    el.classList.remove('is-selected');
                });
                trainDiv.classList.add('is-selected');
                
                // Log selection for debugging
                console.log('🚂 Tåg valt:', {
                    id: train.id,
                    ankomst: train.arrivalTrainNumber,
                    avgång: train.departureTrainNumber,
                    spår: train.trackId,
                    status: train.status
                });
            });
        
        timelineCanvas.appendChild(trainDiv);
        
        // Apply dynamic text contrast after element is in DOM
        // Use setTimeout to ensure styles are computed
        setTimeout(() => applyDynamicTextContrast(trainDiv), 0);
    });
}
}

/**
 * Calculates the correct position and overlap count for each train based on
 * dynamic slot assignment - ensures no two trains occupy the same position.
 * 
 * This is THE KEY FUNCTION for dynamic case handling!
 * 
 * Returns: Array of objects with { train, position, maxSimultaneous }
 */
function calculateTrainPositions(trains) {
    if (trains.length === 0) return [];
    
    // Sort trains by arrival time, then by ID for stable ordering
    const sorted = trains.slice().sort((a, b) => {
        const aStart = a.arrTime || a.depTime;
        const bStart = b.arrTime || b.depTime;
        const timeDiff = aStart - bStart;
        return timeDiff !== 0 ? timeDiff : a.id - b.id;
    });
    
    const result = [];
    const occupiedSlots = []; // Track which positions are occupied at each time
    
    // For each train, calculate positioning using slot assignment
    sorted.forEach(train => {
        const trainStart = train.arrTime || train.depTime;
        const trainEnd = train.depTime || train.arrTime;
        
        // Find all trains that overlap with this train in time
        const overlapping = sorted.filter(other => {
            const otherStart = other.arrTime || other.depTime;
            const otherEnd = other.depTime || other.arrTime;
            
            // Two trains overlap if one starts before the other ends
            return trainStart < otherEnd && trainEnd > otherStart;
        });
        
        // Calculate the MAXIMUM number of trains present at any single moment
        const maxSimultaneous = calculateMaxSimultaneousDuringPeriod(
            overlapping, 
            trainStart, 
            trainEnd
        );
        
        // GRAVITY ALGORITHM: Find the lowest available slot at the moment this train arrives
        // Check which positions are occupied by trains that are CURRENTLY on the track
        let position = 0;
        
        // Get all trains that are on the track when this train arrives
        const trainsAtArrival = result.filter(r => {
            const rStart = r.train.arrTime || r.train.depTime;
            const rEnd = r.train.depTime || r.train.arrTime;
            // Train must arrive before our train arrives AND not depart before our train arrives
            return rStart < trainStart && rEnd > trainStart;
        });
        
        // Find the lowest free position (gravity!)
        const usedPositions = trainsAtArrival.map(r => r.position);
        for (let i = 0; i < maxSimultaneous; i++) {
            if (!usedPositions.includes(i)) {
                position = i;
                break; // Take the lowest available position
            }
        }
        
        result.push({
            train: train,
            position: position,
            totalOverlapping: maxSimultaneous
        });
    });
    
    return result;
}

/**
 * Calculates the maximum number of trains present at any single moment
 * during a specific time period.
 */
function calculateMaxSimultaneousDuringPeriod(trains, periodStart, periodEnd) {
    if (trains.length === 0) return 0;
    
    // Create events for arrivals and departures within the period
    const events = [];
    
    trains.forEach(train => {
        const trainStart = train.arrTime || train.depTime;
        const trainEnd = train.depTime || train.arrTime;
        
        // Only consider events that happen during our period
        if (trainStart < periodEnd && trainEnd > periodStart) {
            // Use the later of train start or period start
            const effectiveStart = trainStart > periodStart ? trainStart : periodStart;
            // Use the earlier of train end or period end
            const effectiveEnd = trainEnd < periodEnd ? trainEnd : periodEnd;
            
            events.push({ time: effectiveStart, type: 'arrive' });
            events.push({ time: effectiveEnd, type: 'depart' });
        }
    });
    
    // Sort events by time
    events.sort((a, b) => {
        if (a.time.getTime() !== b.time.getTime()) {
            return a.time - b.time;
        }
        // If same time, process departures before arrivals
        return a.type === 'depart' ? -1 : 1;
    });
    
    // Sweep through to find maximum
    let current = 0;
    let maximum = 0;
    
    events.forEach(event => {
        if (event.type === 'arrive') {
            current++;
            maximum = Math.max(maximum, current);
        } else {
            current--;
        }
    });
    
    return maximum;
}

/**
 * Periodically update the current time line and label.
 * This ensures the time label is always current and the line's visibility is correct,
 * even when the user is not interacting with the schedule.
 */
function startCurrentTimeUpdater() {
    // Initial update
    updateCurrentTimeLine();
    // Periodic updates
    setInterval(updateCurrentTimeLine, 1000); // Update every second for smoother positioning
}

/**
 * Update current time line position and label.
 * Position is calculated from timeline start (midnight)
 */
function updateCurrentTimeLine() {
    if (!window.TimeManager || !timelineStart) return;
    
    const state = window.TimeManager.getState();
    const now = new Date();
    const { offsetPercentage, isFollowingMode } = state;
    
    const scheduleGrid = document.getElementById('schedule-grid');
    const timelineCanvas = document.getElementById('timeline-canvas');
    const timelineHours = document.getElementById('timeline-hours');
    
    if (!scheduleGrid || !timelineCanvas || !timelineHours) return;

    // --- 1. Manage the current time LINE element ---
    let currentTimeLine = document.getElementById('current-time-line');
    if (!currentTimeLine) {
        currentTimeLine = document.createElement('div');
        currentTimeLine.id = 'current-time-line';
        currentTimeLine.className = 'timeline-current-time';
        // The line belongs in the timeline-canvas to span ALL tracks (even when scrolling)
        timelineCanvas.appendChild(currentTimeLine);
    }

    // Always show the line
    currentTimeLine.style.display = 'block';

    // --- Calculate the line's position from midnight ---
    const nowMinutes = (now.getTime() - timelineStart.getTime()) / 60000;
    const linePositionOnCanvas = (nowMinutes / 60) * window.currentPixelsPerHour;

    // Position the line to span the full canvas height
    const canvasHeight = timelineCanvas.offsetHeight;
    currentTimeLine.style.left = `${linePositionOnCanvas}px`;
    currentTimeLine.style.top = '0px';
    currentTimeLine.style.height = `${canvasHeight}px`;

    // --- 2. Update the label in timeline-hours row ---
    let timeLabel = timelineHours.querySelector('.current-time-label');
    if (!timeLabel) {
        timeLabel = document.createElement('div');
        timeLabel.className = 'current-time-label';
        timelineHours.appendChild(timeLabel);
    }
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    timeLabel.textContent = `${hours}:${minutes}`;
    
    // Position the label at the same x position as the red line
    timeLabel.style.left = `${linePositionOnCanvas}px`;

    // --- 3. If in follow mode, adjust the scroll position ---
    if (isFollowingMode) {
        const scheduleWrapper = document.querySelector('.schedule-wrapper');
        if (!scheduleWrapper) return;
        
        const viewportWidth = scheduleWrapper.clientWidth;
        const redLineFixedPositionInViewport = (offsetPercentage / 100) * viewportWidth;
        const desiredScrollLeft = linePositionOnCanvas - redLineFixedPositionInViewport;

        // Check if scroll is needed to avoid jitter
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

    // Simple: Only deactivate follow mode on manual scroll
    // No complex syncing needed - CSS sticky positioning handles everything!
    scheduleWrapper.addEventListener('scroll', () => {
        if (window.TimeManager.isFollowingMode && !isProgrammaticScroll) {
            window.TimeManager.deactivateFollowingMode();
        }
    }, { passive: true });

    console.log('✅ Scroll synchronization initialized (using native CSS sticky)');
}

