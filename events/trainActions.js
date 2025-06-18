// Train Action Handlers
(function() {
    'use strict';

    function handleAddTrainClick() { 
        if (typeof openTrainModalForAdd !== 'undefined') openTrainModalForAdd(); 
    }

    function setSelectedTrain(trainId) {
        const state = window.AppState;
        if (state.swappingState.active && state.swappingState.sourceTrainId === trainId) {
            return;
        }
        if (state.swappingState.active && state.swappingState.sourceTrainId !== trainId) {
            return;
        }

        state.selectedTrainId = trainId;
        document.querySelectorAll('.train-bar.selected').forEach(b => b.classList.remove('selected'));
        const trainBar = document.querySelector(`.train-bar[data-train-id='${trainId}']`);
        if (trainBar) trainBar.classList.add('selected');
    }

    function clearSelection() {
        const state = window.AppState;
        if (state.swappingState.active) return;
        state.selectedTrainId = null;
        document.querySelectorAll('.train-bar.selected').forEach(b => b.classList.remove('selected'));
    }

    window.handleAddTrainClick = handleAddTrainClick;
    window.setSelectedTrain = setSelectedTrain;
    window.clearSelection = clearSelection;

})(); 