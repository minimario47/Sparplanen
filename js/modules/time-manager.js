/**
 * TimeManager - Central time state management for schedule navigation
 * Handles current time, time ranges, navigation, and following mode
 */

class TimeManager {
  constructor() {
    // Core time state
    this.viewTime = new Date(); // Center of current view
    this.timeRange = 4; // Hours to display (1, 3, 4, 6, 8, 12)
    this.isFollowingMode = false;
    this.followingInterval = null;
    this.qaOverrideActive = false;
    this.scheduleAnchorStr = null;
    
    // Settings (will be updated from settings modal)
    this.offsetPercentage = 20; // Percentage from left edge where red line is fixed (0-50%)
    this.updateIntervalSeconds = 60; // How often following mode updates
    
    // Boundaries: navigation is bounded by the schedule day itself
    // (00:00 on the anchor date to +30h = 06:00 next morning, matching the
    // rendered timeline span), not by rolling offsets from "now".
    this.timelineHours = 30;
    
    // Listeners for state changes
    this.listeners = [];
    
    // Initialize
    this.restoreState();
    this.applyQaOverrideFromUrl();
    this.applyArchiveOverride();
    console.log('✅ TimeManager initialized:', this.getStateInfo());
  }

  /**
   * Archive mode: the user picked a past week from the header label. Pin the
   * view onto that week's schedule day and reuse the qaOverride lock so
   * following-mode, jump-to-now and the staleness banner stay disabled.
   * Mirrors applyQaOverrideFromUrl but is driven by sessionStorage, not the URL.
   */
  applyArchiveOverride() {
    const resolve = window.SparplanenResolve;
    if (!resolve || typeof resolve.getArchiveSelection !== 'function') return;
    const sel = resolve.getArchiveSelection();
    if (!sel || !sel.anchor) return;

    const [year, month, date] = String(sel.anchor).split('-').map(Number);
    if (![year, month, date].every(Number.isFinite)) return;

    // Preserve a scroll position the user already had within this archived day
    // (e.g. across a manual reload); only reset to the default hour when the
    // restored viewTime belongs to a different calendar day.
    const ARCHIVE_DEFAULT_HOUR = 7;
    const sameDay =
      this.viewTime instanceof Date &&
      this.viewTime.getFullYear() === year &&
      this.viewTime.getMonth() === month - 1 &&
      this.viewTime.getDate() === date;
    if (!sameDay) {
      this.viewTime = new Date(year, month - 1, date, ARCHIVE_DEFAULT_HOUR, 0, 0, 0);
    }
    this.isFollowingMode = false;
    this.qaOverrideActive = true;
  }

  applyQaOverrideFromUrl() {
    if (typeof window === 'undefined' || !window.location || !window.URLSearchParams) return;
    const params = new URLSearchParams(window.location.search || '');
    const week = params.get('week');
    const day = params.get('day');
    if (!week || !day) return;

    const dayKey = (window.SparplanenResolve && window.SparplanenResolve.getStockholmSwedishDayKey)
      ? (window.SparplanenResolve.pickWeekAndDay(window.SPARPLANEN_WEEKS, window.SPARPLANEN_ANCHORS).day || day)
      : day;
    const anchors = window.SPARPLANEN_ANCHORS || {};
    const normalizedDay = String(dayKey || day).toLowerCase();
    const anchor = anchors[week]?.[normalizedDay] || anchors[week]?.[String(day).toLowerCase()];
    if (!anchor) return;

    const [year, month, date] = anchor.split('-').map(Number);
    const [hours, minutes] = String(params.get('time') || '19:00').split(':').map(Number);
    if (![year, month, date, hours, minutes].every(Number.isFinite)) return;

    this.viewTime = new Date(year, month - 1, date, hours, minutes, 0, 0);
    this.isFollowingMode = false;
    this.qaOverrideActive = true;
  }

  /**
   * Bind view/navigation time to the loaded schedule's calendar day.
   * Train timestamps use the PDF anchor date; viewTime must use the same day
   * or the visibility filter excludes every train when the bundle is a week behind.
   */
  setScheduleAnchor(anchorStr) {
    const next = anchorStr || null;
    const changed = next !== this.scheduleAnchorStr;
    this.scheduleAnchorStr = next;
    if (this.qaOverrideActive) return;

    const realigned = this.syncViewTimeToScheduleDate();
    if (changed || realigned) {
      const todayYmd = this.getStockholmYmd(new Date());
      const anchorYmd = this.getScheduleAnchorYmd();
      if (anchorYmd && anchorYmd !== todayYmd) {
        console.log(
          `📅 Schedule uses ${anchorYmd} (today is ${todayYmd}); aligned view to schedule day`
        );
      }
    }
  }

  getScheduleAnchorYmd() {
    if (this.scheduleAnchorStr) return this.scheduleAnchorStr;
    return this.getStockholmYmd(new Date());
  }

  getStockholmYmd(date) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Stockholm',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  parseAnchorYmd(ymd) {
    const [year, month, day] = String(ymd).split('-').map(Number);
    if (![year, month, day].every(Number.isFinite)) return null;
    return { year, month, day };
  }

  mapTimeToScheduleDate(sourceDate) {
    const anchor = this.parseAnchorYmd(this.getScheduleAnchorYmd());
    if (!anchor || !(sourceDate instanceof Date) || Number.isNaN(sourceDate.getTime())) {
      return sourceDate instanceof Date ? new Date(sourceDate.getTime()) : new Date();
    }
    return new Date(
      anchor.year,
      anchor.month - 1,
      anchor.day,
      sourceDate.getHours(),
      sourceDate.getMinutes(),
      sourceDate.getSeconds(),
      sourceDate.getMilliseconds()
    );
  }

  /**
   * Clock "now" expressed on the schedule's 30h render canvas.
   *
   * When the real instant actually falls within the rendered window — including
   * the 24:00–30:00 post-midnight stretch of a bundle whose anchor is
   * "yesterday" (the service day rolls over at 06:00, see
   * schedule-timezone-helpers) — return it verbatim so "now" lands at the
   * correct 24:xx position. Folding it onto the anchor day here was the midnight
   * bug: at 00:01 it collapsed "now" back to the far-left 00:01.
   *
   * Only when the bundle is genuinely stale (a past PDF whose canvas no longer
   * contains the real clock, e.g. a week-old schedule) do we fold the
   * time-of-day onto the anchor day so "now" still shows somewhere usable.
   */
  getEffectiveNow() {
    const real = new Date();
    const bounds = this.getScheduleDayBounds();
    if (bounds && real >= bounds.start && real < bounds.end) {
      return real;
    }
    return this.mapTimeToScheduleDate(real);
  }

  syncViewTimeToScheduleDate() {
    // Don't fold a viewTime that already sits within the rendered schedule day
    // — mapTimeToScheduleDate keeps only HH:MM and would collapse the
    // 24:00–30:00 next-morning stretch (e.g. a restored "05:00 next day")
    // back onto the anchor's 05:00 same-day.
    const bounds = this.getScheduleDayBounds();
    if (bounds && this.viewTime >= bounds.start && this.viewTime <= bounds.end) {
      return false;
    }
    const mapped = this.mapTimeToScheduleDate(this.viewTime);
    const changed = mapped.getTime() !== this.viewTime.getTime();
    if (changed) {
      this.viewTime = mapped;
      this.saveState();
    }
    return changed;
  }
  
  /**
   * Get current time state
   */
  getState() {
    const halfRange = (this.timeRange * 60) / 2; // Half range in minutes
    const startTime = new Date(this.viewTime.getTime() - halfRange * 60000);
    const endTime = new Date(this.viewTime.getTime() + halfRange * 60000);
    
    return {
      viewTime: this.viewTime,
      timeRange: this.timeRange,
      startTime: startTime,
      endTime: endTime,
      isFollowingMode: this.isFollowingMode,
      currentRealTime: new Date(),
      offsetPercentage: this.offsetPercentage,
      updateIntervalSeconds: this.updateIntervalSeconds
    };
  }
  
  /**
   * Get human-readable state info for logging
   */
  getStateInfo() {
    const state = this.getState();
    return {
      viewTime: this.formatTime(state.viewTime),
      range: `${this.timeRange}h`,
      window: `${this.formatTime(state.startTime)} - ${this.formatTime(state.endTime)}`,
      following: this.isFollowingMode,
      offset: `${this.offsetPercentage}%`
    };
  }
  
  /**
   * Bounds of the rendered schedule day: 00:00 on the anchor date through
   * +timelineHours (06:00 the next morning).
   */
  getScheduleDayBounds() {
    const anchor = this.parseAnchorYmd(this.getScheduleAnchorYmd());
    const base = anchor
      ? new Date(anchor.year, anchor.month - 1, anchor.day, 0, 0, 0, 0)
      : (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
    return {
      start: base,
      end: new Date(base.getTime() + this.timelineHours * 60 * 60000)
    };
  }

  /**
   * Clamp a candidate view time to the schedule-day bounds.
   */
  clampToScheduleDay(time) {
    const { start, end } = this.getScheduleDayBounds();
    if (time < start) return new Date(start.getTime());
    if (time > end) return new Date(end.getTime());
    return time;
  }

  /**
   * Navigate backward by current time range
   */
  navigatePrevious() {
    const jumpHours = this.timeRange; // Jump by current time range
    // No mapTimeToScheduleDate here: it folds the time-of-day back onto the
    // anchor date, which would wrap the 24:00–30:00 stretch (next morning)
    // back 24 hours. The day-bounds clamp is the only guard needed.
    const newTime = this.clampToScheduleDay(
      new Date(this.viewTime.getTime() - jumpHours * 60 * 60000)
    );

    if (newTime.getTime() === this.viewTime.getTime()) {
      this.notifyError('Du är redan i början av dagens graf');
      return false;
    }

    this.viewTime = newTime;
    this.deactivateFollowingMode(); // User took manual control
    this.saveState();
    this.notifyChange('navigate_previous');

    console.log(`⬅️ Navigated backward ${jumpHours}h:`, this.getStateInfo());
    return true;
  }

  /**
   * Navigate forward by current time range
   */
  navigateNext() {
    const jumpHours = this.timeRange; // Jump by current time range
    // See navigatePrevious: clamp only, no anchor-date folding.
    const newTime = this.clampToScheduleDay(
      new Date(this.viewTime.getTime() + jumpHours * 60 * 60000)
    );

    if (newTime.getTime() === this.viewTime.getTime()) {
      this.notifyError('Du är redan i slutet av dagens graf');
      return false;
    }

    this.viewTime = newTime;
    this.deactivateFollowingMode(); // User took manual control
    this.saveState();
    this.notifyChange('navigate_next');

    console.log(`➡️ Navigated forward ${jumpHours}h:`, this.getStateInfo());
    return true;
  }

  /**
   * Sync view time from a manual scroll position. Re-renders the train
   * window around the new time WITHOUT repositioning the scrollbar — this is
   * what streams trains in as the user pans across the day.
   */
  setViewTimeFromScroll(time) {
    if (!(time instanceof Date) || Number.isNaN(time.getTime())) return false;
    // Scroll positions are already on the timeline calendar — clamp only.
    const newTime = this.clampToScheduleDay(time);
    if (Math.abs(newTime.getTime() - this.viewTime.getTime()) < 60000) return false;

    this.viewTime = newTime;
    this.saveState();
    this.notifyChange('scroll_sync');
    return true;
  }
  
  /**
   * Jump to current time (positions current time at red line)
   */
  jumpToNow() {
    if (this.qaOverrideActive) {
      this.isFollowingMode = false;
      this.notifyChange('jump_to_now');
      console.log('QA schedule override is active; staying on the selected schedule time.');
      return false;
    }

    const now = this.getEffectiveNow();
    
    // Calculate where red line is relative to center
    // Red line is at offsetPercentage% from left, center is at 50%
    // So offset from center = offsetPercentage - 50
    const offsetFromCenterPercent = this.offsetPercentage - 50;
    const offsetFromCenterHours = (offsetFromCenterPercent / 100) * this.timeRange;
    
    // View time should be offset so current time appears at red line.
    // `now` is already on the schedule-day calendar (getEffectiveNow maps it),
    // so clamp directly — do NOT re-fold through mapTimeToScheduleDate (that
    // keeps only HH:MM and would collapse any next-morning position).
    const targetTime = new Date(now.getTime() - offsetFromCenterHours * 60 * 60000);

    this.viewTime = this.clampToScheduleDay(targetTime);
    this.saveState();
    this.notifyChange('jump_to_now');
    
    console.log('🎯 Jumped to now (red line at ' + this.offsetPercentage + '%):', this.getStateInfo());
    return true;
  }

  /**
   * Center the timeline view on an arbitrary time so that it lands at the
   * red-line offset. Mirrors `jumpToNow` but takes any Date.
   *
   * Used by the empty-grid context menu's "Centrera tid här" action.
   */
  centerOnTime(targetTime) {
    if (!(targetTime instanceof Date) || Number.isNaN(targetTime.getTime())) {
      return false;
    }

    const offsetFromCenterPercent = this.offsetPercentage - 50;
    const offsetFromCenterHours = (offsetFromCenterPercent / 100) * this.timeRange;

    // targetTime is already on the timeline calendar (it comes from a clicked
    // pixel position via timelineStart). Clamp directly — re-folding through
    // mapTimeToScheduleDate would collapse a next-morning target to same-day.
    this.viewTime = this.clampToScheduleDay(
      new Date(targetTime.getTime() - offsetFromCenterHours * 60 * 60000)
    );

    if (this.isFollowingMode) {
      this.deactivateFollowingMode();
    }
    this.saveState();
    this.notifyChange('jump_to_now', { centeredAt: this.mapTimeToScheduleDate(targetTime).toISOString() });

    console.log('🎯 Centered on time:', targetTime.toLocaleString('sv-SE'));
    return true;
  }

  /**
   * Toggle following mode on/off
   */
  toggleFollowingMode() {
    if (this.isFollowingMode) {
      this.deactivateFollowingMode();
    } else {
      this.activateFollowingMode();
    }
    return this.isFollowingMode;
  }
  
  /**
   * Activate following mode
   */
  activateFollowingMode() {
    if (this.isFollowingMode) return;
    if (this.qaOverrideActive) {
      this.isFollowingMode = false;
      this.notifyChange('following_deactivated');
      console.log('QA schedule override is active; following mode remains disabled.');
      return;
    }
    
    // First jump to now
    this.jumpToNow();
    
    // Activate following
    this.isFollowingMode = true;
    
    // Start update interval
    this.followingInterval = setInterval(() => {
      this.updateFollowingMode();
    }, this.updateIntervalSeconds * 1000);
    
    this.saveState();
    this.notifyChange('following_activated');
    
    console.log('▶️ Following mode ACTIVATED (updates every ' + this.updateIntervalSeconds + 's)');
  }
  
  /**
   * Deactivate following mode
   */
  deactivateFollowingMode() {
    if (!this.isFollowingMode) return;
    
    this.isFollowingMode = false;
    
    if (this.followingInterval) {
      clearInterval(this.followingInterval);
      this.followingInterval = null;
    }
    
    this.saveState();
    this.notifyChange('following_deactivated');
    
    console.log('⏸️ Following mode DEACTIVATED');
  }
  
  /**
   * Update view in following mode (keeps current time at red line)
   */
  updateFollowingMode() {
    if (!this.isFollowingMode) return;
    
    const now = this.getEffectiveNow();
    
    // Calculate where red line is relative to center
    const offsetFromCenterPercent = this.offsetPercentage - 50;
    const offsetFromCenterHours = (offsetFromCenterPercent / 100) * this.timeRange;
    
    // View time should position current time at red line
    const targetTime = new Date(now.getTime() - offsetFromCenterHours * 60 * 60000);
    
    const timeDiff = targetTime.getTime() - this.viewTime.getTime();
    const diffMinutes = Math.abs(timeDiff) / 60000;
    
    // Determine update strategy
    let strategy = 'smooth';
    if (diffMinutes > 5) {
      strategy = 'jump'; // User probably left and came back
    } else if (diffMinutes > 1) {
      strategy = 'animate'; // Visible but smooth
    }
    
    // Clamp only — do NOT re-fold through mapTimeToScheduleDate. `now` already
    // sits on the canvas (getEffectiveNow), so folding would wrap a 24:00–30:00
    // post-midnight follow position back 24h onto the anchor day (same reason
    // jumpToNow clamps directly).
    this.viewTime = this.clampToScheduleDay(targetTime);
    this.saveState();
    this.notifyChange('following_update', { strategy, diffMinutes });
    
    console.log('🔄 Following mode update (' + strategy + ', Δ' + diffMinutes.toFixed(1) + 'min):', this.getStateInfo());
  }
  
  /**
   * Change time range
   */
  changeTimeRange(newRange) {
    const validRanges = [1, 3, 4, 6, 8, 12, 24];
    if (!validRanges.includes(newRange)) {
      this.notifyError('Invalid time range: ' + newRange);
      return false;
    }
    
    const oldRange = this.timeRange;
    this.timeRange = newRange;
    
    // Keep center time the same, just show more/less around it
    this.saveState();
    this.notifyChange('range_changed', { oldRange, newRange });
    
    console.log('📏 Time range changed: ' + oldRange + 'h → ' + newRange + 'h:', this.getStateInfo());
    return true;
  }
  
  /**
   * Update settings from settings modal
   */
  updateSettings(settings) {
    let changed = false;
    
    if (settings.offsetPercentage !== undefined && settings.offsetPercentage !== this.offsetPercentage) {
      this.offsetPercentage = Math.min(Math.max(settings.offsetPercentage, 0), 50); // Clamp 0-50%
      changed = true;
      console.log('⚙️ Offset updated to: ' + this.offsetPercentage + '%');
    }
    
    if (settings.updateIntervalSeconds !== undefined && settings.updateIntervalSeconds !== this.updateIntervalSeconds) {
      this.updateIntervalSeconds = settings.updateIntervalSeconds;
      changed = true;
      
      // Restart following interval if active
      if (this.isFollowingMode) {
        clearInterval(this.followingInterval);
        this.followingInterval = setInterval(() => {
          this.updateFollowingMode();
        }, this.updateIntervalSeconds * 1000);
      }
      
      console.log('⚙️ Update interval changed to: ' + this.updateIntervalSeconds + 's');
    }
    
    if (settings.autoScroll !== undefined && settings.autoScroll !== this.autoScroll) {
      this.autoScroll = settings.autoScroll;
      changed = true;
      console.log('⚙️ Auto-scroll: ' + (this.autoScroll ? 'ON' : 'OFF'));
    }
    
    if (settings.followingModeEnabled === false && this.isFollowingMode) {
      this.deactivateFollowingMode();
      changed = true;
      console.log('⚙️ Following mode disabled by settings');
    }
    
    if (changed) {
      this.saveState();
      this.notifyChange('settings_updated', settings);
    }
  }
  
  /**
   * Add listener for state changes
   */
  addListener(callback) {
    this.listeners.push(callback);
  }
  
  /**
   * Remove listener
   */
  removeListener(callback) {
    this.listeners = this.listeners.filter(cb => cb !== callback);
  }
  
  /**
   * Notify all listeners of state change
   */
  notifyChange(type, data = {}) {
    const state = this.getState();
    this.listeners.forEach(callback => {
      callback({ type, state, data });
    });
  }
  
  /**
   * Notify error
   */
  notifyError(message) {
    console.warn('⚠️ TimeManager:', message);
    this.listeners.forEach(callback => {
      callback({ type: 'error', message });
    });
  }
  
  /**
   * Save state to localStorage
   */
  saveState() {
    const state = {
      viewTime: this.viewTime.toISOString(),
      timeRange: this.timeRange,
      offsetPercentage: this.offsetPercentage,
      updateIntervalSeconds: this.updateIntervalSeconds,
      savedAt: new Date().toISOString()
    };
    
    try {
      localStorage.setItem('sparplanen_time_state', JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save time state:', error);
    }
  }
  
  /**
   * Restore state from localStorage
   */
  restoreState() {
    try {
      const saved = localStorage.getItem('sparplanen_time_state');
      if (!saved) {
        console.log('No saved time state, using defaults');
        return;
      }
      
      const state = JSON.parse(saved);
      const savedAt = new Date(state.savedAt);
      const now = new Date();
      const ageMinutes = (now - savedAt) / 60000;
      
      // Only restore if saved within last hour
      if (ageMinutes < 60) {
        this.viewTime = new Date(state.viewTime);
        this.timeRange = state.timeRange || 4;
        this.offsetPercentage = state.offsetPercentage || 20;
        this.updateIntervalSeconds = state.updateIntervalSeconds || 60;
        
        console.log('✅ Restored time state from ' + ageMinutes.toFixed(0) + ' minutes ago');
      } else {
        console.log('⏰ Saved state too old (' + ageMinutes.toFixed(0) + ' min), using defaults');
      }
    } catch (error) {
      console.error('Failed to restore time state:', error);
    }
  }
  
  /**
   * Format time for display (HH:MM)
   */
  formatTime(date) {
    return date.toTimeString().substring(0, 5);
  }
  
  /**
   * Format time for time display component (HH:MM:SS)
   */
  formatTimeWithSeconds(date) {
    return date.toTimeString().substring(0, 8);
  }
  
  /**
   * Check if a time is within visible range
   */
  isTimeVisible(time) {
    const state = this.getState();
    return time >= state.startTime && time <= state.endTime;
  }
  
  /**
   * Get midnight of today (for boundary checks)
   */
  getTodayMidnight() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }
  
  /**
   * Get midnight of tomorrow
   */
  getTomorrowMidnight() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }
  
  /**
   * Destroy - cleanup intervals
   */
  destroy() {
    if (this.followingInterval) {
      clearInterval(this.followingInterval);
    }
    this.listeners = [];
    console.log('🗑️ TimeManager destroyed');
  }
}

// Create global instance
window.TimeManager = new TimeManager();
