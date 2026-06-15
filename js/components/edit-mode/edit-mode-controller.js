/**
 * Edit Mode Controller — the pen toggle, tool palette, and bottom action bar.
 *
 * Phase 0 ships the SHELL: entering/leaving the bounded session, the
 * `is-editing` body class, the (disabled) tool palette, and a working action
 * bar (Ångra / Gör om / Avbryt / Slutför). Later phases enable individual
 * tools and wire pointer/keyboard editing into this scaffold.
 *
 * No relayout on toggle — the board stays put; CSS only reveals the chrome.
 */
(function () {
    'use strict';

    // Palette tools. `enabled` flips on per phase as the tool lands.
    const TOOLS = [
        { tool: 'select', label: 'Markera', key: 'V', icon: 'M4 4l7 16 2-7 7-2z', enabled: true },
        { tool: 'cut', label: 'Klipp', key: 'C', icon: 'M6 6l12 12M6 18L18 6', enabled: true },
        { tool: 'attach', label: 'Koppla', key: 'A', icon: 'M9 12h6M7 8a4 4 0 000 8M17 8a4 4 0 010 8', enabled: false },
        { tool: 'retrack', label: 'Flytta spår', key: '', icon: 'M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4', enabled: true },
        { tool: 'retime', label: 'Ändra tid', key: '', icon: 'M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4', enabled: true },
        { tool: 'unit', label: 'Dela/ihop', key: 'K', icon: 'M7 7h4v10H7zM13 7h4v10h-4z', enabled: false },
        { tool: 'delete', label: 'Ta bort', key: '', icon: 'M6 7h12M9 7V5h6v2M8 7l1 12h6l1-12', enabled: false }
    ];

    let toggleBtn = null;
    let paletteEl = null;
    let actionBarEl = null;
    let statusEl = null;
    let undoBtn = null;
    let redoBtn = null;
    let activeTool = 'select';

    function svgIcon(path) {
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
    }

    function buildPalette() {
        const el = document.createElement('div');
        el.className = 'edit-palette';
        el.setAttribute('role', 'toolbar');
        el.setAttribute('aria-label', 'Redigeringsverktyg');
        el.innerHTML = TOOLS.map((t) => `
            <button type="button" class="edit-palette__tool" data-tool="${t.tool}" ${t.enabled ? '' : 'disabled'}
                title="${t.label}${t.key ? ' (' + t.key + ')' : ''}" aria-label="${t.label}">
                <span class="edit-palette__icon">${svgIcon(t.icon)}</span>
                <span class="edit-palette__label">${t.label}</span>
                ${t.key ? `<span class="edit-palette__key">${t.key}</span>` : ''}
            </button>`).join('');
        return el;
    }

    function buildActionBar() {
        const el = document.createElement('div');
        el.className = 'edit-action-bar';
        el.setAttribute('role', 'region');
        el.setAttribute('aria-label', 'Redigeringsåtgärder');
        el.innerHTML = `
            <span class="edit-action-bar__status">
                <span class="edit-action-bar__dot" aria-hidden="true"></span>
                <span class="edit-action-bar__status-text">Redigerar</span>
            </span>
            <span class="edit-action-bar__spacer"></span>
            <button type="button" class="edit-action-bar__btn" data-act="undo" title="Ångra (⌘Z)">Ångra</button>
            <button type="button" class="edit-action-bar__btn" data-act="redo" title="Gör om (⌘⇧Z)">Gör om</button>
            <button type="button" class="edit-action-bar__btn" data-act="cancel">Avbryt</button>
            <button type="button" class="edit-action-bar__btn edit-action-bar__btn--primary" data-act="commit">Slutför</button>`;
        statusEl = el.querySelector('.edit-action-bar__status-text');
        undoBtn = el.querySelector('[data-act="undo"]');
        redoBtn = el.querySelector('[data-act="redo"]');
        el.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-act]');
            if (!btn) return;
            const act = btn.dataset.act;
            if (act === 'undo') window.EditSession.undo();
            else if (act === 'redo') window.EditSession.redo();
            else if (act === 'cancel') requestExit();
            else if (act === 'commit') window.EditSession.commit();
        });
        return el;
    }

    function paintActiveTool() {
        // Reflect the active tool on the body so CSS can switch affordances
        // (e.g. the scissors cursor while the cut tool is selected).
        document.body.dataset.editTool = activeTool;
        if (!paletteEl) return;
        paletteEl.querySelectorAll('.edit-palette__tool').forEach((btn) => {
            btn.classList.toggle('is-active', btn.dataset.tool === activeTool);
        });
    }

    function setActiveTool(tool) {
        const def = TOOLS.find((t) => t.tool === tool);
        if (!def || !def.enabled) return;
        activeTool = tool;
        paintActiveTool();
    }

    function updateChrome() {
        const s = window.EditSession;
        if (!s) return;
        if (toggleBtn) {
            toggleBtn.setAttribute('aria-pressed', s.active ? 'true' : 'false');
            toggleBtn.classList.toggle('is-active', s.active);
        }
        if (undoBtn) undoBtn.disabled = !s.canUndo();
        if (redoBtn) redoBtn.disabled = !s.canRedo();
        if (statusEl) {
            const n = s.pendingCount();
            statusEl.textContent = n > 0
                ? `Redigerar — ${n} ${n === 1 ? 'ändring' : 'ändringar'}`
                : 'Redigerar';
        }
    }

    function enter() {
        if (!window.EditSession) return;
        activeTool = 'select';
        paintActiveTool();
        window.EditSession.start();
    }

    function requestExit() {
        const s = window.EditSession;
        if (!s || !s.active) return;
        if (s.pendingCount() > 0) {
            const n = s.pendingCount();
            const ok = window.confirm(`Kasta ${n} ${n === 1 ? 'ändring' : 'ändringar'}?`);
            if (!ok) return;
        }
        s.discard();
    }

    function toggle() {
        const s = window.EditSession;
        if (!s) return;
        if (s.active) requestExit();
        else enter();
    }

    function isTypingTarget(el) {
        if (!el) return false;
        const tag = el.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    }

    function onKeydown(e) {
        if (isTypingTarget(e.target)) return;
        const s = window.EditSession;
        if (!s) return;
        const meta = e.metaKey || e.ctrlKey;
        if (meta && (e.key === 'z' || e.key === 'Z')) {
            if (!s.active) return;
            e.preventDefault();
            if (e.shiftKey) s.redo(); else s.undo();
            return;
        }
        if (s.active && e.key === 'Escape') { e.preventDefault(); requestExit(); return; }
        if (!meta && (e.key === 'e' || e.key === 'E')) { e.preventDefault(); toggle(); }
    }

    function init() {
        toggleBtn = document.getElementById('edit-mode-toggle');
        if (toggleBtn) toggleBtn.addEventListener('click', toggle);

        paletteEl = buildPalette();
        actionBarEl = buildActionBar();
        document.body.appendChild(paletteEl);
        document.body.appendChild(actionBarEl);
        paletteEl.addEventListener('click', (e) => {
            const btn = e.target.closest('.edit-palette__tool');
            if (!btn || btn.disabled) return;
            setActiveTool(btn.dataset.tool);
        });
        paintActiveTool();

        if (window.EditSession && typeof window.EditSession.subscribe === 'function') {
            window.EditSession.subscribe(updateChrome);
        }
        document.addEventListener('keydown', onKeydown);
        updateChrome();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.EditModeController = {
        getActiveTool: () => activeTool,
        setActiveTool
    };
})();
