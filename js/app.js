/* Main application initialization */

// Detect page loads/reloads with persistent counter
const pageLoadTime = new Date();
let loadCount = parseInt(localStorage.getItem('page_load_count') || '0') + 1;
localStorage.setItem('page_load_count', loadCount.toString());
localStorage.setItem('last_load_time', pageLoadTime.toISOString());

// Single consolidated log entry
const reloadInfo = loadCount > 1 ?
    `⚠️ Page reloaded ${loadCount} times. Possible causes: Safari dev tools auto-refresh, browser extensions (Wipr), file watchers, or service workers.` :
    `✅ Fresh page load`;

console.log(`🚀 Page Load #${loadCount} at ${pageLoadTime.toLocaleTimeString()} - ${reloadInfo}`);

// Detect WHAT is causing the reload
window.addEventListener('beforeunload', (event) => {
    console.warn(`⚠️ Page unloading at ${new Date().toLocaleTimeString()} - possible causes: auto-refresh, extensions, or navigation`);
    console.trace('Unload stack trace');
});

// Global error handler to catch unhandled errors that might cause reloads
window.addEventListener('error', (event) => {
    console.error('🚨 UNHANDLED ERROR (might cause reload):', event.error);
    console.error('   Message:', event.message);
    console.error('   Filename:', event.filename);
    console.error('   Line:', event.lineno);
    console.error('   Column:', event.colno);
    console.error('   Stack:', event.error?.stack);
    // Don't reload - just log the error
    return false;
});

// Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    console.error('🚨 UNHANDLED PROMISE REJECTION (might cause reload):', event.reason);
    console.error('   Stack:', event.reason?.stack);
    // Don't reload - just log the error
    event.preventDefault();
    return false;
});

// Firebase Cloud Function URL (deployed endpoint)
const FIREBASE_CLOUD_FUNCTION_URL = 'https://us-central1-sparplan-9d5ce.cloudfunctions.net/getTrainAnnouncements';

document.addEventListener('DOMContentLoaded', async function() {
    // Initialize theme
    initTheme();
    
    // Initialize header controls (which initializes TimeManager integration)
    initializeHeader();
    
    // Initialize schedule view
    initializeSchedule();
    
    // Initialize delay integration system
    try {
        logger.info('App', 'Initializing delay integration system...');
        window.delayIntegration = new DelayIntegration(FIREBASE_CLOUD_FUNCTION_URL);
        await window.delayIntegration.initialize();
        logger.info('App', 'Delay integration system initialized successfully');
    } catch (error) {
        logger.error('App', 'Failed to initialize delay integration', error);
        console.warn('⚠️ Running without delay data integration');
    }
    
    console.log('🎨 SpårplanV2 loaded successfully!');
    console.log('📋 All systems initialized:');
    console.log('  ✅ TimeManager - Time navigation system');
    console.log('  ✅ Header Controls - Navigation buttons, Nu button, time range selector');
    console.log('  ✅ Schedule Renderer - Dynamic train schedule view');
    console.log('  ✅ Settings Modal - User preferences');
    console.log('  ✅ Theme System - Light/Dark/High-contrast modes');
    console.log('  ✅ Delay Integration - Real-time train delay tracking');
    console.log('  ✅ Debug Logger - Comprehensive logging system');
});


