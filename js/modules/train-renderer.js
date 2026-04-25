/**
 * Train Rendering Engine - Complete railway case support
 */

window.TrainRenderer = {
    
    /**
     * Render all trains with dynamic positioning
     */
    renderTrains(trains, trackLayouts, startTime, pixelsPerHour, userSettings) {
        const timelineCanvas = document.getElementById('timeline-canvas');
        if (!timelineCanvas) return;
        
        const trainsByTrack = trains.reduce((acc, train) => {
            if (!acc[train.trackId]) acc[train.trackId] = [];
            acc[train.trackId].push(train);
            return acc;
        }, {});

        for (const trackId in trainsByTrack) {
            const trackTrains = trainsByTrack[trackId];
            const trackLayout = trackLayouts.find(t => t.id === parseInt(trackId));
            if (!trackLayout) continue;

            const trainPositions = window.TrainPositioning.calculateTrainPositions(trackTrains);
            
            if (trainPositions.length > 0) {
                const maxOverlap = Math.max(...trainPositions.map(tp => tp.totalOverlapping));
                console.log(`🚂 Spår ${trackId}: Max ${maxOverlap} tåg samtidigt`);
                
                if (maxOverlap > 1) {
                    trainPositions.forEach(({ train, position, totalOverlapping }) => {
                        const trainNum = train.arrivalTrainNumber || train.departureTrainNumber;
                        const arrTime = train.arrTime ? train.arrTime.toTimeString().substring(0,5) : '--';
                        const depTime = train.depTime ? train.depTime.toTimeString().substring(0,5) : '--';
                        console.log(`  Tåg ${trainNum} (${arrTime}-${depTime}): Position ${position}`);
                    });
                }
            }
            
            trainPositions.forEach(({ train, position, totalOverlapping }) => {
                const trainDiv = this._createTrainElement(
                    train, position, totalOverlapping, trackLayout, startTime, pixelsPerHour
                );
                if (trainDiv) {
                    timelineCanvas.appendChild(trainDiv);
                    setTimeout(() => window.ColorUtils.applyDynamicTextContrast(trainDiv, userSettings), 0);
                }
            });
        }
    },

    /**
     * Internal: Create a single train element
     */
    _createTrainElement(train, position, totalOverlapping, trackLayout, startTime, pixelsPerHour) {
        const trainHeight = this._getTrainHeight(totalOverlapping);
        const bottomOffset = position * trainHeight;
        const showHoverTooltip = userSettings?.hoverTooltipEnabled !== false;
        
        const arrMinutes = train.arrTime ? (train.arrTime - startTime) / (1000 * 60) : null;
        const depMinutes = train.depTime ? (train.depTime - startTime) / (1000 * 60) : null;
        
        let left = 0, width = 0;
        const minWidthPx = 40;
        const arrivalOnlyWidth = 80;
        const departureOnlyWidth = 80;

        if (arrMinutes !== null && depMinutes !== null) {
            left = (arrMinutes / 60) * pixelsPerHour;
            const calculatedWidth = ((depMinutes - arrMinutes) / 60) * pixelsPerHour;
            width = Math.max(calculatedWidth, minWidthPx);
        } else if (arrMinutes !== null && !train.departureTrainNumber) {
            left = (arrMinutes / 60) * pixelsPerHour;
            width = arrivalOnlyWidth;
        } else if (depMinutes !== null && !train.arrivalTrainNumber) {
            left = (depMinutes / 60) * pixelsPerHour - departureOnlyWidth;
            width = departureOnlyWidth;
        } else {
            return null;
        }

        const trainDiv = document.createElement('div');
        trainDiv.className = `train-bar type-${train.type}`;
        trainDiv.style.left = `${left}px`;
        trainDiv.style.width = `${width}px`;
        
        const verticalPadding = totalOverlapping >= 3 ? 1 : (totalOverlapping === 2 ? 2 : 3);
        trainDiv.style.height = `${Math.max(trainHeight - verticalPadding * 2, 8)}px`;
        trainDiv.style.top = `${trackLayout.top + (trackLayout.height - bottomOffset - trainHeight) + verticalPadding}px`;
        trainDiv.style.zIndex = 10 + position;
        trainDiv.dataset.baseZIndex = String(10 + position);
        
        trainDiv.dataset.trainId = train.id;
        trainDiv.dataset.arrival = train.arrivalTrainNumber || '';
        trainDiv.dataset.departure = train.departureTrainNumber || '';
        trainDiv.dataset.bucket = train.lengthClass;

        if (train.status === 'conflict') trainDiv.classList.add('has-conflict');
        if (train.status === 'delayed') trainDiv.classList.add('is-delayed');
        if (train.connectedTo) trainDiv.classList.add('has-connection');

        const isVeryNarrow = width < 60;
        const isNarrow = width < 100;
        const isCompressed = totalOverlapping >= 3;
        
        const hasArrival = !!train.arrivalTrainNumber;
        const hasDeparture = !!train.departureTrainNumber;
        const sameNumber = train.arrivalTrainNumber === train.departureTrainNumber;
        
        const displaySingleNumber = sameNumber || isVeryNarrow || !(hasArrival && hasDeparture);
        const singleNumber = train.arrivalTrainNumber || train.departureTrainNumber;

        let fontSize = '14px';
        if (isCompressed || isNarrow) fontSize = '12px';
        if (trainHeight < 20) fontSize = '10px';
        if (trainHeight < 16) fontSize = '9px';

        let numbersHTML = '';
        let singleAlignClass = '';
        if (displaySingleNumber) {
            if (hasArrival && !hasDeparture) {
                singleAlignClass = 'single-left';
            } else if (!hasArrival && hasDeparture) {
                singleAlignClass = 'single-right';
            } else {
                singleAlignClass = 'single-centered';
            }
            numbersHTML = `<div class="train-number-value">${singleNumber || ''}</div>`;
        } else {
            numbersHTML = `
                <div class="train-number-value">${train.arrivalTrainNumber || ''}</div>
                <div class="train-number-value">${train.departureTrainNumber || ''}</div>
            `;
        }

        const statusIconHTML = train.status === 'conflict' 
            ? '<div class="status-icon" title="Konflikt! ⚠️"></div>' 
            : '';
        
        const connectionIconHTML = train.connectedTo 
            ? '<div class="connection-icon" title="Kopplad tåg 🔗"></div>' 
            : '';

        const defaultHoverNumber = train.arrivalTrainNumber || train.departureTrainNumber || '';
        const tooltipHTML = showHoverTooltip ? `
            <div class="train-tooltip">
                <div class="train-tooltip-number">Tåg <span class="train-tooltip-number-value">${defaultHoverNumber}</span></div>
                ${train.origin ? `<div class="train-tooltip-meta">Från: ${train.origin}</div>` : ''}
                ${train.dest ? `<div class="train-tooltip-meta">Till: ${train.dest}</div>` : ''}
            </div>
        ` : '';

        const densityClass = totalOverlapping >= 3 ? 'density-3' : (totalOverlapping === 2 ? 'density-2' : 'density-1');

        trainDiv.innerHTML = `
            <div class="train-bar-visual">
                ${statusIconHTML}
                ${connectionIconHTML}
                <div class="train-numbers ${displaySingleNumber ? singleAlignClass : ''}" style="font-size: ${fontSize};">
                    ${numbersHTML}
                </div>
            </div>
            ${tooltipHTML}
        `;

        trainDiv.classList.add(`len-${train.lengthClass}`, densityClass);

        trainDiv.addEventListener('mouseenter', () => {
            trainDiv.classList.add('is-hovered');
            trainDiv.style.zIndex = '2200';
        });
        trainDiv.addEventListener('mouseleave', () => {
            trainDiv.classList.remove('is-hovered');
            trainDiv.style.zIndex = trainDiv.dataset.baseZIndex || String(10 + position);
        });
        trainDiv.addEventListener('mousemove', (e) => {
            if (!showHoverTooltip) return;
            if (!(hasArrival && hasDeparture) || train.arrivalTrainNumber === train.departureTrainNumber) {
                return;
            }
            const tooltipNumber = trainDiv.querySelector('.train-tooltip-number-value');
            if (!tooltipNumber) return;
            const rect = trainDiv.getBoundingClientRect();
            const onRightSide = (e.clientX - rect.left) >= rect.width / 2;
            tooltipNumber.textContent = onRightSide ? train.departureTrainNumber : train.arrivalTrainNumber;
        });
        trainDiv.addEventListener('click', () => {
            document.querySelectorAll('.train-bar.is-selected').forEach(el => el.classList.remove('is-selected'));
            trainDiv.classList.add('is-selected');
            console.log('🚂 Tåg valt:', {
                id: train.id,
                ankomst: train.arrivalTrainNumber,
                avgång: train.departureTrainNumber,
                spår: train.trackId,
                status: train.status
            });
        });
        
        return trainDiv;
    },

    /**
     * Internal: Get train height based on overlap count
     */
    _getTrainHeight(totalTrains) {
        if (totalTrains === 1) return 48;
        if (totalTrains === 2) return 24;
        if (totalTrains === 3) return 16;
        if (totalTrains === 4) return 12;
        return 10;
    }
};
