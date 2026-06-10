/**
 * Önskemål — lightweight feedback / feature-request widget.
 *
 * A header button opens a small modal where any user can submit a bug report,
 * feature request or improvement idea. Submissions are written straight to
 * Cloud Firestore (collection "onskemal") with no sign-in. You read them in the
 * Firebase console → Firestore → onskemal.
 *
 * Self-contained: initialises the Firebase compat SDK (loaded via <script> tags
 * in index.html) on first use, builds its own modal DOM, and wires the button.
 * If Firebase fails to load the button still works but reports the error.
 */
(function () {
    'use strict';

    // Public Firebase web config for project "sparplan-9d5ce". The apiKey is a
    // public client identifier (not a secret); access is gated by Firestore
    // security rules, not by hiding this.
    const FIREBASE_CONFIG = {
        apiKey: 'AIzaSyDbWikoOFYE6oQ66Na5aSzvLNSS6-Rl-Ks',
        authDomain: 'sparplan-9d5ce.firebaseapp.com',
        projectId: 'sparplan-9d5ce',
        storageBucket: 'sparplan-9d5ce.firebasestorage.app',
        messagingSenderId: '131785382039',
        appId: '1:131785382039:web:04fe543c251f64b84231d2',
        measurementId: 'G-CSDCJHEJNB'
    };

    let db = null;
    let backdrop = null;
    let submitting = false;

    function getDb() {
        if (db) return db;
        if (typeof firebase === 'undefined' || !firebase.firestore) return null;
        try {
            if (!firebase.apps || !firebase.apps.length) {
                firebase.initializeApp(FIREBASE_CONFIG);
            }
            db = firebase.firestore();
            return db;
        } catch (e) {
            console.error('[önskemål] Firebase init failed', e);
            return null;
        }
    }

    function notify(message, type) {
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type || 'info');
        } else if (type === 'error') {
            alert(message);
        }
    }

    function buildModal() {
        backdrop = document.createElement('div');
        backdrop.className = 'onskemal-backdrop hidden';
        backdrop.setAttribute('role', 'dialog');
        backdrop.setAttribute('aria-modal', 'true');
        backdrop.setAttribute('aria-labelledby', 'onskemal-title');

        backdrop.innerHTML = `
            <div class="onskemal-modal">
                <div class="onskemal-header">
                    <h2 class="onskemal-title" id="onskemal-title">Önskemål</h2>
                    <button type="button" class="onskemal-close" aria-label="Stäng">&times;</button>
                </div>
                <div class="onskemal-body">
                    <textarea class="onskemal-textarea" id="onskemal-message" rows="5"
                        maxlength="2000" placeholder="Skriv ditt önskemål"></textarea>
                    <input type="text" class="onskemal-input" id="onskemal-contact"
                        maxlength="200" placeholder="Namn (valfritt)" autocomplete="off" />
                </div>
                <div class="onskemal-footer">
                    <button type="button" class="onskemal-btn onskemal-btn--ghost" data-action="cancel">Avbryt</button>
                    <button type="button" class="onskemal-btn onskemal-btn--primary" data-action="send">Skicka</button>
                </div>
            </div>
        `;

        document.body.appendChild(backdrop);

        backdrop.querySelector('.onskemal-close').addEventListener('click', close);
        backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
        backdrop.querySelector('[data-action="send"]').addEventListener('click', submit);
        // Backdrop click (outside the modal) closes.
        backdrop.addEventListener('mousedown', (e) => {
            if (e.target === backdrop) close();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !backdrop.classList.contains('hidden')) close();
        });

        return backdrop;
    }

    function open() {
        if (!backdrop) buildModal();
        backdrop.classList.remove('hidden');
        const msg = backdrop.querySelector('#onskemal-message');
        if (msg) setTimeout(() => msg.focus(), 30);
    }

    function close() {
        if (!backdrop || submitting) return;
        backdrop.classList.add('hidden');
    }

    function setSubmitting(state) {
        submitting = state;
        const btn = backdrop.querySelector('[data-action="send"]');
        if (btn) {
            btn.disabled = state;
            btn.textContent = state ? 'Skickar…' : 'Skicka';
        }
    }

    async function submit() {
        if (submitting) return;
        const msgEl = backdrop.querySelector('#onskemal-message');
        const contactEl = backdrop.querySelector('#onskemal-contact');

        const message = (msgEl.value || '').trim();
        if (!message) {
            notify('Skriv ett önskemål först.', 'error');
            msgEl.focus();
            return;
        }

        const database = getDb();
        if (!database) {
            notify('Kunde inte ansluta till databasen. Försök igen senare.', 'error');
            return;
        }

        const doc = {
            message: message,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            page: String(location.href).slice(0, 300),
            userAgent: String(navigator.userAgent || '').slice(0, 500)
        };
        const contact = (contactEl.value || '').trim();
        if (contact) doc.contact = contact.slice(0, 200);

        setSubmitting(true);
        try {
            await database.collection('onskemal').add(doc);
            setSubmitting(false);
            // Reset and close.
            msgEl.value = '';
            contactEl.value = '';
            backdrop.classList.add('hidden');
            notify('Tack! Ditt önskemål är skickat.', 'success');
        } catch (e) {
            console.error('[önskemål] submit failed', e);
            setSubmitting(false);
            notify('Något gick fel. Ditt önskemål kunde inte skickas.', 'error');
        }
    }

    function wireButton() {
        const btn = document.getElementById('onskemal-btn');
        if (btn) btn.addEventListener('click', open);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wireButton);
    } else {
        wireButton();
    }

    window.Onskemal = { open: open, close: close };
})();
