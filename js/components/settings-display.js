(function() {
    'use strict';

    const buckets = ['b1', 'b2', 'b3', 'b4', 'b5'];
    let elements = {};
    let themeSets = { length: {}, single: {} };
    let onThemeChange = null;

    function init(config) {
        themeSets.length = config.lengthThemes || {};
        themeSets.single = config.singleThemes || {};
        onThemeChange = config.onThemeChange || null;

        elements.stage = document.getElementById('display-stage');
        elements.themeStrip = document.getElementById('display-theme-strip');
        elements.customPanel = document.getElementById('display-custom-panel');
        elements.singleControls = document.getElementById('single-color-controls');
        elements.lengthControls = document.getElementById('length-custom-controls');
        elements.themeControl = document.getElementById('display-theme-control');

        if (!elements.stage || !elements.themeStrip) {
            return;
        }

        bindThemeStrip();
    }

    function bindThemeStrip() {
        elements.themeStrip.addEventListener('click', (event) => {
            const button = event.target.closest('[data-theme-option]');
            if (!button || !onThemeChange) return;
            onThemeChange(button.getAttribute('data-theme-option'));
        });

        elements.themeStrip.addEventListener('keydown', (event) => {
            const buttons = Array.from(elements.themeStrip.querySelectorAll('[data-theme-option]'));
            const currentIndex = buttons.indexOf(document.activeElement);
            if (currentIndex === -1) return;

            let nextIndex = null;
            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                nextIndex = Math.min(currentIndex + 1, buttons.length - 1);
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                nextIndex = Math.max(currentIndex - 1, 0);
            }

            if (nextIndex === null) return;
            event.preventDefault();
            buttons[nextIndex].focus();
            buttons[nextIndex].click();
        });
    }

    function render(settings) {
        if (!elements.stage || !elements.themeStrip) return;

        renderStage(settings);
        renderThemeStrip(settings);
        renderCustomPanel(settings);
        renderLengthRuler(settings);
        renderClassRows(settings);
    }

    function renderStage(settings) {
        elements.stage.dataset.mode = settings.trainColorMode;
        elements.stage.querySelectorAll('[data-stage-bucket]').forEach((bar) => {
            const bucket = bar.getAttribute('data-stage-bucket');
            applyTrainColors(bar, getBucketColors(settings, bucket));
        });
    }

    function renderThemeStrip(settings) {
        const mode = settings.trainColorMode;
        const themes = getOrderedThemes(mode);
        const activeThemeId = getActiveThemeId(settings);
        const helpId = elements.themeControl?.querySelector('.form-help')?.id || '';

        elements.themeStrip.innerHTML = themes.map(([themeId, theme]) => {
            const name = shortenThemeName(theme.name);
            const sample = buildThemeSample(settings, mode, themeId, theme);
            return `
                <button
                    type="button"
                    class="display-theme-option"
                    role="radio"
                    aria-checked="${themeId === activeThemeId}"
                    aria-label="${theme.name}"
                    ${helpId ? `aria-describedby="${helpId}"` : ''}
                    data-theme-option="${themeId}">
                    <span class="display-theme-preview">
                        ${sample}
                        ${themeId === 'custom' ? '<span class="display-theme-notch" aria-hidden="true"></span>' : ''}
                    </span>
                    <span class="display-theme-name">${name}</span>
                </button>
            `;
        }).join('');
    }

    function renderCustomPanel(settings) {
        const activeThemeId = getActiveThemeId(settings);
        const isCustom = activeThemeId === 'custom';
        const isSingle = settings.trainColorMode === 'single';

        if (elements.customPanel) {
            elements.customPanel.hidden = !isCustom;
        }
        if (elements.singleControls) {
            elements.singleControls.hidden = !(isCustom && isSingle);
        }
        if (elements.lengthControls) {
            elements.lengthControls.hidden = !(isCustom && !isSingle);
        }
    }

    function renderLengthRuler(settings) {
        document.querySelectorAll('[data-length-stop]').forEach((stop) => {
            const bucket = stop.getAttribute('data-length-stop');
            const colors = getBucketColors(settings, bucket);
            stop.style.setProperty('--length-mark-color', colors.border);
            stop.style.setProperty('--length-pill-bg', colors.bg);
            stop.style.setProperty('--length-pill-border', colors.border);
            stop.style.setProperty('--length-pill-text', colors.text);
        });
    }

    function renderClassRows(settings) {
        document.querySelectorAll('[data-class-row]').forEach((row) => {
            const bucket = row.getAttribute('data-class-row');
            const colors = getBucketColors(settings, bucket);
            const bar = row.querySelector('.display-class-bar');
            if (!bar) return;
            applyTrainColors(bar, colors);
        });
    }

    function buildThemeSample(settings, mode, themeId, theme) {
        const colors = getThemeSampleColors(settings, mode, themeId, theme);
        return buckets.map((bucket) => {
            const color = colors[bucket];
            return `
                <span
                    class="display-theme-mini-bar"
                    style="--display-bar-bg:${color.bg};--display-bar-border:${color.border};--display-bar-text:${color.text};">
                </span>
            `;
        }).join('');
    }

    function getThemeSampleColors(settings, mode, themeId, theme) {
        if (themeId === 'custom') {
            if (mode === 'single') {
                return buckets.reduce((acc, bucket) => {
                    acc[bucket] = settings.singleColor;
                    return acc;
                }, {});
            }

            return buckets.reduce((acc, bucket) => {
                acc[bucket] = settings.lenColors[bucket];
                return acc;
            }, {});
        }

        if (mode === 'single') {
            return buckets.reduce((acc, bucket) => {
                acc[bucket] = theme.color;
                return acc;
            }, {});
        }

        return theme.colors;
    }

    function getBucketColors(settings, bucket) {
        if (settings.trainColorMode === 'single') {
            return settings.singleColor;
        }
        return settings.lenColors[bucket];
    }

    function getOrderedThemes(mode) {
        const themeSet = themeSets[mode] || {};
        return Object.entries(themeSet)
            .filter(([themeId]) => themeId !== 'custom')
            .concat(themeSet.custom ? [['custom', themeSet.custom]] : []);
    }

    function getActiveThemeId(settings) {
        return settings.trainColorMode === 'single'
            ? settings.singleTheme
            : settings.lengthTheme;
    }

    function shortenThemeName(name) {
        return name.replace(/\s*\(.+?\)\s*/g, '').trim();
    }

    function applyTrainColors(element, colors) {
        element.style.setProperty('--display-bar-bg', colors.bg);
        element.style.setProperty('--display-bar-border', colors.border);
        element.style.setProperty('--display-bar-text', colors.text);
    }

    window.SettingsDisplay = {
        init,
        render
    };
})();
