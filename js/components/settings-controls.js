/* Settings Controls - Interactive components (slider, toggle, select) */

(function() {
    'use strict';

    // Control states
    const controlState = {
        slider: {
            value: 10,
            isDragging: false
        },
        toggles: {},
        selects: {}
    };

    /**
     * Initialize all controls
     */
    function init() {
        initSlider();
        initToggles();
        initSelects();
        console.log('✅ Settings controls initialized');
    }

    /**
     * Initialize slider control
     */
    function initSlider() {
        const slider = document.getElementById('offset-slider');
        const thumb = document.getElementById('offset-slider-thumb');
        const track = document.getElementById('offset-slider-track');
        const valueDisplay = document.getElementById('offset-value');

        if (!slider || !thumb || !track || !valueDisplay) {
            console.warn('Slider elements not found');
            return;
        }

        // Update slider position
        function updateSlider(value) {
            const min = 0;
            const max = 50; // Percentage 0-50%
            const percentage = ((value - min) / (max - min)) * 100;

            thumb.style.left = `${percentage}%`;
            track.style.width = `${percentage}%`;
            valueDisplay.textContent = `${value}%`;
            controlState.slider.value = value;
        }

        // Handle slider drag
        function handleDrag(clientX) {
            const rect = slider.getBoundingClientRect();
            const x = clientX - rect.left;
            const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
            const value = Math.round((percentage / 100) * 50);
            updateSlider(value);
        }

        // Mouse events
        slider.addEventListener('click', (e) => {
            handleDrag(e.clientX);
        });

        thumb.addEventListener('mousedown', (e) => {
            e.preventDefault();
            controlState.slider.isDragging = true;
            document.body.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (controlState.slider.isDragging) {
                handleDrag(e.clientX);
            }
        });

        document.addEventListener('mouseup', () => {
            if (controlState.slider.isDragging) {
                controlState.slider.isDragging = false;
                document.body.style.cursor = '';
            }
        });

        // Touch events for mobile
        thumb.addEventListener('touchstart', (e) => {
            e.preventDefault();
            controlState.slider.isDragging = true;
        });

        document.addEventListener('touchmove', (e) => {
            if (controlState.slider.isDragging && e.touches.length > 0) {
                handleDrag(e.touches[0].clientX);
            }
        });

        document.addEventListener('touchend', () => {
            if (controlState.slider.isDragging) {
                controlState.slider.isDragging = false;
            }
        });

        // Keyboard support
        thumb.addEventListener('keydown', (e) => {
            const currentValue = controlState.slider.value;
            let newValue = currentValue;

            switch(e.key) {
                case 'ArrowLeft':
                case 'ArrowDown':
                    e.preventDefault();
                    newValue = Math.max(0, currentValue - 1);
                    break;
                case 'ArrowRight':
                case 'ArrowUp':
                    e.preventDefault();
                    newValue = Math.min(50, currentValue + 1);
                    break;
                case 'Home':
                    e.preventDefault();
                    newValue = 0;
                    break;
                case 'End':
                    e.preventDefault();
                    newValue = 50;
                    break;
                case 'PageDown':
                    e.preventDefault();
                    newValue = Math.max(0, currentValue - 5);
                    break;
                case 'PageUp':
                    e.preventDefault();
                    newValue = Math.min(50, currentValue + 5);
                    break;
            }

            if (newValue !== currentValue) {
                updateSlider(newValue);
            }
        });

        // Make thumb focusable
        thumb.setAttribute('tabindex', '0');
        thumb.setAttribute('role', 'slider');
        thumb.setAttribute('aria-valuemin', '0');
        thumb.setAttribute('aria-valuemax', '50');
        thumb.setAttribute('aria-valuenow', '20');
        thumb.setAttribute('aria-label', 'Röd linje position (procent från vänster)');

        // Initialize with default value
        updateSlider(20);
    }

    /**
     * Initialize toggle switches
     */
    function initToggles() {
        const toggles = document.querySelectorAll('.settings-toggle');

        toggles.forEach((toggle) => {
            const toggleId = toggle.id;
            controlState.toggles[toggleId] = false;

            // Click handler
            toggle.addEventListener('click', () => {
                const isChecked = toggle.classList.contains('checked');
                setToggle(toggleId, !isChecked);
            });

            // Keyboard support (Space and Enter)
            toggle.addEventListener('keydown', (e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    toggle.click();
                }
            });

            // Make focusable
            toggle.setAttribute('tabindex', '0');
            toggle.setAttribute('role', 'switch');
            toggle.setAttribute('aria-checked', 'false');
        });
    }

    /**
     * Set toggle state
     */
    function setToggle(toggleId, checked) {
        const toggle = document.getElementById(toggleId);
        if (!toggle) return;

        controlState.toggles[toggleId] = checked;

        if (checked) {
            toggle.classList.add('checked');
            toggle.setAttribute('aria-checked', 'true');
        } else {
            toggle.classList.remove('checked');
            toggle.setAttribute('aria-checked', 'false');
        }
    }

    /**
     * Initialize select dropdowns
     */
    function initSelects() {
        const selects = document.querySelectorAll('.settings-select');

        selects.forEach((select) => {
            const selectId = select.id;
            controlState.selects[selectId] = select.value;

            // Change handler
            select.addEventListener('change', () => {
                controlState.selects[selectId] = select.value;
            });
        });
    }

    /**
     * Get slider value
     */
    function getSliderValue() {
        return controlState.slider.value;
    }

    /**
     * Set slider value
     */
    function setSliderValue(value) {
        const slider = document.getElementById('offset-slider');
        const thumb = document.getElementById('offset-slider-thumb');
        const track = document.getElementById('offset-slider-track');
        const valueDisplay = document.getElementById('offset-value');

        if (!slider || !thumb || !track || !valueDisplay) return;

        const min = 0;
        const max = 50; // Percentage 0-50%
        const clampedValue = Math.max(min, Math.min(max, value));
        const percentage = ((clampedValue - min) / (max - min)) * 100;

        thumb.style.left = `${percentage}%`;
        track.style.width = `${percentage}%`;
        valueDisplay.textContent = `${clampedValue}%`;
        thumb.setAttribute('aria-valuenow', clampedValue);
        controlState.slider.value = clampedValue;
    }

    /**
     * Get toggle value
     */
    function getToggleValue(toggleId) {
        return controlState.toggles[toggleId] || false;
    }

    /**
     * Set toggle value
     */
    function setToggleValue(toggleId, checked) {
        setToggle(toggleId, checked);
    }

    /**
     * Get select value
     */
    function getSelectValue(selectId) {
        return controlState.selects[selectId] || '';
    }

    /**
     * Set select value
     */
    function setSelectValue(selectId, value) {
        const select = document.getElementById(selectId);
        if (!select) return;

        select.value = value;
        controlState.selects[selectId] = value;
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose API
    window.SettingsControls = {
        getSliderValue,
        setSliderValue,
        getToggleValue,
        setToggleValue,
        getSelectValue,
        setSelectValue
    };

})();

