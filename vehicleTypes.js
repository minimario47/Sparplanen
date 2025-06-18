// vehicleTypes.js - Vehicle Type Definitions

const vehicleDefinitions = {
    "X2": {
        name: "X2",
        baseLengthMeters: 135,
        canBeMultiple: true,
        description: "SJ High-speed train",
        defaultColor: "#c0392b",
        category: "high_speed"
    },
    "REGINA": {
        name: "Regina",
        baseLengthMeters: 54,
        canBeMultiple: true,
        description: "Regional train unit",
        defaultColor: "#27ae60",
        category: "regional"
    },
    "SJ3000": {
        name: "SJ 3000",
        baseLengthMeters: 107,
        canBeMultiple: false,
        description: "Modern InterCity train",
        defaultColor: "#2980b9",
        category: "intercity"
    },
    "ORESUND": {
        name: "Öresundståg",
        baseLengthMeters: 79,
        canBeMultiple: true,
        description: "Cross-border regional service",
        defaultColor: "#8e44ad",
        category: "regional"
    },
    "PENDELTAG": {
        name: "Pendeltåg",
        baseLengthMeters: 68,
        canBeMultiple: true,
        description: "Commuter train unit",
        defaultColor: "#7f8c8d",
        category: "commuter"
    },
    "LOCOMOTIVE_RC": {
        name: "Rc Lok",
        baseLengthMeters: 16,
        canBeMultiple: false,
        description: "Standard electric locomotive",
        defaultColor: "#34495e",
        category: "locomotive"
    },
    "LOCOMOTIVE_CARGO": {
        name: "Godslok",
        baseLengthMeters: 20,
        canBeMultiple: false,
        description: "Heavy freight locomotive",
        defaultColor: "#34495e",
        category: "cargo"
    },
    "WAGON_PASSENGER": {
        name: "Personvagn",
        baseLengthMeters: 26,
        canBeMultiple: false,
        description: "Standard passenger wagon",
        defaultColor: "#7f8c8d",
        category: "wagon"
    },
    "WAGON_CARGO": {
        name: "Godsvagn",
        baseLengthMeters: 15,
        canBeMultiple: false,
        description: "Standard cargo wagon",
        defaultColor: "#34495e",
        category: "wagon"
    },
    "MAINTENANCE": {
        name: "Banunderhåll",
        baseLengthMeters: 25,
        canBeMultiple: false,
        description: "Track maintenance vehicle",
        defaultColor: "#16a085",
        category: "service"
    }
};

// Helper function to get vehicle definition
function getVehicleDefinition(vehicleTypeID) {
    return vehicleDefinitions[vehicleTypeID] || null;
}

// Helper function to calculate train set length
function calculateTrainSetLength(trainSet) {
    if (!trainSet) return 0;
    
    if (trainSet.customComposition && trainSet.customComposition.length > 0) {
        // Calculate total length from custom composition
        return trainSet.customComposition.reduce((total, vehicle) => {
            const vehicleDef = getVehicleDefinition(vehicle.vehicleTypeID);
            return total + (vehicleDef ? vehicleDef.baseLengthMeters : 0);
        }, 0);
    } else if (trainSet.vehicleTypeID && trainSet.count) {
        // Calculate length from vehicle type and count
        const vehicleDef = getVehicleDefinition(trainSet.vehicleTypeID);
        return vehicleDef ? vehicleDef.baseLengthMeters * trainSet.count : 0;
    }
    
    return 0;
}

// Helper function to get display name for train set
function getTrainSetDisplayName(trainSet) {
    if (!trainSet) return "Okänt";
    
    if (trainSet.customComposition && trainSet.customComposition.length > 0) {
        // Build composition string
        const counts = {};
        trainSet.customComposition.forEach(vehicle => {
            const vehicleDef = getVehicleDefinition(vehicle.vehicleTypeID);
            const name = vehicleDef ? vehicleDef.name : vehicle.vehicleTypeID;
            counts[name] = (counts[name] || 0) + 1;
        });
        
        return Object.entries(counts)
            .map(([name, count]) => count > 1 ? `${count}x${name}` : name)
            .join(" + ");
    } else if (trainSet.vehicleTypeID && trainSet.count) {
        const vehicleDef = getVehicleDefinition(trainSet.vehicleTypeID);
        const name = vehicleDef ? vehicleDef.name : trainSet.vehicleTypeID;
        return trainSet.count > 1 ? `${trainSet.count} × ${name}` : name;
    }
    
    return "Okänt";
}

// Helper function to get color for train set
function getTrainSetColor(trainSet) {
    if (!trainSet) return "#3498db";
    
    if (trainSet.customComposition && trainSet.customComposition.length > 0) {
        // Use color of first vehicle in composition
        const firstVehicle = trainSet.customComposition[0];
        const vehicleDef = getVehicleDefinition(firstVehicle.vehicleTypeID);
        return vehicleDef ? vehicleDef.defaultColor : "#3498db";
    } else if (trainSet.vehicleTypeID) {
        const vehicleDef = getVehicleDefinition(trainSet.vehicleTypeID);
        return vehicleDef ? vehicleDef.defaultColor : "#3498db";
    }
    
    return "#3498db";
} 