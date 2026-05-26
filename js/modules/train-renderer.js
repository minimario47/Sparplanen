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
            
            trainPositions.forEach((placement) => {
                const { train } = placement;
                const trainDiv = this._createTrainElement(
                    train, placement, trackLayout, startTime, pixelsPerHour
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
    _createTrainElement(train, placement, trackLayout, startTime, pixelsPerHour) {
        const laneStart = placement?.laneStart ?? placement?.position ?? 0;
        const laneSpan = Math.max(1, placement?.laneSpan || train.vehicleCount || train.trainSet?.count || 1);
        const totalOverlapping = placement?.totalOverlapping || trackLayout.laneCount || 1;
        const trackLaneCount = Math.max(1, trackLayout.laneCount || 1);
        const lanePressure = Math.max(1, totalOverlapping || 1);
        const isCompressed = lanePressure > 3;
        const laneHeight = trackLayout.laneHeight || this._getTrainHeight(totalOverlapping);
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
        
        const verticalPadding = isCompressed ? (trackLaneCount >= 3 ? 1 : (trackLaneCount === 2 ? 2 : 3)) : 1;
        const visualLaneCount = isCompressed
            ? trackLaneCount
            : Math.max(3, placement?.visualLaneCount || 3);
        const visualLaneSpan = isCompressed
            ? laneSpan
            : Math.min(Math.max(1, placement?.visualLaneSpan || laneSpan), visualLaneCount);
        const visualLaneStartRaw = isCompressed
            ? laneStart
            : (placement?.visualLaneStart ?? laneStart);
        const visualLaneStart = isCompressed
            ? visualLaneStartRaw
            : Math.min(Math.max(0, visualLaneStartRaw), Math.max(0, visualLaneCount - visualLaneSpan));
        const visualLaneHeight = isCompressed ? laneHeight : (trackLayout.height / visualLaneCount);
        const visibleTrainHeight = Math.max(visualLaneHeight * visualLaneSpan - verticalPadding * 2, 8);
        trainDiv.style.height = `${visibleTrainHeight}px`;
        trainDiv.style.top = `${trackLayout.top + (visualLaneStart * visualLaneHeight) + verticalPadding}px`;
        trainDiv.style.zIndex = 10 + laneStart;
        trainDiv.dataset.baseZIndex = String(10 + laneStart);
        
        trainDiv.dataset.trainId = train.id;
        trainDiv.dataset.arrival = train.arrivalTrainNumber || '';
        trainDiv.dataset.departure = train.departureTrainNumber || '';
        trainDiv.dataset.arrivalLabel = train.arrivalLabel || '';
        trainDiv.dataset.departureLabel = train.departureLabel || '';
        trainDiv.dataset.bucket = train.lengthClass;
        trainDiv.dataset.subTrackIndex = String(train.subTrackIndex ?? laneStart);
        trainDiv.dataset.vehicleCount = String(laneSpan);
        trainDiv.dataset.lanePressure = String(lanePressure);
        trainDiv.dataset.trackLaneCount = String(trackLaneCount);
        trainDiv.dataset.visualLaneStart = String(visualLaneStart);
        trainDiv.dataset.visualLaneSpan = String(visualLaneSpan);
        trainDiv.dataset.totalOverlapping = String(totalOverlapping);
        if (train.connectionGroupId) {
            trainDiv.dataset.connectionGroupId = train.connectionGroupId;
        }

        if (train.status === 'conflict') trainDiv.classList.add('has-conflict');
        if (train.status === 'delayed') trainDiv.classList.add('is-delayed');
        if (laneSpan > 1) trainDiv.classList.add('is-multi-vehicle');
        if (train.connectedTo) trainDiv.classList.add('is-connected-train');

        const isVeryNarrow = width < 60;
        const isNarrow = width < 100;
        
        const hasArrival = !!train.arrivalTrainNumber;
        const hasDeparture = !!train.departureTrainNumber;
        const arrivalDisplay = train.arrivalTrainNumber || train.arrivalLabel || '';
        const departureDisplay = train.departureTrainNumber || train.departureLabel || '';
        const hasArrivalDisplay = !!arrivalDisplay;
        const hasDepartureDisplay = !!departureDisplay;
        const sameNumber = train.arrivalTrainNumber === train.departureTrainNumber;
        
        const displaySingleNumber = sameNumber || isVeryNarrow || !(hasArrivalDisplay && hasDepartureDisplay);
        const singleNumber = arrivalDisplay || departureDisplay;

        let fontSizePx;
        if (isCompressed) {
            fontSizePx = visibleTrainHeight >= 24 ? 12 : (visibleTrainHeight >= 14 ? 10 : 9);
        } else if (laneSpan >= 2) {
            fontSizePx = Math.min(16, Math.max(13, Math.round(visibleTrainHeight * 0.48)));
        } else {
            const cap = lanePressure <= 1 ? 16 : 13;
            fontSizePx = Math.min(cap, Math.max(11, Math.ceil(visibleTrainHeight * 0.82)));
        }
        if (isVeryNarrow) {
            fontSizePx = Math.min(fontSizePx, 11);
        } else if (isNarrow) {
            fontSizePx = Math.min(fontSizePx, 12);
        }
        const fontSize = `${fontSizePx}px`;

        let numbersHTML = '';
        let singleAlignClass = '';
        if (displaySingleNumber) {
            if (hasArrivalDisplay && !hasDepartureDisplay) {
                singleAlignClass = 'single-left';
            } else if (!hasArrivalDisplay && hasDepartureDisplay) {
                singleAlignClass = 'single-right';
            } else {
                singleAlignClass = 'single-centered';
            }
            numbersHTML = `<div class="train-number-value">${this._escape(singleNumber || '')}</div>`;
        } else {
            numbersHTML = `
                <div class="train-number-value">${this._escape(arrivalDisplay || '')}</div>
                <div class="train-number-value">${this._escape(departureDisplay || '')}</div>
            `;
        }

        const statusIconHTML = train.status === 'conflict' 
            ? '<div class="status-icon" title="Konflikt! ⚠️"></div>' 
            : '';
        
        const defaultHoverNumber = arrivalDisplay || departureDisplay || '';
        const tooltipHTML = showHoverTooltip ? `
            <div class="train-tooltip">
                <div class="train-tooltip-number">Tåg <span class="train-tooltip-number-value">${this._escape(defaultHoverNumber)}</span></div>
                ${train.origin ? `<div class="train-tooltip-meta">Från: ${this._escape(train.origin)}</div>` : ''}
                ${train.dest ? `<div class="train-tooltip-meta">Till: ${this._escape(train.dest)}</div>` : ''}
                ${laneSpan > 1 ? `<div class="train-tooltip-meta">${laneSpan} fordon</div>` : ''}
            </div>
        ` : '';

        const densityClass = lanePressure >= 3 ? 'density-3' : (lanePressure === 2 ? 'density-2' : 'density-1');
        const dividerHTML = laneSpan > 1
            ? Array.from({ length: laneSpan - 1 }, (_, idx) => {
                const top = ((idx + 1) / laneSpan) * 100;
                return `<div class="train-vehicle-divider" style="top:${top}%"></div>`;
            }).join('')
            : '';

        trainDiv.innerHTML = `
            <div class="train-bar-visual">
                ${dividerHTML}
                ${statusIconHTML}
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
            if (!(hasArrivalDisplay && hasDepartureDisplay) || arrivalDisplay === departureDisplay) {
                return;
            }
            const tooltipNumber = trainDiv.querySelector('.train-tooltip-number-value');
            if (!tooltipNumber) return;
            const rect = trainDiv.getBoundingClientRect();
            const onRightSide = (e.clientX - rect.left) >= rect.width / 2;
            tooltipNumber.textContent = onRightSide ? departureDisplay : arrivalDisplay;
        });
        trainDiv.addEventListener('click', () => {
            document.querySelectorAll('.train-bar.is-selected').forEach(el => el.classList.remove('is-selected'));
            trainDiv.classList.add('is-selected');
            console.log('🚂 Tåg valt:', {
                id: train.id,
                ankomst: train.arrivalTrainNumber,
                avgång: train.departureTrainNumber,
                etikett: train.arrivalLabel || train.departureLabel,
                spår: train.trackId,
                delspår: train.subTrackIndex,
                fordon: laneSpan,
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
    },

    _escape(value) {
        return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[ch]));
    }
};
