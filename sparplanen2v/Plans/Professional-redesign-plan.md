# Fullständig Omdesign av SpårplanV2

---

## 🎯 DESIGN & DEVELOPMENT PRINCIPLES

**Dessa principer MÅSTE följas i VARJE fas, subfas och implementation. Inga undantag.**

---

### 0. PROJECT STRUCTURE & TESTABILITY (CRITICAL - READ FIRST!)

**ABSOLUT VIKTIGAST - DETTA MÅSTE FÖLJAS VID VARJE FIL-SKAPANDE:**

#### Projektstruktur

**ALLA NYA FILER SKA SKAPAS I: `/Users/mikailyenigun/Desktop/Spårplannen/sparplanen2v/`**

- Detta är det NYA programmet, helt separerat från gamla koden
- Gamla koden i `/Users/mikailyenigun/Desktop/Spårplannen/` är ENDAST för referens
- **SKAPA ALDRIG nya filer i root Spårplannen-foldern**
- **SKAPA ALLTID nya filer i sparplanen2v/-foldern**

#### Folder-Organisation inom sparplanen2v/

```
sparplanen2v/
├── index.html                          # MAIN entry point - användaren kör detta
├── styles/
│   ├── design-system.css              # Design system variables
│   ├── typography.css                 # Typography system
│   ├── variables.css                  # Legacy compatibility
│   ├── themes.css                     # Light/dark/high-contrast themes
│   ├── base.css                       # Base HTML styling
│   ├── layout.css                     # Layout components
│   ├── components/                    # Component-specific styles
│   │   ├── buttons.css
│   │   ├── modals.css
│   │   ├── forms.css
│   │   └── ...
│   └── ...
├── js/
│   ├── app.js                         # Main application
│   ├── config.js                      # Configuration
│   ├── modules/                       # Feature modules
│   │   ├── timeline/
│   │   ├── tracks/
│   │   ├── trains/
│   │   └── ...
│   ├── components/                    # Reusable components
│   ├── utils/                         # Utility functions
│   └── ...
├── assets/
│   ├── icons/
│   ├── images/
│   └── fonts/
├── data/
│   ├── tracks.js
│   ├── trains.js
│   └── vehicleTypes.js
└── docs/
    └── Never write text files, write in the chat instead if you want to tell developer something
```

#### REGEL: Auto-Organisation av Filer

När AI skapar en ny fil MÅSTE den:

1. **Bestämma korrekt subfolder baserat på filtyp:**
   - CSS → `sparplanen2v/styles/` (eller `styles/components/` för component-specific)
   - JavaScript → `sparplanen2v/js/` (eller lämplig subfolder: modules/, components/, utils/)
   - HTML → `sparplanen2v/` (root) eller `sparplanen2v/components/` för komponenter
   - Data → `sparplanen2v/data/`
   - Assets → `sparplanen2v/assets/`

2. **Skapa subfolder om det inte finns:**
   - Om filen tillhör en feature (t.ex. warning system) → skapa `js/modules/warnings/`
   - Om filen är en component (t.ex. modal) → skapa `js/components/modals/`
   - Håll relaterade filer tillsammans

3. **Uppdatera index.html automatiskt:**
   - När ny CSS skapas → lägg till `<link>` tag i index.html i RÄTT ordning
   - När ny JS skapas → lägg till `<script>` tag i index.html i RÄTT ordning
   - Ordning är KRITISK för dependencies

#### REGEL: Live Testbarhet

**ANVÄNDAREN MÅSTE KUNNA TESTA ALLT GENOM ATT ÖPPNA index.html I BROWSER**

- **index.html är main entry point** - allt måste fungera därifrån
- **Varje subfas ska vara testbar** - användaren kan öppna browser och se progress
- **Inga build steps initially** - vanilla HTML/CSS/JS som fungerar direkt
- **Console ska vara ren** - zero errors, zero warnings efter varje subfas
- **Visual progress** - användaren ser designen utvecklas real-time

#### REGEL: Incremental Development

- **Varje ny fil ska integreras omedelbart** i index.html
- **Testa efter varje fil** - öppna browser, verifiera att det fungerar
- **Commit efter varje subfas** - funktionell checkpoint
- **Aldrig bryt existerande funktionalitet** - additiv development

#### CSS Loading Order i index.html

**KRITISK ORDNING - FÖLJ EXAKT:**

```html
<!-- 1. Design System Foundation -->
<link rel="stylesheet" href="styles/design-system.css">
<link rel="stylesheet" href="styles/typography.css">
<link rel="stylesheet" href="styles/variables.css">

<!-- 2. Themes -->
<link rel="stylesheet" href="styles/themes.css">

<!-- 3. Base & Layout -->
<link rel="stylesheet" href="styles/base.css">
<link rel="stylesheet" href="styles/layout.css">

<!-- 4. Components (alphabetical) -->
<link rel="stylesheet" href="styles/components/buttons.css">
<link rel="stylesheet" href="styles/components/forms.css">
<link rel="stylesheet" href="styles/components/modals.css">
<!-- ... etc -->

<!-- 5. Page-specific styles last -->
```

#### JavaScript Loading Order i index.html

**KRITISK ORDNING - FÖLJ EXAKT:**

```html
<!-- 1. Configuration & Constants -->
<script src="data/tracks.js"></script>
<script src="data/vehicleTypes.js"></script>
<script src="js/config.js"></script>

<!-- 2. Utilities (no dependencies) -->
<script src="js/utils/helpers.js"></script>
<script src="js/utils/validation.js"></script>

<!-- 3. Core Modules (dependency order matters!) -->
<script src="js/modules/state.js"></script>
<script src="js/modules/renderer.js"></script>

<!-- 4. Feature Modules -->
<script src="js/modules/timeline/timeline.js"></script>
<script src="js/modules/trains/trainManager.js"></script>

<!-- 5. Main App (ALWAYS LAST) -->
<script src="js/app.js"></script>
```

#### REGEL: Developer Visibility

**ANVÄNDAREN SKA SE ALLT SOM HÄNDER:**

- **Console logs** för viktiga operations (kan tas bort senare)
- **Visual indicators** när features laddas
- **Error messages** som är tydliga och hjälpsamma
- **Status updates** i UI när saker händer
- **Debug mode** toggle för extra verbosity

#### Migration av Existerande Filer

Filer som redan skapats i denna session måste flyttas till sparplanen2v/:

- `styles/design-system.css` → `sparplanen2v/styles/design-system.css`
- `styles/typography.css` → `sparplanen2v/styles/typography.css`
- `styles/themes.css` → `sparplanen2v/styles/themes.css`
- `styles/base.css` → `sparplanen2v/styles/base.css`
- `styles/variables.css` → `sparplanen2v/styles/variables.css` (uppdaterad)

#### REGEL: Max Filstorlek - Keep Files Manageable

**INGEN FIL FÅR VARA LÄNGRE ÄN 400 RADER KOD**

Detta är KRITISKT för maintainability, readability och single responsibility.

**När en fil närmar sig 400 rader:**

1. **STOPPA** - lägg inte till mer kod i denna fil
2. **ANALYSERA** - vad kan separeras ut?
   - Relaterade funktioner → egen modul
   - Komponenter → egen component-fil
   - Utilities → utils-fil
   - Constants → config/constants-fil

3. **LETA EFTER RELATERADE FILER:**
   - Finns det redan en fil som passar denna kod?
   - Är den filen <400 rader? → Lägg till där
   - Är den filen också >400 rader? → Gå till steg 4

4. **SKAPA NY FIL i relaterad folder:**
   - Om feature code → `js/modules/[feature-name]/[specific-file].js`
   - Om component → `js/components/[component-name]/[part].js`
   - Om util → `js/utils/[category]-utils.js`
   - Exempel: `design-system.css` (500+ rader) → dela upp i:
     - `design-system-colors.css` (färger)
     - `design-system-spacing.css` (spacing & shadows)
     - `design-system-typography.css` (typography vars)

5. **UPPDATERA IMPORTS/LINKS:**
   - Nya CSS-filer → lägg till i index.html (rätt ordning!)
   - Nya JS-filer → lägg till i index.html (rätt ordning!)
   - Dokumentera uppdelningen i kommentarer

**VARFÖR 400 rader?**
- ✅ Lätt att skanna hela filen utan scroll
- ✅ Single Responsibility - en fil, ett syfte
- ✅ Lättare att debugga
- ✅ Snabbare att hitta kod
- ✅ Mindre merge conflicts
- ✅ Bättre testability

**UNDANTAG (måste justifieras):**
- Data-filer (trains.js, tracks.js) - OK att vara längre
- Generated code - OK men bör isoleras
- Kompletta bibliotek i en fil - överväg att dela upp ändå

**EXEMPEL PÅ UPPDELNING:**

```javascript
// INNAN: modules/warnings/warningEngine.js (600 rader - FÖR LÅNGT!)

// EFTER uppdelning:
modules/warnings/
├── warningEngine.js           (200 rader - orchestration)
├── warningRules.js           (150 rader - rule definitions)
├── warningEvaluator.js       (150 rader - evaluation logic)
└── warningDisplay.js         (100 rader - UI rendering)
```

**REGEL: Automatisk Max-Varning**

När en fil når 380 rader (approaching limit), lägg till detta i toppen av filen:

```
/* ⚠️ WARNING: This file is approaching the 400-line limit (currently at XXX lines)
 * DO NOT add more code to this file without splitting it first!
 * See Professional-redesign-plan.md section "REGEL: Max Filstorlek" for guidance.
 */
```

När en fil når 400+ rader (limit exceeded), uppdatera varningen:

```
/* 🚫 MAX LIMIT EXCEEDED: This file has XXX lines (limit: 400)
 * DO NOT ADD ANY MORE CODE TO THIS FILE!
 * This file MUST be split before adding new functionality.
 * See Professional-redesign-plan.md section "REGEL: Max Filstorlek" for splitting guidance.
 */
```

**⚠️ ABSOLUT VIKTIGAST: Varje gång AI skapar/redigerar en fil, kontrollera att:**
1. ✅ Filen är i sparplanen2v/
2. ✅ Filen är i rätt subfolder
3. ✅ Filen är UNDER 400 rader kod
4. ✅ Om approaching 380 rader → lägg till approaching-warning
5. ✅ Om över 400 rader → lägg till max-exceeded warning OCH dela upp filen
6. ✅ index.html är uppdaterad med länk till filen
7. ✅ Ordningen är korrekt i index.html
8. ✅ Filen kan testas genom att öppna index.html i browser

---

### I. CORE DEVELOPMENT PRINCIPLES

#### 1. Professional Excellence - No Cut Corners

- Varje implementation måste vara production-ready kvalitet
- Inga "quick fixes" eller temporära lösningar
- Kod ska vara maintainable, readable och well-documented
- Performance optimization är obligatorisk, inte optional
- Error handling ska vara comprehensive på alla nivåer

#### 2. Complete User Control

- Controllers måste kunna redigera ALLT i systemet
- Alla inställningar ska vara accessible och intuitive
- Inga hårdkodade värden som användare borde kunna ändra
- Alla features ska ha on/off toggles där det är relevant
- Exportera/importera konfigurationer ska vara möjligt

#### 3. Mandatory Research & Learning

- Innan varje subfas: Research best practices för den specifika funktionen
- Studera 3-5 professionella exempel på liknande features
- Dokumentera inspiration sources och design decisions
- Om osäker: ASK developer för clarification
- Kontinuerligt lära sig nya tekniker och metoder

#### 4. Developer Communication

- Om något är unclear eller ambiguous: ASK
- Om en design decision kan implementeras på flera sätt: ASK vilket sätt är föredraget
- Om en feature kan påverka andra delar av systemet: ASK
- Om tidsestimat för en task är > 2 timmar: INFORM developer
- Vid tekniska blockers: COMMUNICATE immediately

---

### II. VISUAL DESIGN PRINCIPLES (Anthony Hobday's Safe Rules)

#### Color & Contrast

- **Use near-black (#1a1a1a) and near-white (#fafafa)** instead of pure black/white
- **Saturate neutrals** with < 5% of primary color for coherent palette
- **Use high contrast** for important elements (buttons, critical info)
- **Distinct brightness values** in color palette - colors shouldn't compete
- **Warm OR cool**, not both - if saturating neutrals, stick to one temperature
- **Container colors**: 7% brightness difference (light mode), 12% (dark mode)

#### Typography

- **Body text minimum 16px** - higher is better for readability
- **Lower letter-spacing with larger text**, raise with smaller text
- **Line length ~70 characters** (60-80 acceptable)
- **Use maximum two typefaces** - one for headings, one for body
- **Line height**: decrease for large text, increase for small text

#### Spacing & Alignment

- **Everything aligns with something else** - no orphaned elements
- **Measurements mathematically related** - use 4px or 8px scale
- **Spacing between contrast points** - measure from high contrast edges
- **Outer padding ≥ inner padding** - related elements closer together
- **12-column grid** for horizontal layouts

#### Shadows & Depth

- **Drop shadow blur = 2× distance** (4px distance = 8px blur)
- **Don't use shadows in dark mode** - use borders/subtle highlights instead
- **Don't mix depth techniques** - consistent shadow style throughout
- **Closer elements are lighter** - matches real world (light from above)

#### Containers & Borders

- **Borders contrast with BOTH** container and background
- **Nested corners**: inner radius = outer radius - gap distance
- **No double hard divides** - avoid border + background change together
- **Simple on complex OR complex on simple** - never complex on complex

#### Buttons & Interactive Elements

- **Horizontal padding = 2× vertical padding** in buttons
- **Lower icon contrast** when paired with text
- **Elements in order of visual weight** - heaviest first or on outside edge

#### General

- **Everything deliberate** - explain every design choice (spacing, color, size)
- **Optical alignment > mathematical** when needed - trust your eye
- **Don't mix warm and cool** in neutral saturations

---

### III. UX PRINCIPLES (Nielsen Norman Group)

#### Visual Hierarchy

- **Most important information most prominent** - size, color, position
- **Progressive disclosure** - show essential first, details on demand
- **Scanning patterns** - F-pattern for text, Z-pattern for UI
- **Grouping related elements** - proximity indicates relationship

#### Consistency & Standards

- **Internal consistency** - same elements behave the same way
- **External consistency** - follow platform conventions
- **Visual consistency** - colors, fonts, spacing follow system
- **Functional consistency** - similar tasks have similar workflows

#### Visibility & Feedback

- **System status visible** - always show what's happening
- **Immediate feedback** - acknowledge every user action
- **Progress indicators** - for long operations
- **Clear affordances** - buttons look clickable, fields look editable

#### Error Prevention & Recovery

- **Prevent errors** better than good error messages
- **Constraints** - disable invalid options
- **Confirmations** for destructive actions
- **Undo/Redo** - easy recovery from mistakes
- **Clear error messages** - what happened, why, how to fix

#### Flexibility & Efficiency

- **Shortcuts for experts** - keyboard shortcuts, bulk actions
- **Customization** - adapt to different workflows
- **Defaults that work** - good out of box, but customizable
- **Multiple paths** - support different user preferences

---

### IV. IMPLEMENTATION QUALITY STANDARDS

#### Code Quality

- **DRY (Don't Repeat Yourself)** - abstract common patterns
- **SOLID principles** - especially Single Responsibility
- **Meaningful names** - functions, variables, classes self-document
- **Comments for WHY, not WHAT** - code shows what, comments explain why
- **Consistent code style** - follow established patterns in codebase

#### Performance

- **Optimize rendering** - minimize reflows and repaints
- **Lazy loading** - load what's needed when needed
- **Debounce/throttle** - for frequent events (scroll, resize, input)
- **Efficient data structures** - O(1) lookups where possible
- **Monitor performance** - measure before and after optimizations

#### Accessibility (WCAG 2.1 AA)

- **Semantic HTML** - use proper elements (button, nav, main, etc.)
- **ARIA labels** - for dynamic content and complex interactions
- **Keyboard navigation** - everything accessible without mouse
- **Focus indicators** - clear visible focus states
- **Color not only indicator** - use icons, text, patterns too
- **Contrast ratios**: 4.5:1 for text, 3:1 for UI components

#### Responsive Design

- **Mobile-first approach** - start small, enhance for larger
- **Breakpoints at content breaks** - not device-specific
- **Touch targets ≥ 44×44px** - for mobile usability
- **Flexible layouts** - use flexbox/grid, avoid fixed widths
- **Test on real devices** - simulators miss touch nuances

---

### V. TESTING & VALIDATION

#### Before Each Commit

- **Visual inspection** - does it look right?
- **Functional testing** - does it work as expected?
- **Responsive check** - test at multiple screen sizes
- **Accessibility check** - keyboard navigation, screen reader
- **Performance check** - no obvious slowdowns

#### Browser Testing

- **Check console for errors** - zero errors/warnings
- **Validate HTML/CSS** - use validators

---

### VI. DOCUMENTATION REQUIREMENTS

#### Inline Documentation - KEEP IT MINIMAL!

**❌ FÖRBJUDET:**
- **NO USAGE EXAMPLES** in code files - waste of tokens/space
- **NO LONG EXPLANATORY COMMENTS** - code should be self-documenting
- **NO DECORATIVE BOXES** - simple /* */ comments only
- **NO PHILOSOPHY SECTIONS** - just code
- **NO "How to use" sections** - obvious from code

**✅ TILLÅTET (bara när nödvändigt):**
- **File header:** 1-2 lines max stating file purpose
- **Complex logic:** Short "why" comment (not "what")
- **TODO comments:** With ticket/issue number
- **Hacks/Workarounds:** Brief explanation why needed

**EXEMPEL PÅ KORREKT MINIMAL KOMMENTERING:**
```css
/* Header styles - 70px fixed height */
.app-header { 
  height: var(--header-height);
}
```

**EXEMPEL PÅ FEL (för mycket):**
```css
/*
╔══════════════════════════════════════════════════════════════╗
║                    HEADER COMPONENT                          ║
║   Modern, professional header with navigation                ║
╚══════════════════════════════════════════════════════════════╝

PHILOSOPHY:
- Clean and minimal
- Easy to read
... 20 more lines ...

USAGE EXAMPLES:
<header class="app-header">...</header>
*/
```

#### README Files

- Documentation belongs in **README.md**, NOT in code files
- Usage examples go in **docs/** folder
- Keep code files LEAN

---

### VII. BEAUTIFUL & USER-FRIENDLY REQUIREMENTS

#### Visual Beauty

- **Consistent spacing rhythm** - use 8px grid system
- **Smooth animations** - 200-300ms for most interactions
- **Delightful micro-interactions** - button hover, loading states
- **Attention to detail** - pixel-perfect alignment
- **Color harmony** - use color theory (complementary, analogous)

#### User-Friendliness

- **Intuitive without training** - obvious what to do
- **Forgiving of mistakes** - easy undo, clear confirmations
- **Helpful guidance** - tooltips, hints, onboarding
- **Fast and responsive** - <100ms perceived latency
- **Predictable behavior** - no surprises

---

### VIII. ANTHONY HOBDAY INSPIRATION

Studera och ta inspiration från:

- **https://anthonyhobday.com** - clean, professional aesthetic
- **Minimalist but not sterile** - personality through subtle details
- **Generous whitespace** - breathing room between elements
- **Clear hierarchy** - obvious what's important
- **Thoughtful typography** - readable, beautiful, purposeful

---

### IX. GIT & VERSION CONTROL STRATEGY

- **eCommit efter varje subfas** - tydliga commit messages på svenska
- **Branch strategy**: feature branches för större features
- **No commits to main without testing** - alltid testa innan merge
- **Descriptive commit messages**: "Subfas X.Y: Vad som gjordes och varför"
- **Tag releases**: när hela faser är klara (v1.0-phase1, etc.)

---

### X. DATA INTEGRITY & VALIDATION

- **Validate all user inputs** - client-side OCH server-side validation
- **Sanitize data** before storage - prevent XSS och injection
- **Type checking** - ensure data types are correct (number, string, date)
- **Boundary validation** - check min/max values (tider 00:00-23:59, längder > 0, etc.)
- **Data migration strategy** - om schema ändras, migrera gamla data automatiskt
- **Backup before destructive operations** - auto-backup innan stora ändringar
- **Version user data** - så gamla backups kan läsas av nya versioner
- **Referential integrity** - om tåg raderas, radera också relaterade notes/warnings

---

### XI. SECURITY CONSIDERATIONS

- **Input sanitization** - prevent XSS attacks, escape HTML
- **No eval() usage** - security risk, never use
- **Content Security Policy** - implementera CSP headers (om möjligt)
- **localStorage encryption** för sensitiv data (om sådan finns)
- **Rate limiting** på API calls - prevent abuse
- **Secure API communication** - HTTPS only för production
- **Authentication/Authorization** om flera användare ska använda systemet
- **No sensitive data in URLs** - använd POST, inte GET för känslig data
- **CORS policy** - strict CORS om backend finns

---

### XII. ERROR HANDLING & LOGGING

#### Error Handling Strategy

- **Global error handler** - catch alla uncaught errors och exceptions
- **Try-catch blocks** för kritiska operationer (API calls, localStorage, parsing)
- **Graceful degradation** - systemet ska fortsätta fungera vid delfel
- **User-friendly error messages** - tekniska detaljer i console, vänliga meddelanden till user
- **Error recovery mechanisms** - försök återhämta från errors automatiskt
- **Fallback values** - använd defaults vid fel i data

#### Error Categories

- **Critical**: System-breaking errors som kräver omstart eller user intervention
- **Warning**: Funktioner fungerar inte optimalt men systemet är användbart
- **Info**: Informativa meddelanden om icke-optimala states

#### Logging System

- **Console logging** i development mode - detaljerade logs
- **Production logging** - endast critical errors
- **Error logging to localStorage** - spara error history för debugging
- **Stack traces** i development men inte i production
- **Error context** - spara state när error uppstod för reproduktion
- **User actions leading to error** - breadcrumb trail
- **Timestamp och severity** för alla logs

#### Error Display

- **Toast notifications** för user-facing errors
- **Error modal** för critical errors som kräver user action
- **Inline validation errors** i formulär
- **Console errors** för developer debugging
- **Error boundary** - catch React-style errors i components

---

### XIII. PERFORMANCE BENCHMARKS

#### Load Time Targets

- **Initial page load < 2 sekunder** (på genomsnittlig 4G connection)
- **Time to interactive < 3 sekunder**
- **First contentful paint < 1 sekund**

#### Runtime Performance

- **Rendering train schedule < 500ms** för 100 tåg
- **Search/filter operations < 200ms**
- **Zoom/pan operations 60 FPS** - smooth animations (16.67ms per frame)
- **User interaction response < 100ms** - perceived instant feedback

#### Resource Usage

- **Memory usage** - monitor för memory leaks, max 100MB för app
- **Bundle size** - keep JavaScript < 500KB total (gzipped)
- **CSS size** - keep stylesheets < 100KB (gzipped)
- **Image optimization** - lazy load, compressed, WebP format

#### Monitoring

- **Performance.now()** för measuring critical operations
- **Chrome DevTools Performance tab** - analyze rendering bottlenecks
- **Lighthouse scores** - aim for 90+ on Performance
- **Real User Monitoring** - track actual user performance (optional)

---

### XIV. BROWSER & DEVICE COMPATIBILITY

#### Primary Support

- **Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile browsers**: iOS Safari 14+, Chrome Mobile 90+
- **Operating Systems**: Windows 10+, macOS 11+, iOS 14+, Android 10+

#### Screen Resolutions

- **Minimum desktop**: 1280×720
- **Optimal desktop**: 1920×1080
- **Minimum mobile**: 375×667 (iPhone SE)
- **Tablets**: 768×1024 (iPad)

#### Testing Requirements

- **Test devices**: iPhone 12, Samsung Galaxy S21, iPad Pro
- **Browser testing** på alla primary browsers
- **Responsive testing** vid olika breakpoints
- **Graceful degradation** för äldre browsers - visa varning men försök fungera
- **No browser-specific hacks** - använd feature detection, inte browser detection

#### Compatibility Techniques

- **Polyfills** för nya JavaScript features i äldre browsers
- **Autoprefixer** för CSS vendor prefixes
- **Progressive enhancement** - basic functionality fungerar överallt
- **Feature detection** med Modernizr eller native APIs

---

### XV. INTERNATIONALIZATION (I18N) READINESS

- **All text i separate language file** (`lang/sv.js`) - även om bara svenska nu
- **Date/time formatting** använd Intl API - locale-aware
- **Number formatting** - svenska format (komma för decimaler, mellanslag för tusentals)
- **Prepare for translation** - inga hårdkodade strings i kod
- **RTL support consideration** - även om inte behövs nu, designa för framtiden
- **Currency formatting** om relevant - använd Intl.NumberFormat
- **Plural rules** - språk har olika plural regler
- **String interpolation** - använd template strings för dynamiskt innehåll

---

### XVI. EXPORT & PRINT FUNCTIONALITY

- **Export schedule som PDF** - professional layout med headers/footers
- **Export som Excel/CSV** - för analys i externa verktyg
- **Export notes som PDF** - för skift-handover dokumentation
- **Print-friendly CSS** - @media print styles, hide UI chrome
- **Print preview** innan printing - visa hur det kommer se ut
- **Export images** - screenshot av schedule som PNG/JPEG
- **Export configuration** - välj vad som ska inkluderas i export
- **Filename conventions** - auto-generate filenames med datum

---

### XVII. BACKUP & RESTORE

#### Automatic Backup

- **Auto-backup to localStorage** - varje 5 minuter
- **Multiple backup slots** - spara senaste 5 backups
- **Backup includes**: trains, settings, warnings, notes, history, profiles
- **Timestamp each backup** - ISO 8601 format
- **Backup size monitoring** - varna om localStorage är nästan full

#### Manual Backup

- **Manual backup button** - download all data som JSON
- **Backup naming** - Spårplannen_Backup_YYYY-MM-DD_HHMM.json
- **Backup metadata** - version, timestamp, user info
- **Compressed backups** - optional gzip compression

#### Restore Functionality

- **Restore from backup** - upload JSON file
- **Validation before restore** - check backup integrity och version
- **Preview before restore** - show what will be restored
- **Merge or replace** option - keep current data eller ersätt helt
- **Restore specific parts** - only settings, only trains, etc.

#### Cloud Backup (Future)

- **Cloud sync settings** (optional, future) - sync till server
- **Conflict resolution** - vid simultana ändringar
- **Version history** - spara historik av backups

#### Disaster Recovery

- **Corrupted data detection** - validate data on load
- **Fallback to last known good** - auto-restore från backup vid corruption
- **Factory reset** - återställ till defaults med confirmation

---

### XVIII. ANALYTICS & MONITORING (Optional men rekommenderat)

#### Usage Analytics (Privacy-first)

- **Feature usage tracking** - vilka features används mest? (anonymt)
- **Performance monitoring** - track rendering times, load times
- **Error tracking** - hur ofta uppstår errors? vilka typer?
- **User behavior** - navigation patterns, time spent

#### Privacy Compliance

- **All tracking GDPR-compliant** - opt-in, inte opt-out
- **Anonymous data only** - no personal information
- **Clear privacy policy** - förklara vad som trackas
- **Easy opt-out** - respektera Do Not Track headers
- **Data deletion** - användare kan radera sin analytics data

#### Analytics Dashboard (Optional)

- **Usage statistics** - visa controller sin egen användning
- **Performance insights** - visa om appen är långsam
- **Improvement suggestions** - baserat på usage patterns

---

### XIX. THEME & CUSTOMIZATION

#### Built-in Themes

- **Light mode** (default) - ljust, professionellt
- **Dark mode** - ögonvänligt för nattskift
- **High contrast mode** - för accessibility och synnedsättning
- **Auto theme switching** - baserat på system preferences eller tid på dygnet

#### Color Blind Modes

- **Deuteranopia mode** - grön-röd färgblindhet (vanligast)
- **Protanopia mode** - röd färgblindhet
- **Tritanopia mode** - blå-gul färgblindhet
- **Use patterns/icons** - inte bara färg för att kommunicera status

#### Customization Options

- **Custom color themes** - användare kan skapa egna färgscheman
- **Theme editor** - visual editor för att skapa themes
- **Import/export themes** - dela themes mellan användare
- **Preview themes** - before applying
- **Theme marketplace** (future) - dela themes med community

#### Typography Customization

- **Font size adjustment** - Small (14px), Medium (16px), Large (18px), Extra Large (20px)
- **Font family choice** - System default, Dyslexie (dyslexivänlig), Mono
- **Line height adjustment** - för lättare läsning

#### Density Modes

- **Compact** - mer information på skärmen, mindre spacing
- **Normal** - balanced (default)
- **Comfortable** - generous spacing, större elements

#### Advanced Customization

- **Custom CSS injection** - för power users (risk disclaimer)
- **UI element visibility** - hide/show specific UI components
- **Layout customization** - rearrange panels, toolbars

---

### XX. OFFLINE CAPABILITY

#### Service Worker (Future Enhancement)

- **Service Worker** för offline caching
- **Cache-first strategy** för static assets
- **Network-first strategy** för API data
- **Background sync** - queue operations när offline

#### Offline Detection

- **Online/offline detection** - navigator.onLine + ping check
- **Status indicator** - visa banner när offline
- **Graceful degradation** - disable features som kräver network

#### Offline Functionality

- **Last known state** tillgänglig offline - cached data
- **Queue actions** när offline - sync när online igen
- **Local-first architecture** - fungerar utan server
- **IndexedDB storage** - för större datasets offline

#### Sync Strategy

- **Auto-sync** när connection återställs
- **Conflict resolution** - vid samtidiga ändringar offline/online
- **Manual sync trigger** - user-initiated sync
- **Sync status indicators** - visa syncing progress

#### Offline Features

- **View cached schedule** - last loaded data
- **Create/edit trains** - stored lokalt, synced senare
- **Notes creation** - offline mode
- **Settings changes** - always available offline

---

### XXI. DEVELOPER EXPERIENCE (DX)

- **Code comments i svenska** - matcha användargränssnittet
- **README.md** med installation och development instructions
- **CONTRIBUTING.md** om fler ska bidra
- **Development vs Production modes** - olika config för environments
- **Hot reload** för development (om build system finns)
- **Linting rules** - ESLint med svenska kommentarer OK
- **Code formatting** - Prettier eller liknande för consistency
- **Component documentation** - JSDoc comments för functions/classes
- **Development tools** - helpful console commands för debugging

---

### XXII. NOTIFICATIONS & ALERTS SYSTEM

#### Toast Notifications

- **Toast notifications** - för success, error, info, warning messages
- **Position customizable** - top-right (default), top-left, bottom-right, bottom-left, top-center
- **Duration customizable** - auto-dismiss (3s, 5s, 10s) eller sticky (manual dismiss)
- **Multiple toasts** - stack notifications, max 5 samtidigt
- **Dismiss actions** - X button, click anywhere, swipe (mobile)

#### Alert Types

- **Success** - green, checkmark icon, positive feedback
- **Error** - red, X icon, problem occurred
- **Warning** - orange, exclamation icon, caution needed
- **Info** - blue, info icon, informational message

#### Sound Alerts

- **Sound notifications** för kritiska warnings (toggleable)
- **Different sounds** för olika alert types
- **Volume control** - i settings
- **Mute all sounds** - global sound toggle
- **Respect system sound settings**

#### Browser Notifications

- **Native browser notifications** - om permission finns
- **Request permission** - user-friendly prompt
- **Critical events only** - don't spam
- **Notification grouping** - group similar notifications
- **Action buttons** - quick actions från notification

#### Notification Management

- **Notification history** - se tidigare notifications (last 50)
- **Clear all** - rensa notification history
- **Filter by type** - visa bara errors, warnings, etc.
- **Search notifications** - full-text search i history
- **Mark as read** - för viktiga notifications

#### Do Not Disturb Mode

- **DND mode** - pause alla notifications temporärt
- **Schedule DND** - auto-enable certain times
- **Allow critical** - critical alerts kommer igenom även i DND
- **Visual indicator** - visa när DND är aktivt

#### Notification Settings

- **Per-type settings** - enable/disable olika notification types
- **Sound per type** - olika ljud för olika types
- **Duration per type** - hur länge notifications visas
- **Priority system** - high priority stays longer

---

### XXIII. CONTEXT & HELP SYSTEM

#### Inline Help

- **Tooltips** - hover/focus för att se förklaring
- **Placement smart** - auto-adjust tooltip position
- **Keyboard accessible** - tooltips via keyboard navigation
- **Rich tooltips** - support för formatting, images
- **Delay before show** - 500ms hover delay

#### Help Modal

- **Comprehensive help guide** - searchable, categorized
- **Table of contents** - easy navigation
- **Search functionality** - full-text search i help content
- **Screenshots/GIFs** - visual demonstrations
- **Updated regularly** - keep help current with features

#### Keyboard Shortcuts Guide

- **? key för att visa** - global shortcut help
- **Categorized shortcuts** - grouped by functionality
- **Search shortcuts** - find specific shortcut
- **Printable version** - export as PDF
- **Custom shortcuts** - show user's custom bindings

#### Onboarding Tour

- **First-time user tour** - guided walkthrough
- **Step-by-step highlights** - spotlight important features
- **Skip/restart option** - user control
- **Progress indicator** - show tour progress
- **Never show again** - checkbox option
- **Reactivate tour** - i help menu

#### Contextual Help

- **Context-aware help** - different help för different screens
- **"Learn more" links** - inline links till relevant help sections
- **Video tutorials** (future) - embedded eller externa länkar
- **Interactive demos** - try feature in safe environment

#### FAQ Section

- **Common questions** - frequently asked questions
- **Search FAQ** - quick find answers
- **Community contributed** - allow users to suggest FAQs
- **Problem/solution format** - clear structure

#### Error Help

- **Error-specific help** - when error occurs, link to relevant help
- **Troubleshooting guides** - step-by-step problem solving
- **Common solutions** - for frequent issues
- **Contact support** - if help doesn't solve it (om relevant)

#### Help Feedback

- **Was this helpful?** - thumbs up/down på help articles
- **Suggest improvements** - users can suggest edits
- **Report outdated** - flag help that's no longer accurate

---

**⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**

---

## FASE 1: Visuell Redesign & Foundation (Prioritet 1)

**🔔 REMINDER: Följ alla Design & Development Principles ovan genom hela denna fas.**

**📁 CRITICAL: Alla filer för denna fas skapas i `/Users/mikailyenigun/Desktop/Spårplannen/sparplanen2v/`**

### Subfas 1.1: Design System & CSS Foundation

**Mål**: Skapa ett modernt, professionellt designsystem baserat på Material Design-principer

**📁 FOLDER**: Alla CSS-filer för denna subfas → `sparplanen2v/styles/`

**🔔 REMINDER CHECKLIST för denna subfas:**
- ✅ Alla filer skapas i `sparplanen2v/styles/`
- ✅ index.html uppdateras med nya CSS-länkar i KORREKT ordning
- ✅ Användaren kan öppna `sparplanen2v/index.html` och se resultatet
- ✅ Console är ren (zero errors/warnings)
- ✅ Alla Design & Development Principles följs
- ✅ Commit efter subfas är klar

**Åtgärder**: 

- Skapa nytt `styles/design-system.css` med moderna CSS-variabler för färger, typografi, spacing, shadows
- Implementera glassmorfism-effekter och moderna skuggor för djup
- Uppdatera `styles/variables.css` med professionellt färgschema (primär, sekundär, accent, success, warning, danger, info)
- Skapa `styles/typography.css` med moderna fontskalor och hierarki
- Definiera konsistenta border-radius, transitions, och animations

**Filer att ändra**: `styles/variables.css`, `styles/themes.css`, `styles/base.css`

**Nya filer**: `styles/design-system.css`, `styles/typography.css`

### Subfas 1.2: Header & Navigation Redesign

**Mål**: Modernisera header med bättre layout, visuell hierarki och tillgänglighet

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Redesigna `.app-header` med modern gradient, shadows och spacing
- Skapa nya button-styles med hover-effekter, ripple-animations
- Förbättra tidskontroller med större, tydligare knappar
- Lägg till visuella indikatorer för aktiv status
- Uppdatera delay-connection-status med modern badge-design

**Filer att ändra**: `styles/header.css`, `styles/buttons.css`, `index.html`

### Subfas 1.3: Schedule View Redesign

**Mål**: Skapa en vacker, professionell schemavy med bättre visuell separation

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Redesigna `.track-labels` med modern card-design, hover-effekter
- Uppdatera `.timeline-header` med subtila gradients och bättre typografi
- Förbättra `.train-bar` visuellt: modernare färger, shadows, hover-states
- Lägg till smooth transitions för alla interaktioner
- Förbättra conflict/warning visualisering med moderna ikoner och färger

**Filer att ändra**: `styles/layout.css`, `styles/trains.css`, `styles/timeline.css`, `renderer.js`

### Subfas 1.4: Modal & Form Redesign

**Mål**: Modernisera alla modaler och formulär för bättre UX

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Redesigna `.modal-overlay` med modern backdrop blur
- Uppdatera `.modal-content` med card-design, shadows, animations
- Förbättra form-inputs med moderna styles (outlined, filled)
- Lägg till input validation visuellt (success/error states)
- Skapa nya dropdown-styles och select-komponenter

**Filer att ändra**: `styles/modals.css`, `modalManager.js`, `index.html`

### Subfas 1.5: Responsive Layout Foundation

**Mål**: Säkerställa att alla nya visuella element fungerar responsivt

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Uppdatera `styles/responsive.css` för nya designelement
- Implementera flexbox/grid för bättre layout på alla skärmstorlekar
- Testa och justera breakpoints för tablets och mobiler
- Säkerställa att färger, spacing fungerar på alla devices

**Filer att ändra**: `styles/responsive.css`, `styles/layout.css`

---

## FASE 2: Enhanced Responsiveness & View Controls

### Subfas 2.1: Advanced Zoom Controls

**Mål**: Implementera fullständig zoom-kontroll för X och Y axlar

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Skapa zoom-kontroller i UI (zoom in/out knappar, zoom-slider)
- Uppdatera `calculateDynamicSizing()` i `app.js` för dynamisk zoom
- Implementera zoom-state i AppState
- Lägg till zoom-shortcuts (Ctrl +/-, pinch-to-zoom)
- Spara zoom-preferenser i localStorage

**Filer att ändra**: `app.js`, `renderer.js`, `events/keyboardShortcuts.js`

**Nya filer**: `ui/ZoomControls.js`

### Subfas 2.2: "Now Mode" med Auto-scroll

**Mål**: Implementera live-läge där röd linje är centrerad och schemat scrollar

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Skapa "Nu"-knapp i header som aktiverar now-mode
- Implementera auto-scroll logik i `renderer.js`
- Uppdatera `updateCurrentTimeLine()` för centered positioning i now-mode
- Skapa smooth scroll-animation när tiden uppdateras
- Lägg till toggle för att pausa/återuppta now-mode

**Filer att ändra**: `app.js`, `renderer.js`, `index.html`

### Subfas 2.3: Compact View Toggle

**Mål**: Skapa kompakt vy för mindre skärmar med färre detaljer

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Skapa toggle-knapp för compact view
- Implementera compact CSS-klasser med mindre text, mindre spacing
- Dölj mindre viktig information i compact mode (längd, detaljerad info)
- Behåll kritisk information synlig (tågnummer, tid, konflikter)
- Automatisk aktivering på små skärmar med manual override

**Filer att ändra**: `styles/responsive.css`, `app.js`, `index.html`

**Nya filer**: `styles/compact-view.css`

### Subfas 2.4: Touch & Mobile Optimization

**Mål**: Optimera för touch-enheter

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Implementera touch event handlers för drag, resize, zoom
- Förstora touch-targets (minst 44x44px)
- Lägg till touch-feedback (ripple effects)
- Optimera context menu för touch (long-press)
- Testa och förbättra mobile performance

**Filer att ändra**: `events/mouseEvents.js`

**Nya filer**: `events/touchEvents.js`

---

## FASE 3: Advanced Warning System

### Subfas 3.1: Warning Engine Architecture

**Mål**: Skapa flexibel warning-engine för customizable regler

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Skapa `warningEngine.js` med pluggable rule system
- Definiera warning rule interface/struktur
- Implementera rule evaluation engine
- Skapa warning priority system (critical, high, medium, low)
- Implementera warning persistence i localStorage

**Nya filer**: `warningEngine.js`, `warningRules.js`

### Subfas 3.2: Built-in Warning Rules

**Mål**: Implementera specifika warning-regler för Göteborg C

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- **Rule 1**: Departure before arrival deadlock (tåg A avgår innan tåg B som ska anlända)
- **Rule 2**: Platform length exceeded (total tåglängd > spårlängd)
- **Rule 3**: Unidirectional flow violation (norr till norr logik)
- **Rule 4**: Temporal overlap conflicts
- **Rule 5**: Train type vs platform type mismatch
- Implementera varje regel som separat modul i `warningRules.js`

**Filer att ändra**: `warningRules.js`, `renderer.js`

### Subfas 3.3: Custom Warning Builder UI

**Mål**: UI för att skapa, redigera och ta bort egna warning-regler

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Skapa "Warning Manager" modal med lista över alla regler
- Implementera "Add Rule" formulär med dropdown för regel-typ
- Skapa regel-editor med parameters (tid, längd, spår-typ etc)
- Lägg till enable/disable toggle för varje regel
- Implementera delete med confirmation

**Nya filer**: `ui/WarningManager.js`, `styles/warning-manager.css`

### Subfas 3.4: Warning Silence System

**Mål**: Flexibelt system för att tysta warnings

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Implementera silence-state i warning engine
- Skapa UI för silence options:
  - Tysta specifik warning permanent
  - Tysta alla warnings för X minuter/timmar
  - Tysta per warning-typ (längd, konflikt, etc)
- Lägg till "Snooze" knapp på varje warning
- Visa silenced warnings i separat lista
- Auto-unsilence när problemet är löst

**Filer att ändra**: `warningEngine.js`

**Nya filer**: `ui/WarningSilencer.js`

### Subfas 3.5: Warning Display & Notifications

**Mål**: Professionell visualisering av warnings

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Skapa warning panel/sidebar med alla aktiva warnings
- Implementera warning badges på train-bars med ikoner
- Lägg till sound notifications (toggleable) för critical warnings
- Skapa warning severity colors (orange, red, purple)
- Implementera blinking/pulsing för kritiska warnings
- Lägg till warning history log

**Filer att ändra**: `styles/notifications.css`, `renderer.js`

**Nya filer**: `ui/WarningPanel.js`

---

## FASE 4: Conflict Resolution System

### Subfas 4.1: Conflict Detection Engine

**Mål**: Intelligent konflikt-detection som förstår Göteborg C logik

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Skapa `conflictResolver.js` med detection algoritmer
- Implementera graph-based track analysis för flow
- Detektera temporal conflicts med consideration för vändtid
- Analysera capacity conflicts (längd + antal tåg)
- Beräkna conflict severity score

**Nya filer**: `conflictResolver.js`

### Subfas 4.2: Solution Generator

**Mål**: AI-liknande system som genererar konfliktlösningar

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Implementera algoritm för att generera lösningsförslag:
  - Byt spår för tåg
  - Justera ankomst/avgångstid (minimal förändring först)
  - Flytta till alternativt subtrack
  - Split/merge tjänster
- Rankera lösningar baserat på:
  - Minsta förändring från original
  - Fewest warnings violated
  - Passenger impact (om data finns)
- Respektera warning rules vid lösningsförslag

**Filer att ändra**: `conflictResolver.js`

### Subfas 4.3: Suggestion UI & Navigation

**Mål**: Snygg UI för att visa och navigera mellan lösningsförslag

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Skapa "Conflict Resolution" panel (toggleable)
- Visa aktuell konflikt highlightad på schemat
- Lista lösningsförslag med:
  - Visual preview
  - Impact score
  - Ändringar som krävs
- Implementera "Next Solution" / "Previous Solution" navigation
- Preview solution på schemat med transparency
- Lägg till "Apply Solution" knapp

**Nya filer**: `ui/ConflictResolutionPanel.js`, `styles/conflict-resolution.css`

### Subfas 4.4: Apply Solution Mechanism

**Mål**: Säkert applicera lösningsförslag med undo

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Implementera solution application med validation
- Integrera med history engine för undo
- Animera train-bar changes när solution appliceras
- Visa confirmation med changes summary
- Auto re-check för nya konflikter efter apply

**Filer att ändra**: `conflictResolver.js`, `historyEngine.js`, `events/trainActions.js`

---

## FASE 5: Notes & Communication System

### Subfas 5.1: Data Structure & Storage

**Mål**: Robust data-struktur för notes

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Definiera note schema:
  ```js
  {
    id, type (track/train/shift), 
    attachedTo (trackId/trainId/null),
    content, author, timestamp,
    priority (normal/high/critical),
    resolved (bool), tags[]
  }
  ```

- Skapa `notesEngine.js` för CRUD operations
- Implementera persistence i localStorage + optional server sync
- Lägg till note search/filter funktionalitet

**Nya filer**: `notesEngine.js`

### Subfas 5.2: Track Notes UI

**Mål**: Anteckningar kopplade till specifika spår

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Lägg till notes-ikon på track labels
- Skapa popover/modal för att visa track notes
- Implementera "Add Note" formulär för spår
- Visa note count badge på tracks med notes
- Färgkoda tracks med high-priority notes (subtle highlight)

**Nya filer**: `ui/TrackNotes.js`, `styles/notes.css`

### Subfas 5.3: Train Notes UI

**Mål**: Anteckningar kopplade till specifika tåg

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Lägg till notes-ikon på train context menu
- Visa note indicator på train-bars (small badge)
- Implementera train note modal med tjänstspecifik info
- Koppla notes till både arrival och departure tågnummer
- Auto-visa notes när tåg är valt/editerat

**Nya filer**: `ui/TrainNotes.js`

### Subfas 5.4: Shift Communication Panel

**Mål**: Global kommunikation mellan skift

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Skapa "Shift Log" panel (toggleable sidebar)
- Implementera timeline-vy av shift notes
- Lägg till "Handover Notes" special category
- Implementera markdown support för formaterad text
- Lägg till attachments (images, files) support
- Skapa "Important" pinning för kritiska meddelanden

**Nya filer**: `ui/ShiftLogPanel.js`, `styles/shift-log.css`

### Subfas 5.5: Search & Filter

**Mål**: Kraftfull sökning över alla notes

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Skapa global note search
- Implementera filters:
  - By type (track/train/shift)
  - By priority
  - By date range
  - By author
  - By resolved status
- Highlight search results på schemat
- Export notes to PDF/CSV

**Filer att ändra**: `notesEngine.js`

**Nya filer**: `ui/NoteSearch.js`

---

## FASE 6: Settings & Customization

### Subfas 6.1: Settings Panel Architecture

**Mål**: Omfattande settings-system för fullständig kontroll

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Skapa `settingsEngine.js` för settings management
- Definiera settings schema med categories:
  - View Settings
  - Warning Settings
  - Notification Settings
  - API Settings
  - Display Settings
  - Behavior Settings
- Implementera settings persistence med versioning
- Skapa settings modal med tab-navigation

**Nya filer**: `settingsEngine.js`, `ui/SettingsPanel.js`, `styles/settings.css`

### Subfas 6.2: View Preferences

**Mål**: Anpassa alla visuella aspekter

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Default zoom level (X och Y)
- Default time window (1h, 3h, 6h etc)
- Show/hide elements (track length, vehicle info, time indicators)
- Color scheme preferences
- Compact view auto-activation threshold
- Grid density settings

**Filer att ändra**: `settingsEngine.js`, `ui/SettingsPanel.js`

### Subfas 6.3: Warning Preferences

**Mål**: Fullständig kontroll över warning-systemet

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Enable/disable warnings globally
- Configure warning thresholds (proximity minutes, length percentage)
- Set default silence durations
- Configure notification sounds
- Warning severity customization

**Filer att ändra**: `settingsEngine.js`, `warningEngine.js`

### Subfas 6.4: Profile & Presets

**Mål**: Spara olika profiler för olika situationer

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Skapa "Profiles" system (Morning Shift, Evening Shift, Weekend etc)
- Implementera quick profile switching
- Auto-activate profile based på tid på dygnet
- Import/export profiles
- Share profiles mellan användare

**Filer att ändra**: `settingsEngine.js`

**Nya filer**: `ui/ProfileManager.js`

### Subfas 6.5: Import/Export Settings

**Mål**: Backup och delning av settings

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Export alla settings till JSON
- Import settings från fil
- Reset till defaults med confirmation
- Cloud sync settings (optional, future)

**Filer att ändra**: `settingsEngine.js`, `ui/SettingsPanel.js`

---

## FASE 7: API Integration & Automation

### Subfas 7.1: Settings-based API Control

**Mål**: Flytta API-kontroller till settings

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Skapa API Settings tab i settings panel
- Flytta start/stop kontroller från header till settings
- Lägg till API URL konfiguration
- Implementera update interval settings
- Visa detailed connection status i settings

**Filer att ändra**: `settingsEngine.js`, `TrainData/train_delay_integration.js`

### Subfas 7.2: Auto-start Configuration

**Mål**: Automatisk start av API vid sidladdning

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Lägg till "Auto-start API on load" checkbox i settings
- Implementera auto-start logic i `train_delay_integration.js`
- Lägg till retry logic vid failed connection
- Visa loading indicator under initial connection
- Notification när auto-start lyckas/misslyckas

**Filer att ändra**: `TrainData/train_delay_integration.js`, `settingsEngine.js`

### Subfas 7.3: Connection Status & Monitoring

**Mål**: Professionell statusövervakning

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Förbättra connection status badge i header
- Lägg till detaljerad status i settings (last update, train count, errors)
- Implementera connection health monitoring
- Warning när connection är lost
- Auto-reconnect med exponential backoff

**Filer att ändra**: `TrainData/train_delay_integration.js`, `styles/header.css`

### Subfas 7.4: Error Handling & Retry

**Mål**: Robust error handling

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Implementera comprehensive error catching
- Visa user-friendly error messages
- Lägg till manual retry button
- Log errors för debugging
- Fallback till cached data vid API failure

**Filer att ändra**: `TrainData/train_delay_integration.js`

---

## FASE 8: Additional Professional Tools

### Subfas 8.1: Quick Actions Toolbar

**Mål**: Snabb tillgång till vanliga operationer

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Skapa floating action button (FAB) eller quick toolbar
- Lägg till quick actions:
  - Add train
  - Jump to now
  - Find conflicts
  - Open notes
  - Export schedule
- Customizable quick actions i settings

**Nya filer**: `ui/QuickActions.js`, `styles/quick-actions.css`

### Subfas 8.2: Keyboard Shortcuts System

**Mål**: Fullständigt keyboard navigation

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Skapa comprehensive shortcut system:
  - Ctrl+N: New train
  - Ctrl+F: Find/search
  - Ctrl+Z/Y: Undo/redo
  - Space: Toggle now mode
  - Arrow keys: Navigate trains
  - +/-: Zoom
  - Etc.
- Skapa keyboard shortcut cheat sheet modal (?)
- Customizable shortcuts i settings

**Filer att ändra**: `events/keyboardShortcuts.js`

**Nya filer**: `ui/ShortcutHelper.js`

### Subfas 8.3: Undo/Redo Enhancement

**Mål**: Förbättra undo/redo med preview

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Visa undo/redo stack i UI
- Preview av vad undo/redo kommer göra
- Selective undo (undo specifik action mitt i history)
- Clear history option
- Undo/redo for bulk operations

**Filer att ändra**: `historyEngine.js`, `events/historyOperations.js`

### Subfas 8.4: Accessibility Features

**Mål**: WCAG 2.1 AA compliance

**Åtgärder** - **⚠️ PÅMINNELSE: Dessa principer är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler.**
:

- Implementera proper ARIA labels på alla element
- Keyboard navigation för alla features
- Screen reader support
- High contrast mode
- Focus indicators
- Color blind friendly color schemes

**Filer att ändra**: Alla UI-filer, CSS-filer

---

## IMPLEMENTERINGSSTRATEGI

**Fas 1** kommer göras först (visuell redesign) enligt prioritet.

För varje subfas:

1. Du säger "Start subfas X.Y"
2. Jag skapar detaljerade todos för den subfasen
3. Jag implementerar alla todos
4. Du godkänner och vi går vidare till nästa

**Estimerad tidsåtgång**: Detta är ett stort projekt som kan ta flera dagar/veckor beroende på komplexitet och testning.

**Testning**: Efter varje subfas testar vi i browsern för att säkerställa kvalitet.

**Backup**: Vi committar till git efter varje completad subfas.