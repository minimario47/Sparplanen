/**
 * Firebase Cloud Functions for SpårplanV2
 * Trafikverket API Proxy with caching and error handling
 */

const functions = require('firebase-functions');
const fetch = require('node-fetch');

// Trafikverket API configuration
const TRAFIKVERKET_API_URL = 'https://api.trafikinfo.trafikverket.se/v2/data.json';
const TRAFIKVERKET_API_KEY = '5de4a8d180e045fbb63fa7a32a7d6af9';
const LOCATION_SIGNATURE = 'G'; // Gothenburg

// In-memory cache (15 seconds TTL per location)
const cache = new Map();
const CACHE_TTL = 15000; // 15 seconds

/**
 * Build XML request for Trafikverket API
 * @param {string} locationSignature - Location code (e.g., "G" for Gothenburg)
 * @param {number} hoursBack - Hours to look back
 * @param {number} hoursAhead - Hours to look ahead
 * @return {string} XML request string
 */
function buildTrafikverketRequest(locationSignature, hoursBack = 3, hoursAhead = 6) {
  const now = new Date();
  const startDate = new Date(now.getTime() - (hoursBack * 60 * 60 * 1000));
  const endDate = new Date(now.getTime() + (hoursAhead * 60 * 60 * 1000));

  const formatDate = (date) => date.toISOString().split('.')[0];

  return `
    <REQUEST>
      <LOGIN authenticationkey="${TRAFIKVERKET_API_KEY}"/>
      <QUERY objecttype="TrainAnnouncement" schemaversion="1.9">
        <FILTER>
          <AND>
            <EQ name="LocationSignature" value="${locationSignature}"/>
            <EQ name="ActivityType" value="Ankomst"/>
            <AND>
              <GTE name="AdvertisedTimeAtLocation" value="${formatDate(startDate)}"/>
              <LT name="AdvertisedTimeAtLocation" value="${formatDate(endDate)}"/>
            </AND>
          </AND>
        </FILTER>
      </QUERY>
    </REQUEST>
  `.trim();
}

/**
 * Parse datetime string from Trafikverket API
 * @param {string} datetimeStr - DateTime string from API
 * @return {Date|null} Parsed date or null
 */
function parseDateTime(datetimeStr) {
  if (!datetimeStr) return null;
  try {
    // Handle timezone offsets
    const cleaned = datetimeStr.replace('+02:00', '').replace('+01:00', '');
    return new Date(cleaned);
  } catch (e) {
    return null;
  }
}

/**
 * Calculate delay in minutes
 * @param {string} advertisedTime - Scheduled time
 * @param {string} estimatedTime - Estimated time
 * @param {string} actualTime - Actual time
 * @return {Object} Delay minutes and status
 */
function calculateDelay(advertisedTime, estimatedTime, actualTime) {
  const advertisedDt = parseDateTime(advertisedTime);
  if (!advertisedDt) return {delayMinutes: null, delayStatus: 'NO_SCHEDULE'};

  const comparisonTime = actualTime || estimatedTime;
  const comparisonDt = parseDateTime(comparisonTime);

  if (!comparisonDt) return {delayMinutes: null, delayStatus: 'NO_ESTIMATE'};

  const delayMinutes = Math.round((comparisonDt - advertisedDt) / 60000);

  let delayStatus = 'ON_TIME';
  if (delayMinutes > 2) delayStatus = 'DELAYED';
  else if (delayMinutes < -2) delayStatus = 'EARLY';

  return {delayMinutes, delayStatus};
}

/**
 * Extract deviation information
 * @param {Array} deviationArray - Array of deviations
 * @param {boolean} isCanceled - Is train canceled
 * @return {Object} Replacement status and description
 */
function extractDeviationInfo(deviationArray, isCanceled) {
  if (isCanceled) return {isReplaced: false, description: 'CANCELED'};
  if (!deviationArray || !Array.isArray(deviationArray)) return {isReplaced: false, description: ''};

  let isReplaced = false;
  const descriptions = [];

  deviationArray.forEach((dev) => {
    if (dev.Description) {
      descriptions.push(dev.Description);
      const desc = dev.Description.toLowerCase();
      if (desc.includes('ersätt') || desc.includes('buss')) {
        isReplaced = true;
      }
    }
  });

  return {
    isReplaced,
    description: descriptions.join('; '),
  };
}

/**
 * Process raw train announcements into normalized format
 * @param {Array} announcements - Raw train announcements
 * @return {Array} Processed train data
 */
function processTrainAnnouncements(announcements) {
  const currentTime = new Date();
  const processed = [];

  announcements.forEach((train) => {
    // Skip trains that arrived more than 1 hour ago
    const actualTime = parseDateTime(train.TimeAtLocation);
    if (actualTime && (currentTime - actualTime) > 3600000) {
      return;
    }

    const {delayMinutes, delayStatus} = calculateDelay(
        train.AdvertisedTimeAtLocation,
        train.EstimatedTimeAtLocation,
        train.TimeAtLocation,
    );

    const {isReplaced, description} = extractDeviationInfo(
        train.Deviation,
        train.Canceled === true,
    );

    processed.push({
      trainNumber: train.AdvertisedTrainIdent,
      delayMinutes,
      delayStatus,
      isCanceled: train.Canceled === true,
      isReplaced,
      deviationDescription: description,
      estimatedTime: train.EstimatedTimeAtLocation || null,
      advertisedTime: train.AdvertisedTimeAtLocation,
      actualTime: train.TimeAtLocation || null,
      trackAtLocation: train.TrackAtLocation || null,
      fromLocation: train.FromLocation?.[0]?.LocationName || '',
      lastUpdated: currentTime.toISOString(),
    });
  });

  return processed;
}

/**
 * Generate summary statistics
 * @param {Array} trains - Array of processed trains
 * @return {Object} Summary statistics
 */
function generateSummary(trains) {
  return {
    total: trains.length,
    delayed: trains.filter((t) => t.delayStatus === 'DELAYED').length,
    early: trains.filter((t) => t.delayStatus === 'EARLY').length,
    canceled: trains.filter((t) => t.isCanceled).length,
    replaced: trains.filter((t) => t.isReplaced).length,
    avgDelay: trains.reduce((sum, t) => sum + (t.delayMinutes || 0), 0) / trains.length || 0,
    maxDelay: Math.max(...trains.map((t) => t.delayMinutes || 0), 0),
  };
}

/**
 * Fetch train announcements from Trafikverket API
 * @param {string} locationSignature - Location code
 * @return {Promise<Object>} Train data with summary
 */
async function fetchTrainAnnouncements(locationSignature) {
  const cacheKey = locationSignature;
  const cached = cache.get(cacheKey);

  // Return cached data if still valid
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    console.log(`[Cache] Returning cached data for ${locationSignature}`);
    return cached.data;
  }

  console.log(`[API] Fetching train announcements for ${locationSignature}`);

  const xmlRequest = buildTrafikverketRequest(locationSignature);

  try {
    const response = await fetch(TRAFIKVERKET_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
      },
      body: xmlRequest,
    });

    if (!response.ok) {
      throw new Error(`Trafikverket API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Extract train announcements
    let announcements = [];
    if (data.RESPONSE && data.RESPONSE.RESULT) {
      data.RESPONSE.RESULT.forEach((result) => {
        if (result.TrainAnnouncement) {
          announcements = announcements.concat(result.TrainAnnouncement);
        }
      });
    }

    console.log(`[API] Fetched ${announcements.length} train announcements`);

    // Process announcements
    const trains = processTrainAnnouncements(announcements);
    const summary = generateSummary(trains);

    const result = {
      trains,
      summary,
      lastUpdated: new Date().toISOString(),
    };

    // Cache the result
    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    });

    return result;
  } catch (error) {
    console.error('[API] Error fetching train announcements:', error);
    throw error;
  }
}

/**
 * HTTP Cloud Function: Get train announcements
 * Endpoint: /trv/announcements?location=G
 */
exports.getTrainAnnouncements = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({error: 'Method not allowed'});
    return;
  }

  const locationSignature = req.query.location || LOCATION_SIGNATURE;

  try {
    const data = await fetchTrainAnnouncements(locationSignature);
    res.status(200).json(data);
  } catch (error) {
    console.error('[Function] Error:', error);
    res.status(500).json({
      error: 'Failed to fetch train announcements',
      message: error.message,
    });
  }
});

/**
 * Scheduled Function: Update train data every minute
 * This keeps the cache warm for the frontend
 */
exports.scheduledTrainUpdate = functions.pubsub
    .schedule('every 1 minutes')
    .timeZone('Europe/Stockholm')
    .onRun(async (context) => {
      console.log('[Scheduled] Updating train data...');
      try {
        await fetchTrainAnnouncements(LOCATION_SIGNATURE);
        console.log('[Scheduled] Train data updated successfully');
      } catch (error) {
        console.error('[Scheduled] Error updating train data:', error);
      }
    });

