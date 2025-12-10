/**
 * Form Components Handler - Manages custom form elements
 * Handles: toggles, sliders, custom selects, radio groups, collapsible help
 */

(function() {
    'use strict';

    const FormComponents = {

        /**
         * Initialize collapsible help text
         */
        initHelpToggles() {
            const helpToggles = document.querySelectorAll('.form-help-toggle');
            
            helpToggles.forEach(toggle => {
                toggle.setAttribute('role', 'button');
                toggle.setAttribute('tabindex', '0');
                toggle.setAttribute('aria-label', 'Visa/dölj hjälptext');
                
                const helpText = toggle.closest('.form-control').querySelector('.form-help');
                
                // Click handler
                toggle.addEventListener('click', () => {
                    const isExpanded = toggle.classList.contains('expanded');
                    this.toggleHelp(toggle, helpText, !isExpanded);
                });
                
                // Keyboard support
                toggle.addEventListener('keydown', (e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        toggle.click();
                    }
                });
            });
        },

        /**
         * Toggle help text visibility
         */
        toggleHelp(toggle, helpText, show) {
            if (show) {
                toggle.classList.add('expanded');
                helpText.classList.add('visible');
                toggle.setAttribute('aria-expanded', 'true');
            } else {
                toggle.classList.remove('expanded');
                helpText.classList.remove('visible');
                toggle.setAttribute('aria-expanded', 'false');
            }
        },

        /**
         * Initialize toggle switches
         */
        initToggles() {
            const toggles = document.querySelectorAll('.toggle-switch');
            
            toggles.forEach(toggle => {
                toggle.setAttribute('role', 'switch');
                toggle.setAttribute('tabindex', '0');
                
                // Check if already has the 'checked' class
                const isChecked = toggle.classList.contains('checked');
                toggle.setAttribute('aria-checked', isChecked ? 'true' : 'false');
                
                // Click handler
                toggle.addEventListener('click', () => this.toggleSwitch(toggle));
                
                // Keyboard support (Space/Enter)
                toggle.addEventListener('keydown', (e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        this.toggleSwitch(toggle);
                    }
                });
            });
        },

        /**
         * Toggle a switch and add bounce animation
         */
        toggleSwitch(toggle) {
            const isChecked = toggle.classList.contains('checked');
            
            toggle.classList.add('toggled-once');
            toggle.classList.toggle('checked', !isChecked);
            toggle.setAttribute('aria-checked', !isChecked ? 'true' : 'false');
            
            // Dispatch change event
            toggle.dispatchEvent(new CustomEvent('change', {
                detail: { checked: !isChecked }
            }));
        },

        /**
         * Initialize sliders
         */
        initSliders() {
            const sliders = document.querySelectorAll('.slider');
            
            sliders.forEach(slider => {
                const valueDisplay = slider.nextElementSibling;
                
                // Update display on input
                slider.addEventListener('input', () => {
                    if (valueDisplay && valueDisplay.classList.contains('slider-value')) {
                        valueDisplay.textContent = slider.value + (slider.dataset.unit || '');
                    }
                    slider.dispatchEvent(new CustomEvent('change', {
                        detail: { value: slider.value }
                    }));
                });
                
                // Update fill width using data attribute
                const updateFill = () => {
                    const value = (slider.value - slider.min) / (slider.max - slider.min) * 100;
                    slider.style.setProperty('--fill-percent', value + '%');
                };
                
                slider.addEventListener('input', updateFill);
                updateFill();
            });
        },

        /**
         * Initialize custom select dropdowns
         */
        initSelects() {
            const selects = document.querySelectorAll('.custom-select');
            
            selects.forEach(select => {
                const button = select.querySelector('.custom-select-button');
                const menu = select.querySelector('.custom-select-menu');
                const options = select.querySelectorAll('.custom-select-option');
                
                if (!button || !menu) return;
                
                // Toggle menu on button click
                button.addEventListener('click', () => {
                    const isOpen = menu.classList.contains('open');
                    this.closeAllSelects();
                    if (!isOpen) {
                        menu.classList.add('open');
                        button.setAttribute('aria-expanded', 'true');
                    }
                });
                
                // Handle option selection
                options.forEach(option => {
                    option.addEventListener('click', () => {
                        options.forEach(opt => opt.classList.remove('selected'));
                        option.classList.add('selected');
                        
                        button.textContent = option.textContent.trim();
                        button.appendChild(this.createChevron());
                        
                        menu.classList.remove('open');
                        button.setAttribute('aria-expanded', 'false');
                        
                        // Dispatch change event
                        select.dispatchEvent(new CustomEvent('change', {
                            detail: { value: option.getAttribute('data-value') || option.textContent }
                        }));
                    });
                });
                
                // Keyboard navigation
                button.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        button.click();
                    }
                });
            });
            
            // Close selects when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.custom-select')) {
                    this.closeAllSelects();
                }
            });
        },

        /**
         * Create a chevron SVG icon
         */
        createChevron() {
            const div = document.createElement('div');
            div.className = 'custom-select-chevron';
            div.innerHTML = '▼';
            return div;
        },

        /**
         * Close all select menus
         */
        closeAllSelects() {
            const menus = document.querySelectorAll('.custom-select-menu');
            const buttons = document.querySelectorAll('.custom-select-button');
            
            menus.forEach(menu => menu.classList.remove('open'));
            buttons.forEach(btn => btn.setAttribute('aria-expanded', 'false'));
        },

        /**
         * Initialize radio button groups
         */
        initRadioGroups() {
            const groups = document.querySelectorAll('.radio-group');
            
            groups.forEach(group => {
                const inputs = group.querySelectorAll('.radio-group-input');
                
                inputs.forEach(input => {
                    input.addEventListener('change', () => {
                        if (input.checked) {
                            inputs.forEach(i => i.classList.remove('checked'));
                            input.classList.add('checked');
                            
                            group.dispatchEvent(new CustomEvent('change', {
                                detail: { value: input.value }
                            }));
                        }
                    });
                });
            });
        },

        /**
         * Initialize all form components
         */
        init() {
            this.initHelpToggles();
            this.initToggles();
            this.initSliders();
            this.initSelects();
            this.initRadioGroups();
            console.log('✅ Form components initialized');
        }
    };

    /**
     * Initialize when DOM is ready
     */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => FormComponents.init());
    } else {
        FormComponents.init();
    }

    /**
     * Expose API for external use
     */
    window.FormComponents = FormComponents;

})();
