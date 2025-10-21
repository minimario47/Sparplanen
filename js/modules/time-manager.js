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
    
    // Settings (will be updated from settings modal)
    this.offsetPercentage = 20; // Percentage from left edge where red line is fixed (0-50%)
    this.updateIntervalSeconds = 60; // How often following mode updates
    
    // Boundaries
    this.maxPastHours = 24; // Can't go more than 24h in past
    this.maxFutureHours = 12; // Can't go more than 12h in future
    
    // Listeners for state changes
    this.listeners = [];
    
    // Initialize
    this.restoreState();
    console.log('✅ TimeManager initialized:', this.getStateInfo());
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
   * Navigate backward by current time range
   */
  navigatePrevious() {
    const jumpHours = this.timeRange; // Jump by current time range
    const newTime = new Date(this.viewTime.getTime() - jumpHours * 60 * 60000);
    
    // Check boundary
    const now = new Date();
    const maxPast = new Date(now.getTime() - this.maxPastHours * 60 * 60000);
    
    if (newTime < maxPast) {
      this.notifyError(`Cannot go more than ${this.maxPastHours} hours in the past`);
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
    const newTime = new Date(this.viewTime.getTime() + jumpHours * 60 * 60000);
    
    // Check boundary
    const now = new Date();
    const maxFuture = new Date(now.getTime() + this.maxFutureHours * 60 * 60000);
    
    if (newTime > maxFuture) {
      this.notifyError(`Cannot go more than ${this.maxFutureHours} hours in the future`);
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
   * Jump to current time (positions current time at red line)
   */
  jumpToNow() {
    const now = new Date();
    
    // Calculate where red line is relative to center
    // Red line is at offsetPercentage% from left, center is at 50%
    // So offset from center = offsetPercentage - 50
    const offsetFromCenterPercent = this.offsetPercentage - 50;
    const offsetFromCenterHours = (offsetFromCenterPercent / 100) * this.timeRange;
    
    // View time should be offset so current time appears at red line
    const targetTime = new Date(now.getTime() - offsetFromCenterHours * 60 * 60000);
    
    this.viewTime = targetTime;
    this.saveState();
    this.notifyChange('jump_to_now');
    
    console.log('🎯 Jumped to now (red line at ' + this.offsetPercentage + '%):', this.getStateInfo());
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
    
    const now = new Date();
    
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
    
    this.viewTime = targetTime;
    this.saveState();
    this.notifyChange('following_update', { strategy, diffMinutes });
    
    console.log('🔄 Following mode update (' + strategy + ', Δ' + diffMinutes.toFixed(1) + 'min):', this.getStateInfo());
  }
  
  /**
   * Change time range
   */
  changeTimeRange(newRange) {
    const validRanges = [1, 3, 4, 6, 8, 12];
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
