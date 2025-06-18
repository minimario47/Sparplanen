// Utility Functions - Notifications, Helpers, and Common Functions
(function() {
    'use strict';

    function showNotification(message, type = 'info', duration = 6000) {
        const notificationArea = document.body;
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        // Calculate position based on existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        let topOffset = 20; // Initial top offset (var(--spacing-5))
        
        // Stack notifications below each other
        existingNotifications.forEach(existing => {
            const rect = existing.getBoundingClientRect();
            topOffset = Math.max(topOffset, rect.bottom - rect.top + parseInt(existing.style.top || '20') + 10);
        });
        
        notification.style.top = `${topOffset}px`;
        
        const messageSpan = document.createElement('span');
        messageSpan.textContent = message;
        notification.appendChild(messageSpan);
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '✕';
        closeButton.style.cssText = 'float: right; background: none; border: none; color: inherit; cursor: pointer; margin-left: 10px; padding: 0; font-size: 1em; line-height: 1;';
        closeButton.onclick = () => {
            notification.remove();
            repositionNotifications();
        };
        notification.appendChild(closeButton);
        notificationArea.appendChild(notification);
        
        setTimeout(() => { 
            if (notification.parentElement) {
                notification.remove(); 
                repositionNotifications();
            }
        }, duration);
    }
    
    // Helper function to reposition notifications after one is removed
    function repositionNotifications() {
        const notifications = document.querySelectorAll('.notification');
        let topOffset = 20;
        
        notifications.forEach(notification => {
            notification.style.top = `${topOffset}px`;
            const rect = notification.getBoundingClientRect();
            topOffset += rect.height + 10; // 10px gap between notifications
        });
    }

    // Color utility functions
    function darkenColor(hex, percent) {
        if (!hex || typeof hex !== 'string' || !hex.startsWith('#') || hex.length < 4) return '#000000';
        let R = 0, G = 0, B = 0;
        if (hex.length === 4) {
            R = parseInt(hex[1] + hex[1], 16); 
            G = parseInt(hex[2] + hex[2], 16); 
            B = parseInt(hex[3] + hex[3], 16);
        } else if (hex.length === 7) {
            R = parseInt(hex.slice(1, 3), 16); 
            G = parseInt(hex.slice(3, 5), 16); 
            B = parseInt(hex.slice(5, 7), 16);
        } else { 
            return '#000000'; 
        }
        R = Math.max(0, Math.floor(R * (100 - percent) / 100));
        G = Math.max(0, Math.floor(G * (100 - percent) / 100));
        B = Math.max(0, Math.floor(B * (100 - percent) / 100));
        return `#${R.toString(16).padStart(2, '0')}${G.toString(16).padStart(2, '0')}${B.toString(16).padStart(2, '0')}`;
    }

    function lightenColor(hex, percent) {
        if (!hex || typeof hex !== 'string' || !hex.startsWith('#') || hex.length < 4) return '#ffffff';
        let R = 0, G = 0, B = 0;
        if (hex.length === 4) {
            R = parseInt(hex[1] + hex[1], 16); 
            G = parseInt(hex[2] + hex[2], 16); 
            B = parseInt(hex[3] + hex[3], 16);
        } else if (hex.length === 7) {
            R = parseInt(hex.slice(1, 3), 16); 
            G = parseInt(hex.slice(3, 5), 16); 
            B = parseInt(hex.slice(5, 7), 16);
        } else { 
            return '#ffffff'; 
        }
        R = Math.min(255, Math.floor(R + (255 - R) * percent / 100));
        G = Math.min(255, Math.floor(G + (255 - G) * percent / 100));
        B = Math.min(255, Math.floor(B + (255 - B) * percent / 100));
        return `#${R.toString(16).padStart(2, '0')}${G.toString(16).padStart(2, '0')}${B.toString(16).padStart(2, '0')}`;
    }

    // Time utility functions (duplicated from app.js for clarity)
    function timeToMinutes(timeStr) {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    function minutesToTime(totalMinutes) {
        const hours = Math.floor(totalMinutes / 60) % 24;
        const minutes = Math.round(totalMinutes % 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    // Format helpers
    function formatDuration(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0) {
            return `${hours}h ${mins}m`;
        }
        return `${mins}m`;
    }

    function formatTimeRange(startTime, endTime) {
        return `${startTime} - ${endTime}`;
    }

    // Validation helpers
    function validateTimeFormat(timeStr) {
        if (!timeStr) return false;
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
        return timeRegex.test(timeStr);
    }

    function validateTimeRange(startTime, endTime) {
        if (!validateTimeFormat(startTime) || !validateTimeFormat(endTime)) {
            return { valid: false, message: 'Ogiltigt tidsformat' };
        }
        
        const startMinutes = timeToMinutes(startTime);
        const endMinutes = timeToMinutes(endTime);
        
        if (endMinutes <= startMinutes) {
            return { valid: false, message: 'Avgångstid måste vara efter ankomsttid' };
        }
        
        const duration = endMinutes - startMinutes;
        if (duration < 5) {
            return { valid: false, message: 'Tjänsten måste vara minst 5 minuter lång' };
        }
        
        return { valid: true, message: 'Tidsintervall är giltigt' };
    }

    // Data processing helpers
    function sortTrainsByTime(trains) {
        return [...trains].sort((a, b) => {
            const aTime = timeToMinutes(a.scheduledArrivalTime || a.startTime);
            const bTime = timeToMinutes(b.scheduledArrivalTime || b.startTime);
            return aTime - bTime;
        });
    }

    function filterTrainsByTimeWindow(trains, startHour, viewHours) {
        const windowStartMinutes = startHour * 60;
        const windowEndMinutes = windowStartMinutes + (viewHours * 60);
        
        return trains.filter(train => {
            const trainStart = timeToMinutes(train.scheduledArrivalTime || train.startTime);
            const trainEnd = timeToMinutes(train.scheduledDepartureTime || train.endTime);
            
            // Train overlaps with window if it starts before window ends and ends after window starts
            return trainStart < windowEndMinutes && trainEnd > windowStartMinutes;
        });
    }

    function getTrainsByTrack(trains, trackId, subTrackIndex = null) {
        return trains.filter(train => {
            if (subTrackIndex !== null) {
                return train.trackId === trackId && train.subTrackIndex === subTrackIndex;
            }
            return train.trackId === trackId;
        });
    }

    // DOM utility functions
    function createElement(tag, className = '', content = '') {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (content) element.textContent = content;
        return element;
    }

    function removeAllChildren(element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }

    function toggleClass(element, className, force = undefined) {
        if (force !== undefined) {
            if (force) {
                element.classList.add(className);
            } else {
                element.classList.remove(className);
            }
        } else {
            element.classList.toggle(className);
        }
    }

    // Animation helpers
    function animateProperty(element, property, from, to, duration = 300, easing = 'ease-out') {
        return new Promise((resolve) => {
            const start = performance.now();
            const initialValue = from;
            const change = to - from;

            function animate(currentTime) {
                const elapsed = currentTime - start;
                const progress = Math.min(elapsed / duration, 1);
                
                let easedProgress = progress;
                if (easing === 'ease-out') {
                    easedProgress = 1 - Math.pow(1 - progress, 3);
                } else if (easing === 'ease-in') {
                    easedProgress = Math.pow(progress, 3);
                } else if (easing === 'ease-in-out') {
                    easedProgress = progress < 0.5 
                        ? 4 * Math.pow(progress, 3) 
                        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
                }

                const currentValue = initialValue + (change * easedProgress);
                element.style[property] = `${currentValue}px`;

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            }
            requestAnimationFrame(animate);
        });
    }

    // Storage helpers
    function safeParseJSON(jsonString, fallback = null) {
        try {
            return JSON.parse(jsonString);
        } catch (error) {
            console.warn('Failed to parse JSON:', error);
            return fallback;
        }
    }

    function safeStringifyJSON(obj, fallback = '{}') {
        try {
            return JSON.stringify(obj);
        } catch (error) {
            console.warn('Failed to stringify JSON:', error);
            return fallback;
        }
    }

    // Debounce function for performance optimization
    function debounce(func, wait, immediate = false) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func.apply(this, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(this, args);
        };
    }

    // Throttle function for performance optimization
    function throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Deep clone helper (fallback if historyEngine is not available)
    function deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => deepClone(item));
        if (typeof obj === 'object') {
            const clonedObj = {};
            for (let key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
    }

    // Error handling helper
    function handleError(error, context = 'Unknown') {
        console.error(`Error in ${context}:`, error);
        showNotification(`Ett fel uppstod: ${error.message}`, 'error', 5000);
    }

    // Browser compatibility checks
    function checkBrowserSupport() {
        const features = {
            localStorage: typeof Storage !== 'undefined',
            canvas: !!window.HTMLCanvasElement,
            flexbox: CSS.supports('display', 'flex'),
            gridLayout: CSS.supports('display', 'grid'),
            es6: typeof Promise !== 'undefined',
            fetch: typeof fetch !== 'undefined'
        };

        const unsupported = Object.entries(features)
            .filter(([feature, supported]) => !supported)
            .map(([feature]) => feature);

        if (unsupported.length > 0) {
            const featureNames = {
                localStorage: 'Lokal lagring',
                canvas: 'Canvas-stöd',
                flexbox: 'Flexbox-layout',
                gridLayout: 'Grid-layout',
                es6: 'Modern JavaScript',
                fetch: 'Nätverksfunktioner'
            };
            
            const missingFeatures = unsupported.map(f => featureNames[f] || f).join(', ');
            
            showNotification(
                `⚠️ Din webbläsare saknar stöd för: ${missingFeatures}. Vissa funktioner kanske inte fungerar korrekt. Överväg att uppdatera din webbläsare.`,
                'warning',
                12000
            );
            return false;
        }
        return true;
    }
    
    // Enhanced validation functions
    function validateTrainData(trainData) {
        const errors = [];
        
        if (!trainData.arrivalTrainNumber?.trim()) {
            errors.push('Ankomst tågnummer krävs');
        }
        
        if (!trainData.departureTrainNumber?.trim()) {
            errors.push('Avgång tågnummer krävs');
        }
        
        if (!trainData.origin?.trim()) {
            errors.push('Ursprungsstation krävs');
        }
        
        if (!trainData.destination?.trim()) {
            errors.push('Destinationsstation krävs');
        }
        
        if (!validateTimeFormat(trainData.scheduledArrivalTime)) {
            errors.push('Ogiltig ankomsttid');
        }
        
        if (!validateTimeFormat(trainData.scheduledDepartureTime)) {
            errors.push('Ogiltig avgångstid');
        }
        
        if (trainData.scheduledArrivalTime && trainData.scheduledDepartureTime) {
            const validation = validateTimeRange(trainData.scheduledArrivalTime, trainData.scheduledDepartureTime);
            if (!validation.valid) {
                errors.push(validation.message);
            }
        }
        
        if (!trainData.trackId || trainData.subTrackIndex === undefined) {
            errors.push('Spår måste väljas');
        }
        
        if (!trainData.trainSet?.vehicleTypeID) {
            errors.push('Fordonstyp måste väljas');
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
    
    // User guidance functions
    function showWelcomeGuide() {
        const hasSeenGuide = localStorage.getItem('hasSeenWelcomeGuide');
        if (hasSeenGuide) return;
        
        setTimeout(() => {
            const guideMessage = `🚂 Välkommen till Digitalt Tågspårdiagram!

Snabbstart:
• Klicka "➕ Lägg till tåg" för att skapa en ny tjänst
• Dra och släpp tåg för att flytta dem
• Högerklicka på tåg för fler alternativ
• Använd Ctrl+Z för att ångra ändringar

Tips:
• Tryck F1 eller ❓ för fullständig hjälp
• Ctrl+S sparar automatiskt
• Färgkoder visar konflikter och varningar

Kom igång genom att lägga till ditt första tåg!`;

            showNotification(guideMessage, 'info', 12000);
            localStorage.setItem('hasSeenWelcomeGuide', 'true');
        }, 1000);
    }
    
    function showFeatureTip(feature) {
        const tips = {
            'drag': 'Dra tåg för att flytta dem i tid eller till andra spår. Använd handtagen på sidorna för att ändra längd.',
            'conflicts': 'Röda tåg har konflikter (överlappning). Gula visar kort vändtid. Orange/röd visar längdproblem.',
            'keyboard': 'Använd tangentbordsgenvägar för snabbare arbete: Ctrl+Z (ångra), Ctrl+S (spara), Delete (ta bort valt tåg).',
            'context': 'Högerklicka på tåg för att redigera, dela, byta plats eller ta bort.',
            'history': 'Alla ändringar sparas i historiken. Klicka "📋 Historik" för att se och återgå till tidigare versioner.',
            'currenttime': '🕐 Den röda linjen visar aktuell tid och uppdateras automatiskt. Navigera till rätt tidsperiod för att se den.'
        };
        
        if (tips[feature]) {
            showNotification(`💡 Tips: ${tips[feature]}`, 'info', 6000);
        }
    }
    
    function showProgressFeedback(action, progress = 0) {
        const progressMessages = {
            'saving': `💾 Sparar... ${Math.round(progress)}%`,
            'loading': `📂 Laddar... ${Math.round(progress)}%`,
            'exporting': `📸 Exporterar... ${Math.round(progress)}%`,
            'importing': `📁 Importerar... ${Math.round(progress)}%`,
            'rendering': `🎨 Renderar... ${Math.round(progress)}%`
        };
        
        if (progressMessages[action]) {
            showNotification(progressMessages[action], 'info', 1000);
        }
    }

    // Performance monitoring
    function measurePerformance(name, fn) {
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        console.log(`Performance: ${name} took ${(end - start).toFixed(2)}ms`);
        return result;
    }

    // Export all utility functions globally
    window.showNotification = showNotification;
    window.darkenColor = darkenColor;
    window.lightenColor = lightenColor;
    window.formatDuration = formatDuration;
    window.formatTimeRange = formatTimeRange;
    window.validateTimeFormat = validateTimeFormat;
    window.validateTimeRange = validateTimeRange;
    window.validateTrainData = validateTrainData;
    window.sortTrainsByTime = sortTrainsByTime;
    window.filterTrainsByTimeWindow = filterTrainsByTimeWindow;
    window.getTrainsByTrack = getTrainsByTrack;
    window.createElement = createElement;
    window.removeAllChildren = removeAllChildren;
    window.toggleClass = toggleClass;
    window.animateProperty = animateProperty;
    window.safeParseJSON = safeParseJSON;
    window.safeStringifyJSON = safeStringifyJSON;
    window.debounce = debounce;
    window.throttle = throttle;
    window.deepClone = deepClone;
    window.handleError = handleError;
    window.checkBrowserSupport = checkBrowserSupport;
    window.measurePerformance = measurePerformance;
    window.showWelcomeGuide = showWelcomeGuide;
    window.showFeatureTip = showFeatureTip;
    window.showProgressFeedback = showProgressFeedback;

})(); 