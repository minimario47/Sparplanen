// Menu System 
(function() {
    'use strict';

    const menuConfig = {
        'data-management': {
            title: 'Data',
            icon: '💾',
            description: 'Hantera din data',
            items: [
                {
                    id: 'save',
                    title: 'Spara',
                    description: 'Spara nuvarande schema',
                    icon: '💾',
                    shortcut: 'Ctrl+S',
                    action: () => {
                        if (typeof handleSaveNow === 'function') {
                            handleSaveNow();
                        }
                    }
                },
                {
                    id: 'import',
                    title: 'Importera',
                    description: 'Ladda schema från fil',
                    icon: '📁',
                    shortcut: 'Ctrl+O',
                    action: () => {
                        if (typeof handleImportClick === 'function') {
                            handleImportClick();
                        }
                    }
                },
                {
                    id: 'export',
                    title: 'Exportera',
                    description: 'Spara som PNG-bild',
                    icon: '📸',
                    shortcut: 'Ctrl+E',
                    action: () => {
                        const button = document.getElementById('exportButton');
                        if (button && button.click) {
                            button.click();
                        }
                    }
                },
                {
                    id: 'reset-data',
                    title: 'Återställ data',
                    description: 'Återställ till ursprunglig tågdata från trains.js',
                    icon: '🔄',
                    action: () => {
                        if (confirm('⚠️ Detta kommer att ta bort ALL sparad data och återställa till ursprungliga tågdata.\n\nÄr du säker på att du vill fortsätta?')) {
                            if (typeof persistenceEngine !== 'undefined' && persistenceEngine.resetToInitialData) {
                                persistenceEngine.resetToInitialData();
                            } else {
                                if (typeof showNotification !== 'undefined') {
                                    showNotification('Återställningsfunktion inte tillgänglig', 'error');
                                }
                            }
                        }
                    }
                }
            ]
        },
        'edit-tools': {
            title: 'Redigering',
            icon: '✏️',
            description: 'Redigera och hantera ändringar',
            items: [
                {
                    id: 'undo',
                    title: 'Ångra',
                    description: 'Ångra senaste ändring',
                    icon: '↶',
                    shortcut: 'Ctrl+Z',
                    action: () => {
                        if (typeof handleUndo === 'function') {
                            handleUndo();
                        }
                    }
                },
                {
                    id: 'redo',
                    title: 'Gör om',
                    description: 'Upprepa ångrad ändring',
                    icon: '↷',
                    shortcut: 'Ctrl+Y',
                    action: () => {
                        if (typeof handleRedo === 'function') {
                            handleRedo();
                        }
                    }
                },
                {
                    id: 'history',
                    title: 'Historik',
                    description: 'Visa ändringshistorik',
                    icon: '📋',
                    action: () => {
                        if (typeof toggleHistoryPanel === 'function') {
                            toggleHistoryPanel();
                        }
                    }
                }
            ]
        },
        'help-settings': {
            title: 'Hjälp & Inställningar',
            icon: '⚙️',
            description: 'Hjälp och konfiguration',
            items: [
                {
                    id: 'theme-toggle',
                    title: 'Växla tema',
                    description: 'Byt mellan ljust och mörkt tema',
                    icon: '🌓',
                    action: () => {
                        toggleTheme();
                    }
                },
                {
                    id: 'help',
                    title: 'Hjälp',
                    description: 'Visa tangentbordsgenvägar',
                    icon: '❓',
                    shortcut: 'F1',
                    action: () => {
                        if (typeof showKeyboardHelp === 'function') {
                            showKeyboardHelp();
                        }
                    }
                },
                {
                    id: 'tips',
                    title: 'Tips & Tricks',
                    description: 'Användbara tips för bättre arbetsflöde',
                    icon: '💡',
                    action: () => {
                        showUsageTips();
                    }
                },
                {
                    id: 'about',
                    title: 'Om Applikationen',
                    description: 'Information om systemet',
                    icon: 'ℹ️',
                    action: () => {
                        showAboutInfo();
                    }
                }
            ]
        }
    };

    let activeMenu = null;
    let menuContainer = null;

    // Initialize menu system
    function initializeMenuSystem() {
        createMenuContainer();
        setupEventListeners();
        initializeTheme();
        console.log('✅ Menu system initialized');
    }

    function createMenuContainer() {
        menuContainer = document.createElement('div');
        menuContainer.className = 'menu-system';
        menuContainer.innerHTML = createMenuHTML();
        
        const controlsContainer = document.querySelector('.main-controls');
        if (controlsContainer) {
            const addTrainButton = controlsContainer.querySelector('#addTrainButton');
            if (addTrainButton) {
                controlsContainer.insertBefore(menuContainer, addTrainButton.nextSibling);
            } else {
                controlsContainer.appendChild(menuContainer);
            }
        }
    }

    function createMenuHTML() {
        return Object.entries(menuConfig).map(([menuId, menuData]) => `
            <div class="menu-item-wrapper">
                <button class="menu-button" data-menu="${menuId}" 
                        title="${menuData.description}" 
                        aria-label="${menuData.title}">
                    <span class="menu-icon">▼</span>
                    <span>${menuData.icon} ${menuData.title}</span>
                </button>
                <div class="menu-dropdown" data-menu-dropdown="${menuId}">
                    <button class="menu-close" aria-label="Stäng meny">×</button>
                    ${createCategoryHTML(menuData)}
                </div>
            </div>
        `).join('');
    }

    function createCategoryHTML(categoryData) {
        return `
            <div class="menu-category">
                <div class="menu-category-header">
                    <span class="category-icon">${categoryData.icon}</span>
                    <span>${categoryData.title}</span>
                </div>
                <div class="menu-category-items">
                    ${categoryData.items.map(item => `
                        <button class="menu-item" data-action="${item.id}" 
                                title="${item.description}">
                            <span class="item-icon">${item.icon}</span>
                            <div class="menu-item-content">
                                <div class="menu-item-title">${item.title}</div>
                                <div class="menu-item-description">${item.description}</div>
                            </div>
                            ${item.shortcut ? `<span class="menu-item-shortcut">${item.shortcut}</span>` : ''}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Setup event listeners
    function setupEventListeners() {
        // Menu button clicks
        document.addEventListener('click', handleMenuClick);
        
        // Close menu when clicking outside
        document.addEventListener('click', handleOutsideClick);
        
        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboardShortcuts);
        
        // Close on escape
        document.addEventListener('keydown', handleEscapeKey);
    }

    // Handle menu button clicks
    function handleMenuClick(e) {
        const menuButton = e.target.closest('.menu-button');
        const menuItem = e.target.closest('.menu-item');
        const closeButton = e.target.closest('.menu-close');

        if (menuButton) {
            e.preventDefault();
            e.stopPropagation();
            const menuId = menuButton.dataset.menu;
            toggleMenu(menuId);
        } else if (menuItem) {
            e.preventDefault();
            e.stopPropagation();
            handleMenuItemClick(menuItem);
        } else if (closeButton) {
            e.preventDefault();
            e.stopPropagation();
            closeAllMenus();
        }
    }

    // Handle menu item clicks
    function handleMenuItemClick(menuItem) {
        const actionId = menuItem.dataset.action;
        
        // Add loading state
        menuItem.classList.add('loading');
        
        // Find the action in menu config
        for (const [menuId, menuData] of Object.entries(menuConfig)) {
            const item = menuData.items.find(item => item.id === actionId);
            if (item && item.action) {
                try {
                    item.action();
                    
                    // Provide user feedback
                    if (typeof showNotification === 'function') {
                        showNotification(`${item.title} utförd`, 'success', 2000);
                    }
                } catch (error) {
                    console.error(`Error executing menu action ${actionId}:`, error);
                    if (typeof showNotification === 'function') {
                        showNotification(`Fel vid ${item.title.toLowerCase()}`, 'error', 3000);
                    }
                }
                break;
            }
        }
        
        // Remove loading state and close menu
        setTimeout(() => {
            menuItem.classList.remove('loading');
            closeAllMenus();
        }, 300);
    }

    // Toggle menu visibility
    function toggleMenu(menuId) {
        const dropdown = document.querySelector(`[data-menu-dropdown="${menuId}"]`);
        const button = document.querySelector(`[data-menu="${menuId}"]`);
        
        if (!dropdown || !button) return;

        const isActive = dropdown.classList.contains('visible');
        
        // Close all other menus first
        closeAllMenus();
        
        if (!isActive) {
            // Open this menu
            dropdown.classList.add('visible');
            button.classList.add('active');
            activeMenu = menuId;
            
            // Focus first menu item for accessibility
            const firstItem = dropdown.querySelector('.menu-item');
            if (firstItem) {
                setTimeout(() => firstItem.focus(), 100);
            }
        }
    }

    // Close all menus
    function closeAllMenus() {
        const dropdowns = document.querySelectorAll('.menu-dropdown');
        const buttons = document.querySelectorAll('.menu-button');
        
        dropdowns.forEach(dropdown => dropdown.classList.remove('visible'));
        buttons.forEach(button => button.classList.remove('active'));
        
        activeMenu = null;
    }

    // Handle clicking outside menus
    function handleOutsideClick(e) {
        if (!e.target.closest('.menu-system')) {
            closeAllMenus();
        }
    }

    // Handle escape key
    function handleEscapeKey(e) {
        if (e.key === 'Escape' && activeMenu) {
            closeAllMenus();
        }
    }

    // Handle keyboard shortcuts
    function handleKeyboardShortcuts(e) {
        // Don't handle shortcuts when typing in inputs
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        const shortcuts = {
            'KeyS': { ctrl: true, action: 'save' },
            'KeyO': { ctrl: true, action: 'import' },
            'KeyE': { ctrl: true, action: 'export' },
            'KeyZ': { ctrl: true, action: 'undo' },
            'KeyY': { ctrl: true, action: 'redo' },
            'F1': { action: 'help' }
        };

        const shortcut = shortcuts[e.code];
        if (shortcut && (!shortcut.ctrl || e.ctrlKey)) {
            e.preventDefault();
            executeActionById(shortcut.action);
        }
    }

    // Execute action by ID
    function executeActionById(actionId) {
        for (const [menuId, menuData] of Object.entries(menuConfig)) {
            const item = menuData.items.find(item => item.id === actionId);
            if (item && item.action) {
                item.action();
                break;
            }
        }
    }

    // Show usage tips
    function showUsageTips() {
        const tips = [
            "💡 Dra tåg för att flytta dem mellan spår och i tid",
            "💡 Använd högerklick för snabb åtkomst till tågalternativ",
            "💡 Färgkoder visar konflikter: Röd = överlappning, Gul = kort vändtid",
            "💡 Ctrl+Z/Y för snabb ångra/gör om",
            "💡 Använd piltangenterna för att navigera mellan tåg",
            "💡 Delete-tangenten tar bort valt tåg",
            "💡 Dubbelklicka på tåg för snabb redigering"
        ];
        
        const tipMessage = tips.join('\n\n');
        
        if (typeof showNotification === 'function') {
            showNotification(tipMessage, 'info', 8000);
        }
    }

    // Show about information
    function showAboutInfo() {
        const aboutMessage = `🚂 Digitalt Tågspårdiagram
        
Version: 2.0 Enhanced
Utvecklad för effektiv tågtrafikplanering

Funktioner:
• Visuell schemaläggning
• Konfliktsdetektering
• Export till bilder
• Automatisk sparning
• Tangentbordsgenvägar
• Historikhantering

Teknisk information:
• Moderna webbteknologier
• Responsiv design
• Lokal datalagring
• Tillgänglighetsoptimerad`;

        if (typeof showNotification === 'function') {
            showNotification(aboutMessage, 'info', 10000);
        }
    }

    // Update menu item states based on application state
    function updateMenuStates() {
        // This can be called when app state changes to update menu item availability
        const undoButton = document.querySelector('[data-action="undo"]');
        const redoButton = document.querySelector('[data-action="redo"]');
        
        if (undoButton && window.AppState) {
            const canUndo = window.AppState.historyPointer > 0;
            undoButton.style.opacity = canUndo ? '1' : '0.5';
            undoButton.disabled = !canUndo;
        }
        
        if (redoButton && window.AppState) {
            const canRedo = window.AppState.historyPointer < (window.AppState.actionHistory?.length - 1);
            redoButton.style.opacity = canRedo ? '1' : '0.5';
            redoButton.disabled = !canRedo;
        }
    }

    // Theme management functions
    function initializeTheme() {
        // Check for saved theme preference or default to light
        const savedTheme = localStorage.getItem('railway-tracker-theme') || 'light';
        setTheme(savedTheme);
    }
    
    function setTheme(theme) {
        const validThemes = ['light', 'dark', 'high-contrast'];
        if (!validThemes.includes(theme)) {
            theme = 'light';
        }
        
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('railway-tracker-theme', theme);
        
        // Update theme toggle icon and text
        updateThemeToggleUI(theme);
        
        // Provide user feedback
        const themeNames = {
            'light': 'Ljust tema',
            'dark': 'Mörkt tema',
            'high-contrast': 'Simon läge'
        };
        
        if (typeof showNotification === 'function') {
            showNotification(`🎨 ${themeNames[theme]} aktiverat`, 'success', 2000);
        }
    }
    
    function getCurrentTheme() {
        return document.documentElement.getAttribute('data-theme') || 'light';
    }
    
    function toggleTheme() {
        const currentTheme = getCurrentTheme();
        const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
        setTheme(nextTheme);
    }
    
    function updateThemeToggleUI(theme) {
        const themeItem = document.querySelector('[data-action="theme-toggle"]');
        if (themeItem) {
            const icon = themeItem.querySelector('.item-icon');
            const title = themeItem.querySelector('.menu-item-title');
            const description = themeItem.querySelector('.menu-item-description');
            
            if (theme === 'dark') {
                if (icon) icon.textContent = '☀️';
                if (title) title.textContent = 'Ljust tema';
                if (description) description.textContent = 'Byt till ljust tema';
            } else {
                if (icon) icon.textContent = '🌙';
                if (title) title.textContent = 'Mörkt tema';
                if (description) description.textContent = 'Byt till mörkt tema';
            }
        }
    }
    
    // Detect system theme preference
    function detectSystemTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    }
    
    // Listen for system theme changes
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('railway-tracker-theme')) {
                setTheme(e.matches ? 'dark' : 'light');
            }
        });
    }

    // Export functions globally
    window.initializeMenuSystem = initializeMenuSystem;
    window.updateMenuStates = updateMenuStates;
    window.closeAllMenus = closeAllMenus;
    window.toggleTheme = toggleTheme;
    window.setTheme = setTheme;
    window.getCurrentTheme = getCurrentTheme;

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeMenuSystem);
    } else {
        initializeMenuSystem();
    }

})(); 