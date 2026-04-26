# Spårplannen: automation from the beginning (Gmail + GitHub + Pages)

This is the full path from nothing to a working **weekly multi-PDF** flow. It assumes you already did the steps marked **(done)** — skip those and pick up at the next section.

## What the project expects now (important)

- PDFs for **one week** are stored **per day** (not one `latest.pdf` for everything):

  `TrainData/incoming/<YEAR>-W<WW>/mandag.pdf` … `sondag.pdf`

- Filenames in mail look like:  
  `… v.18 3tim … Måndag.pdf` — we read **v.18** = ISO week 18, and the **Swedish weekday** in the name.

- The **all-days-in-one** PDF (large file, no `Måndag` / `Tisdag` / … before `.pdf`) is **ignored**; only **per-day** files are uploaded.

- If you re-send a single day, the same path is **updated** (GitHub overwrites the file — same as “replace for that date”).

- The web app uses **Europe/Stockholm** and picks **trains + closures** for **today** when possible; otherwise the latest week that has that weekday’s data. Data is in `trains.js` as `SPARPLANEN_WEEKS` (see [emit_week_bundle.py](../TrainData/emit_week_bundle.py)).

---

## A. GitHub (you have likely done this)

1. **Repository** for Spårplannen on GitHub, default branch `main` (or note your real branch name).

2. **Personal access token (classic)** with scopes:
   - **repo** (commit PDFs and generated JS)
   - **workflow** (trigger the Actions workflow after uploads)

3. **Actions** enabled for the repository (Settings → Actions → allow workflows).

4. **Push** this project (including `.github/workflows/ingest-pdf.yml` and the `TrainData/` tools) to `main` so the workflow file exists on GitHub.

5. **GitHub Pages** source set to the branch and folder you use (usually `main` + root).

> Keep the token only in **Google Apps Script → Project settings → Script properties**, never in the repo.

**Script property names:** `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`  
**Optional:** `GITHUB_BRANCH` (if not `main`), `GITHUB_WORKFLOW` (if you rename the file; default `ingest-pdf.yml`)

---

## B. Gmail (you have likely done this)

1. **Create a label** in Gmail, e.g. `spårplan-inkommande`.

2. **Filter** so weekly mail (from work, has attachments, subject contains `Spårplan` or similar) **gets that label**.

3. The Apps Script will only process **unread** threads with this label, then mark them read.

4. In **Script properties**, the **key** is exactly `GMAIL_LABEL` and the **value** is the **same string** as the Gmail label name (including nested labels, e.g. `Parent/Spårplan` if you use that).

---

## C. Google Apps Script project (code + properties)

1. Open [script.google.com](https://script.google.com) → your project (or create one).

2. **Time zone (recommended):** Project settings → set time zone to **Europe/Stockholm** (helps year/week).

3. **Script properties** (Project settings → Script properties) — at minimum:
   - `GMAIL_LABEL`
   - `GITHUB_TOKEN`
   - `GITHUB_OWNER`
   - `GITHUB_REPO`
   - (optional) `GITHUB_BRANCH`, `GITHUB_WORKFLOW`

4. **Code:** paste the contents of [gmail-pdf-to-github.gs](gmail-pdf-to-github.gs) into a script file and **Save**.

5. **First authorization:** choose **Run** on `processInbox` (or `main`) and allow Gmail + external URL to `api.github.com`.

6. **Trigger (clock):** time-driven, e.g. every **15 minutes**, function **`processInbox`**.

7. **How one run works:**  
   For the first **unread** labeled thread, it checks each PDF. For each per-day file it:
   - derives **year** from the **message date** in Stockholm
   - derives **week** from `v.<number>` in the **filename**
   - derives **day** from the Swedish name before `.pdf`
   - `PUT` to `TrainData/incoming/<YEAR>-W<WW>/<day>.pdf`
   - after **at least one** successful upload, calls **`workflow_dispatch`** once for `ingest-pdf.yml`, then **marks the thread read**
   - If there is nothing to upload (only the “all week” master PDFs), the thread is **not** marked read (fix filter or add a per-day file).

8. **Token must include** **`workflow`**, or dispatch fails with 403/404.

---

## D. What GitHub Actions does (automatic)

- Workflow file: [ingest-pdf.yml](../.github/workflows/ingest-pdf.yml)

- **Manual:** Actions → “Ingest plan PDF” → Run workflow.  
- **From Apps Script:** the script calls `workflow_dispatch` after your uploads (recommended so **one** run processes **all** files you just added).

- The job runs `python3 TrainData/ingest_incoming.py`, which:
  - runs `extract_monday.py` for each per-day PDF under `TrainData/incoming/...`
  - runs `emit_week_bundle.py` to build `trains.js` and `closures.js` with the week map

- Then it commits and pushes `trains.js` and `closures.js` to `main` (if something changed). Pages will rebuild.

---

## E. After you add or change a single day (update mail)

- Put the new PDF in the same week folder in Gmail (or forward a thread that only has that PDF).
- The script uploads to the **same** path (`.../torsdag.pdf` etc.); GitHub **replaces** the file (new SHA in API).
- One dispatch ingests the whole `incoming` tree and regenerates the bundle so **“now”** uses the new extraction for that day when it matches the calendar.

---

## F. Local test (optional)

With one PDF in the correct layout, e.g.:

`TrainData/incoming/2025-W20/torsdag.pdf`

```bash
python3 -m pip install -r TrainData/requirements.txt
python3 TrainData/ingest_incoming.py
```

Check `trains.js` for `SPARPLANEN_WEEKS` and `SPARPLANEN_ANCHORS`, then open the app in a browser.

---

## G. Troubleshooting

| Symptom | What to check |
|--------|----------------|
| 403/401 on GitHub | Token scopes, owner/repo, branch |
| 404 on dispatch | Workflow file name = `ingest-pdf.yml` in **default** branch; token has **workflow** |
| Nothing uploads | Per-day name must end with a weekday before `.pdf`; `v.18` must appear in the filename for week number |
| Workflow runs but no JS change | Path must be `TrainData/incoming/YYYY-Www/mandag.pdf` etc., not a flat `latest.pdf` |
| Wrong day in the app | Browser uses Stockholm date + [schedule-timezone-helpers.js](../js/schedule-timezone-helpers.js) |

---

## H. If you do not use Google Apps Script

You can still **copy PDFs** into `TrainData/incoming/YYYY-Www/` locally, commit, and run **Ingest plan PDF** from the Actions tab. The `workflow_dispatch` + multi-upload flow is the mail automation piece.
