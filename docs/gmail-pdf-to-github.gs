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

var DAY_TOKEN_RE = /(Måndag|tisdag|Tisdag|Onsdag|onsdag|Torsdag|torsdag|Fredag|fredag|Lördag|lördag|Söndag|söndag)\.pdf/i;

/**
 * "Spårplaner ... v.18 ... Måndag.pdf" or "3tim.pdf Måndag.pdf" → 18
 */
function weekNumberFromName_(name) {
  var m = (name || "").match(/v\.?\s*(\d+)/i);
  if (!m) {
    return null;
  }
  return parseInt(m[1], 10);
}

/**
 * Tries to find a Swedish day name; returns a key in DAY_KEY_MAP or null.
 * Skips the "master" file that has no "Day.pdf" at the end.
 */
function dayKeyFromFileName_(name) {
  var m = (name || "").match(DAY_TOKEN_RE);
  if (!m) {
    return null;
  }
  var token = m[1].toLowerCase();
  return DAY_KEY_MAP[token] || null;
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
  return r.getResponseCode() === 200 || r.getResponseCode() === 201;
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

function processInbox() {
  var c = getProps_();
  if (!c.label || !c.token || !c.owner || !c.repo) {
    throw new Error("Set GMAIL_LABEL, GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO");
  }
  var userLabel = GmailApp.getUserLabelByName(c.label);
  if (!userLabel) {
    throw new Error("Gmail label not found: " + c.label);
  }
  var threads = userLabel.getThreads(0, 20);
  for (var ti = 0; ti < threads.length; ti++) {
    var thread = threads[ti];
    if (!thread.isUnread()) {
      continue;
    }
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
      var atts = message.getAttachments();
      for (var ai = 0; ai < atts.length; ai++) {
        var att = atts[ai];
        if (!isPdf_(att)) {
          continue;
        }
        var name = att.getName() || "plan.pdf";
        var dayKey = dayKeyFromFileName_(name);
        if (!dayKey) {
          // All-days bundle or unknown — skip
          continue;
        }
        var wn = weekNumberFromName_(name);
        if (wn == null) {
          continue;
        }
        var wpad = wn < 10 ? "0" + wn : String(wn);
        var folder = year + "-W" + wpad;
        var path = "TrainData/incoming/" + folder + "/" + dayKey + ".pdf";
        var bytes = att.copyBlob().getBytes();
        var b64 = Utilities.base64Encode(bytes);
        var msg = "chore: plan PDF " + folder + " " + dayKey + " (" + name + ")";
        if (!putGitHubFile_(c.owner, c.repo, c.token, path, b64, msg, c.branch)) {
          throw new Error("PUT failed for " + path);
        }
        uploaded++;
      }
    }
    if (uploaded > 0) {
      dispatchWorkflow_(c.owner, c.repo, c.token, c.workflow, c.branch);
      thread.markRead();
      return;
    }
  }
}

function main() {
  processInbox();
}
