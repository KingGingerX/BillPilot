export const STORAGE_KEY = "symphoniq.state.v1";

export const RELEASE_STAGES = [
  "Idea",
  "Recorded",
  "Mixed",
  "Mastered",
  "Assets Ready",
  "Scheduled",
  "Released"
];

export const PLATFORM_OPTIONS = [
  "Spotify",
  "Apple Music",
  "YouTube",
  "TikTok",
  "Instagram",
  "SoundCloud",
  "Bandcamp",
  "Email List"
];

const VALID_VIEWS = ["dashboard", "songs", "pack", "campaign", "assets", "queue", "review", "integrations", "backup", "distribute"];
const DEFAULT_PLATFORMS = ["Spotify", "YouTube", "TikTok", "Instagram"];
const MAX_SOURCE_FILES_PER_SONG = 75;
const DEFAULT_INTEGRATION_SETTINGS = {
  platformUrls: {},
  webhookUrl: "http://127.0.0.1:4173/api/inbox/symphoniq",
  label: ""
};
const ANALYTICS_FIELDS = ["streams", "saves", "shares", "comments", "playlistAdds", "contentViews"];

export const ROUTENOTE_GENRES = [
  "Alternative", "Blues", "Classical", "Country", "Dance/Electronic",
  "Folk", "Gospel", "Hip-Hop/Rap", "Jazz", "Latin", "Metal",
  "New Age", "Pop", "R&B/Soul", "Reggae", "Rock", "Singer/Songwriter",
  "Soundtrack", "World"
];

const ROUTENOTE_STORE_MAP = {
  "Spotify": "Spotify",
  "Apple Music": "Apple Music",
  "YouTube": "YouTube Music",
  "TikTok": "TikTok",
  "Instagram": "Instagram",
  "SoundCloud": "SoundCloud",
  "Bandcamp": null,
  "Email List": null
};

const DISTRIBUTION_STATUSES = ["none", "ready", "submitted", "processing", "live"];

const REQUIRED_FIELDS = [
  ["title", "Song title"],
  ["artist", "Artist name"],
  ["stage", "Production stage"],
  ["releaseDate", "Release date"],
  ["mood", "Mood"],
  ["story", "Song story"],
  ["audience", "Target listener"],
  ["links", "Release or private review links"],
  ["assets", "Visual or promo assets"]
];

export function createEmptyState() {
  return {
    version: 1,
    activeView: "dashboard",
    songs: [],
    selectedSongId: null,
    integrations: createDefaultIntegrations(),
    lastBackupAt: "",
    updatedAt: new Date().toISOString()
  };
}

export function createSong(input = {}) {
  const now = new Date().toISOString();
  return normalizeSong({
    title: "",
    artist: "Goody",
    stage: "Idea",
    releaseDate: "",
    mood: "",
    story: "",
    audience: "",
    platforms: DEFAULT_PLATFORMS,
    links: "",
    assets: "",
    notes: "",
    analytics: {},
    sourceFiles: [],
    ...input,
    id: cryptoSafeId(),
    createdAt: now,
    updatedAt: now
  });
}

export function normalizeState(value) {
  if (!value || typeof value !== "object") {
    return createEmptyState();
  }

  const songs = Array.isArray(value.songs)
    ? value.songs.map(normalizeSong).filter((song) => song.id)
    : [];
  const uniqueSongs = ensureUniqueSongIds(songs);

  const selectedSongId =
    typeof value.selectedSongId === "string" && uniqueSongs.some((song) => song.id === value.selectedSongId)
      ? value.selectedSongId
      : uniqueSongs[0]?.id ?? null;

  return {
    version: 1,
    activeView: VALID_VIEWS.includes(value.activeView) ? value.activeView : "dashboard",
    songs: uniqueSongs,
    selectedSongId,
    integrations: normalizeIntegrations(value.integrations),
    lastBackupAt: cleanText(value.lastBackupAt),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString()
  };
}

export function normalizeSong(song) {
  const source = song && typeof song === "object" ? song : {};
  const platforms = Array.isArray(source.platforms)
    ? source.platforms.filter((item) => PLATFORM_OPTIONS.includes(item))
    : [];

  return {
    id: typeof source.id === "string" && source.id.trim() ? source.id : cryptoSafeId(),
    title: cleanText(source.title),
    artist: cleanText(source.artist) || "Goody",
    stage: RELEASE_STAGES.includes(source.stage) ? source.stage : "Idea",
    releaseDate: normalizeDateString(source.releaseDate),
    mood: cleanText(source.mood),
    story: cleanText(source.story),
    audience: cleanText(source.audience),
    platforms: platforms.length ? platforms : DEFAULT_PLATFORMS,
    links: cleanText(source.links),
    assets: cleanText(source.assets),
    notes: cleanText(source.notes),
    analytics: normalizeAnalytics(source.analytics),
    sourceFiles: normalizeSourceFiles(source.sourceFiles),
    distribution: normalizeDistribution(source.distribution),
    createdAt: cleanText(source.createdAt) || new Date().toISOString(),
    updatedAt: cleanText(source.updatedAt) || new Date().toISOString()
  };
}

export function getSelectedSong(state) {
  return state.songs.find((song) => song.id === state.selectedSongId) ?? state.songs[0] ?? null;
}

export function scoreSong(song) {
  const missing = REQUIRED_FIELDS.filter(([field]) => {
    if (field === "releaseDate") {
      return !isValidDateString(song.releaseDate);
    }
    if (field === "platforms") {
      return !song.platforms.length;
    }
    return !String(song[field] ?? "").trim();
  }).map(([, label]) => label);

  if (!song.platforms.length) {
    missing.push("Distribution platforms");
  }

  const completed = REQUIRED_FIELDS.length + 1 - missing.length;
  const percent = Math.max(0, Math.round((completed / (REQUIRED_FIELDS.length + 1)) * 100));
  return {
    percent,
    missing,
    ready: percent === 100
  };
}

export function getStageIndex(stage) {
  return RELEASE_STAGES.indexOf(stage);
}

export function sortSongs(songs) {
  return [...songs].sort((a, b) => {
    const dateA = a.releaseDate || "9999-12-31";
    const dateB = b.releaseDate || "9999-12-31";
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return a.title.localeCompare(b.title);
  });
}

export function generateCampaign(song, now = new Date()) {
  const score = scoreSong(song);
  const date = parseDate(song.releaseDate) ?? now;
  const title = song.title || "Untitled song";
  const artist = song.artist || "Goody";
  const listener = song.audience || "the listeners who need this";
  const mood = song.mood || "the emotion behind the track";
  const story = song.story || "the story behind the record";
  const links = song.links || "link coming from your release dashboard";
  const platforms = song.platforms.length ? song.platforms : DEFAULT_PLATFORMS;

  const items = [
    {
      offset: -21,
      channel: "Operations",
      title: "Lock release foundation",
      body: `Confirm final audio, artwork, metadata, and distributor status for "${title}". Missing: ${score.missing.join(", ") || "nothing"}.`
    },
    {
      offset: -14,
      channel: "Short-form",
      title: "Hook test",
      body: `Film three short clips around this listener: ${listener}. Each clip opens with the strongest line, sound, or feeling from "${title}".`
    },
    {
      offset: -10,
      channel: "Instagram",
      title: "Story post",
      body: `"${title}" came from ${story}. If you have ever felt ${mood}, this one is for you.`
    },
    {
      offset: -7,
      channel: "YouTube",
      title: "Visual setup",
      body: `Publish a short visual or lyric fragment for "${title}" with a direct pre-save or premiere link: ${links}.`
    },
    {
      offset: -3,
      channel: "Email List",
      title: "Early listener note",
      body: `Subject: ${title}\n\nI made this for ${listener}. The core feeling is ${mood}. Listen early here: ${links}`
    },
    {
      offset: 0,
      channel: "All Platforms",
      title: "Release day launch",
      body: `"${title}" by ${artist} is out now. Start with ${platforms[0]}, then push the strongest clip to ${platforms.slice(1).join(", ") || platforms[0]}.`
    },
    {
      offset: 1,
      channel: "TikTok",
      title: "Reaction angle",
      body: `Use the most replayable moment from "${title}" and ask listeners what scene, memory, or mood it puts them in.`
    },
    {
      offset: 3,
      channel: "Instagram",
      title: "Meaning breakdown",
      body: `Break down one lyric, texture, or production choice from "${title}" and connect it back to ${story}.`
    },
    {
      offset: 7,
      channel: "YouTube",
      title: "Performance cut",
      body: `Record a stripped, live, or studio-performance version of "${title}" to give the song a second content life.`
    },
    {
      offset: 14,
      channel: "Operations",
      title: "Signal review",
      body: `Capture saves, comments, shares, watch time, playlist adds, and strongest audience language for "${title}". Use that language in the next wave.`
    }
  ];

  return items.map((item) => ({
    ...item,
    date: addDays(date, item.offset).toISOString().slice(0, 10)
  }));
}

export function summarizeCatalog(songs) {
  const total = songs.length;
  const released = songs.filter((song) => song.stage === "Released").length;
  const ready = songs.filter((song) => scoreSong(song).ready).length;
  const upcoming = sortSongs(songs).filter((song) => song.releaseDate && song.stage !== "Released").slice(0, 5);
  const averageReadiness = total
    ? Math.round(songs.reduce((sum, song) => sum + scoreSong(song).percent, 0) / total)
    : 0;

  return { total, released, ready, upcoming, averageReadiness };
}

export function buildRolloutQueue(songs, now = new Date()) {
  const today = dateOnly(now);
  return sortSongs(songs)
    .flatMap((song) =>
      generateCampaign(song).map((item) => ({
        ...item,
        songId: song.id,
        song: song.title || "Untitled song",
        ready: scoreSong(song).ready,
        daysUntil: dateDiffDays(today, item.date)
      }))
    )
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.song.localeCompare(b.song);
    });
}

export function summarizeDashboard(state, now = new Date()) {
  const normalized = normalizeState(state);
  const selected = getSelectedSong(normalized);
  const queue = buildRolloutQueue(normalized.songs, now);
  const upcoming = queue.filter((item) => item.daysUntil >= 0).slice(0, 6);
  const overdue = queue.filter((item) => item.daysUntil < 0 && item.daysUntil >= -14).slice(0, 6);
  const blockedSongs = normalized.songs
    .map((song) => ({ song, score: scoreSong(song) }))
    .filter((entry) => !entry.score.ready)
    .sort((a, b) => b.score.percent - a.score.percent)
    .slice(0, 4);

  return {
    selected,
    summary: summarizeCatalog(normalized.songs),
    upcoming,
    overdue,
    blockedSongs,
    performance: summarizePerformance(normalized.songs),
    backup: summarizeBackup(normalized, now)
  };
}

export function summarizePerformance(songs) {
  const totals = songs.reduce(
    (result, song) => {
      for (const field of ANALYTICS_FIELDS) {
        result[field] += song.analytics[field];
      }
      return result;
    },
    Object.fromEntries(ANALYTICS_FIELDS.map((field) => [field, 0]))
  );
  const reviewed = songs.filter((song) => song.analytics.reviewedAt).length;
  const topSongs = [...songs]
    .sort((a, b) => b.analytics.streams + b.analytics.contentViews - (a.analytics.streams + a.analytics.contentViews))
    .slice(0, 5);

  return { totals, reviewed, topSongs };
}

export function inferSongsFromFiles(files) {
  const entries = Array.from(files ?? [])
    .map(normalizeFileEntry)
    .filter(Boolean);

  if (!entries.length) {
    return [];
  }

  const grouped = new Map();
  for (const entry of entries) {
    const key = getSongKey(entry);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(entry);
  }

  return [...grouped.entries()].map(([key, group]) => {
    const audio = group.find((item) => isAudioFile(item.name, item.type)) ?? group[0];
    const title = inferTitleFromGroup(key, audio?.name);
    const hasAudio = group.some((item) => isAudioFile(item.name, item.type));
    const hasVideo = group.some((item) => isVideoFile(item.name, item.type));
    const hasImage = group.some((item) => isImageFile(item.name, item.type));

    return createSong({
      title,
      stage: hasAudio || hasVideo ? "Recorded" : "Idea",
      assets: describeImportedAssets(group),
      sourceFiles: group,
      notes: [hasAudio ? "Audio imported." : "", hasVideo ? "Video imported." : "", hasImage ? "Artwork imported." : ""].filter(Boolean).join(" "),
      releaseDate: ""
    });
  });
}

export function generateReleasePack(song, label = "") {
  const score = scoreSong(song);
  const title = song.title || "Untitled song";
  const artist = song.artist || "Goody";
  const mood = song.mood || "the emotional center of the record";
  const audience = song.audience || "the listeners who should hear this first";
  const story = song.story || "the story behind the record";
  const links = song.links || "release link not set yet";
  const assets = song.assets || "assets not set yet";

  const checklist = [
    { area: "Metadata", item: "Confirm title, artist, release date, and stage.", ready: Boolean(song.title && song.artist && song.releaseDate) },
    { area: "Story", item: "Write the hook, meaning, and listener angle.", ready: Boolean(song.story && song.mood && song.audience) },
    { area: "Assets", item: "Store artwork, clips, and promo files.", ready: Boolean(song.assets) },
    { area: "Distribution", item: "Prepare the distributor submission fields.", ready: Boolean(song.links) },
    { area: "Platforms", item: "Confirm the launch platforms and rollout order.", ready: Boolean(song.platforms.length) }
  ];

  const youtube = {
    title: `${title} - ${artist}`,
    description: [
      `${title} by ${artist}.`,
      ``,
      `Mood: ${mood}`,
      `Audience: ${audience}`,
      `Story: ${story}`,
      `Release link: ${links}`,
      label ? `Label: ${label}` : "",
      `Assets: ${assets}`
    ].filter(Boolean).join("\n"),
    tags: buildTags(song),
    thumbnailPrompt: `${title} cover art that visually communicates ${mood} for listeners who connect with ${audience}.`
  };

  const copy = [
    `# ${title}`,
    ``,
    `Artist: ${artist}`,
    `Readiness: ${score.percent}%`,
    `Mood: ${mood}`,
    `Audience: ${audience}`,
    `Story: ${story}`,
    `Links: ${links}`,
    `Assets: ${assets}`,
    ``,
    `## Checklist`,
    ...checklist.map((item) => `- [${item.ready ? "x" : " "}] ${item.area}: ${item.item}`),
    ``,
    `## YouTube Draft`,
    `Title: ${youtube.title}`,
    `Description:`,
    youtube.description,
    `Tags: ${youtube.tags.join(", ")}`,
    `Thumbnail prompt: ${youtube.thumbnailPrompt}`
  ].join("\n");

  return {
    title,
    artist,
    score,
    checklist,
    youtube,
    copy
  };
}

export function createIntegrationPayload(song, state) {
  const normalizedSong = normalizeSong(song);
  const normalized = normalizeState(state);
  const label = normalized.integrations?.label || "";
  return {
    schema: "symphoniq.integration.v1",
    generatedAt: new Date().toISOString(),
    song: normalizedSong,
    readiness: scoreSong(normalizedSong),
    releasePack: generateReleasePack(normalizedSong, label),
    campaign: generateCampaign(normalizedSong),
    performance: normalizedSong.analytics,
    catalog: summarizeCatalog(normalized.songs),
    label
  };
}

export function exportCampaignCalendar(song) {
  const normalizedSong = normalizeSong(song);
  const campaign = generateCampaign(normalizedSong);
  const title = normalizedSong.title || "Untitled song";
  const artist = normalizedSong.artist || "Goody";
  const events = campaign.map((item) => ({
    uid: `${normalizedSong.id}-${item.date}-${slugText(item.channel)}-${slugText(item.title)}@symphoniq.local`,
    date: item.date,
    summary: `${title}: ${item.channel} - ${item.title}`,
    description: item.body,
    categories: [artist, item.channel, "SymphoniQ"]
  }));
  return buildCalendar(`${title} rollout`, events);
}

export function exportCatalogCalendar(state) {
  const normalized = normalizeState(state);
  const events = buildRolloutQueue(normalized.songs).map((item) => ({
    uid: `${item.songId}-${item.date}-${slugText(item.channel)}-${slugText(item.title)}@symphoniq.local`,
    date: item.date,
    summary: `${item.song}: ${item.channel} - ${item.title}`,
    description: item.body,
    categories: [item.channel, "SymphoniQ"]
  }));
  return buildCalendar("SymphoniQ rollout queue", events);
}

export function exportReleaseChecklist(song) {
  const pack = generateReleasePack(song);
  return pack.checklist.map((item) => `${item.ready ? "[x]" : "[ ]"} ${item.area}: ${item.item}`).join("\n");
}

export function getRouteNoteReadiness(song) {
  const stageIndex = RELEASE_STAGES.indexOf(song.stage);
  const assetsReadyIndex = RELEASE_STAGES.indexOf("Assets Ready");
  const wav = song.sourceFiles.find((f) => /\.wav$/i.test(f.name));
  const art = song.sourceFiles.find((f) => /\.(jpg|jpeg|png)$/i.test(f.name));

  const checks = [
    { label: "Stage is Assets Ready or later", ready: stageIndex >= assetsReadyIndex && stageIndex !== -1 },
    { label: "WAV audio file attached", ready: Boolean(wav) },
    { label: "Cover art attached (JPG or PNG)", ready: Boolean(art) },
    { label: "Song title set", ready: Boolean(song.title) },
    { label: "Artist name set", ready: Boolean(song.artist) },
    { label: "Release date set", ready: Boolean(song.releaseDate) },
    { label: "Platforms selected", ready: song.platforms.length > 0 }
  ];

  return { checks, ready: checks.every((c) => c.ready), wav: wav ?? null, art: art ?? null };
}

export function getRouteNotePackage(song, label = "") {
  const normalized = normalizeSong(song);
  const readiness = getRouteNoteReadiness(normalized);
  const savedGenre = normalized.distribution?.routenote?.genre;
  const genre = savedGenre || inferGenre(normalized.mood);
  const stores = normalized.platforms.map((p) => ROUTENOTE_STORE_MAP[p]).filter(Boolean);

  const fields = {
    "Release Title": normalized.title || "",
    "Artist Name": normalized.artist || "",
    "Record Label": label || normalized.artist || "",
    "Release Date": normalized.releaseDate || "",
    "Genre": genre,
    "Language": "English",
    "Explicit Content": "No",
    "Stores": stores.length ? stores.join(", ") : "Spotify, Apple Music, YouTube Music, TikTok",
    "ISRC": normalized.distribution?.routenote?.isrc || "(leave blank — RouteNote will assign)",
    "UPC": normalized.distribution?.routenote?.upc || "(leave blank — RouteNote will assign)"
  };

  const copy = [
    `# RouteNote Submission — ${normalized.title || "Untitled song"}`,
    ``,
    ...Object.entries(fields).map(([k, v]) => `${k}: ${v}`),
    ``,
    `## Files to Upload`,
    `Audio (WAV): ${readiness.wav ? readiness.wav.path : "NOT FOUND — attach WAV to song first"}`,
    `Artwork: ${readiness.art ? readiness.art.path : "NOT FOUND — attach JPG/PNG to song first"}`,
    ``,
    `## Steps`,
    `1. Open https://routenote.com/upload/`,
    `2. Create new release — set type to Single (or EP/Album as needed)`,
    `3. Fill each field listed above`,
    `4. Upload the WAV audio file`,
    `5. Upload cover art (min 1400x1400 px)`,
    `6. Select distribution stores`,
    `7. Submit for review`,
    `8. Paste RouteNote release URL and ISRC back into Symphoniq Distribute panel`
  ].join("\n");

  return { fields, readiness, genre, copy };
}

function inferGenre(mood) {
  const m = String(mood || "").toLowerCase();
  if (/hip.?hop|rap|trap|drill|boom.?bap/.test(m)) return "Hip-Hop/Rap";
  if (/r&b|soul|neo.?soul/.test(m)) return "R&B/Soul";
  if (/pop|catchy|radio/.test(m)) return "Pop";
  if (/rock|guitar|punk|grunge/.test(m)) return "Rock";
  if (/electronic|edm|dance|house|techno|synth/.test(m)) return "Dance/Electronic";
  if (/country|folk|americana/.test(m)) return "Country";
  if (/jazz/.test(m)) return "Jazz";
  if (/classical|orchestral/.test(m)) return "Classical";
  if (/reggae|dancehall/.test(m)) return "Reggae";
  return "Hip-Hop/Rap";
}

export function exportState(state) {
  return JSON.stringify(normalizeState(state), null, 2);
}

export function importState(json) {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Import failed: JSON is not valid.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Import failed: backup must be a catalog object.");
  }

  if (!Array.isArray(parsed.songs)) {
    throw new Error("Import failed: catalog is missing a songs array.");
  }

  const next = normalizeState(parsed);
  if (!Array.isArray(next.songs)) {
    throw new Error("Import failed: catalog is missing.");
  }
  return {
    ...next,
    updatedAt: new Date().toISOString()
  };
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function createDefaultIntegrations() {
  return {
    platformUrls: { ...DEFAULT_INTEGRATION_SETTINGS.platformUrls },
    webhookUrl: DEFAULT_INTEGRATION_SETTINGS.webhookUrl
  };
}

function normalizeIntegrations(value) {
  const source = value && typeof value === "object" ? value : {};
  const inputUrls = source.platformUrls && typeof source.platformUrls === "object" ? source.platformUrls : {};
  const platformUrls = {};

  for (const platform of PLATFORM_OPTIONS) {
    const url = normalizeHttpUrl(inputUrls[platform]);
    if (url) {
      platformUrls[platform] = url;
    }
  }

  return {
    platformUrls,
    webhookUrl: normalizeHttpUrl(source.webhookUrl),
    label: cleanText(source.label)
  };
}

function normalizeAnalytics(value) {
  const source = value && typeof value === "object" ? value : {};
  const analytics = Object.fromEntries(
    ANALYTICS_FIELDS.map((field) => [field, normalizeCount(source[field])])
  );
  return {
    ...analytics,
    notes: cleanText(source.notes),
    reviewedAt: cleanText(source.reviewedAt)
  };
}

function normalizeCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }
  return Math.floor(number);
}

function normalizeDistribution(value) {
  const source = value && typeof value === "object" ? value : {};
  const rn = source.routenote && typeof source.routenote === "object" ? source.routenote : {};
  return {
    routenote: {
      status: DISTRIBUTION_STATUSES.includes(rn.status) ? rn.status : "none",
      genre: cleanText(rn.genre),
      releaseId: cleanText(rn.releaseId),
      releaseUrl: cleanText(rn.releaseUrl),
      isrc: cleanText(rn.isrc),
      upc: cleanText(rn.upc),
      submittedAt: cleanText(rn.submittedAt),
      liveAt: cleanText(rn.liveAt)
    }
  };
}

function summarizeBackup(state, now) {
  if (!state.lastBackupAt) {
    return { status: "missing", label: "No backup recorded", daysSince: null };
  }
  const backupDate = new Date(state.lastBackupAt);
  if (Number.isNaN(backupDate.getTime())) {
    return { status: "missing", label: "No backup recorded", daysSince: null };
  }
  const daysSince = Math.max(0, dateDiffDays(dateOnly(backupDate), dateOnly(now)));
  return {
    status: daysSince > 7 ? "stale" : "current",
    label: daysSince === 0 ? "Backed up today" : `${daysSince}d since backup`,
    daysSince
  };
}

function normalizeHttpUrl(value) {
  const text = cleanText(value);
  if (!text) {
    return "";
  }
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function normalizeSourceFiles(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(normalizeFileEntry).filter(Boolean).slice(0, MAX_SOURCE_FILES_PER_SONG);
}

function ensureUniqueSongIds(songs) {
  const seen = new Set();
  return songs.map((song) => {
    if (!seen.has(song.id)) {
      seen.add(song.id);
      return song;
    }
    let id = cryptoSafeId();
    while (seen.has(id)) {
      id = cryptoSafeId();
    }
    seen.add(id);
    return { ...song, id };
  });
}

function normalizeFileEntry(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const name = cleanText(value.name);
  const path = cleanText(value.path || value.webkitRelativePath || value.fullPath);
  const type = cleanText(value.type);
  const size = Number.isFinite(Number(value.size)) ? Number(value.size) : 0;
  const lastModified = Number.isFinite(Number(value.lastModified)) ? Number(value.lastModified) : null;
  if (!name && !path) {
    return null;
  }
  return {
    name: name || path.split("/").pop() || "file",
    path: path || name,
    type,
    size,
    lastModified
  };
}

function getSongKey(entry) {
  const path = entry.path || entry.name;
  if (path.includes("/")) {
    return path.split("/")[0];
  }
  return stripExtension(entry.name).toLowerCase() || "untitled";
}

function inferTitleFromGroup(key, fallbackName) {
  if (key && key !== "__root__") {
    return humanizeName(key);
  }
  return humanizeName(stripExtension(fallbackName || "untitled"));
}

function describeImportedAssets(group) {
  const audioCount = group.filter((item) => isAudioFile(item.name, item.type)).length;
  const imageCount = group.filter((item) => isImageFile(item.name, item.type)).length;
  const videoCount = group.filter((item) => isVideoFile(item.name, item.type)).length;
  return [
    audioCount ? `${audioCount} audio file${audioCount === 1 ? "" : "s"}` : "",
    imageCount ? `${imageCount} image file${imageCount === 1 ? "" : "s"}` : "",
    videoCount ? `${videoCount} video file${videoCount === 1 ? "" : "s"}` : "",
    `${group.length} total asset${group.length === 1 ? "" : "s"}`
  ].filter(Boolean).join(", ");
}

function buildTags(song) {
  const tags = [
    song.artist,
    song.title,
    song.mood,
    song.audience,
    "music release",
    "new song"
  ];
  return [...new Set(tags.map((tag) => cleanTag(tag)).filter(Boolean))].slice(0, 12);
}

function cleanTag(value) {
  return cleanText(value).replaceAll("#", "");
}

function humanizeName(value) {
  return String(value)
    .replaceAll(/[_-]+/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim()
    .replaceAll(/\b\w/g, (letter) => letter.toUpperCase());
}

function stripExtension(value) {
  return String(value).replace(/\.[^.]+$/, "");
}

function isAudioFile(name, type) {
  const value = String(type || name || "");
  return /^audio\/[\w.+-]+$/i.test(value) || /\.(mp3|wav|aiff|aif|flac|m4a|aac|ogg|opus)$/i.test(value);
}

function isVideoFile(name, type) {
  const value = String(type || name || "");
  return /^video\/[\w.+-]+$/i.test(value) || /\.(mp4|mov|m4v|webm|mkv)$/i.test(value);
}

function isImageFile(name, type) {
  const value = String(type || name || "");
  return /^image\/[\w.+-]+$/i.test(value) || /\.(png|jpg|jpeg|webp|gif|avif|bmp|tiff)$/i.test(value);
}

function cryptoSafeId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint32Array(2);
    globalThis.crypto.getRandomValues(bytes);
    return `song-${Date.now().toString(36)}-${bytes[0].toString(36)}${bytes[1].toString(36)}`;
  }
  return `song-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseDate(value) {
  if (!isValidDateString(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateOnly(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function dateDiffDays(start, end) {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (!startDate || !endDate) {
    return 0;
  }
  return Math.round((endDate.getTime() - startDate.getTime()) / 86400000);
}

function normalizeDateString(value) {
  const text = cleanText(value);
  return isValidDateString(text) ? text : "";
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) {
    return false;
  }
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function buildCalendar(name, events) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SymphoniQ//Music Launch Command Center//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeCalendarText(name)}`,
    ...events.flatMap((event) => [
      "BEGIN:VEVENT",
      `UID:${escapeCalendarText(event.uid)}`,
      `DTSTAMP:${formatCalendarTimestamp(new Date())}`,
      `DTSTART;VALUE=DATE:${event.date.replaceAll("-", "")}`,
      `SUMMARY:${escapeCalendarText(event.summary)}`,
      `DESCRIPTION:${escapeCalendarText(event.description)}`,
      `CATEGORIES:${event.categories.map(escapeCalendarText).join(",")}`,
      "END:VEVENT"
    ]),
    "END:VCALENDAR",
    ""
  ].join("\r\n");
}

function formatCalendarTimestamp(date) {
  return date.toISOString().replaceAll(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeCalendarText(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll(/\r?\n/g, "\\n");
}

function slugText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}
