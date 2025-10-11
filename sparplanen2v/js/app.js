/* Main application initialization */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize theme
    initTheme();
    
    // Initialize header controls (which initializes TimeManager integration)
    initializeHeader();
    
    // Initialize schedule view
    initializeSchedule();
    
    console.log('🎨 SpårplanV2 loaded successfully!');
    console.log('📋 All systems initialized:');
    console.log('  ✅ TimeManager - Time navigation system');
    console.log('  ✅ Header Controls - Navigation buttons, Nu button, time range selector');
    console.log('  ✅ Schedule Renderer - Dynamic train schedule view');
    console.log('  ✅ Settings Modal - User preferences');
    console.log('  ✅ Theme System - Light/Dark/High-contrast modes');
});


