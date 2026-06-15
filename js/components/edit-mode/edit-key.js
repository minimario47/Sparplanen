/**
 * Edit Key — stable natural identity for board edits.
 *
 * Record `id` in trains.js is POSITIONAL and renumbers on every weekly regen,
 * so keying edits by id would silently re-bind them to unrelated trains. We key
 * instead on a stable composite of domain fields that survives the regen:
 *
 *   week | day | plannedTrackId | subTrackIndex | arrPart | depPart
 *
 * where arrPart/depPart prefer the train NUMBER ("3593@00:19"), fall back to a
 * label for numberless operation bars ("L:MVH@00:34"), and finally to time
 * only. `plannedTrackId` is the FROZEN planned track (never the live/edited
 * `trackId`) so the key stays valid across a manual re-track.
 *
 * Public API (window.EditKey):
 *   buildEditKey(train)        → string
 *   resolveEditKey(key, trains)→ { matches: Array<train>, count: number }
 *   hhmm(date)                 → 'HH:MM' | ''
 */
(function () {
    'use strict';

    function hhmm(d) {
        if (!(d instanceof Date) || isNaN(d.getTime())) return '';
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        return `${h}:${m}`;
    }

    function legPart(num, label, time) {
        const n = String(num || '').trim();
        const t = hhmm(time);
        if (n) return `${n}@${t}`;
        const l = String(label || '').trim();
        if (l) return `L:${l}@${t}`;
        return t ? `@${t}` : '';
    }

    function buildEditKey(train) {
        if (!train || typeof train !== 'object') return '';
        const sel = window.currentScheduleSelection || {};
        const week = sel.week || '?';
        const day = sel.day || '?';
        const track = Number.isFinite(train.plannedTrackId)
            ? train.plannedTrackId
            : parseInt(train.plannedTrackId ?? train.trackId, 10);
        // Frozen sub-lane: a re-track mutates live subTrackIndex, so key off the
        // planned one (falls back to live for records predating the freeze).
        const subSource = train.plannedSubTrackIndex ?? train.subTrackIndex;
        const sub = Number.isFinite(subSource) ? subSource : 0;
        const arrPart = legPart(train.arrivalTrainNumber, train.arrivalLabel, train.arrTime);
        const depPart = legPart(train.departureTrainNumber, train.departureLabel, train.depTime);
        return `${week}|${day}|${track}|${sub}|${arrPart}|${depPart}`;
    }

    function resolveEditKey(key, trains) {
        const list = Array.isArray(trains) ? trains : [];
        if (!key) return { matches: [], count: 0 };
        const matches = list.filter((t) => buildEditKey(t) === key);
        return { matches, count: matches.length };
    }

    window.EditKey = { buildEditKey, resolveEditKey, hhmm };
})();
