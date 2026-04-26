// tracks.js - Track definitions for Göteborg Central
// Spårlängd: two segment meters + plattform (realuppmätt värden).
// trackSegmentMeters: [0] = andra spårledning (vänster i "A+B"), [1] = första spårledning (höger i "A+B").

// Make trackDefinitions globally available for tooltip functionality
window.trackDefinitions = [
    { trackID_Internal: 'GbgC-01', publicTrackNumber: '1', trackSegmentMeters: [95, 132], platformLengthMeters: 279, totalLengthMeters: 227, signalVisibleLengthMeters: 227, subTrackCount: 3, properties: ['regional_platform'], description: 'Regional- och pendeltågstrafik' },
    { trackID_Internal: 'GbgC-02', publicTrackNumber: '2', trackSegmentMeters: [151, 158], platformLengthMeters: 279, totalLengthMeters: 309, signalVisibleLengthMeters: 309, subTrackCount: 3, properties: ['high_speed_platform', 'long_distance'], description: 'Höghastighetsplattform för X2 och InterCity' },
    { trackID_Internal: 'GbgC-03', publicTrackNumber: '3', trackSegmentMeters: [179, 171], platformLengthMeters: 375, totalLengthMeters: 350, signalVisibleLengthMeters: 350, subTrackCount: 3, properties: ['intercity_platform'], description: 'InterCity och regionaltåg' },
    { trackID_Internal: 'GbgC-04', publicTrackNumber: '4', trackSegmentMeters: [205, 195], platformLengthMeters: 375, totalLengthMeters: 400, signalVisibleLengthMeters: 400, subTrackCount: 3, properties: ['intercity_platform'], description: 'InterCity och regionaltåg' },
    { trackID_Internal: 'GbgC-05', publicTrackNumber: '5', trackSegmentMeters: [144, 139], platformLengthMeters: 272, totalLengthMeters: 283, signalVisibleLengthMeters: 283, subTrackCount: 3, properties: ['regional_platform'], description: 'Regional- och pendeltågstrafik' },
    { trackID_Internal: 'GbgC-06', publicTrackNumber: '6', trackSegmentMeters: [131, 186], platformLengthMeters: 309, totalLengthMeters: 317, signalVisibleLengthMeters: 317, subTrackCount: 3, properties: ['regional_platform'], description: 'Regional- och pendeltågstrafik' },
    { trackID_Internal: 'GbgC-07', publicTrackNumber: '7', trackSegmentMeters: [164, 226], platformLengthMeters: 417, totalLengthMeters: 390, signalVisibleLengthMeters: 390, subTrackCount: 3, properties: ['regional_platform'], description: 'Regional- och pendeltågstrafik' },
    { trackID_Internal: 'GbgC-08', publicTrackNumber: '8', trackSegmentMeters: [174, 179], platformLengthMeters: 421, totalLengthMeters: 353, signalVisibleLengthMeters: 353, subTrackCount: 3, properties: ['regional_platform'], description: 'Regional- och pendeltågstrafik' },
    { trackID_Internal: 'GbgC-09', publicTrackNumber: '9', trackSegmentMeters: [107, 140], platformLengthMeters: 233, totalLengthMeters: 247, signalVisibleLengthMeters: 247, subTrackCount: 3, properties: ['commuter_platform'], description: 'Pendeltåg och lokaltrafik' },
    { trackID_Internal: 'GbgC-10', publicTrackNumber: '10', trackSegmentMeters: [107, 140], platformLengthMeters: 233, totalLengthMeters: 247, signalVisibleLengthMeters: 247, subTrackCount: 3, properties: ['commuter_platform'], description: 'Pendeltåg och lokaltrafik' },
    { trackID_Internal: 'GbgC-11', publicTrackNumber: '11', trackSegmentMeters: [98, 97], platformLengthMeters: 169, totalLengthMeters: 195, signalVisibleLengthMeters: 195, subTrackCount: 3, properties: ['commuter_platform'], description: 'Pendeltåg och lokaltrafik' },
    { trackID_Internal: 'GbgC-12', publicTrackNumber: '12', trackSegmentMeters: [98, 101], platformLengthMeters: 169, totalLengthMeters: 199, signalVisibleLengthMeters: 199, subTrackCount: 3, properties: ['commuter_platform'], description: 'Pendeltåg och lokaltrafik' },
    { trackID_Internal: 'GbgC-13', publicTrackNumber: '13', trackSegmentMeters: [111, 100], platformLengthMeters: 161, totalLengthMeters: 211, signalVisibleLengthMeters: 211, subTrackCount: 3, properties: ['commuter_platform'], description: 'Pendeltåg och lokaltrafik' },
    { trackID_Internal: 'GbgC-14', publicTrackNumber: '14', trackSegmentMeters: [95, 118], platformLengthMeters: 161, totalLengthMeters: 213, signalVisibleLengthMeters: 213, subTrackCount: 3, properties: ['maintenance'], description: 'Underhåll och servicetåg' },
    { trackID_Internal: 'GbgC-15', publicTrackNumber: '15', trackSegmentMeters: [84, 160], platformLengthMeters: 235, totalLengthMeters: 244, signalVisibleLengthMeters: 244, subTrackCount: 3, properties: ['cargo'], description: 'Godstrafik och rangering' },
    { trackID_Internal: 'GbgC-16', publicTrackNumber: '16', trackSegmentMeters: [98, 162], platformLengthMeters: 235, totalLengthMeters: 260, signalVisibleLengthMeters: 260, subTrackCount: 3, properties: ['maintenance_only', 'limited'], description: 'Begränsad användning, huvudsakligen underhåll' }
];

/** Summan av de två spårsegmenten. */
function getTrackSegmentSumMeters(track) {
    if (Array.isArray(track.trackSegmentMeters) && track.trackSegmentMeters.length >= 2) {
        return track.trackSegmentMeters[0] + track.trackSegmentMeters[1];
    }
    return track.totalLengthMeters;
}

/**
 * Tåglängd som får plats vid plattform / spår: min av delsumma och plattform.
 * Används för tågpassage-varningar.
 */
function getTrackStoppingLimitMeters(track) {
    if (!track) return 0;
    const sum = getTrackSegmentSumMeters(track);
    if (track.platformLengthMeters != null) {
        return Math.min(sum, track.platformLengthMeters);
    }
    return track.signalVisibleLengthMeters;
}

/**
 * Full line including platform (legacy / export / some panels).
 * Renders: 95m+132m = 227m (platform: 279m)
 */
function formatTrackLengthDisplay(track) {
    if (Array.isArray(track.trackSegmentMeters) && track.trackSegmentMeters.length >= 2) {
        const andra = track.trackSegmentMeters[0];
        const forsta = track.trackSegmentMeters[1];
        const total = andra + forsta;
        if (track.platformLengthMeters != null) {
            return `${andra}m+${forsta}m = ${total}m (platform: ${track.platformLengthMeters}m)`;
        }
        return `${andra}m+${forsta}m = ${total}m`;
    }
    if (track.platformLengthMeters != null) {
        return `${track.totalLengthMeters}m (platform: ${track.platformLengthMeters}m)`;
    }
    return `${track.totalLengthMeters}m`;
}

/**
 * Huvudvy: endast spår/signalsumma, utan plattform (mindre yta).
 * Renders: 95m+132m = 227m
 */
function formatTrackSignalLengthDisplay(track) {
    if (Array.isArray(track.trackSegmentMeters) && track.trackSegmentMeters.length >= 2) {
        const andra = track.trackSegmentMeters[0];
        const forsta = track.trackSegmentMeters[1];
        const total = andra + forsta;
        return `${andra}m+${forsta}m = ${total}m`;
    }
    return `${track.totalLengthMeters}m`;
}

window.getTrackSegmentSumMeters = getTrackSegmentSumMeters;
window.getTrackStoppingLimitMeters = getTrackStoppingLimitMeters;
window.formatTrackLengthDisplay = formatTrackLengthDisplay;
window.formatTrackSignalLengthDisplay = formatTrackSignalLengthDisplay;

// Helper function to get track definition by track ID
function getTrackDefinition(trackId) {
    return trackDefinitions.find(track => parseInt(track.publicTrackNumber) === parseInt(trackId)) || null;
}

// Helper function to check if a train set fits on a track
function canTrainSetFitOnTrack(trainSet, trackId) {
    const trackDef = getTrackDefinition(trackId);
    if (!trackDef) return false;
    const trainLength = calculateTrainSetLength(trainSet);
    return trainLength <= getTrackStoppingLimitMeters(trackDef);
}

// Helper function to get track capacity status
function getTrackCapacityStatus(trainSet, trackId) {
    const trackDef = getTrackDefinition(trackId);
    if (!trackDef) return { status: 'unknown', message: 'Spår ej definierat' };

    const trainLength = calculateTrainSetLength(trainSet);
    const physical = getTrackSegmentSumMeters(trackDef);
    const stopLimit = getTrackStoppingLimitMeters(trackDef);

    if (trainLength > physical) {
        return {
            status: 'impossible',
            message: `Tåget (${trainLength}m) är längre än spåret (${physical}m)`
        };
    }
    if (trainLength > stopLimit) {
        return {
            status: 'warning',
            message: `Tåget (${trainLength}m) överstiger gällande tåglängd (${stopLimit}m) mot plattform`
        };
    }
    const utilization = Math.round((trainLength / stopLimit) * 100);
    return {
        status: 'ok',
        message: `Spårutnyttjande: ${utilization}% (${trainLength}m av ${stopLimit}m)`
    };
}

// Helper function to check track suitability for vehicle type
function isTrackSuitableForVehicleType(trackId, vehicleTypeID) {
    const trackDef = getTrackDefinition(trackId);
    const vehicleDef = getVehicleDefinition(vehicleTypeID);

    if (!trackDef || !vehicleDef) return true; // Default to allowing if definitions missing

    // Define suitability rules
    const suitabilityRules = {
        'high_speed': ['high_speed_platform', 'intercity_platform'],
        'intercity': ['high_speed_platform', 'intercity_platform', 'regional_platform'],
        'regional': ['intercity_platform', 'regional_platform', 'commuter_platform'],
        'commuter': ['regional_platform', 'commuter_platform'],
        'cargo': ['cargo', 'maintenance'],
        'locomotive': ['cargo', 'maintenance', 'regional_platform'], // Can use various tracks
        'wagon': ['cargo', 'maintenance'],
        'service': ['maintenance', 'maintenance_only']
    };

    const allowedProperties = suitabilityRules[vehicleDef.category] || [];
    return allowedProperties.some(prop => trackDef.properties.includes(prop));
}

// Helper function to get all tracks suitable for a vehicle type
function getSuitableTracksForVehicleType(vehicleTypeID) {
    return trackDefinitions.filter(track =>
        isTrackSuitableForVehicleType(parseInt(track.publicTrackNumber), vehicleTypeID)
    );
}
