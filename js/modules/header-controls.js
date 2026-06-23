/**
 * Header Controls - Time navigation integrated with TimeManager
 */

let nuButtonClickCount = 0;
let nuButtonLastClick = 0;
const NU_BUTTON_DOUBLE_CLICK_THRESHOLD = 500; // ms

function initializeHeader() {
    if (!window.TimeManager) {
        console.error('❌ TimeManager not found! Make sure time-manager.js loads first.');
        return;
    }
    
    console.log('🎛️ Initializing header controls...');
    
    // Listen to TimeManager state changes
    window.TimeManager.addListener(handleTimeStateChange);
    
    // Listen to settings changes from settings modal
    window.addEventListener('settingsChanged', handleSettingsChanged);
    
    // Load initial settings from localStorage
    loadInitialSettings();
    
    // Initialize all controls
    initializeNavigationButtons();
    initializeTimeRangeSelector();
    initializeNuButton();
    // initializeCurrentTimeUpdater();
    
    // Initial display update
    updateAllDisplays();
    
    console.log('✅ Header controls initialized');
}

/**
 * Load initial settings from localStorage and apply to TimeManager
 */
function loadInitialSettings() {
    try {
        const saved = localStorage.getItem('sparplannen-settings');
        if (saved) {
            const settings = JSON.parse(saved);
            applySettingsToTimeManager(settings);
            console.log('✅ Initial settings loaded and applied to TimeManager');
        }
    } catch (error) {
        console.error('Error loading initial settings:', error);
    }
}

/**
 * Handle settings changed event from settings modal
 */
function handleSettingsChanged(event) {
    const settings = event.detail;
    console.log('⚙️ Settings changed, updating TimeManager:', settings);
    applySettingsToTimeManager(settings);
}

/**
 * Apply settings to TimeManager
 */
function applySettingsToTimeManager(settings) {
    if (!window.TimeManager) return;
    
    const timeManagerSettings = {
        offsetPercentage: settings.offsetPercentage,
        updateIntervalSeconds: parseInt(settings.updateInterval),
        followingModeEnabled: settings.followMode
    };
    
    window.TimeManager.updateSettings(timeManagerSettings);

    if (window.TimeManager.qaOverrideActive) {
        updateNuButtonState(false);
        return;
    }
    
    // If follow mode was enabled in settings, activate it immediately
    if (settings.followMode && !window.TimeManager.isFollowingMode) {
        window.TimeManager.activateFollowingMode();
        updateNuButtonState(true);
        console.log('✅ Following mode activated from settings');
    }
    // If follow mode was disabled in settings, deactivate it
    else if (!settings.followMode && window.TimeManager.isFollowingMode) {
        window.TimeManager.deactivateFollowingMode();
        updateNuButtonState(false);
        console.log('⏸️ Following mode deactivated from settings');
    }
}

/**
 * Initialize Previous/Next navigation buttons
 */
function initializeNavigationButtons() {
    const prevButton = document.getElementById('time-nav-prev');
    const nextButton = document.getElementById('time-nav-next');
    
    if (prevButton) {
        prevButton.addEventListener('click', () => {
            const success = window.TimeManager.navigatePrevious();
            if (!success) {
                showNotification('Kan inte navigera längre bakåt', 'warning');
            }
        });
    }
    
    if (nextButton) {
        nextButton.addEventListener('click', () => {
            const success = window.TimeManager.navigateNext();
            if (!success) {
                showNotification('Kan inte navigera längre framåt', 'warning');
            }
        });
    }
}

/**
 * Initialize time range selector dropdown
 */
function initializeTimeRangeSelector() {
    const timeRangeBtn = document.getElementById('time-range-btn');
    const timeRangeDropdown = document.getElementById('time-range-dropdown');
    
    if (!timeRangeBtn || !timeRangeDropdown) return;
    
    // Toggle dropdown
    timeRangeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        timeRangeDropdown.classList.toggle('active');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!timeRangeBtn.contains(e.target) && !timeRangeDropdown.contains(e.target)) {
            timeRangeDropdown.classList.remove('active');
        }
    });
    
    // Handle time range selection
    document.querySelectorAll('.time-range-option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const hours = parseInt(option.getAttribute('data-hours'));
            
            // Update TimeManager
            window.TimeManager.changeTimeRange(hours);
            
            // Update UI
            document.querySelectorAll('.time-range-option').forEach(opt => {
                opt.classList.remove('active');
            });
            option.classList.add('active');
            
            // Update button text
            timeRangeBtn.querySelector('span').textContent = hours + 'h';
            
            // Close dropdown
            timeRangeDropdown.classList.remove('active');
        });
    });
    
    // Set initial button text from TimeManager
    const currentRange = window.TimeManager.timeRange;
    timeRangeBtn.querySelector('span').textContent = currentRange + 'h';
}

/**
 * Initialize Nu button with two modes: jump to now (first click) and following mode (second click)
 */
function initializeNuButton() {
    const nowButton = document.getElementById('now-button');
    if (!nowButton) return;
    
    nowButton.addEventListener('click', () => {
        const now = Date.now();
        const timeSinceLastClick = now - nuButtonLastClick;
        
        // Check if this is a quick second click (within threshold)
        if (timeSinceLastClick < NU_BUTTON_DOUBLE_CLICK_THRESHOLD && nuButtonClickCount === 1) {
            // Second click - toggle following mode
            const isFollowing = window.TimeManager.toggleFollowingMode();
            updateNuButtonState(isFollowing);
            
            if (isFollowing) {
                showNotification('Följ-läge aktiverat', 'success');
            } else {
                showNotification('Följ-läge inaktiverat', 'info');
            }
            
            nuButtonClickCount = 0;
        } else {
            // First click - jump to now
            window.TimeManager.jumpToNow();
            showNotification('Centrerat på nuvarande tid', 'info');
            nuButtonClickCount = 1;
        }
        
        nuButtonLastClick = now;
    });
    
    // Initial state
    updateNuButtonState(window.TimeManager.isFollowingMode);
}

/**
 * Update Nu button visual state based on following mode
 */
function updateNuButtonState(isFollowing) {
    const nowButton = document.getElementById('now-button');
    if (!nowButton) return;
    
    if (isFollowing) {
        nowButton.classList.add('following-active');
        nowButton.setAttribute('aria-label', 'Följer nuvarande tid - klicka för att avaktivera');
        nowButton.innerHTML = '<span>● Följer</span>';
    } else {
        nowButton.classList.remove('following-active');
        nowButton.setAttribute('aria-label', 'Hoppa till nuvarande tid');
        nowButton.innerHTML = '<span>Nu</span>';
    }
}

/**
 * Update current time every second
 */
/*
function initializeCurrentTimeUpdater() {
    // Update immediately
    updateCurrentTimeDisplay();
    
    // Then update every second
    setInterval(() => {
        updateCurrentTimeDisplay();
    }, 1000);
}
*/

/**
 * Handle TimeManager state changes
 */
function handleTimeStateChange(event) {
    const { type, state, data } = event;
    
    switch (type) {
        case 'navigate_previous':
        case 'navigate_next':
        case 'jump_to_now':
        case 'range_changed':
        case 'scroll_sync':
            // Keep the header centre-time in sync when the user pans the
            // timeline by hand (the main way to navigate in archive mode).
            updateAllDisplays();
            break;
            
        case 'following_activated':
            updateNuButtonState(true);
            break;
            
        case 'following_deactivated':
            updateNuButtonState(false);
            break;
            
        case 'following_update':
            updateAllDisplays();
            break;
            
        case 'error':
            showNotification(event.message, 'error');
            break;
    }
}

/**
 * Update all time displays
 */
function updateAllDisplays() {
    const state = window.TimeManager.getState();
    
    // Update view center time display
    const currentTimeEl = document.getElementById('current-time-display');
    if (currentTimeEl) {
        const hours = String(state.viewTime.getHours()).padStart(2, '0');
        const minutes = String(state.viewTime.getMinutes()).padStart(2, '0');
        currentTimeEl.textContent = `${hours}:${minutes}`;
    }
    
    // Update time range display
    const timeRangeEl = document.getElementById('time-range-display');
    if (timeRangeEl) {
        const startHours = String(state.startTime.getHours()).padStart(2, '0');
        const startMins = String(state.startTime.getMinutes()).padStart(2, '0');
        const endHours = String(state.endTime.getHours()).padStart(2, '0');
        const endMins = String(state.endTime.getMinutes()).padStart(2, '0');
        
        timeRangeEl.textContent = `${startHours}:${startMins} - ${endHours}:${endMins}`;
    }
}

/**
 * Update current time indicator (not view center, but actual "now")
 */
/*
function updateCurrentTimeDisplay() {
    const now = new Date();
    const state = window.TimeManager.getState();
    
    // Update current time line position if visible
    const currentTimeLine = document.getElementById('current-time-line');
    if (currentTimeLine && window.TimeManager.isTimeVisible(now)) {
        // Calculate position based on time range
        const totalMs = state.endTime.getTime() - state.startTime.getTime();
        const offsetMs = now.getTime() - state.startTime.getTime();
        const percentage = (offsetMs / totalMs) * 100;
        
        currentTimeLine.style.left = `${percentage}%`;
        currentTimeLine.style.display = 'block';
    } else if (currentTimeLine) {
        currentTimeLine.style.display = 'none';
    }
}
*/

/**
 * Toast notifications — "platform-board" stack.
 *
 * One fixed stack (top-right, under the header) holds every toast in a column,
 * so multiple notifications queue instead of overlapping. Each toast is a
 * neutral raised card that speaks the edit-palette vocabulary; type is signalled
 * by a small coloured signal-aspect dot, not a full colour fill. A countdown
 * rail depletes as the auto-dismiss timer runs and pauses while hovered.
 * Repeated identical messages coalesce into a ×N counter.
 *
 * Reduced-motion safe: the card's resting state is fully visible without any
 * JS class toggle, and the rail/animations are inert under prefers-reduced-motion.
 */
const NOTIFICATION_MAX_VISIBLE = 5;
const NOTIFICATION_DEFAULT_DURATION = 4500;
const NOTIFICATION_ERROR_DURATION = 7000;

function getNotificationStack() {
    let stack = document.getElementById('notification-stack');
    if (!stack) {
        stack = document.createElement('div');
        stack.id = 'notification-stack';
        stack.className = 'notification-stack';
        // The stack itself is the live region; additions are announced once.
        stack.setAttribute('role', 'region');
        stack.setAttribute('aria-label', 'Aviseringar');
        stack.setAttribute('aria-live', 'polite');
        stack.setAttribute('aria-relevant', 'additions');
        document.body.appendChild(stack);
    }
    return stack;
}

function dismissNotification(toast) {
    if (!toast || toast.dataset.dismissing === 'true') return;
    toast.dataset.dismissing = 'true';
    if (toast._notifTimer) clearTimeout(toast._notifTimer);
    toast.classList.remove('notification--in');
    toast.classList.add('notification--out');
    const remove = () => { if (toast.parentNode) toast.remove(); };
    // Fall back to a timer in case transitionend never fires (reduced motion).
    toast.addEventListener('transitionend', remove, { once: true });
    setTimeout(remove, 320);
}

function startNotificationTimer(toast, duration) {
    toast._notifRemaining = duration;
    const begin = () => {
        toast._notifStart = Date.now();
        toast._notifTimer = setTimeout(() => dismissNotification(toast), toast._notifRemaining);
        toast.classList.remove('notification--paused');
    };
    const pause = () => {
        if (!toast._notifTimer) return;
        clearTimeout(toast._notifTimer);
        toast._notifTimer = null;
        toast._notifRemaining -= (Date.now() - toast._notifStart);
        toast.classList.add('notification--paused');
    };
    toast.addEventListener('mouseenter', pause);
    toast.addEventListener('mouseleave', begin);
    begin();
}

function showNotification(message, type = 'info', duration) {
    console.log(`📢 [${String(type).toUpperCase()}] ${message}`);

    if (duration == null) {
        duration = type === 'error' ? NOTIFICATION_ERROR_DURATION : NOTIFICATION_DEFAULT_DURATION;
    }

    const stack = getNotificationStack();

    // Coalesce a repeat of the most recent, same-type message into a ×N counter
    // instead of stacking a duplicate.
    const newest = stack.firstElementChild;
    if (newest && newest.dataset.dismissing !== 'true' &&
        newest.dataset.type === type && newest.dataset.message === message) {
        const count = (parseInt(newest.dataset.count || '1', 10)) + 1;
        newest.dataset.count = String(count);
        let badge = newest.querySelector('.notification__count');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'notification__count';
            newest.querySelector('.notification__body').appendChild(badge);
        }
        badge.textContent = `×${count}`;
        // Re-pulse and restart the countdown.
        newest.classList.remove('notification--pulse');
        void newest.offsetWidth; // reflow so the animation can re-trigger
        newest.classList.add('notification--pulse');
        if (newest._notifTimer) clearTimeout(newest._notifTimer);
        startNotificationTimer(newest, duration);
        return;
    }

    const toast = document.createElement('div');
    toast.className = `notification notification--${type}`;
    toast.dataset.type = type;
    toast.dataset.message = message;
    toast.dataset.count = '1';
    toast.style.setProperty('--notif-duration', `${duration}ms`);

    const dot = document.createElement('span');
    dot.className = 'notification__dot';
    dot.setAttribute('aria-hidden', 'true');

    const body = document.createElement('div');
    body.className = 'notification__body';
    const text = document.createElement('span');
    text.className = 'notification__text';
    text.textContent = message;
    body.appendChild(text);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'notification__close';
    close.setAttribute('aria-label', 'Stäng');
    close.textContent = '✕';
    close.addEventListener('click', () => dismissNotification(toast));

    const rail = document.createElement('div');
    rail.className = 'notification__rail';
    rail.setAttribute('aria-hidden', 'true');
    const railFill = document.createElement('div');
    railFill.className = 'notification__rail-fill';
    rail.appendChild(railFill);

    toast.append(dot, body, close, rail);

    // Newest on top.
    stack.insertBefore(toast, stack.firstChild);

    // Trim the oldest past the cap. Work from a snapshot of the live (not
    // already-dismissing) toasts — dismissNotification removes asynchronously,
    // so we must not loop on the live children count.
    const live = Array.prototype.filter.call(
        stack.children, (c) => c.dataset.dismissing !== 'true'
    );
    for (let i = NOTIFICATION_MAX_VISIBLE; i < live.length; i++) {
        dismissNotification(live[i]); // newest-first, so these are the oldest
    }

    // Reveal on the next frame so the enter transition runs.
    requestAnimationFrame(() => toast.classList.add('notification--in'));

    startNotificationTimer(toast, duration);
}

// Export globally
window.showNotification = showNotification;

/**
 * Format time for display
 */
function formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}
