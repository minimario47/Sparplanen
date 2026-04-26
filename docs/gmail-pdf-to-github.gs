/**
 * Spårplannen — weekly multi-PDF upload to GitHub + single workflow run
 * ------------------------------------------------------------------------
 * 1) For every PDF in an UNREAD message with your label (per-day files only)
 *    PUT to: TrainData/incoming/<YEAR>-W<WW>/<day>.pdf
 * 2) Skips the "all week in one" PDF (no weekday in the filename)
 * 3) When done (one message = one batch), POST workflow_dispatch to run ingest on GitHub
 *
 * Script properties: GMAIL_LABEL, GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO
 * Optional: GITHUB_BRANCH (default main), GITHUB_WORKFLOW (default ingest-pdf.yml)
 *
 * Token: classic PAT with "repo" + "workflow" (for dispatch)
 */

var GH_API = "https://api.github.com";

/** Map normalized Swedish + ASCII spellings to folder/file keys (lö/ö → lo/so) */
var DAY_KEY_MAP = {
  "mandag": "mandag",
  "måndag": "mandag",
  "tisdag": "tisdag",
  "onsdag": "onsdag",
  "torsdag": "torsdag",
  "fredag": "fredag",
  "lordag": "lordag",
  "lördag": "lordag",
  "sondag": "sondag",
  "söndag": "sondag",
};

/**
 * Spårplannen week, e.g. "v.17" in subject or "…, v.17 3tim …" in filename.
 * Must NOT treat "VERSION 2" as v + 2 (week). Require literal "v." or "v" + dot before digits.
 */
function weekNumberFromName_(name, subject) {
  // Require "v.17" style — avoids treating "VERSION 2" as week 2
  var pool = (name || "") + " " + (subject || "");
  var m = pool.match(/\bv\.\s*(\d{1,2})\b/i);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Filenames can look like: "... VERSION 2.pdf Fredag.pdf" — the *tail* is always "Dayname.pdf".
 * The all-days file ends with "VERSION 2.pdf" (no day word before the last .pdf).
 */
function dayKeyFromFileName_(name) {
  var n = (name || "").replace(/\s+$/, "");
  if (!/\.pdf$/i.test(n)) {
    return null;
  }
  var m = n.match(/([a-zA-Z\u00C0-\u024F]+)\.pdf$/i);
  if (!m) {
    return null;
  }
  var raw = m[1].toLowerCase();
  var u = raw.replace(/\u00f6/g, "o").replace(/\u00e4/g, "a").replace(/\u00e5/g, "a");
  if (u === "mandag" || raw === "måndag") {
    return "mandag";
  }
  if (u === "lordag" || raw === "l\u00f6rdag") {
    return "lordag";
  }
  if (u === "sondag" || raw === "s\u00f6ndag") {
    return "sondag";
  }
  if (u === "tisdag") {
    return "tisdag";
  }
  if (u === "onsdag") {
    return "onsdag";
  }
  if (u === "torsdag") {
    return "torsdag";
  }
  if (u === "fredag") {
    return "fredag";
  }
  return null;
}

function isPdf_(att) {
  var n = (att.getName() || "").toLowerCase();
  if ((att.getContentType() || "").toLowerCase().indexOf("pdf") >= 0) {
    return true;
  }
  return n.length >= 4 && n.substring(n.length - 4) === ".pdf";
}

function getProps_() {
  var p = PropertiesService.getScriptProperties();
  return {
    token: p.getProperty("GITHUB_TOKEN"),
    owner: p.getProperty("GITHUB_OWNER"),
    repo: p.getProperty("GITHUB_REPO"),
    label: p.getProperty("GMAIL_LABEL"),
    branch: p.getProperty("GITHUB_BRANCH") || "main",
    workflow: p.getProperty("GITHUB_WORKFLOW") || "ingest-pdf.yml",
  };
}

function getFileSha_(owner, repo, token, filePath) {
  var pathEnc = filePath.split("/").map(encodeURIComponent).join("/");
  var url = GH_API + "/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/contents/" + pathEnc;
  var r = UrlFetchApp.fetch(url, {
    method: "get",
    headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" },
    muteHttpExceptions: true,
  });
  if (r.getResponseCode() === 404) {
    return null;
  }
  if (r.getResponseCode() !== 200) {
    throw new Error("GET " + filePath + " " + r.getResponseCode() + " " + r.getContentText().slice(0, 300));
  }
  return JSON.parse(r.getContentText()).sha;
}

function putGitHubFile_(owner, repo, token, filePath, contentBase64, message, branch) {
  var sha = getFileSha_(owner, repo, token, filePath);
  var body = { message: message, content: contentBase64, branch: branch };
  if (sha) {
    body.sha = sha;
  }
  var pathEnc = filePath.split("/").map(encodeURIComponent).join("/");
  var url = GH_API + "/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/contents/" + pathEnc;
  var r = UrlFetchApp.fetch(url, {
    method: "put",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });
  var code = r.getResponseCode();
  if (code === 200 || code === 201) {
    return true;
  }
  Logger.log("GitHub PUT failed: " + code + " for " + filePath);
  Logger.log(r.getContentText().slice(0, 800));
  return false;
}

function dispatchWorkflow_(owner, repo, token, workflow, branch) {
  var pathEnc = workflow.split("/").map(encodeURIComponent).join("/");
  var url =
    GH_API +
    "/repos/" +
    encodeURIComponent(owner) +
    "/" +
    encodeURIComponent(repo) +
    "/actions/workflows/" +
    pathEnc +
    "/dispatches";
  var r = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
    },
    payload: JSON.stringify({ ref: branch }),
    muteHttpExceptions: true,
  });
  if (r.getResponseCode() !== 204) {
    throw new Error("workflow_dispatch " + r.getResponseCode() + " " + r.getContentText().slice(0, 500));
  }
}

/**
 * Year for folder name (Y-Www) in Europe/Stockholm
 */
function yearForMessage_(message) {
  return parseInt(Utilities.formatDate(message.getDate(), "Europe/Stockholm", "yyyy"), 10);
}

/**
 * Set dryRun: true to only log what would be uploaded (no GitHub, no mark read).
 * Open Executions (or View → Logs) to read SPAR: lines.
 */
function processInbox(dryRun) {
  var c = getProps_();
  if (!c.label || !c.token || !c.owner || !c.repo) {
    throw new Error("Set GMAIL_LABEL, GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO");
  }
  if (dryRun) {
    Logger.log("SPAR: DRY RUN — no GitHub calls");
  } else {
    Logger.log("SPAR: starting owner=" + c.owner + " repo=" + c.repo + " branch=" + c.branch);
  }
  var userLabel = GmailApp.getUserLabelByName(c.label);
  if (!userLabel) {
    throw new Error("Gmail label not found. Exact spelling? Got: " + c.label);
  }
  // Only threads that are *unread* in Gmail (same as a search for is:unread on that label)
  var q = 'label:"' + c.label.replace(/"/g, "") + '" is:unread';
  var threads;
  try {
    threads = GmailApp.search(q, 0, 20);
  } catch (e) {
    Logger.log("SPAR: search failed: " + e);
    threads = [];
  }
  if (threads.length === 0) {
    var totalLabeled = 0;
    try {
      totalLabeled = userLabel.getThreads(0, 100).length;
    } catch (e2) {
      Logger.log("SPAR: could not list labeled threads: " + e2);
    }
    Logger.log(
      "SPAR: 0 *unread* threads with this label. Labeled (any state) in sample: " +
        totalLabeled +
        " — if >0, your mail is READ. In Gmail: open the thread → ⋮ → 'Mark as unread' (or select thread + m). " +
        "The script will not re-upload from read mail."
    );
    return;
  }
  Logger.log("SPAR: unread threads to process=" + threads.length);
  for (var ti = 0; ti < threads.length; ti++) {
    var thread = threads[ti];
    var year = 0;
    var uploaded = 0;
    var messages = thread.getMessages();
    for (var mi = 0; mi < messages.length; mi++) {
      var message = messages[mi];
      if (!message.isUnread()) {
        continue;
      }
      if (year === 0) {
        year = yearForMessage_(message);
      }
      var subj = message.getSubject() || "";
      Logger.log("SPAR: unread msg y=" + year + " subj=" + subj);
      var atts = message.getAttachments();
      for (var ai = 0; ai < atts.length; ai++) {
        var att = atts[ai];
        if (!isPdf_(att)) {
          continue;
        }
        var name = att.getName() || "plan.pdf";
        var dayKey = dayKeyFromFileName_(name);
        var wn = weekNumberFromName_(name, subj);
        if (!dayKey) {
          Logger.log('SPAR: skip (no day in tail .pdf) name="' + name + '"');
          continue;
        }
        if (wn == null) {
          Logger.log('SPAR: skip (no v.## week) name="' + name + '" subj=' + subj);
          continue;
        }
        var wpad = wn < 10 ? "0" + wn : String(wn);
        var folder = year + "-W" + wpad;
        var path = "TrainData/incoming/" + folder + "/" + dayKey + ".pdf";
        if (dryRun) {
          Logger.log("SPAR: [dry] would put " + path + " from " + name);
          uploaded++;
          continue;
        }
        Logger.log("SPAR: uploading " + path);
        var bytes = att.copyBlob().getBytes();
        var b64 = Utilities.base64Encode(bytes);
        var msg = "chore: plan PDF " + folder + " " + dayKey + " (" + name + ")";
        if (!putGitHubFile_(c.owner, c.repo, c.token, path, b64, msg, c.branch)) {
          throw new Error("PUT failed for " + path + " — see logs for GitHub body");
        }
        Logger.log("SPAR: ok " + path);
        uploaded++;
      }
    }
    if (uploaded > 0) {
      if (!dryRun) {
        dispatchWorkflow_(c.owner, c.repo, c.token, c.workflow, c.branch);
        Logger.log("SPAR: workflow dispatch OK");
        thread.markRead();
      } else {
        Logger.log("SPAR: dry run — not dispatching, not markRead");
      }
      return;
    }
  }
  Logger.log("SPAR: nothing uploaded. Is the mail UNREAD? Does a per-day PDF end in Fredag.pdf / Måndag.pdf? Is v.17 in subject or filename?");
}

/** Logs parsing only; run this if GitHub is silent. */
function dryRunInbox() {
  processInbox(true);
}

function main() {
  processInbox(false);
}
