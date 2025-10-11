
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

#### REGEL: Chrome DevTools MCP - AI-Assisted Testing & Debugging

**KRITISKT: AI MÅSTE använda Chrome DevTools MCP för att verifiera all kod**

**⚠️ VIKTIGT: Använd Chrome, INTE Safari!**
- **macOS default browser är Safari** - men MCP fungerar ENDAST med Chrome
- **AI måste explicit använda MCP Chrome DevTools tools** för testing
- **File protocol path:** `file:///Users/mikailyenigun/Desktop/Spårplannen/sparplanen2v/index.html`

---

### MCP Capabilities - Vad AI Kan Göra

Chrome DevTools MCP ger AI superkrafter att faktiskt SE och TESTA koden:

#### 1. **Öppna & Navigera Sidor**
```javascript
// AI kan öppna index.html i Chrome automatiskt
mcp_chrome-devtools_new_page(url: "file:///Users/.../sparplanen2v/index.html")
mcp_chrome-devtools_navigate_page(url: "http://localhost:8080")
```

#### 2. **Ta Snapshots (DOM Inspection)**
```javascript
// Få hela DOM-strukturen som accessibility tree med unique IDs
mcp_chrome-devtools_take_snapshot()
// Visar alla element med uid (t.ex. uid=1_14 för theme toggle button)
// Perfect för att hitta element att interagera med
```

#### 3. **Ta Screenshots**
```javascript
// Se hur sidan FAKTISKT ser ut visuellt
mcp_chrome-devtools_take_screenshot(format: "png")
// Kan ta fullPage screenshots eller specific elements
// Jämför före/efter ändringar visuellt
```

#### 4. **Läs Console Logs & Errors**
```javascript
// Se ALLA console.log(), errors, warnings
mcp_chrome-devtools_list_console_messages()
// Example output:
// ✅ Settings controls initialized
// 🎨 Theme initialized: light
// 📅 Schedule initialized with 11 trains on 12 tracks
```

#### 5. **Inspektera Network Requests**
```javascript
// Lista ALLA nätverks-requests (CSS, JS, images)
mcp_chrome-devtools_list_network_requests()
// Se vilka filer som laddades (200 success eller 404 error)
// Diagnostisera varför resources inte laddar
```

#### 6. **Interagera med Sidan**
```javascript
// Klicka på buttons, links, elements
mcp_chrome-devtools_click(uid: "1_14")  // Klicka theme toggle

// Fyll i formulär
mcp_chrome-devtools_fill(uid: "2_5", value: "Test input")

// Hover över element
mcp_chrome-devtools_hover(uid: "3_10")

// Simulera komplett user flows
```

#### 7. **Evaluera JavaScript Live**
```javascript
// Kör JavaScript direkt på sidan
mcp_chrome-devtools_evaluate_script(function: `() => {
  return {
    currentTheme: document.documentElement.getAttribute('data-theme'),
    totalTrains: document.querySelectorAll('[class*="train"]').length,
    viewportWidth: window.innerWidth
  };
}`)
// Returns live data från sidan!
```

#### 8. **Performance Testing**
```javascript
// Starta performance trace
mcp_chrome-devtools_performance_start_trace(reload: true, autoStop: true)

// Stoppa och analysera
mcp_chrome-devtools_performance_stop_trace()

// Få Core Web Vitals (LCP, FID, CLS) och performance insights
```

---

### Mandatory MCP Testing Workflow

**AI MÅSTE FÖLJA DENNA PROCESS efter varje kod-ändring:**

#### ✅ STEG 1: Öppna i Chrome
```
mcp_chrome-devtools_new_page("file:///.../sparplanen2v/index.html")
```

#### ✅ STEG 2: Verifiera Inga Errors
```
mcp_chrome-devtools_list_console_messages()
// Ska INTE visa errors, endast success logs
```

#### ✅ STEG 3: Kontrollera Network Loads
```
mcp_chrome-devtools_list_network_requests()
// Alla CSS/JS files ska vara 200 (success), INTE 404
```

#### ✅ STEG 4: Ta Screenshot
```
mcp_chrome-devtools_take_screenshot()
// Verifiera att design ser korrekt ut visuellt
```

#### ✅ STEG 5: Testa Interaktioner
```
mcp_chrome-devtools_take_snapshot()  // Få element UIDs
mcp_chrome-devtools_click(uid: "...")  // Testa buttons
// Verifiera att klicks fungerar som förväntat
```

#### ✅ STEG 6: Inspect State (om relevant)
```
mcp_chrome-devtools_evaluate_script(...)
// Kontrollera att JavaScript state är korrekt
```

---

### Praktiska MCP Exempel

#### Exempel 1: Verifiera Theme Toggle
```
1. mcp_chrome-devtools_new_page(index.html)
2. mcp_chrome-devtools_take_screenshot()  // Se light mode
3. mcp_chrome-devtools_take_snapshot()    // Hitta theme button uid
4. mcp_chrome-devtools_click(uid: "1_14") // Klicka theme toggle
5. mcp_chrome-devtools_list_console_messages()  // Se "Theme changed to: dark"
6. mcp_chrome-devtools_take_screenshot()  // Verifiera dark mode visuellt
```

#### Exempel 2: Debug Varför CSS Inte Laddar
```
1. mcp_chrome-devtools_new_page(index.html)
2. mcp_chrome-devtools_list_network_requests()
   // Se om CSS file är 404 (file not found)
3. mcp_chrome-devtools_take_screenshot()
   // Se visuellt om styles saknas
4. mcp_chrome-devtools_list_console_messages()
   // Kolla efter "Failed to load resource" errors
```

#### Exempel 3: Testa Settings Modal
```
1. mcp_chrome-devtools_new_page(index.html)
2. mcp_chrome-devtools_take_snapshot()
3. mcp_chrome-devtools_click(uid: "1_15")  // Öppna settings
4. mcp_chrome-devtools_take_screenshot()   // Se att modal öppnade
5. mcp_chrome-devtools_take_snapshot()     // Se modal content struktur
6. mcp_chrome-devtools_evaluate_script(`() => {
     return document.querySelector('.settings-modal').style.display;
   }`)  // Verifiera modal är synlig
```

---

### När AI MÅSTE Använda MCP

**OBLIGATORISKT att testa med MCP i dessa situationer:**

1. ✅ **Efter VARJE ny CSS file skapats** - verifiera den laddas och applys korrekt
2. ✅ **Efter VARJE ny JS file skapats** - verifiera no errors i console
3. ✅ **Efter layout/design ändringar** - ta screenshot, verifiera visuellt
4. ✅ **Efter ny interactive feature** - testa med clicks/fills
5. ✅ **Efter bug fix** - verifiera att bug är fixad
6. ✅ **Vid responsive design** - resize viewport och verifiera
7. ✅ **Vid theme changes** - verifiera light/dark modes ser rätt ut
8. ✅ **Vid performance optimizations** - kör performance trace

---

### MCP vs Manual Testing

| Scenario | AI med MCP | Utan MCP |
|----------|------------|----------|
| Verifiera CSS laddar | ✅ Ser network requests, tar screenshot | ❌ Gissar, kan missa fel |
| Testa button clicks | ✅ Klickar faktiskt, ser resultat | ❌ Kan bara anta det fungerar |
| Debug console errors | ✅ Läser faktiska errors | ❌ Kan inte se errors |
| Kontrollera theme toggle | ✅ Klickar, tar screenshot före/efter | ❌ Kan inte verifiera |
| Verifiera responsiveness | ✅ Ändrar viewport, tar screenshots | ❌ Kan bara skriva kod och hoppas |

---

### MCP Best Practices för AI

1. **Ta ALLTID screenshot efter ändringar** - visualisera results
2. **Läs ALLTID console efter page load** - catch errors tidigt
3. **Verifiera network requests** - alla resources ska vara 200 OK
4. **Testa user flows** - klicka, fyll i, navigera som en riktig användare
5. **Använd evaluate_script för state inspection** - se faktisk JavaScript state
6. **Jämför före/efter screenshots** - visuell regression testing
7. **Testa i OLIKA viewport sizes** - resize page, verifiera responsive

---

### Felsökning med MCP

| Problem | MCP Solution |
|---------|--------------|
| "Vit sida" | `list_network_requests()` - kolla om CSS/JS laddar |
| "Button gör inget" | `list_console_messages()` - se JavaScript errors |
| "Fel färger" | `take_screenshot()` + `evaluate_script()` - inspektera theme |
| "Layout trasig" | `take_snapshot()` - se DOM struktur, hitta CSS issues |
| "Långsam" | `performance_start_trace()` - se bottlenecks |

---

**Referens:** [Chrome DevTools MCP Documentation](https://developer.chrome.com/blog/chrome-devtools-mcp)

**⚠️ ABSOLUT KRITISKT:**
- AI ska ALLTID använda MCP för verification
- ALDRIG anta att kod fungerar utan att testa i Chrome
- MCP är INTE optional - det är MANDATORY för quality assurance

#### REGEL: Dynamic Responsiveness - ALLTID Adaptera till Browser Layout

**KRITISKT: Varje feature MÅSTE fungera i ALLA browser-storlekar och layouts**

**Browser Layout Scenarios att ALLTID testa:**
- ✅ Fullscreen (1920×1080, 2560×1440)
- ✅ Half screen vertical split (960×1080)
- ✅ Half screen horizontal split (1920×540)
- ✅ Quarter screen (960×540)
- ✅ Mobile portrait (375×667, 414×896)
- ✅ Mobile landscape (667×375, 896×414)
- ✅ Tablet (768×1024, 1024×768)
- ✅ Resizing in real-time (smooth adaptation)

**Implementation Requirements:**

1. **Flexible Layouts**
   - Använd `flexbox` och `CSS Grid` - ALDRIG fasta bredder
   - Containers ska använda `min-width`, `max-width`, `width: 100%`
   - Height ska anpassas till `viewport height` (`vh`) när relevant
   - ALDRIG hårdkodat `width: 800px` - använd `width: min(800px, 100%)`

2. **Content Adaptation**
   - Information ska prioriteras - viktigast först
   - Vid mindre utrymme: dölj mindre viktig info, visa tooltips
   - Horizontal scroll TILLÅTET för timeline (men visa scroll hint)
   - Vertical scroll för långa listor (tracks)

3. **Real-time Resize Handling**
   - Lyssna på `window.resize` event med debounce (150ms)
   - Recalculate layout vid resize
   - Smooth transitions vid layout-changes (200ms)
   - Testa genom att dra browser-fönstret medans appen körs

4. **Breakpoints Strategy**
   - Mobile: < 640px
   - Tablet: 640px - 1024px
   - Desktop Small: 1024px - 1440px
   - Desktop Large: > 1440px
   - Men ÄVEN testa mellanliggande storlekar!

5. **Testing Protocol**
   - VARJE gång CSS/layout ändras: testa i alla scenarios
   - Använd Chrome DevTools responsive mode
   - Testa genom att resize browser window manuellt
   - Verifiera att inget bryts vid ANY window size

**Exempel på KORREKT responsiv CSS:**
```css
.schedule-container {
  width: 100%;
  max-width: 2000px;
  height: min(600px, calc(100vh - var(--header-height) - 64px));
  overflow-x: auto;
  overflow-y: auto;
}

.track-label {
  min-width: 120px;
  max-width: 200px;
  width: clamp(120px, 15vw, 200px);
}
```

**Exempel på FEL (hårda värden):**
```css
.schedule-container {
  width: 1200px;  /* ❌ Bryts vid smaller screens */
  height: 600px;  /* ❌ Inte responsive till viewport */
}
```

**⚠️ ABSOLUT VIKTIGT:**
- Testa VARJE feature genom att resize browser till olika storlekar
- Om något ser konstigt ut vid half-screen → fixa OMEDELBART
- User ska kunna ha browser i ANY size och appen ska fungera perfekt

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

**🔔 REMINDER: Följ alla Design & Development Principles i filen Rules.md genom hela denna fas.**

**📁 CRITICAL: Alla filer för denna fas skapas i `/Users/mikailyenigun/Desktop/Spårplannen/sparplanen2v/`**
