// Context Menu Handlers
(function() {
    'use strict';

    function showContextMenu(x, y, trainId) {
        const contextMenu = window.AppElements.contextMenu;
        contextMenu.style.left = `${x}px`; 
        contextMenu.style.top = `${y}px`;
        contextMenu.style.display = 'block'; 
        contextMenu.dataset.trainId = trainId;
    }

    function hideContextMenu() { 
        window.AppElements.contextMenu.style.display = 'none'; 
    }

    function handleContextMenuAction(e) {
        const action = e.target.dataset.action;
        const trainIdString = window.AppElements.contextMenu.dataset.trainId;

        if (!action || !trainIdString) return;
        const trainId = parseInt(trainIdString);
        if (isNaN(trainId)) return;

        hideContextMenu();
        switch (action) {
            case 'edit': 
                if (typeof openTrainModalForEdit !== 'undefined') openTrainModalForEdit(trainId); 
                break;
            case 'delete': 
                if (typeof handleDeleteTrain !== 'undefined') handleDeleteTrain(trainId); 
                break;
            case 'swap': 
                if (typeof initiateSwap !== 'undefined') initiateSwap(trainId); 
                break;
            case 'split': 
                if (typeof handleSplitTrain !== 'undefined') handleSplitTrain(trainId); 
                break;
        }
    }

    // Expose functions globally
    window.showContextMenu = showContextMenu;
    window.hideContextMenu = hideContextMenu;
    window.handleContextMenuAction = handleContextMenuAction;

})(); 