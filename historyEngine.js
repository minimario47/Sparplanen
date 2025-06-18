// historyEngine.js - Action History and Undo/Redo Management

class HistoryEngine {
    constructor() {
        this.maxHistorySize = 100; // Maximum number of actions to store
        this.actionTypes = {
            TRAIN_ADD: 'train_add',
            TRAIN_DELETE: 'train_delete',
            TRAIN_EDIT: 'train_edit',
            TRAIN_MOVE: 'train_move',
            TRAIN_RESIZE: 'train_resize',
            TRAIN_SWAP: 'train_swap',
            TRAIN_SPLIT: 'train_split',
            VIEW_CHANGE: 'view_change',
            BATCH_OPERATION: 'batch_operation',
            IMPORT_DATA: 'import_data',
            CLEAR_ALL: 'clear_all'
        };
    }


    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (typeof obj === 'object') {
            const clonedObj = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = this.deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
        return obj;
    }


    initializeHistory(state) {
        if (!state.actionHistory) {
            state.actionHistory = [];
        }
        if (typeof state.historyPointer === 'undefined') {
            state.historyPointer = -1;
        }
        return state;
    }


    logAction(state, actionType, description, dataBefore, dataAfter = null, metadata = {}) {
        this.initializeHistory(state);

        if (state.historyPointer < state.actionHistory.length - 1) {
            state.actionHistory = state.actionHistory.slice(0, state.historyPointer + 1);
        }


        const actionRecord = {
            id: this.generateActionId(),
            timestamp: new Date().toISOString(),
            type: actionType,
            description: description,
            previousTrainData: this.deepClone(dataBefore),
            newTrainData: dataAfter ? this.deepClone(dataAfter) : this.deepClone(state.trains),
            metadata: {
                ...metadata,
                userAgent: navigator.userAgent,
                viewState: {
                    currentStartHour: state.currentStartHour,
                    viewHours: state.viewHours,
                    selectedTrainId: state.selectedTrainId
                }
            }
        };


        state.actionHistory.push(actionRecord);
        state.historyPointer = state.actionHistory.length - 1;


        if (state.actionHistory.length > this.maxHistorySize) {
            const removeCount = state.actionHistory.length - this.maxHistorySize;
            state.actionHistory.splice(0, removeCount);
            state.historyPointer -= removeCount;
        }


        console.log(`Action logged: ${description}`, {
            type: actionType,
            id: actionRecord.id,
            historyLength: state.actionHistory.length,
            pointer: state.historyPointer
        });

        return actionRecord.id;
    }


    undoLastAction(state) {
        this.initializeHistory(state);

        if (state.historyPointer >= 0) {
            const action = state.actionHistory[state.historyPointer];
            
            console.log(`Undoing action: ${action.description}`);
            
            state.trains = this.deepClone(action.previousTrainData);
            
            if (action.metadata.viewState) {
                state.currentStartHour = action.metadata.viewState.currentStartHour;
                state.viewHours = action.metadata.viewState.viewHours;
                state.selectedTrainId = null;
            }
            
            state.historyPointer--;
            
            state.swappingState = { active: false, sourceTrainId: null };
            
            console.log(`Undo successful. History pointer now at: ${state.historyPointer}`);
            return true;
        } else {
            console.log('No actions to undo');
            return false;
        }
    }


    redoNextAction(state) {
        this.initializeHistory(state);

        if (state.historyPointer < state.actionHistory.length - 1) {

            state.historyPointer++;
            const action = state.actionHistory[state.historyPointer];
            
            console.log(`Redoing action: ${action.description}`);
            

            state.trains = this.deepClone(action.newTrainData);
            

            if (action.metadata.viewState) {
                state.currentStartHour = action.metadata.viewState.currentStartHour;
                state.viewHours = action.metadata.viewState.viewHours;
                state.selectedTrainId = null;
            }
            

            state.swappingState = { active: false, sourceTrainId: null };
            
            console.log(`Redo successful. History pointer now at: ${state.historyPointer}`);
            return true;
        } else {
            console.log('No actions to redo');
            return false;
        }
    }


    revertToAction(state, actionIndex) {
        this.initializeHistory(state);

        if (actionIndex >= 0 && actionIndex < state.actionHistory.length) {
            const action = state.actionHistory[actionIndex];
            
            console.log(`Reverting to action: ${action.description} (index ${actionIndex})`);
            

            state.trains = this.deepClone(action.newTrainData);
            state.historyPointer = actionIndex;
            

            if (action.metadata.viewState) {
                state.currentStartHour = action.metadata.viewState.currentStartHour;
                state.viewHours = action.metadata.viewState.viewHours;
            }
            

            state.selectedTrainId = null;
            state.swappingState = { active: false, sourceTrainId: null };
            
            console.log(`Reverted successfully to action index: ${actionIndex}`);
            return true;
        } else {
            console.error('Invalid action index for revert:', actionIndex);
            return false;
        }
    }


    getHistorySummary(state) {
        this.initializeHistory(state);

        return state.actionHistory.map((action, index) => ({
            index: index,
            id: action.id,
            timestamp: new Date(action.timestamp),
            type: action.type,
            description: action.description,
            isCurrent: index === state.historyPointer,
            canRevertTo: true,
            metadata: action.metadata
        }));
    }


    getUndoRedoStatus(state) {
        this.initializeHistory(state);

        return {
            canUndo: state.historyPointer >= 0,
            canRedo: state.historyPointer < state.actionHistory.length - 1,
            undoDescription: state.historyPointer >= 0 ? 
                state.actionHistory[state.historyPointer].description : null,
            redoDescription: state.historyPointer < state.actionHistory.length - 1 ? 
                state.actionHistory[state.historyPointer + 1].description : null,
            historyLength: state.actionHistory.length,
            currentPosition: state.historyPointer + 1
        };
    }


    clearHistory(state) {
        state.actionHistory = [];
        state.historyPointer = -1;
        console.log('History cleared');
    }


    exportHistory(state) {
        this.initializeHistory(state);

        const exportData = {
            version: '1.0',
            exportTimestamp: new Date().toISOString(),
            totalActions: state.actionHistory.length,
            currentPointer: state.historyPointer,
            history: state.actionHistory.map(action => ({
                ...action,
                previousTrainData: `[${action.previousTrainData.length} trains]`,
                newTrainData: `[${action.newTrainData.length} trains]`
            }))
        };

        return exportData;
    }


    generateActionId() {
        return 'action_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }


    startBatch(state, batchDescription) {
        this.initializeHistory(state);
        
        state._batchOperation = {
            active: true,
            description: batchDescription,
            startState: this.deepClone(state.trains),
            startTime: Date.now()
        };
    }


    endBatch(state) {
        if (state._batchOperation && state._batchOperation.active) {
            const batch = state._batchOperation;
            
            this.logAction(
                state,
                this.actionTypes.BATCH_OPERATION,
                batch.description,
                batch.startState,
                this.deepClone(state.trains),
                {
                    batchDuration: Date.now() - batch.startTime,
                    operationCount: 'multiple'
                }
            );
            
            delete state._batchOperation;
            console.log(`Batch operation completed: ${batch.description}`);
        }
    }


    cancelBatch(state) {
        if (state._batchOperation && state._batchOperation.active) {
            // Restore to batch start state
            state.trains = this.deepClone(state._batchOperation.startState);
            delete state._batchOperation;
            console.log('Batch operation cancelled');
        }
    }


    isInBatch(state) {
        return state._batchOperation && state._batchOperation.active;
    }


    smartLogAction(state, actionType, description, dataBefore, dataAfter = null, metadata = {}) {
        if (this.isInBatch(state)) {
            console.log(`Batch mode: Skipping individual log for: ${description}`);
            return null;
        }
        
        return this.logAction(state, actionType, description, dataBefore, dataAfter, metadata);
    }


    getActionStatistics(state) {
        this.initializeHistory(state);

        const stats = {
            totalActions: state.actionHistory.length,
            actionsByType: {},
            actionsPerHour: {},
            averageTimeBetweenActions: 0,
            mostActiveHour: null,
            sessionDuration: 0
        };

        if (state.actionHistory.length === 0) return stats;


        state.actionHistory.forEach(action => {
            stats.actionsByType[action.type] = (stats.actionsByType[action.type] || 0) + 1;
            
            const hour = new Date(action.timestamp).getHours();
            stats.actionsPerHour[hour] = (stats.actionsPerHour[hour] || 0) + 1;
        });


        let maxActions = 0;
        for (const [hour, count] of Object.entries(stats.actionsPerHour)) {
            if (count > maxActions) {
                maxActions = count;
                stats.mostActiveHour = parseInt(hour);
            }
        }


        const firstAction = new Date(state.actionHistory[0].timestamp);
        const lastAction = new Date(state.actionHistory[state.actionHistory.length - 1].timestamp);
        stats.sessionDuration = lastAction - firstAction;

        if (state.actionHistory.length > 1) {
            stats.averageTimeBetweenActions = stats.sessionDuration / (state.actionHistory.length - 1);
        }

        return stats;
    }
}


const historyEngine = new HistoryEngine(); 