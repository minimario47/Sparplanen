// Time Navigation Handlers
(function() {
    'use strict';

    function handlePrevTime() {
        const state = window.AppState;
        state.currentStartHour = Math.max(0, state.currentStartHour - state.viewHours);
        if (typeof render !== 'undefined') render();
        // Update current time line when view changes
        if (typeof updateCurrentTimeLine === 'function') updateCurrentTimeLine();
    }

    function handleNextTime() {
        const state = window.AppState;
        const config = window.AppConfig;
        const maxStartHour = Math.max(0, config.totalHours - state.viewHours);
        state.currentStartHour = Math.min(maxStartHour, state.currentStartHour + state.viewHours);
        if (typeof render !== 'undefined') render();
        // Update current time line when view changes
        if (typeof updateCurrentTimeLine === 'function') updateCurrentTimeLine();
    }

    function handleViewHoursChange(e) {
        const state = window.AppState;
        const config = window.AppConfig;
        const dataBefore = (typeof historyEngine !== 'undefined') ? historyEngine.deepClone(state.trains) : JSON.parse(JSON.stringify(state.trains));
        const newViewHours = parseInt(e.target.value);
        const oldViewHours = state.viewHours;
        state.viewHours = newViewHours;
        const maxStartHour = Math.max(0, config.totalHours - state.viewHours);
        if (state.currentStartHour > maxStartHour) state.currentStartHour = maxStartHour;
        if (typeof render !== 'undefined') render();
        // Update current time line when view hours change
        if (typeof updateCurrentTimeLine === 'function') updateCurrentTimeLine();
        if (typeof window.saveAndLog !== 'undefined' && typeof historyEngine !== 'undefined') {
            window.saveAndLog(historyEngine.actionTypes.VIEW_CHANGE, `Ändrade vy från ${oldViewHours} till ${newViewHours} timmar`, dataBefore);
        }
    }

    // Expose functions globally
    window.handlePrevTime = handlePrevTime;
    window.handleNextTime = handleNextTime;
    window.handleViewHoursChange = handleViewHoursChange;

})(); 