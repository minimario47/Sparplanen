/* Settings Modal - Main modal controller */

(function() {
    'use strict';

    // Modal state
    let isOpen = false;
    let currentTab = 'time';

    // Default settings
    const defaultSettings = {
        offsetPercentage: 20,
        followMode: false,
        updateInterval: '60'
    };

    // Current settings (loaded from localStorage or defaults)
    let currentSettings = { ...defaultSettings };

    // DOM elements (will be initialized on DOMContentLoaded)
    let elements = {
        backdrop: null,
        modal: null,
        closeBtn: null,
        tabs: [],
        tabPanels: [],
        resetBtn: null,
        cancelBtn: null,
        saveBtn: null
    };

    /**
     * Initialize the settings modal
     */
    function init() {
        // Get DOM elements
        elements.backdrop = document.getElementById('settings-backdrop');
        elements.modal = document.getElementById('settings-modal');
        elements.closeBtn = document.getElementById('settings-close-btn');
        elements.tabs = Array.from(document.querySelectorAll('.settings-tab'));
        elements.tabPanels = Array.from(document.querySelectorAll('.settings-tab-panel'));
        elements.resetBtn = document.getElementById('settings-reset-btn');
        elements.cancelBtn = document.getElementById('settings-cancel-btn');
        elements.saveBtn = document.getElementById('settings-save-btn');

        if (!elements.backdrop || !elements.modal) {
            console.warn('Settings modal elements not found');
            return;
        }

        // Load saved settings
        loadSettings();

        // Set up event listeners
        setupEventListeners();

        console.log('✅ Settings modal initialized');
    }

    /**
     * Set up all event listeners
     */
    function setupEventListeners() {
        // Close button
        if (elements.closeBtn) {
            elements.closeBtn.addEventListener('click', closeModal);
        }

        // Backdrop click (close modal)
        if (elements.backdrop) {
            elements.backdrop.addEventListener('click', (e) => {
                if (e.target === elements.backdrop) {
                    closeModal();
                }
            });
        }

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isOpen) {
                closeModal();
            }
        });

        // Tab switching
        elements.tabs.forEach((tab) => {
            tab.addEventListener('click', () => {
                const tabName = tab.getAttribute('data-tab');
                switchTab(tabName);
            });
        });

        // Footer buttons
        if (elements.resetBtn) {
            elements.resetBtn.addEventListener('click', resetSettings);
        }

        if (elements.cancelBtn) {
            elements.cancelBtn.addEventListener('click', closeModal);
        }

        if (elements.saveBtn) {
            elements.saveBtn.addEventListener('click', saveSettings);
        }

        // Listen for settings button click in header
        const settingsBtn = document.querySelector('.settings-button');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', openModal);
        } else {
            console.warn('Settings button not found in DOM');
        }
    }

    /**
     * Open the settings modal
     */
    function openModal() {
        if (!elements.backdrop || !elements.modal) {
            console.error('Modal elements not found');
            return;
        }

        isOpen = true;
        elements.backdrop.classList.remove('hidden', 'closing');
        
        // Load current settings into controls
        updateControlsFromSettings();

        // Focus management
        trapFocus();
    }

    /**
     * Close the settings modal
     */
    function closeModal() {
        if (!elements.backdrop || !elements.modal) return;

        // Add closing animation
        elements.backdrop.classList.add('closing');

        // Wait for animation to finish before hiding
        setTimeout(() => {
            elements.backdrop.classList.add('hidden');
            elements.backdrop.classList.remove('closing');
            isOpen = false;
        }, 200); // Match animation duration

        console.log('Settings modal closed');
    }

    /**
     * Switch between tabs
     */
    function switchTab(tabName) {
        currentTab = tabName;

        // Update tab buttons
        elements.tabs.forEach((tab) => {
            if (tab.getAttribute('data-tab') === tabName) {
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
            } else {
                tab.classList.remove('active');
                tab.setAttribute('aria-selected', 'false');
            }
        });

        // Update tab panels
        elements.tabPanels.forEach((panel) => {
            if (panel.getAttribute('data-tab-panel') === tabName) {
                panel.classList.add('active');
                panel.removeAttribute('hidden');
            } else {
                panel.classList.remove('active');
                panel.setAttribute('hidden', 'true');
            }
        });

        console.log(`Switched to tab: ${tabName}`);
    }

    /**
     * Load settings from localStorage
     */
    function loadSettings() {
        try {
            const saved = localStorage.getItem('sparplannen-settings');
            if (saved) {
                currentSettings = { ...defaultSettings, ...JSON.parse(saved) };
                console.log('✅ Settings loaded from localStorage', currentSettings);
            } else {
                currentSettings = { ...defaultSettings };
                console.log('Using default settings');
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            currentSettings = { ...defaultSettings };
        }
    }

    /**
     * Save settings to localStorage
     */
    function saveSettings() {
        // Get current values from controls
        currentSettings = getSettingsFromControls();

        try {
            localStorage.setItem('sparplannen-settings', JSON.stringify(currentSettings));
            console.log('✅ Settings saved', currentSettings);

            // Dispatch event for other components to react to
            window.dispatchEvent(new CustomEvent('settingsChanged', {
                detail: currentSettings
            }));

            // Show success notification (if notification system exists)
            if (window.showNotification) {
                window.showNotification('Inställningar sparade', 'success');
            }

            closeModal();
        } catch (error) {
            console.error('Error saving settings:', error);
            if (window.showNotification) {
                window.showNotification('Kunde inte spara inställningar', 'error');
            }
        }
    }

    /**
     * Reset settings to defaults
     */
    function resetSettings() {
        if (confirm('Är du säker på att du vill återställa alla inställningar till standardvärden?')) {
            currentSettings = { ...defaultSettings };
            updateControlsFromSettings();
            console.log('Settings reset to defaults');
        }
    }

    /**
     * Get current settings from controls
     */
    function getSettingsFromControls() {
        return {
            offsetPercentage: window.SettingsControls ? window.SettingsControls.getSliderValue() : defaultSettings.offsetPercentage,
            followMode: window.SettingsControls ? window.SettingsControls.getToggleValue('follow-mode') : defaultSettings.followMode,
            updateInterval: window.SettingsControls ? window.SettingsControls.getSelectValue('update-interval') : defaultSettings.updateInterval
        };
    }

    /**
     * Update controls to reflect current settings
     */
    function updateControlsFromSettings() {
        if (window.SettingsControls) {
            window.SettingsControls.setSliderValue(currentSettings.offsetPercentage);
            window.SettingsControls.setToggleValue('follow-mode', currentSettings.followMode);
            window.SettingsControls.setSelectValue('update-interval', currentSettings.updateInterval);
        }
    }

    /**
     * Trap focus within modal for accessibility
     */
    function trapFocus() {
        if (!elements.modal) return;

        const focusableElements = elements.modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];

        // Focus first element
        if (firstFocusable) {
            setTimeout(() => firstFocusable.focus(), 100);
        }

        // Tab trap
        elements.modal.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                if (document.activeElement === firstFocusable) {
                    e.preventDefault();
                    lastFocusable.focus();
                }
            } else {
                if (document.activeElement === lastFocusable) {
                    e.preventDefault();
                    firstFocusable.focus();
                }
            }
        });
    }

    /**
     * Get current settings (for external use)
     */
    function getCurrentSettings() {
        return { ...currentSettings };
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose API
    window.SettingsModal = {
        open: openModal,
        close: closeModal,
        getCurrentSettings: getCurrentSettings
    };


})();

