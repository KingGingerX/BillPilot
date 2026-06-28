import {
  PLATFORM_OPTIONS,
  RELEASE_STAGES,
  ROUTENOTE_GENRES,
  STORAGE_KEY,
  buildRolloutQueue,
  createEmptyState,
  createSong,
  createIntegrationPayload,
  exportCampaignCalendar,
  exportCatalogCalendar,
  exportState,
  exportReleaseChecklist,
  generateCampaign,
  generateReleasePack,
  getRouteNotePackage,
  getRouteNoteReadiness,
  getSelectedSong,
  inferSongsFromFiles,
  importState,
  normalizeState,
  scoreSong,
  sortSongs,
  summarizeDashboard,
  summarizeCatalog
} from "./symphoniq-core.js";

let statusMessage = null;
let state = await loadState();

const app = document.querySelector("#app");

function getTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function setTheme(theme) {
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  localStorage.setItem("symphoniq.theme", theme);
}

render();

async function loadState() {
  let apiState = null;
  try {
    const res = await fetch("/api/state");
    if (res.ok) {
      apiState = normalizeState(await res.json());
    }
  } catch {}

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const localState = saved ? normalizeState(JSON.parse(saved)) : createEmptyState();

    if (apiState && apiState.songs.length > 0) {
      return apiState;
    }

    if (localState.songs.length > 0) {
      syncStateToServer(localState);
      return localState;
    }

    return apiState || createEmptyState();
  } catch {
    statusMessage = {
      tone: "error",
      text: "Saved catalog could not be read. Export backups are the recovery path for this browser profile."
    };
    return apiState || createEmptyState();
  }
}

async function saveState(next) {
  state = normalizeState({
    ...next,
    updatedAt: new Date().toISOString()
  });

  let serverOk = false;
  try {
    const res = await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state)
    });
    serverOk = res.ok;
  } catch {}

  if (!serverOk) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      statusMessage = {
        tone: "warning",
        text: "Saved to browser storage. Server persistence unavailable."
      };
      return true;
    } catch {
      statusMessage = {
        tone: "error",
        text: "Catalog changed in memory, but browser storage refused the save. Download a backup before closing this tab."
      };
      return false;
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
  return true;
}

function syncStateToServer(next) {
  fetch("/api/state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(next)
  }).catch(() => {});
}

function render() {
  const selected = getSelectedSong(state);
  const summary = summarizeCatalog(state.songs);

  app.innerHTML = `
    <header class="topbar">
      <div class="brand">
        <img src="./symphoniq_logo.jpeg" alt="SymphoniQ" class="logo">
        <div>
          <p class="eyebrow">SymphoniQ</p>
          <h1>Music Launch Command Center</h1>
        </div>
      </div>
      <div class="topbar-actions">
        <button data-action="toggle-theme" aria-label="Toggle theme">${getTheme() === "dark" ? "☀️" : "🌙"}</button>
        <button data-action="import-folder">Import Folder</button>
        <button class="primary" data-action="new-song">New Song</button>
      </div>
      <input id="folder-input" type="file" hidden multiple webkitdirectory directory>
    </header>

    <main class="shell">
      <aside class="sidebar">
        ${renderSummary(summary)}
        <nav class="nav" aria-label="Primary">
          ${navButton("dashboard", "Dashboard")}
          ${navButton("songs", "Songs")}
          ${navButton("pack", "Pack")}
          ${navButton("campaign", "Campaign")}
          ${navButton("assets", "Assets")}
          ${navButton("queue", "Queue")}
          ${navButton("review", "Review")}
          ${navButton("integrations", "Integrations")}
          ${navButton("distribute", "Distribute")}
          ${navButton("backup", "Backup")}
        </nav>
      </aside>

      <section class="workspace">
        ${renderStatus()}
        ${renderView(selected)}
      </section>
    </main>
  `;

  bindEvents();
}

function renderStatus() {
  if (!statusMessage) {
    return "";
  }
  return `
    <div class="status ${statusMessage.tone}" role="status">
      ${escapeHtml(statusMessage.text)}
    </div>
  `;
}

function renderSummary(summary) {
  return `
    <section class="summary" aria-label="Catalog summary">
      <div><strong>${summary.total}</strong><span>Songs</span></div>
      <div><strong>${summary.averageReadiness}%</strong><span>Avg ready</span></div>
      <div><strong>${summary.ready}</strong><span>Launch ready</span></div>
      <div><strong>${summary.released}</strong><span>Released</span></div>
    </section>
  `;
}

function navButton(view, label) {
  const active = state.activeView === view ? "active" : "";
  return `<button class="${active}" data-view="${view}">${label}</button>`;
}

function renderView(selected) {
  if (state.activeView === "dashboard") return renderDashboard();
  if (state.activeView === "pack") return renderPack(selected);
  if (state.activeView === "campaign") return renderCampaign(selected);
  if (state.activeView === "assets") return renderAssets(selected);
  if (state.activeView === "queue") return renderQueue();
  if (state.activeView === "review") return renderReview(selected);
  if (state.activeView === "integrations") return renderIntegrations(selected);
  if (state.activeView === "distribute") return renderDistribute(selected);
  if (state.activeView === "backup") return renderBackup();
  return renderSongs(selected);
}

function renderDashboard() {
  const dashboard = summarizeDashboard(state);
  const selected = dashboard.selected;
  return `
    <section class="dashboard">
      <div class="dashboard-hero">
        <div>
          <span class="kicker">Command Center</span>
          <h2>${escapeHtml(selected?.title || "No active song")}</h2>
          <p>${selected ? `${scoreSong(selected).percent}% ready - ${escapeHtml(selected.stage)}` : "Create or import a song to activate the release workflow."}</p>
        </div>
        <div class="hero-actions">
          <button class="primary" data-action="new-song">New Song</button>
          <button data-action="import-folder">Import Folder</button>
          <button data-view="backup">Backup</button>
        </div>
      </div>

      <div class="dashboard-grid">
        <section class="panel metric-panel">
          <h3>Catalog</h3>
          <div class="metric-row">
            <div><strong>${dashboard.summary.total}</strong><span>Songs</span></div>
            <div><strong>${dashboard.summary.averageReadiness}%</strong><span>Average</span></div>
            <div><strong>${dashboard.summary.ready}</strong><span>Ready</span></div>
          </div>
        </section>

        <section class="panel metric-panel">
          <h3>Release Signals</h3>
          <div class="metric-row">
            <div><strong>${formatNumber(dashboard.performance.totals.streams)}</strong><span>Streams</span></div>
            <div><strong>${formatNumber(dashboard.performance.totals.saves)}</strong><span>Saves</span></div>
            <div><strong>${formatNumber(dashboard.performance.reviewed)}</strong><span>Reviewed</span></div>
          </div>
          <button data-view="review">Review Releases</button>
        </section>

        <section class="panel metric-panel">
          <h3>Backup Health</h3>
          <div class="backup-health ${dashboard.backup.status}">
            <strong>${escapeHtml(dashboard.backup.label)}</strong>
            <span>${dashboard.backup.status === "current" ? "Catalog recovery is current." : "Download a fresh backup before heavy editing."}</span>
          </div>
          <button data-view="backup">Open Backup</button>
        </section>

        <section class="panel metric-panel">
          <h3>Selected Song</h3>
          ${selected ? renderSelectedDashboard(selected) : renderInlineEmpty("No song selected.")}
        </section>

        <section class="panel">
          <div class="section-head compact">
            <div>
              <h3>Next Actions</h3>
            </div>
            <button data-view="queue">Queue</button>
          </div>
          ${renderDashboardActions(dashboard.upcoming, "No upcoming actions.")}
        </section>

        <section class="panel">
          <div class="section-head compact">
            <div>
              <h3>Readiness Gaps</h3>
            </div>
            <button data-view="songs">Songs</button>
          </div>
          ${dashboard.blockedSongs.length ? `
            <div class="gap-list">
              ${dashboard.blockedSongs.map(({ song, score }) => `
                <button class="gap-item" data-select-song="${song.id}" data-target-view="songs">
                  <strong>${escapeHtml(song.title || "Untitled song")}</strong>
                  <span>${score.percent}% - ${escapeHtml(score.missing.slice(0, 3).join(", "))}</span>
                </button>
              `).join("")}
            </div>
          ` : renderInlineEmpty("Every saved song is launch-ready.")}
        </section>
      </div>
    </section>
  `;
}

function renderSelectedDashboard(song) {
  const score = scoreSong(song);
  return `
    <div class="selected-dashboard">
      <div class="meter small" style="--value:${score.percent}%"><span>${score.percent}%</span></div>
      <div>
        <strong>${escapeHtml(song.title || "Untitled song")}</strong>
        <span>${score.ready ? "Ready for launch execution." : `${score.missing.length} gaps remain.`}</span>
        <div class="mini-actions">
          <button data-view="pack">Pack</button>
          <button data-view="campaign">Campaign</button>
          <button data-view="integrations">Integrations</button>
        </div>
      </div>
    </div>
  `;
}

function renderDashboardActions(items, emptyMessage) {
  if (!items.length) {
    return renderInlineEmpty(emptyMessage);
  }
  return `
    <div class="action-list">
      ${items.map((item) => `
        <article>
          <time>${escapeHtml(item.date)}</time>
          <div>
            <strong>${escapeHtml(item.song)} - ${escapeHtml(item.channel)}</strong>
            <span>${escapeHtml(item.title)}</span>
          </div>
          <b>${item.daysUntil === 0 ? "Today" : `${item.daysUntil}d`}</b>
        </article>
      `).join("")}
    </div>
  `;
}

function renderInlineEmpty(message) {
  return `<p class="inline-empty">${escapeHtml(message)}</p>`;
}

function renderSongs(selected) {
  if (!state.songs.length) {
    return `
      <div class="empty">
        <h2>Start with the first real song.</h2>
        <p>Add one track, then SymphoniQ turns its metadata into a launch plan, content angles, and operational queue.</p>
        <button class="primary" data-action="new-song">Create Song</button>
      </div>
    `;
  }

  return `
    <div class="split">
      <section class="song-list" aria-label="Song catalog">
        ${sortSongs(state.songs).map(renderSongCard).join("")}
      </section>
      <section class="editor" aria-label="Song editor">
        ${selected ? renderSongEditor(selected) : ""}
      </section>
    </div>
  `;
}

function renderSongCard(song) {
  const score = scoreSong(song);
  const active = song.id === state.selectedSongId ? "selected" : "";
  const rnStatus = song.distribution?.routenote?.status ?? "none";
  const rnBadge = rnStatus !== "none"
    ? `<em class="rn-badge rn-${escapeHtml(rnStatus)}">RN: ${escapeHtml(rnStatus)}</em>`
    : "";
  return `
    <button class="song-card ${active}" data-select-song="${song.id}">
      <span>
        <strong>${escapeHtml(song.title || "Untitled song")}</strong>
        <small>${escapeHtml(song.stage)}${song.releaseDate ? ` - ${escapeHtml(song.releaseDate)}` : ""}</small>
        ${rnBadge}
      </span>
      <b>${score.percent}%</b>
    </button>
  `;
}

function renderSongEditor(song) {
  const score = scoreSong(song);
  const pack = generateReleasePack(song, state.integrations?.label || "");

  return `
    <form class="song-form" data-song-form="${song.id}">
      <div class="form-head">
        <div>
          <h2>${escapeHtml(song.title || "Untitled song")}</h2>
          <p>${score.ready ? "Ready for launch execution." : `Missing ${score.missing.length} launch-critical item${score.missing.length === 1 ? "" : "s"}.`}</p>
        </div>
        <div class="meter" style="--value:${score.percent}%"><span>${score.percent}%</span></div>
      </div>

      <div class="grid two">
        ${input("title", "Song title", song.title, "text")}
        ${input("artist", "Artist", song.artist, "text")}
        ${select("stage", "Stage", song.stage, RELEASE_STAGES)}
        ${input("releaseDate", "Release date", song.releaseDate, "date")}
        ${input("mood", "Mood", song.mood, "text")}
        ${input("audience", "Target listener", song.audience, "text")}
      </div>

      ${textarea("story", "Story behind the song", song.story)}
      ${textarea("links", "Release, review, storage, or private links", song.links)}
      ${textarea("assets", "Visual assets and promo material", song.assets)}
      ${textarea("notes", "Working notes", song.notes)}

      <fieldset class="platforms">
        <legend>Platforms</legend>
        ${PLATFORM_OPTIONS.map((platform) => `
          <label>
            <input type="checkbox" name="platforms" value="${platform}" ${song.platforms.includes(platform) ? "checked" : ""}>
            <span>${platform}</span>
          </label>
        `).join("")}
      </fieldset>

      ${song.sourceFiles.length ? renderSourceFiles(song) : `
        <div class="source-files">
          <div class="source-files-top">
            <h3>Imported Assets</h3>
            <button type="button" class="btn-sm" data-action="add-video" data-song-id="${song.id}">Add Video</button>
          </div>
          <p class="fine-print">No local files linked yet. Use Import Folder to pull in audio files and attach them to a draft.</p>
        </div>
      `}
      <input type="file" id="video-file-input" accept="video/*" data-song-id="${song.id}" hidden>

      ${score.missing.length ? `<div class="warning"><strong>Next unlock:</strong> ${score.missing.map(escapeHtml).join(", ")}</div>` : ""}

      <div class="actions">
        <button class="primary" type="submit">Save Song</button>
        <button type="button" data-action="copy-pack" data-song-id="${song.id}">Copy Pack</button>
        <button type="button" data-action="copy-checklist" data-song-id="${song.id}">Copy Checklist</button>
        <button type="button" data-action="duplicate-song" data-song-id="${song.id}">Duplicate</button>
        <button type="button" class="danger" data-action="delete-song" data-song-id="${song.id}">Delete</button>
      </div>

      <div class="pack-preview">
        <h3>YouTube Draft Preview</h3>
        <p><strong>Title:</strong> ${escapeHtml(pack.youtube.title)}</p>
        <p><strong>Tags:</strong> ${escapeHtml(pack.youtube.tags.join(", "))}</p>
      </div>
    </form>
  `;
}

function renderSourceFiles(song) {
  return `
    <div class="source-files">
      <div class="source-files-top">
        <h3>Imported Assets</h3>
        <button type="button" class="btn-sm" data-action="add-video" data-song-id="${song.id}">Add Video</button>
      </div>
      <ul>
        ${song.sourceFiles.map((file) => {
          const audio = isAudioFilename(file.name);
          const video = isVideoFilename(file.name);
          const url = buildFileUrl(file);
          return `
            <li class="source-file-row">
              <div class="file-meta">
                <strong>${escapeHtml(file.name)}</strong>
                <small>${escapeHtml(file.path || file.name)}${file.size ? ` · ${formatBytes(file.size)}` : ""}</small>
              </div>
              <div class="file-actions">
                ${audio ? `<button type="button" class="btn-sm" data-action="copy-freebeat-link" data-url="${escapeHtml(url)}">Copy Link</button>` : ""}
                ${(audio || video) ? `<button type="button" class="btn-sm" data-action="open-media-url" data-url="${escapeHtml(url)}">${video ? "Open Video" : "Open Audio"}</button>` : ""}
              </div>
            </li>
          `;
        }).join("")}
      </ul>
    </div>
  `;
}

function renderPack(song) {
  if (!song) return renderNoSong("Create a song before generating a release pack.");
  const pack = generateReleasePack(song, state.integrations?.label || "");
  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <h2>Release Pack</h2>
          <p>Everything needed to push this song through rollout, capture, and submission.</p>
        </div>
        <div class="section-actions">
          <button data-action="copy-pack">Copy Pack</button>
          <button data-action="download-pack">Download Pack</button>
          <button data-action="copy-youtube">Copy YouTube Draft</button>
        </div>
      </div>

      <div class="release-grid">
        <article>
          <span>Readiness</span>
          <strong>${pack.score.percent}%</strong>
          <p>${pack.score.ready ? "Launch ready." : `${pack.score.missing.length} gaps remain.`}</p>
        </article>
        <article>
          <span>Distribution</span>
          <strong>${escapeHtml(song.platforms[0] || "Not set")}</strong>
          <p>Primary launch platform.</p>
        </article>
        <article>
          <span>YouTube</span>
          <strong>Draft ready</strong>
          <p>Video upload copy and thumbnail direction included.</p>
        </article>
      </div>

      <div class="split-panels">
        <section>
          <h3>Checklist</h3>
          <div class="checklist">
            ${pack.checklist.map((item) => `
              <label>
                <input type="checkbox" ${item.ready ? "checked" : ""} disabled>
                <span><strong>${escapeHtml(item.area)}</strong>${escapeHtml(item.item)}</span>
              </label>
            `).join("")}
          </div>
        </section>

        <section>
          <h3>YouTube Draft</h3>
          <div class="draft-box">
            <label>
              <span>Title</span>
              <textarea readonly rows="2">${escapeHtml(pack.youtube.title)}</textarea>
            </label>
            <label>
              <span>Description</span>
              <textarea readonly rows="10">${escapeHtml(pack.youtube.description)}</textarea>
            </label>
            <label>
              <span>Tags</span>
              <textarea readonly rows="2">${escapeHtml(pack.youtube.tags.join(", "))}</textarea>
            </label>
            <label>
              <span>Thumbnail prompt</span>
              <textarea readonly rows="3">${escapeHtml(pack.youtube.thumbnailPrompt)}</textarea>
            </label>
          </div>
        </section>
      </div>
    </section>
  `;
}

function renderCampaign(song) {
  if (!song) return renderNoSong("Create a song before generating a campaign.");
  const campaign = generateCampaign(song);
  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <h2>Campaign for ${escapeHtml(song.title || "Untitled song")}</h2>
          <p>Generated from the real metadata saved on this song.</p>
        </div>
        <button data-action="copy-campaign">Copy Campaign</button>
      </div>
      <div class="timeline">
        ${campaign.map((item) => `
          <article class="timeline-item">
            <time>${escapeHtml(item.date)}</time>
            <div>
              <strong>${escapeHtml(item.channel)} - ${escapeHtml(item.title)}</strong>
              <p>${escapeHtml(item.body).replaceAll("\n", "<br>")}</p>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderAssets(song) {
  if (!song) return renderNoSong("Create a song before building release assets.");
  const captions = buildAssetPack(song);
  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <h2>Asset Machine</h2>
          <p>Copy blocks directly into your content workflow.</p>
        </div>
        <button data-action="copy-assets">Copy Assets</button>
      </div>
      <div class="asset-grid">
        ${captions.map((asset) => `
          <article>
            <span>${escapeHtml(asset.type)}</span>
            <h3>${escapeHtml(asset.title)}</h3>
            <p>${escapeHtml(asset.body)}</p>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderQueue() {
  const allItems = buildRolloutQueue(state.songs);

  if (!allItems.length) return renderNoSong("Add songs to build the rollout queue.");

  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <h2>Rollout Queue</h2>
          <p>All upcoming actions across the catalog.</p>
        </div>
      </div>
      <div class="queue">
        ${allItems.map((item) => `
          <article>
            <time>${escapeHtml(item.date)}</time>
            <div>
              <strong>${escapeHtml(item.song)} - ${escapeHtml(item.channel)}</strong>
              <p>${escapeHtml(item.title)}</p>
            </div>
            <span class="${item.ready ? "ready" : "blocked"}">${item.ready ? "Ready" : "Needs data"}</span>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderReview(song) {
  if (!song) return renderNoSong("Create a song before reviewing release performance.");
  const performance = summarizeCatalogPerformance(state.songs);
  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <h2>Release Review</h2>
          <p>Track real post-release signals and use them to shape the next content wave.</p>
        </div>
        <div class="section-actions">
          <button data-action="copy-review">Copy Review</button>
          <button data-action="download-review">Download Review</button>
        </div>
      </div>

      <div class="release-grid">
        <article>
          <span>Total Streams</span>
          <strong>${formatNumber(performance.streams)}</strong>
          <p>Catalog playback signal.</p>
        </article>
        <article>
          <span>Total Saves</span>
          <strong>${formatNumber(performance.saves)}</strong>
          <p>Intent and replay signal.</p>
        </article>
        <article>
          <span>Reviewed Songs</span>
          <strong>${formatNumber(performance.reviewed)}</strong>
          <p>Releases with captured metrics.</p>
        </article>
      </div>

      <form class="review-form" data-review-form="${song.id}">
        <div class="section-head compact">
          <div>
            <h3>${escapeHtml(song.title || "Untitled song")}</h3>
            <p>Last reviewed: ${escapeHtml(song.analytics.reviewedAt || "Not reviewed yet")}</p>
          </div>
        </div>
        <div class="grid three">
          ${numberInput("streams", "Streams", song.analytics.streams)}
          ${numberInput("saves", "Saves", song.analytics.saves)}
          ${numberInput("shares", "Shares", song.analytics.shares)}
          ${numberInput("comments", "Comments", song.analytics.comments)}
          ${numberInput("playlistAdds", "Playlist adds", song.analytics.playlistAdds)}
          ${numberInput("contentViews", "Content views", song.analytics.contentViews)}
        </div>
        ${textarea("analyticsNotes", "Signal notes", song.analytics.notes)}
        <div class="actions">
          <button class="primary" type="submit">Save Review</button>
          <button type="button" data-view="dashboard">Dashboard</button>
          <button type="button" data-view="campaign">Campaign</button>
        </div>
      </form>

      <div class="top-songs">
        <h3>Strongest Signals</h3>
        ${performance.topSongs.length ? performance.topSongs.map((entry) => `
          <button class="gap-item" data-select-song="${entry.id}" data-target-view="review">
            <strong>${escapeHtml(entry.title || "Untitled song")}</strong>
            <span>${formatNumber(entry.analytics.streams)} streams - ${formatNumber(entry.analytics.saves)} saves - ${formatNumber(entry.analytics.contentViews)} content views</span>
          </button>
        `).join("") : renderInlineEmpty("No release metrics saved yet.")}
      </div>
    </section>
  `;
}

function renderBackup() {
  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <h2>Backup and Transfer</h2>
          <p>Export your catalog before browser cleanup, machine moves, or major edits.</p>
        </div>
      </div>
      <label class="field">
        <span>Catalog JSON</span>
        <textarea id="backup-data" rows="16">${escapeHtml(exportState(state))}</textarea>
      </label>
      <div class="actions">
        <button class="primary" data-action="download-backup">Download Backup</button>
        <button data-action="import-backup">Import Text</button>
      </div>
      <p class="fine-print">Last saved: ${escapeHtml(state.updatedAt)}</p>
    </section>
  `;
}

function renderIntegrations(song) {
  const platformUrls = state.integrations?.platformUrls ?? {};
  const webhookUrl = state.integrations?.webhookUrl ?? "";
  const label = state.integrations?.label ?? "";
  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <h2>Integrations</h2>
          <p>Connect SymphoniQ to the tools you already use without storing credentials in this app.</p>
        </div>
        <div class="section-actions">
          <button data-action="download-song-calendar" ${song ? "" : "disabled"}>Song Calendar</button>
          <button data-action="download-catalog-calendar">Catalog Calendar</button>
          <button class="primary" data-action="send-webhook" ${song && webhookUrl ? "" : "disabled"}>Send Webhook</button>
        </div>
      </div>

      <form class="integration-form" data-integration-form>
        <section>
          <h3>Platform Workspaces</h3>
          <div class="integration-grid">
            ${PLATFORM_OPTIONS.map((platform) => `
              <label class="field">
                <span>${escapeHtml(platform)}</span>
                <input name="platform:${escapeHtml(platform)}" type="url" value="${escapeHtml(platformUrls[platform] || "")}">
              </label>
            `).join("")}
          </div>
          <div class="actions">
            <button class="primary" type="submit">Save Integrations</button>
            ${PLATFORM_OPTIONS.map((platform) => `
              <button type="button" data-action="open-platform" data-platform="${escapeHtml(platform)}" ${platformUrls[platform] ? "" : "disabled"}>
                Open ${escapeHtml(platform)}
              </button>
            `).join("")}
          </div>
        </section>

        <section>
          <h3>Label</h3>
          <label class="field">
            <span>Record Label</span>
            <input name="label" type="text" value="${escapeHtml(label)}" placeholder="e.g. Seeing Red Records">
          </label>
          <p class="fine-print">Flows into release packs, YouTube descriptions, and campaign copy for every song.</p>
        </section>

        <section>
          <h3>Automation Webhook</h3>
          <label class="field">
            <span>Webhook URL</span>
            <input name="webhookUrl" type="url" value="${escapeHtml(webhookUrl)}">
          </label>
          <p class="fine-print">Webhook payload includes the selected song, readiness score, release pack, campaign, and catalog summary.</p>
        </section>
      </form>

      <div class="integration-payload">
        <h3>Selected Song Payload</h3>
        <textarea readonly rows="16">${escapeHtml(song ? JSON.stringify(createIntegrationPayload(song, state), null, 2) : "Create or select a song to preview the integration payload.")}</textarea>
      </div>
    </section>
  `;
}

function renderDistribute(song) {
  if (!song) return renderNoSong("Create a song before distributing to RouteNote.");

  const label = state.integrations?.label || "";
  const pkg = getRouteNotePackage(song, label);
  const rn = song.distribution?.routenote ?? {};
  const statusOptions = ["none", "ready", "submitted", "processing", "live"];

  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <h2>Distribute — ${escapeHtml(song.title || "Untitled song")}</h2>
          <p>Prepare and submit this track to RouteNote for streaming distribution.</p>
        </div>
        <div class="section-actions">
          <button data-action="copy-routenote" data-song-id="${song.id}">Copy Submission Data</button>
          <button class="primary" data-action="open-routenote">Open RouteNote</button>
        </div>
      </div>

      <div class="rn-readiness ${pkg.readiness.ready ? "rn-gate-ready" : "rn-gate-blocked"}">
        <h3>${pkg.readiness.ready ? "Ready to submit" : "Not ready — fix these first"}</h3>
        <ul class="rn-checklist">
          ${pkg.readiness.checks.map((c) => `
            <li class="${c.ready ? "rn-check-pass" : "rn-check-fail"}">
              <span class="rn-check-icon">${c.ready ? "✓" : "✗"}</span>
              ${escapeHtml(c.label)}
            </li>
          `).join("")}
        </ul>
      </div>

      <div class="rn-fields">
        <div class="rn-fields-head">
          <h3>Submission Fields</h3>
          <p class="fine-print">Fill these into RouteNote's new release form. Click Copy to grab any field.</p>
        </div>
        <div class="rn-field-grid">
          ${Object.entries(pkg.fields).map(([key, value]) => `
            <div class="rn-field-row">
              <span class="rn-field-label">${escapeHtml(key)}</span>
              <span class="rn-field-value">${escapeHtml(value)}</span>
              <button type="button" class="btn-sm" data-action="copy-routenote-field" data-value="${escapeHtml(value)}">Copy</button>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="rn-files">
        <h3>Files to Upload</h3>
        ${pkg.readiness.wav ? `
          <div class="rn-field-row">
            <span class="rn-field-label">WAV Audio</span>
            <span class="rn-field-value">${escapeHtml(pkg.readiness.wav.path)}</span>
            <button type="button" class="btn-sm" data-action="copy-routenote-field" data-value="${escapeHtml(pkg.readiness.wav.path)}">Copy Path</button>
          </div>
        ` : `<p class="rn-missing">No WAV file found in source files — import your WAV into this song first.</p>`}
        ${pkg.readiness.art ? `
          <div class="rn-field-row">
            <span class="rn-field-label">Cover Art</span>
            <span class="rn-field-value">${escapeHtml(pkg.readiness.art.path)}</span>
            <button type="button" class="btn-sm" data-action="copy-routenote-field" data-value="${escapeHtml(pkg.readiness.art.path)}">Copy Path</button>
          </div>
        ` : `<p class="rn-missing">No JPG/PNG artwork found in source files — import your cover art first.</p>`}
      </div>

      <form class="rn-status-form" data-routenote-status-form="${song.id}">
        <h3>Distribution Status</h3>
        <p class="fine-print">After submitting to RouteNote, paste the release details back here to track distribution.</p>
        <div class="grid two">
          <label class="field">
            <span>Status</span>
            <select name="rnStatus">
              ${statusOptions.map((s) => `<option value="${s}" ${(rn.status || "none") === s ? "selected" : ""}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join("")}
            </select>
          </label>
          <label class="field">
            <span>Genre Override</span>
            <select name="rnGenre">
              ${ROUTENOTE_GENRES.map((g) => `<option value="${g}" ${pkg.genre === g ? "selected" : ""}>${escapeHtml(g)}</option>`).join("")}
            </select>
          </label>
          <label class="field">
            <span>RouteNote Release URL</span>
            <input name="rnReleaseUrl" type="url" value="${escapeHtml(rn.releaseUrl || "")}" placeholder="https://routenote.com/releases/...">
          </label>
          <label class="field">
            <span>RouteNote Release ID</span>
            <input name="rnReleaseId" type="text" value="${escapeHtml(rn.releaseId || "")}" placeholder="e.g. RN-12345678">
          </label>
          <label class="field">
            <span>ISRC</span>
            <input name="rnIsrc" type="text" value="${escapeHtml(rn.isrc || "")}" placeholder="e.g. USRC12345678">
          </label>
          <label class="field">
            <span>UPC</span>
            <input name="rnUpc" type="text" value="${escapeHtml(rn.upc || "")}" placeholder="e.g. 123456789012">
          </label>
        </div>
        <div class="actions">
          <button class="primary" type="submit">Save Distribution Status</button>
          ${rn.releaseUrl ? `<button type="button" data-action="open-routenote-release" data-url="${escapeHtml(rn.releaseUrl)}">Open Release</button>` : ""}
        </div>
        ${rn.submittedAt ? `<p class="fine-print">Submitted: ${escapeHtml(rn.submittedAt.slice(0, 10))}</p>` : ""}
        ${rn.liveAt ? `<p class="fine-print">Went live: ${escapeHtml(rn.liveAt.slice(0, 10))}</p>` : ""}
      </form>
    </section>
  `;
}

function renderNoSong(message) {
  return `
    <div class="empty">
      <h2>${escapeHtml(message)}</h2>
      <button class="primary" data-action="new-song">Create Song</button>
    </div>
  `;
}

function bindEvents() {
  document.querySelectorAll("[data-action='toggle-theme']").forEach((button) => {
    button.addEventListener("click", () => {
      setTheme(getTheme() === "dark" ? "light" : "dark");
      render();
    });
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", async () => {
      statusMessage = null;
      await saveState({ ...state, activeView: button.dataset.view });
      render();
    });
  });

  document.querySelector("[data-action='import-folder']")?.addEventListener("click", () => {
    document.querySelector("#folder-input")?.click();
  });

  document.querySelector("#folder-input")?.addEventListener("change", async (event) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    const drafts = inferSongsFromFiles(files.map((file) => ({
      name: file.name,
      path: file.webkitRelativePath || file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified
    })));

    if (!drafts.length) return;

    const saved = await saveState({
      ...state,
      songs: [...state.songs, ...drafts],
      selectedSongId: drafts[0].id,
      activeView: "songs"
    });
    if (saved) {
      statusMessage = { tone: "success", text: `Imported ${drafts.length} song draft${drafts.length === 1 ? "" : "s"}.` };
    }
    event.target.value = "";
    render();
  });

  document.querySelectorAll("[data-action='new-song']").forEach((button) => {
    button.addEventListener("click", async () => {
      const song = createSong();
      await saveState({
        ...state,
        songs: [...state.songs, song],
        selectedSongId: song.id,
        activeView: "songs"
      });
      render();
    });
  });

  document.querySelectorAll("[data-select-song]").forEach((button) => {
    button.addEventListener("click", async () => {
      await saveState({ ...state, selectedSongId: button.dataset.selectSong, activeView: button.dataset.targetView || state.activeView });
      render();
    });
  });

  document.querySelectorAll("[data-song-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const id = form.dataset.songForm;
      const nextSongs = state.songs.map((song) =>
        song.id === id
          ? {
              ...song,
              title: String(formData.get("title") || "").trim(),
              artist: String(formData.get("artist") || "").trim(),
              stage: String(formData.get("stage") || "Idea"),
              releaseDate: String(formData.get("releaseDate") || ""),
              mood: String(formData.get("mood") || "").trim(),
              audience: String(formData.get("audience") || "").trim(),
              story: String(formData.get("story") || "").trim(),
              links: String(formData.get("links") || "").trim(),
              assets: String(formData.get("assets") || "").trim(),
              notes: String(formData.get("notes") || "").trim(),
              platforms: formData.getAll("platforms").map(String),
              updatedAt: new Date().toISOString()
            }
          : song
      );
      await saveState({ ...state, songs: nextSongs });
      render();
    });
  });

  document.querySelectorAll("[data-review-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const id = form.dataset.reviewForm;
      const nextSongs = state.songs.map((song) =>
        song.id === id
          ? {
              ...song,
              analytics: {
                streams: formNumber(formData, "streams"),
                saves: formNumber(formData, "saves"),
                shares: formNumber(formData, "shares"),
                comments: formNumber(formData, "comments"),
                playlistAdds: formNumber(formData, "playlistAdds"),
                contentViews: formNumber(formData, "contentViews"),
                notes: String(formData.get("analyticsNotes") || "").trim(),
                reviewedAt: new Date().toISOString()
              },
              updatedAt: new Date().toISOString()
            }
          : song
      );
      if (await saveState({ ...state, songs: nextSongs })) {
        statusMessage = { tone: "success", text: "Release review saved." };
      }
      render();
    });
  });

  document.querySelectorAll("[data-action='duplicate-song']").forEach((button) => {
    button.addEventListener("click", async () => {
      const source = state.songs.find((song) => song.id === button.dataset.songId);
      if (!source) return;
      const song = createSong({
        ...source,
        title: `${source.title || "Untitled song"} alternate run`,
        stage: "Idea",
        releaseDate: ""
      });
      await saveState({ ...state, songs: [...state.songs, song], selectedSongId: song.id });
      render();
    });
  });

  document.querySelectorAll("[data-action='delete-song']").forEach((button) => {
    button.addEventListener("click", async () => {
      const target = state.songs.find((song) => song.id === button.dataset.songId);
      const name = target?.title || "this song";
      if (!window.confirm(`Delete "${name}" from this local catalog? Export a backup first if you may need it later.`)) {
        return;
      }
      const remaining = state.songs.filter((song) => song.id !== button.dataset.songId);
      await saveState({
        ...state,
        songs: remaining,
        selectedSongId: remaining[0]?.id ?? null
      });
      render();
    });
  });

  document.querySelectorAll("[data-action='add-video']").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.querySelector("#video-file-input");
      if (!input) return;
      input.dataset.songId = button.dataset.songId;
      input.click();
    });
  });

  document.querySelector("#video-file-input")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const songId = event.target.dataset.songId;
    statusMessage = { tone: "success", text: `Uploading "${file.name}"…` };
    render();
    try {
      const res = await fetch(`/api/upload-video?name=${encodeURIComponent(file.name)}`, {
        method: "POST",
        headers: { "Content-Type": file.type || "video/mp4" },
        body: file
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      const nextSongs = state.songs.map((song) =>
        song.id === songId
          ? {
              ...song,
              sourceFiles: [
                ...song.sourceFiles,
                { name: data.name, path: data.path, type: file.type, size: file.size, lastModified: file.lastModified }
              ],
              updatedAt: new Date().toISOString()
            }
          : song
      );
      if (await saveState({ ...state, songs: nextSongs })) {
        statusMessage = { tone: "success", text: `"${data.name}" saved to videos/ and linked to this song.` };
      }
    } catch (error) {
      statusMessage = { tone: "error", text: `Video upload failed: ${error instanceof Error ? error.message : "Unknown error"}.` };
    }
    event.target.value = "";
    render();
  });

  document.querySelectorAll("[data-action='copy-freebeat-link']").forEach((button) => {
    button.addEventListener("click", () => {
      queueCopy(button.dataset.url, "Freebeat link copied.");
    });
  });

  document.querySelectorAll("[data-action='open-media-url']").forEach((button) => {
    button.addEventListener("click", () => {
      window.open(button.dataset.url, "_blank", "noopener,noreferrer");
    });
  });

  document.querySelectorAll("[data-action='copy-pack']").forEach((button) => {
    button.addEventListener("click", () => {
      const song = state.songs.find((entry) => entry.id === button.dataset.songId) ?? getSelectedSong(state);
      if (!song) return;
      queueCopy(generateReleasePack(song, state.integrations?.label || "").copy, "Release pack copied.");
    });
  });

  document.querySelectorAll("[data-action='copy-checklist']").forEach((button) => {
    button.addEventListener("click", () => {
      const song = state.songs.find((entry) => entry.id === button.dataset.songId) ?? getSelectedSong(state);
      if (!song) return;
      queueCopy(exportReleaseChecklist(song), "Checklist copied.");
    });
  });

  document.querySelector("[data-action='copy-campaign']")?.addEventListener("click", () => {
    const song = getSelectedSong(state);
    if (!song) return;
    queueCopy(formatCampaign(song), "Campaign copied.");
  });

  document.querySelector("[data-action='copy-assets']")?.addEventListener("click", () => {
    const song = getSelectedSong(state);
    if (!song) return;
    queueCopy(formatAssets(song), "Assets copied.");
  });

  document.querySelector("[data-action='copy-youtube']")?.addEventListener("click", () => {
    const song = getSelectedSong(state);
    if (!song) return;
    const pack = generateReleasePack(song, state.integrations?.label || "");
    queueCopy([
      `Title: ${pack.youtube.title}`,
      `Description:\n${pack.youtube.description}`,
      `Tags: ${pack.youtube.tags.join(", ")}`,
      `Thumbnail prompt: ${pack.youtube.thumbnailPrompt}`
    ].join("\n\n"), "YouTube draft copied.");
  });

  document.querySelector("[data-action='download-pack']")?.addEventListener("click", () => {
    const song = getSelectedSong(state);
    if (!song) return;
    const pack = generateReleasePack(song, state.integrations?.label || "");
    downloadText(pack.copy, `${slugify(song.title || "release-pack")}.md`, "text/markdown");
  });

  document.querySelector("[data-action='download-backup']")?.addEventListener("click", async () => {
    const next = { ...state, lastBackupAt: new Date().toISOString() };
    await saveState(next);
    downloadText(exportState(state), `symphoniq-backup-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
    statusMessage = { tone: "success", text: "Backup downloaded and timestamp recorded." };
    render();
  });

  document.querySelector("[data-action='import-backup']")?.addEventListener("click", async () => {
    const input = document.querySelector("#backup-data");
    if (!(input instanceof HTMLTextAreaElement)) {
      return;
    }
    try {
      const imported = importState(input.value);
      if (await saveState(imported)) {
        statusMessage = { tone: "success", text: "Backup imported into the local catalog." };
      }
      render();
    } catch (error) {
      input.setCustomValidity(error.message);
      input.reportValidity();
      input.setCustomValidity("");
    }
  });

  document.querySelector("[data-integration-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const platformUrls = {};
    for (const platform of PLATFORM_OPTIONS) {
      platformUrls[platform] = String(formData.get(`platform:${platform}`) || "").trim();
    }
    if (await saveState({
      ...state,
      integrations: {
        platformUrls,
        webhookUrl: String(formData.get("webhookUrl") || "").trim(),
        label: String(formData.get("label") || "").trim()
      }
    })) {
      statusMessage = { tone: "success", text: "Integration settings saved." };
    }
    render();
  });

  document.querySelectorAll("[data-action='open-platform']").forEach((button) => {
    button.addEventListener("click", () => {
      const url = state.integrations?.platformUrls?.[button.dataset.platform];
      if (!url) return;
      window.open(url, "_blank", "noopener,noreferrer");
    });
  });

  document.querySelector("[data-action='download-song-calendar']")?.addEventListener("click", () => {
    const song = getSelectedSong(state);
    if (!song) return;
    downloadText(exportCampaignCalendar(song), `${slugify(song.title || "song-rollout")}.ics`, "text/calendar");
  });

  document.querySelector("[data-action='download-catalog-calendar']")?.addEventListener("click", () => {
    downloadText(exportCatalogCalendar(state), `symphoniq-rollout-${new Date().toISOString().slice(0, 10)}.ics`, "text/calendar");
  });

  document.querySelector("[data-action='send-webhook']")?.addEventListener("click", () => {
    const song = getSelectedSong(state);
    if (!song) return;
    sendWebhook(song);
  });

  document.querySelector("[data-action='copy-review']")?.addEventListener("click", () => {
    const song = getSelectedSong(state);
    if (!song) return;
    queueCopy(formatReleaseReview(song), "Release review copied.");
  });

  document.querySelector("[data-action='download-review']")?.addEventListener("click", () => {
    const song = getSelectedSong(state);
    if (!song) return;
    downloadText(formatReleaseReview(song), `${slugify(song.title || "release-review")}-review.md`, "text/markdown");
  });

  document.querySelectorAll("[data-action='copy-routenote']").forEach((button) => {
    button.addEventListener("click", () => {
      const song = state.songs.find((s) => s.id === button.dataset.songId) ?? getSelectedSong(state);
      if (!song) return;
      const pkg = getRouteNotePackage(song, state.integrations?.label || "");
      queueCopy(pkg.copy, "RouteNote submission data copied.");
    });
  });

  document.querySelector("[data-action='open-routenote']")?.addEventListener("click", () => {
    window.open("https://routenote.com/releases/new", "_blank", "noopener,noreferrer");
  });

  document.querySelectorAll("[data-action='copy-routenote-field']").forEach((button) => {
    button.addEventListener("click", () => {
      queueCopy(button.dataset.value || "", "Copied.");
    });
  });

  document.querySelectorAll("[data-action='open-routenote-release']").forEach((button) => {
    button.addEventListener("click", () => {
      const url = button.dataset.url;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    });
  });

  document.querySelectorAll("[data-routenote-status-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const songId = form.dataset.routenoteStatusForm;
      const formData = new FormData(form);
      const rnStatus = String(formData.get("rnStatus") || "none");
      const rnGenre = String(formData.get("rnGenre") || "");
      const rnReleaseUrl = String(formData.get("rnReleaseUrl") || "").trim();
      const rnReleaseId = String(formData.get("rnReleaseId") || "").trim();
      const rnIsrc = String(formData.get("rnIsrc") || "").trim();
      const rnUpc = String(formData.get("rnUpc") || "").trim();

      const nextSongs = state.songs.map((song) => {
        if (song.id !== songId) return song;
        const existing = song.distribution?.routenote ?? {};
        return {
          ...song,
          distribution: {
            routenote: {
              status: rnStatus,
              genre: rnGenre,
              releaseUrl: rnReleaseUrl,
              releaseId: rnReleaseId,
              isrc: rnIsrc,
              upc: rnUpc,
              submittedAt: rnStatus === "submitted" && !existing.submittedAt
                ? new Date().toISOString()
                : (existing.submittedAt || ""),
              liveAt: rnStatus === "live" && !existing.liveAt
                ? new Date().toISOString()
                : (existing.liveAt || "")
            }
          },
          updatedAt: new Date().toISOString()
        };
      });

      if (await saveState({ ...state, songs: nextSongs })) {
        statusMessage = { tone: "success", text: "Distribution status saved." };
      }
      render();
    });
  });
}

function input(name, label, value, type) {
  return `
    <label class="field">
      <span>${label}</span>
      <input name="${name}" type="${type}" value="${escapeHtml(value)}">
    </label>
  `;
}

function select(name, label, value, options) {
  return `
    <label class="field">
      <span>${label}</span>
      <select name="${name}">
        ${options.map((option) => `<option value="${option}" ${option === value ? "selected" : ""}>${option}</option>`).join("")}
      </select>
    </label>
  `;
}

function textarea(name, label, value) {
  return `
    <label class="field">
      <span>${label}</span>
      <textarea name="${name}" rows="4">${escapeHtml(value)}</textarea>
    </label>
  `;
}

function numberInput(name, label, value) {
  return `
    <label class="field">
      <span>${label}</span>
      <input name="${name}" type="number" min="0" step="1" value="${Number(value) || 0}">
    </label>
  `;
}

function buildAssetPack(song) {
  const title = song.title || "Untitled song";
  const mood = song.mood || "the feeling";
  const story = song.story || "the real moment behind the record";
  const audience = song.audience || "people who need this song";
  const links = song.links || "your release link";

  return [
    {
      type: "Caption",
      title: "Direct release post",
      body: `${title} is built for ${audience}. The feeling is ${mood}. Listen here: ${links}`
    },
    {
      type: "Short video",
      title: "Opening hook",
      body: `Start on camera with: "I made ${title} for anyone who knows ${mood} but never says it out loud." Cut to the strongest song moment.`
    },
    {
      type: "Story",
      title: "Behind the song",
      body: `This record started with ${story}. Save it if it hits where you are right now.`
    },
    {
      type: "Email",
      title: "Release note",
      body: `Subject: ${title}\n\nThis one is for ${audience}. The center of the song is ${mood}. Listen here: ${links}`
    },
    {
      type: "Press note",
      title: "One-line pitch",
      body: `${song.artist || "Goody"} turns ${mood} into a focused release for ${audience} on "${title}".`
    },
    {
      type: "Checklist",
      title: "Asset pass",
      body: `Cover art, vertical clip, square visual, lyric clip, performance clip, pinned comment, email note, distributor link, analytics capture.`
    }
  ];
}

function formatCampaign(song) {
  return generateCampaign(song)
    .map((item) => `${item.date} | ${item.channel} | ${item.title}\n${item.body}`)
    .join("\n\n");
}

function formatAssets(song) {
  return buildAssetPack(song)
    .map((item) => `${item.type}: ${item.title}\n${item.body}`)
    .join("\n\n");
}

function formatReleaseReview(song) {
  return [
    `# ${song.title || "Untitled song"} Release Review`,
    ``,
    `Streams: ${song.analytics.streams}`,
    `Saves: ${song.analytics.saves}`,
    `Shares: ${song.analytics.shares}`,
    `Comments: ${song.analytics.comments}`,
    `Playlist adds: ${song.analytics.playlistAdds}`,
    `Content views: ${song.analytics.contentViews}`,
    `Reviewed at: ${song.analytics.reviewedAt || "Not reviewed yet"}`,
    ``,
    `## Notes`,
    song.analytics.notes || "No review notes saved."
  ].join("\n");
}

function summarizeCatalogPerformance(songs) {
  const topSongs = [...songs]
    .sort((a, b) => b.analytics.streams + b.analytics.contentViews - (a.analytics.streams + a.analytics.contentViews))
    .slice(0, 5);
  return {
    streams: songs.reduce((sum, song) => sum + song.analytics.streams, 0),
    saves: songs.reduce((sum, song) => sum + song.analytics.saves, 0),
    reviewed: songs.filter((song) => song.analytics.reviewedAt).length,
    topSongs
  };
}

function downloadText(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Use the legacy copy path below when clipboard permissions are denied.
  }
  const element = document.createElement("textarea");
  element.value = text;
  element.setAttribute("readonly", "");
  element.style.position = "fixed";
  element.style.left = "-9999px";
  document.body.append(element);
  element.select();
  const copied = document.execCommand("copy");
  element.remove();
  if (!copied) {
    throw new Error("Copy failed. Select the text manually from the current panel.");
  }
}

function queueCopy(text, successText) {
  copyText(text)
    .then(() => {
      statusMessage = { tone: "success", text: successText };
      render();
    })
    .catch((error) => {
      statusMessage = { tone: "error", text: error.message };
      render();
    });
}

async function sendWebhook(song) {
  const webhookUrl = state.integrations?.webhookUrl;
  if (!webhookUrl) {
    statusMessage = { tone: "error", text: "Save a webhook URL before sending." };
    render();
    return;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createIntegrationPayload(song, state)),
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`Webhook failed with HTTP ${response.status}.`);
    }
    statusMessage = { tone: "success", text: "Webhook delivered." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook failed.";
    const name = error instanceof Error ? error.name : "";
    statusMessage = {
      tone: "error",
      text: name === "AbortError" ? "Webhook timed out after 10 seconds." : message
    };
  } finally {
    window.clearTimeout(timeout);
    render();
  }
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value) || 0);
}

function formNumber(formData, name) {
  const value = Number(formData.get(name));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildFileUrl(file) {
  const filePath = file.path || file.name;
  return filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .reduce((base, segment) => `${base}/${segment}`, "http://127.0.0.1:4173");
}

function isAudioFilename(name) {
  return /\.(mp3|wav|aiff|aif|flac|m4a|aac|ogg|opus)$/i.test(String(name || ""));
}

function isVideoFilename(name) {
  return /\.(mp4|mov|m4v|webm|mkv)$/i.test(String(name || ""));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.SymphoniQCore = { scoreSong, generateCampaign, generateReleasePack, inferSongsFromFiles };
