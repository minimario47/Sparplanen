/**
 * settings-delay.js — no-op
 * Delay settings have been merged into settings-modal.js (sparplannen-settings localStorage key).
 * This file is kept to avoid breaking any existing <script> tags.
 */

// Provide stub API in case anything still calls these
window.loadDelaySettings = function() { return {}; };
window.saveDelaySettings = function() { return false; };
window.initializeDelaySettingsUI = function() {};
