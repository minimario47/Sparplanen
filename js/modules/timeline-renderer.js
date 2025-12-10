/**
 * Timeline Rendering - Hours, tracks, grid
 */

window.TimelineRenderer = {
    
    /**
     * Render timeline hours
     */
    renderTimelineHours(timelineStart, totalHours, pixelsPerHour) {
        const timelineHours = document.getElementById('timeline-hours');
        if (!timelineHours) return;
        
        timelineHours.innerHTML = '';
        
        const totalWidth = totalHours * pixelsPerHour;
        timelineHours.style.width = totalWidth + 'px';
        timelineHours.style.position = 'relative';
        
        const currentHour = new Date().getHours();
        
        for (let i = 0; i <= totalHours; i++) {
            const hourTime = new Date(timelineStart);
            hourTime.setHours(hourTime.getHours() + i);
            const hour = hourTime.getHours();
            
            const leftPosition = i * pixelsPerHour;
            
            const hourDiv = document.createElement('div');
            hourDiv.className = 'timeline-hour' + (hour === currentHour ? ' current' : '');
            hourDiv.style.position = 'absolute';
            hourDiv.style.left = leftPosition + 'px';
            hourDiv.style.width = pixelsPerHour + 'px';
            hourDiv.innerHTML = `<span class="timeline-hour-label">${hour.toString().padStart(2, '0')}:00</span>`;
            
            timelineHours.appendChild(hourDiv);
        }
    },

    /**
     * Render track labels
     */
    renderTrackLabels(trackLayouts, cachedTracks) {
        const trackLabels = document.getElementById('track-labels');
        trackLabels.innerHTML = '';
        
        trackLayouts.forEach(layout => {
            const trackDiv = document.createElement('div');
            trackDiv.className = 'track-row';
            trackDiv.style.height = `${layout.height}px`;

            const trackInfo = cachedTracks.find(t => t.id === layout.id);
            if (!trackInfo) return;

            trackDiv.innerHTML = `
                <div class="track-content">
                    <div class="track-name">${trackInfo.name}</div>
                    <div class="track-info">
                        <span class="track-length">
                            <span class="track-length-icon"></span>
                            ${trackInfo.length}m
                        </span>
                    </div>
                </div>
            `;
            trackLabels.appendChild(trackDiv);
        });
    },

    /**
     * Render timeline grid
     */
    renderTimelineGrid(trackLayouts, totalWidth, pixelsPerHour) {
        const timelineCanvas = document.getElementById('timeline-canvas');
        if (!timelineCanvas) return;

        // Clear old grid AND train elements
        const existingTrackRows = timelineCanvas.querySelectorAll('.timeline-track-row');
        existingTrackRows.forEach(row => row.remove());
        
        const existingTrains = timelineCanvas.querySelectorAll('.train-bar');
        existingTrains.forEach(train => train.remove());

        const totalHeight = trackLayouts.length > 0 ? trackLayouts[trackLayouts.length - 1].top + trackLayouts[trackLayouts.length - 1].height : 0;
        
        timelineCanvas.style.width = totalWidth + 'px';
        timelineCanvas.style.height = totalHeight + 'px';
        
        const totalHours = totalWidth / pixelsPerHour;

        trackLayouts.forEach(layout => {
            const trackRow = document.createElement('div');
            trackRow.className = 'timeline-track-row';
            trackRow.style.top = `${layout.top}px`;
            trackRow.style.height = `${layout.height}px`;
            trackRow.style.width = '100%';
            trackRow.style.position = 'absolute';

            const totalQuarterHours = totalHours * 4;
            for (let i = 0; i <= totalQuarterHours; i++) {
                const gridLine = document.createElement('div');
                gridLine.className = 'grid-line';
                const leftPercentage = (i / totalQuarterHours) * 100;
                gridLine.style.left = `${leftPercentage}%`;

                if (i % 4 === 0) {
                    gridLine.className = 'grid-line grid-line-hour';
                    gridLine.style.opacity = '1';
                    gridLine.style.width = '4px';
                    gridLine.style.backgroundColor = 'var(--neutral-400)';
                }

                trackRow.appendChild(gridLine);
            }

            timelineCanvas.appendChild(trackRow);
        });
    }
};
