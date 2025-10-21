// tracks.js - Track Definitions for Göteborg Central

// Make trackDefinitions globally available for tooltip functionality
window.trackDefinitions = [
    { 
        trackID_Internal: 'GbgC-01', 
        publicTrackNumber: '1', 
        totalLengthMeters: 450, 
        signalVisibleLengthMeters: 420, 
        subTrackCount: 3, 
        properties: ['regional_platform'], 
        description: 'Regional- och pendeltågstrafik'
    },
    { 
        trackID_Internal: 'GbgC-02', 
        publicTrackNumber: '2', 
        totalLengthMeters: 450, 
        signalVisibleLengthMeters: 420, 
        subTrackCount: 3, 
        properties: ['high_speed_platform', 'long_distance'], 
        description: 'Höghastighetsplattform för X2 och InterCity'
    },
    { 
        trackID_Internal: 'GbgC-03', 
        publicTrackNumber: '3', 
        totalLengthMeters: 420, 
        signalVisibleLengthMeters: 390, 
        subTrackCount: 3, 
        properties: ['intercity_platform'], 
        description: 'InterCity och regionaltåg'
    },
    { 
        trackID_Internal: 'GbgC-04', 
        publicTrackNumber: '4', 
        totalLengthMeters: 420, 
        signalVisibleLengthMeters: 390, 
        subTrackCount: 3, 
        properties: ['intercity_platform'], 
        description: 'InterCity och regionaltåg'
    },

    { 
        trackID_Internal: 'GbgC-05', 
        publicTrackNumber: '5', 
        totalLengthMeters: 380, 
        signalVisibleLengthMeters: 350, 
        subTrackCount: 3, 
        properties: ['regional_platform'], 
        description: 'Regional- och pendeltågstrafik'
    },
    { 
        trackID_Internal: 'GbgC-06', 
        publicTrackNumber: '6', 
        totalLengthMeters: 380, 
        signalVisibleLengthMeters: 350, 
        subTrackCount: 3, 
        properties: ['regional_platform'], 
        description: 'Regional- och pendeltågstrafik'
    },
    { 
        trackID_Internal: 'GbgC-07', 
        publicTrackNumber: '7', 
        totalLengthMeters: 360, 
        signalVisibleLengthMeters: 330, 
        subTrackCount: 3, 
        properties: ['regional_platform'], 
        description: 'Regional- och pendeltågstrafik'
    },
    { 
        trackID_Internal: 'GbgC-08', 
        publicTrackNumber: '8', 
        totalLengthMeters: 360, 
        signalVisibleLengthMeters: 330, 
        subTrackCount: 3, 
        properties: ['regional_platform'], 
        description: 'Regional- och pendeltågstrafik'
    },

    { 
        trackID_Internal: 'GbgC-09', 
        publicTrackNumber: '9', 
        totalLengthMeters: 280, 
        signalVisibleLengthMeters: 250, 
        subTrackCount: 3, 
        properties: ['commuter_platform'], 
        description: 'Pendeltåg och lokaltrafik'
    },
    { 
        trackID_Internal: 'GbgC-10', 
        publicTrackNumber: '10', 
        totalLengthMeters: 280, 
        signalVisibleLengthMeters: 250, 
        subTrackCount: 3, 
        properties: ['commuter_platform'], 
        description: 'Pendeltåg och lokaltrafik'
    },
    { 
        trackID_Internal: 'GbgC-11', 
        publicTrackNumber: '11', 
        totalLengthMeters: 260, 
        signalVisibleLengthMeters: 230, 
        subTrackCount: 3, 
        properties: ['commuter_platform'], 
        description: 'Pendeltåg och lokaltrafik'
    },
    { 
        trackID_Internal: 'GbgC-12', 
        publicTrackNumber: '12', 
        totalLengthMeters: 260, 
        signalVisibleLengthMeters: 230, 
        subTrackCount: 3, 
        properties: ['commuter_platform'], 
        description: 'Pendeltåg och lokaltrafik'
    },

    { 
        trackID_Internal: 'GbgC-13', 
        publicTrackNumber: '13', 
        totalLengthMeters: 320, 
        signalVisibleLengthMeters: 290, 
        subTrackCount: 3, 
        properties: ['commuter_platform'], 
        description: 'Pendeltåg och lokaltrafik'
    },
    { 
        trackID_Internal: 'GbgC-14', 
        publicTrackNumber: '14', 
        totalLengthMeters: 300, 
        signalVisibleLengthMeters: 270, 
        subTrackCount: 3, 
        properties: ['maintenance'], 
        description: 'Underhåll och servicetåg'
    },
    { 
        trackID_Internal: 'GbgC-15', 
        publicTrackNumber: '15', 
        totalLengthMeters: 400, 
        signalVisibleLengthMeters: 370, 
        subTrackCount: 3, 
        properties: ['cargo'], 
        description: 'Godstrafik och rangering'
    },
    { 
        trackID_Internal: 'GbgC-16', 
        publicTrackNumber: '16', 
        totalLengthMeters: 250, 
        signalVisibleLengthMeters: 220, 
        subTrackCount: 3, 
        properties: ['maintenance_only', 'limited'], 
        description: 'Begränsad användning, huvudsakligen underhåll'
    }
];

// Helper function to get track definition by track ID
function getTrackDefinition(trackId) {
    return trackDefinitions.find(track => parseInt(track.publicTrackNumber) === parseInt(trackId)) || null;
}

// Helper function to check if a train set fits on a track
function canTrainSetFitOnTrack(trainSet, trackId) {
    const trackDef = getTrackDefinition(trackId);
    if (!trackDef) return false;
    
    const trainLength = calculateTrainSetLength(trainSet);
    return trainLength <= trackDef.signalVisibleLengthMeters;
}

// Helper function to get track capacity status
function getTrackCapacityStatus(trainSet, trackId) {
    const trackDef = getTrackDefinition(trackId);
    if (!trackDef) return { status: 'unknown', message: 'Spår ej definierat' };
    
    const trainLength = calculateTrainSetLength(trainSet);
    
    if (trainLength > trackDef.totalLengthMeters) {
        return { 
            status: 'impossible', 
            message: `Tåget (${trainLength}m) är längre än spåret (${trackDef.totalLengthMeters}m)` 
        };
    } else if (trainLength > trackDef.signalVisibleLengthMeters) {
        return { 
            status: 'warning', 
            message: `Tåget (${trainLength}m) överstiger signalsikt (${trackDef.signalVisibleLengthMeters}m)` 
        };
    } else {
        const utilization = Math.round((trainLength / trackDef.signalVisibleLengthMeters) * 100);
        return { 
            status: 'ok', 
            message: `Spårutnyttjande: ${utilization}% (${trainLength}m av ${trackDef.signalVisibleLengthMeters}m)` 
        };
    }
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