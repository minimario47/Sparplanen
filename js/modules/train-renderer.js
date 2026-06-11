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

        // Batch all DOM insertions into one fragment (one layout pass instead
        // of one per train) and run the text-contrast pass once afterwards
        // instead of scheduling one setTimeout per train.
        const fragment = document.createDocumentFragment();
        const createdDivs = [];

        for (const trackId in trainsByTrack) {
            const trackTrains = trainsByTrack[trackId];
            const trackLayout = trackLayouts.find(t => t.id === parseInt(trackId));
            if (!trackLayout) continue;

            const trainPositions = window.TrainPositioning.calculateTrainPositions(trackTrains);

            if (window.__DEBUG_SCHEDULE_RENDER && trainPositions.length > 0) {
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
                    fragment.appendChild(trainDiv);
                    createdDivs.push(trainDiv);
                }
            });
        }

        timelineCanvas.appendChild(fragment);

        if (createdDivs.length > 0) {
            requestAnimationFrame(() => {
                // Read phase (getComputedStyle) for every train first, then one
                // write phase — interleaving the two forces a reflow per train.
                // Overview bars without numbers skip the (expensive) read.
                const numberEls = createdDivs.map((trainDiv) => trainDiv.querySelector('.train-numbers'));
                const colors = createdDivs.map((trainDiv, i) =>
                    numberEls[i] ? window.ColorUtils.computeDynamicTextColor(trainDiv, userSettings) : null
                );
                createdDivs.forEach((trainDiv, i) => {
                    if (!colors[i] || !numberEls[i]) return;
                    numberEls[i].style.color = colors[i];
                });
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

        // Overview mode (24h zoom): thousands of bars at once, so each bar
        // sheds its detail children (tooltip, dividers, mousemove) and the
        // min-width clamp is relaxed so dwell times aren't exaggerated 3-4x.
        const isOverview = pixelsPerHour < 80;

        let left = 0, width = 0;
        const minWidthPx = isOverview ? 12 : 40;
        const arrivalOnlyWidth = isOverview ? 30 : 80;
        const departureOnlyWidth = isOverview ? 30 : 80;

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

        // Clamp to the timeline canvas [0, timelineHours]. A bar can legitimately
        // start before 00:00 (overnight from yesterday) or run past 06:00 next
        // morning (a morning train departing after the window); the PDF itself
        // cuts bars at the page edge, so we draw to the edge instead of letting
        // them overflow and create blank over-scroll past the data.
        const canvasW = ((window.TimeManager && window.TimeManager.timelineHours) || 30) * pixelsPerHour;
        if (left < 0) { width += left; left = 0; }
        if (left + width > canvasW) width = canvasW - left;
        if (width <= 0) return null;

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
        // Anchor the packed lane stack to the BOTTOM of the track: lane 0 rests on
        // the floor and extra trains stack upward, so any breathing room (from the
        // min-lane padding on quiet tracks) sits empty at the top rather than the
        // bars floating up there. laneFromTop flips the lane index within the
        // track's visual lane count.
        const laneFromTop = Math.max(0, visualLaneCount - visualLaneStart - visualLaneSpan);
        trainDiv.style.top = `${trackLayout.top + (laneFromTop * visualLaneHeight) + verticalPadding}px`;
        trainDiv.style.zIndex = 10 + laneStart;
        trainDiv.dataset.baseZIndex = String(10 + laneStart);
        
        const segment = train._segment || null;
        if (segment) {
            trainDiv.dataset.segment = segment;
            trainDiv.classList.add('train-bar--torn', `train-bar--torn-${segment}`);
        }

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
        const showNumbers = !isOverview || width >= 48;
        if (isOverview) trainDiv.classList.add('is-overview');
        
        const hasArrival = !!train.arrivalTrainNumber;
        const hasDeparture = !!train.departureTrainNumber;
        const arrivalDisplay = train.arrivalTrainNumber || train.arrivalLabel || '';
        const departureDisplay = train.departureTrainNumber || train.departureLabel || '';
        const hasArrivalDisplay = !!arrivalDisplay;
        const hasDepartureDisplay = !!departureDisplay;
        const sameNumber = train.arrivalTrainNumber === train.departureTrainNumber;
        
        // A torn half shows only its own leg's number.
        const displaySingleNumber = !!segment || sameNumber || isVeryNarrow || !(hasArrivalDisplay && hasDepartureDisplay);
        const singleNumber = segment === 'departure'
            ? (departureDisplay || arrivalDisplay)
            : (segment === 'arrival'
                ? (arrivalDisplay || departureDisplay)
                : (arrivalDisplay || departureDisplay));

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
            if (segment) {
                // Number sits away from the torn edge, toward the outer end.
                singleAlignClass = segment === 'arrival' ? 'single-left' : 'single-right';
            } else if (hasArrivalDisplay && !hasDepartureDisplay) {
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
        
        const defaultHoverNumber = segment ? (singleNumber || '') : (arrivalDisplay || departureDisplay || '');
        const tooltipHTML = (showHoverTooltip && !isOverview) ? `
            <div class="train-tooltip">
                <div class="train-tooltip-number">Tåg <span class="train-tooltip-number-value">${this._escape(defaultHoverNumber)}</span></div>
                ${train.origin ? `<div class="train-tooltip-meta">Från: ${this._escape(train.origin)}</div>` : ''}
                ${train.dest ? `<div class="train-tooltip-meta">Till: ${this._escape(train.dest)}</div>` : ''}
                ${laneSpan > 1 ? `<div class="train-tooltip-meta">${laneSpan} fordon</div>` : ''}
            </div>
        ` : '';

        const densityClass = lanePressure >= 3 ? 'density-3' : (lanePressure === 2 ? 'density-2' : 'density-1');
        const dividerHTML = (laneSpan > 1 && !isOverview)
            ? Array.from({ length: laneSpan - 1 }, (_, idx) => {
                const top = ((idx + 1) / laneSpan) * 100;
                return `<div class="train-vehicle-divider" style="top:${top}%"></div>`;
            }).join('')
            : '';

        const numbersContainerHTML = showNumbers ? `
                <div class="train-numbers ${displaySingleNumber ? singleAlignClass : ''}" style="font-size: ${fontSize};">
                    ${numbersHTML}
                </div>` : '';

        trainDiv.innerHTML = `
            <div class="train-bar-visual">
                ${dividerHTML}
                ${statusIconHTML}${numbersContainerHTML}
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
            trainDiv.style.zIndex = trainDiv.dataset.baseZIndex || String(10 + laneStart);
        });
        trainDiv.addEventListener('mousemove', (e) => {
            if (!showHoverTooltip || segment || isOverview) return;
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
