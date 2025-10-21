# Fullständig Omdesign av SpårplanV2

---

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

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
:

- Redesigna `.app-header` med modern gradient, shadows och spacing
- Skapa nya button-styles med hover-effekter, ripple-animations
- Förbättra tidskontroller med större, tydligare knappar
- Lägg till visuella indikatorer för aktiv status
- Uppdatera delay-connection-status med modern badge-design

**Filer att ändra**: `styles/header.css`, `styles/buttons.css`, `index.html`

### Subfas 1.3: Schedule View Redesign

**Mål**: Skapa en vacker, professionell schemavy med bättre visuell separation

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
:

- Redesigna `.track-labels` med modern card-design, hover-effekter
- Uppdatera `.timeline-header` med subtila gradients och bättre typografi
- Förbättra `.train-bar` visuellt: modernare färger, shadows, hover-states
- Lägg till smooth transitions för alla interaktioner
- Förbättra conflict/warning visualisering med moderna ikoner och färger

**Filer att ändra**: `styles/layout.css`, `styles/trains.css`, `styles/timeline.css`, `renderer.js`

### Subfas 1.4: Modal & Form Redesign

**Mål**: Modernisera alla modaler och formulär för bättre UX

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
:

- Redesigna `.modal-overlay` med modern backdrop blur
- Uppdatera `.modal-content` med card-design, shadows, animations
- Förbättra form-inputs med moderna styles (outlined, filled)
- Lägg till input validation visuellt (success/error states)
- Skapa nya dropdown-styles och select-komponenter

**Filer att ändra**: `styles/modals.css`, `modalManager.js`, `index.html`

### Subfas 1.5: Responsive Layout Foundation

**Mål**: Säkerställa att alla nya visuella element fungerar responsivt

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
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

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
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

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
:

- Skapa "Nu"-knapp i header som aktiverar now-mode
- Implementera auto-scroll logik i `renderer.js`
- Uppdatera `updateCurrentTimeLine()` för centered positioning i now-mode
- Skapa smooth scroll-animation när tiden uppdateras
- Lägg till toggle för att pausa/återuppta now-mode

**Filer att ändra**: `app.js`, `renderer.js`, `index.html`

### Subfas 2.3: Compact View Toggle

**Mål**: Skapa kompakt vy för mindre skärmar med färre detaljer

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
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

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
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

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
:

- Skapa `warningEngine.js` med pluggable rule system
- Definiera warning rule interface/struktur
- Implementera rule evaluation engine
- Skapa warning priority system (critical, high, medium, low)
- Implementera warning persistence i localStorage

**Nya filer**: `warningEngine.js`, `warningRules.js`

### Subfas 3.2: Built-in Warning Rules

**Mål**: Implementera specifika warning-regler för Göteborg C

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
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

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
:

- Skapa "Warning Manager" modal med lista över alla regler
- Implementera "Add Rule" formulär med dropdown för regel-typ
- Skapa regel-editor med parameters (tid, längd, spår-typ etc)
- Lägg till enable/disable toggle för varje regel
- Implementera delete med confirmation

**Nya filer**: `ui/WarningManager.js`, `styles/warning-manager.css`

### Subfas 3.4: Warning Silence System

**Mål**: Flexibelt system för att tysta warnings

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
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

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
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

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
:

- Skapa `conflictResolver.js` med detection algoritmer
- Implementera graph-based track analysis för flow
- Detektera temporal conflicts med consideration för vändtid
- Analysera capacity conflicts (längd + antal tåg)
- Beräkna conflict severity score

**Nya filer**: `conflictResolver.js`

### Subfas 4.2: Solution Generator

**Mål**: AI-liknande system som genererar konfliktlösningar

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
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

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
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

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
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

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
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

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
:

- Lägg till notes-ikon på track labels
- Skapa popover/modal för att visa track notes
- Implementera "Add Note" formulär för spår
- Visa note count badge på tracks med notes
- Färgkoda tracks med high-priority notes (subtle highlight)

**Nya filer**: `ui/TrackNotes.js`, `styles/notes.css`

### Subfas 5.3: Train Notes UI

**Mål**: Anteckningar kopplade till specifika tåg

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
:

- Lägg till notes-ikon på train context menu
- Visa note indicator på train-bars (small badge)
- Implementera train note modal med tjänstspecifik info
- Koppla notes till både arrival och departure tågnummer
- Auto-visa notes när tåg är valt/editerat

**Nya filer**: `ui/TrainNotes.js`

### Subfas 5.4: Shift Communication Panel

**Mål**: Global kommunikation mellan skift

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
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

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
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

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
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

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
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

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
:

- Enable/disable warnings globally
- Configure warning thresholds (proximity minutes, length percentage)
- Set default silence durations
- Configure notification sounds
- Warning severity customization

**Filer att ändra**: `settingsEngine.js`, `warningEngine.js`

### Subfas 6.4: Profile & Presets

**Mål**: Spara olika profiler för olika situationer

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
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

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
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

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
:

- Skapa API Settings tab i settings panel
- Flytta start/stop kontroller från header till settings
- Lägg till API URL konfiguration
- Implementera update interval settings
- Visa detailed connection status i settings

**Filer att ändra**: `settingsEngine.js`, `TrainData/train_delay_integration.js`

### Subfas 7.2: Auto-start Configuration

**Mål**: Automatisk start av API vid sidladdning

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
:

- Lägg till "Auto-start API on load" checkbox i settings
- Implementera auto-start logic i `train_delay_integration.js`
- Lägg till retry logic vid failed connection
- Visa loading indicator under initial connection
- Notification när auto-start lyckas/misslyckas

**Filer att ändra**: `TrainData/train_delay_integration.js`, `settingsEngine.js`

### Subfas 7.3: Connection Status & Monitoring

**Mål**: Professionell statusövervakning

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
:

- Förbättra connection status badge i header
- Lägg till detaljerad status i settings (last update, train count, errors)
- Implementera connection health monitoring
- Warning när connection är lost
- Auto-reconnect med exponential backoff

**Filer att ändra**: `TrainData/train_delay_integration.js`, `styles/header.css`

### Subfas 7.4: Error Handling & Retry

**Mål**: Robust error handling

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
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

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
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

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
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

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
:

- Visa undo/redo stack i UI
- Preview av vad undo/redo kommer göra
- Selective undo (undo specifik action mitt i history)
- Clear history option
- Undo/redo for bulk operations

**Filer att ändra**: `historyEngine.js`, `events/historyOperations.js`

### Subfas 8.4: Accessibility Features

**Mål**: WCAG 2.1 AA compliance

**Åtgärder** - **⚠️ PÅMINNELSE: Principer i Rules.md är MANDATORY för VARJE fas och subfas. Vid tveksamhet, referera tillbaka till dessa regler. i Rules.md**
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