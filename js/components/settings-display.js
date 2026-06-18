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

        elements.panel = document.getElementById('panel-display');
        elements.stage = document.getElementById('display-stage');
        elements.singleStrip = document.getElementById('display-theme-strip');
        elements.lengthStrip = document.getElementById('display-length-theme-strip');
        elements.singleEditor = document.getElementById('single-color-controls');
        elements.lengthCustom = document.getElementById('length-custom-controls');

        if (!elements.stage || !elements.singleStrip) {
            return;
        }

        bindThemeStrip(elements.singleStrip, 'single');
        bindThemeStrip(elements.lengthStrip, 'length');
    }

    // A gallery is a radiogroup of look-cards. A click reports both the mode the
    // gallery represents and the chosen theme id, so the controller can flip the
    // active colour mode and apply the palette in one go.
    function bindThemeStrip(strip, mode) {
        if (!strip) return;

        strip.addEventListener('click', (event) => {
            const button = event.target.closest('[data-theme-option]');
            if (!button || !onThemeChange) return;
            onThemeChange(mode, button.getAttribute('data-theme-option'));
        });

        strip.addEventListener('keydown', (event) => {
            const buttons = Array.from(strip.querySelectorAll('[data-theme-option]'));
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
        if (!elements.stage || !elements.singleStrip) return;

        setActiveMode(settings);
        renderStage(settings);
        renderGallery(settings, 'single');
        renderGallery(settings, 'length');
        renderSingleEditor(settings);
        renderLengthCustom(settings);
        renderLengthRuler(settings);
        renderClassRows(settings);
    }

    // Drives the dim/active styling — whichever mode isn't live fades out.
    function setActiveMode(settings) {
        if (elements.panel) {
            elements.panel.setAttribute('data-active-color-mode', settings.trainColorMode || 'single');
        }
    }

    function renderStage(settings) {
        elements.stage.dataset.mode = settings.trainColorMode;
        elements.stage.querySelectorAll('[data-stage-bucket]').forEach((bar) => {
            const bucket = bar.getAttribute('data-stage-bucket');
            applyTrainColors(bar, getBucketColors(settings, bucket));
        });
    }

    function renderGallery(settings, mode) {
        const strip = mode === 'single' ? elements.singleStrip : elements.lengthStrip;
        if (!strip) return;

        const themes = getOrderedThemes(mode);
        const activeThemeId = mode === 'single' ? settings.singleTheme : settings.lengthTheme;
        const helpEl = strip.closest('.form-control')
            ? strip.closest('.form-control').querySelector('.form-help')
            : null;
        const helpId = (helpEl && helpEl.id) || '';

        strip.innerHTML = themes.map(([themeId, theme]) => {
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

    // Inline editor for the single "Egen färg" card — visible only when that card
    // is the selected one, so editing a swatch can never surprise-switch a named
    // theme to custom (you're already on custom to reach the pickers).
    function renderSingleEditor(settings) {
        if (elements.singleEditor) {
            elements.singleEditor.hidden = !(settings.trainColorMode === 'single'
                && settings.singleTheme === 'custom');
        }
    }

    // The per-class colour matrix is the length mode's "Egen färg" — same rule.
    function renderLengthCustom(settings) {
        if (elements.lengthCustom) {
            elements.lengthCustom.hidden = settings.lengthTheme !== 'custom';
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
            const colors = getLengthBucketColors(settings, bucket);
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

    // Colours that drive the stage/ruler — reflect the ACTIVE mode.
    function getBucketColors(settings, bucket) {
        if (settings.trainColorMode === 'single') {
            return settings.singleColor;
        }
        return settings.lenColors[bucket];
    }

    // The per-class matrix always shows length colours regardless of active mode.
    function getLengthBucketColors(settings, bucket) {
        return settings.lenColors[bucket];
    }

    function getOrderedThemes(mode) {
        const themeSet = themeSets[mode] || {};
        return Object.entries(themeSet)
            .filter(([themeId]) => themeId !== 'custom')
            .concat(themeSet.custom ? [['custom', themeSet.custom]] : []);
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
