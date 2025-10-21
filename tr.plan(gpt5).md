# Train Delay API Integration & Advanced Visualization System

## Phase 1: Firebase Backend Setup

### 1.1 Firebase Cloud Function for Trafikverket API Proxy

**File:** `sparplanen2v/firebase/functions/index.js`

Create Cloud Function that:

- Accepts requests from frontend (CORS enabled)
- Calls Trafikverket API with authentication key `5de4a8d180e045fbb63fa7a32a7d6af9`
- Fetches train announcements for Gothenburg (location signature "G")
- Time window: 3 hours back, 6 hours forward
- Returns processed data: train number, delay minutes, status, cancellation, replacement info
- Updates every 30 seconds via scheduled function
- Implements retry logic and error handling

**Data Structure Returned:**

```javascript
{
  trains: [{
    trainNumber: "3500",
    delayMinutes: 5,
    delayStatus: "DELAYED|EARLY|ON_TIME",
    isCanceled: false,
    isReplaced: false,
    deviationDescription: "...",
    estimatedTime: "ISO8601",
    advertisedTime: "ISO8601",
    actualTime: "ISO8601|null",
    lastUpdated: "ISO8601"
  }],
  summary: { total, delayed, early, canceled, replaced },
  lastUpdated: "ISO8601"
}
```

### 1.2 Firebase Configuration Files

**Files:**

- `sparplanen2v/firebase/firebase.json` - Firebase project config
- `sparplanen2v/firebase/functions/package.json` - Dependencies
- `sparplanen2v/firebase/.firebaserc` - Project ID

## Phase 2: Frontend API Client

### 2.1 Delay API Client Module

**File:** `sparplanen2v/js/api/delay-api-client.js`

Class `DelayAPIClient`:

- Constructor accepts Firebase Cloud Function URL
- Method `fetchDelayData()` - Gets all trains
- Method `startAutoUpdate(interval)` - Polls every 30 seconds
- Method `stopAutoUpdate()` - Stops polling
- Manages connection state: `connecting`, `connected`, `disconnected`, `error`
- Emits events: `data-updated`, `connection-changed`, `error`
- Implements exponential backoff on errors
- Debug logging: `[DelayAPI] prefix for all logs`

### 2.2 Delay Data Manager

**File:** `sparplanen2v/js/api/delay-data-manager.js`

Class `DelayDataManager`:

- Stores delay data in Map: `trainNumber -> delayInfo`
- Handles both string and numeric train number lookups
- Method `getDelayInfo(trainNumber)` - Returns delay for specific train
- Method `updateData(trainsArray)` - Processes API response
- Method `hasDelay(trainNumber)` - Boolean check
- Matches train numbers from `trains.js` (arrivalTrainNumber, departureTrainNumber)
- Debug logging: `[DelayData]` prefix

## Phase 3: Conflict Detection Engine

### 3.1 Conflict Detector Module

**File:** `sparplanen2v/js/delay/conflict-detector.js`

Class `ConflictDetector`:

**Core Algorithm:**

1. For each delayed train, calculate actual arrival/departure times
2. Add turnaround time buffer (default 10 min, user configurable)
3. Find all trains on same track within time window
4. Detect overlaps:

   - **Hard Conflict**: Delayed train's extended time overlaps another train's scheduled time
   - **Soft Conflict**: Within tolerance window (user configurable, default 5 min)

**Methods:**

- `detectConflicts(train, delayInfo, allTrains, settings)` -> `{ hasConflict, conflictType, affectedTrains[] }`
- `calculateActualTimes(train, delayInfo, turnaroundTime)` -> `{ actualArrival, actualDeparture, extendedDeparture }`
- `checkOverlap(train1Times, train2Times)` -> boolean
- `getConflictSeverity(overlapMinutes, tolerance)` -> `'hard'|'soft'|'none'`

**Return Structure:**

```javascript
{
  hasConflict: true,
  conflictType: 'hard', // or 'soft'
  affectedTrains: [
    { trainId: 123, overlap: 5, severity: 'hard' }
  ],
  warning: "Delayed train affects train 3501 at 19:05"
}
```

Debug logging: `[Conflict]` prefix

## Phase 4: Visualization System - Three