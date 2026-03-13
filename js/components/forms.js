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

            helpToggles.forEach((toggle, idx) => {
                toggle.setAttribute('role', 'button');
                toggle.setAttribute('tabindex', '0');
                // Preserve specific aria-label from HTML; only fall back to generic if absent
                if (!toggle.getAttribute('aria-label')) {
                    toggle.setAttribute('aria-label', 'Visa/dölj hjälptext');
                }

                const formControl = toggle.closest('.form-control');
                const helpText = formControl.querySelector('.form-help');

                // Wire aria-describedby: assign an ID to the help text element and
                // point the associated interactive control(s) at it so screen readers
                // announce the help text as a description of the field.
                if (helpText) {
                    const helpId = helpText.id || ('form-help-' + (formControl.id || idx));
                    helpText.id = helpId;
                    const controls = formControl.querySelectorAll(
                        '.slider, .toggle-switch, .custom-select-button, .radio-group-input'
                    );
                    controls.forEach(ctrl => ctrl.setAttribute('aria-describedby', helpId));
                }

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
                const options = Array.from(select.querySelectorAll('.custom-select-option'));

                if (!button || !menu) return;

                // ARIA: add listbox/option roles so screen readers understand the widget
                const menuId = button.id ? button.id + '-menu' : 'select-menu-' + Math.random().toString(36).slice(2);
                menu.id = menuId;
                menu.setAttribute('role', 'listbox');
                button.setAttribute('aria-haspopup', 'listbox');
                button.setAttribute('aria-controls', menuId);

                options.forEach((option, idx) => {
                    option.setAttribute('role', 'option');
                    option.setAttribute('tabindex', '-1');
                    const val = option.getAttribute('data-value') || option.textContent.trim();
                    option.id = menuId + '-opt-' + idx;
                    if (option.classList.contains('selected')) {
                        option.setAttribute('aria-selected', 'true');
                        button.setAttribute('aria-activedescendant', option.id);
                    } else {
                        option.setAttribute('aria-selected', 'false');
                    }
                });

                const openMenu = () => {
                    this.closeAllSelects();
                    menu.classList.add('open');
                    button.setAttribute('aria-expanded', 'true');
                    // Focus currently selected option
                    const selected = menu.querySelector('[aria-selected="true"]') || options[0];
                    if (selected) selected.focus();
                };

                const closeMenu = () => {
                    menu.classList.remove('open');
                    button.setAttribute('aria-expanded', 'false');
                    button.focus();
                };

                const selectOption = (option) => {
                    options.forEach(opt => {
                        opt.classList.remove('selected');
                        opt.setAttribute('aria-selected', 'false');
                    });
                    option.classList.add('selected');
                    option.setAttribute('aria-selected', 'true');
                    button.setAttribute('aria-activedescendant', option.id);

                    button.textContent = option.textContent.trim();
                    button.appendChild(this.createChevron());

                    closeMenu();

                    select.dispatchEvent(new CustomEvent('change', {
                        detail: { value: option.getAttribute('data-value') || option.textContent.trim() }
                    }));
                };

                // Toggle menu on button click
                button.addEventListener('click', () => {
                    if (menu.classList.contains('open')) {
                        closeMenu();
                    } else {
                        openMenu();
                    }
                });

                // Handle option selection via click
                options.forEach(option => {
                    option.addEventListener('click', () => selectOption(option));
                });

                // Keyboard navigation on button (closed state)
                button.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                        e.preventDefault();
                        openMenu();
                    } else if (e.key === 'Escape') {
                        closeMenu();
                    }
                });

                // Keyboard navigation within open menu
                menu.addEventListener('keydown', (e) => {
                    const focused = document.activeElement;
                    const idx = options.indexOf(focused);
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        const next = options[Math.min(idx + 1, options.length - 1)];
                        if (next) next.focus();
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        if (idx <= 0) { closeMenu(); return; }
                        const prev = options[idx - 1];
                        if (prev) prev.focus();
                    } else if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (focused && options.includes(focused)) selectOption(focused);
                    } else if (e.key === 'Escape' || e.key === 'Tab') {
                        closeMenu();
                    } else if (e.key === 'Home') {
                        e.preventDefault();
                        options[0]?.focus();
                    } else if (e.key === 'End') {
                        e.preventDefault();
                        options[options.length - 1]?.focus();
                    }
                });
            });

            // Close selects when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.custom-select')) {
                    this.closeAllSelects();
                }
            });

            // Close on Escape at document level
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') this.closeAllSelects();
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
