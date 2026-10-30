// lg-fleet M3U/M3U8 parser — ported from homelessbrian/NuvioTV M3uParser.kt
// Handles tvg-id/name/logo, group-title, tvg-chno, catchup*, #EXTGRP, #EXTVLCOPT,
// #EXTHTTP, Kodi #KODIPROP headers/DRM, and stream_headers. Zero deps.

const ATTR_RE = /([A-Za-z0-9_\-]+)\s*=\s*"([^"]*)"/g;
const ATTR_UNQ_RE = /([A-Za-z0-9_\-]+)\s*=\s*([^\s",]+)/g;

export class M3uEntry {
  constructor({
    name = "",
    tvgId = null,
    tvgName = null,
    logo = null,
    group = null,
    chno = null,
    url = "",
    headers = {},
    catchup = null,
    drm = null
  } = {}) {
    this.name = name;
    this.tvgId = tvgId;
    this.tvgName = tvgName;
    this.logo = logo;
    this.group = group;
    this.chno = chno;
    this.url = url;
    this.headers = headers;
    this.catchup = catchup;
    this.drm = drm;
  }
}

export class M3uPlaylist {
  constructor(epgUrls = [], entries = []) {
    this.epgUrls = epgUrls;
    this.entries = entries;
  }
}

export class CatchupInfo {
  constructor({ type = "default", source = null, days = 1, correctionHours = 0 } = {}) {
    this.type = type;
    this.source = source;
    this.days = days;
    this.correctionHours = correctionHours;
  }
}

export class DrmInfo {
  constructor({ scheme = null, license = null, licenseHeaders = {}, manifestType = null } = {}) {
    this.scheme = scheme;
    this.license = license;
    this.licenseHeaders = licenseHeaders;
    this.manifestType = manifestType;
  }
}

function normalizeHeader(key) {
  const k = String(key).toLowerCase();
  if (k === "user-agent") return "User-Agent";
  if (k === "referer" || k === "referrer") return "Referer";
  if (k === "origin") return "Origin";
  if (k === "cookie") return "Cookie";
  return key;
}

function attributes(line) {
  const map = {};
  let m;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(line))) map[String(m[1]).toLowerCase()] = m[2];
  ATTR_UNQ_RE.lastIndex = 0;
  while ((m = ATTR_UNQ_RE.exec(line))) {
    const key = String(m[1]).toLowerCase();
    if (!(key in map) && key !== "extinf") map[key] = m[2];
  }
  return map;
}

function displayName(info) {
  let inQuotes = false;
  for (let i = 0; i < info.length; i++) {
    const c = info[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === "," && !inQuotes) return info.substring(i + 1).trim();
  }
  return "";
}

export function parse(text) {
  const epgUrls = [];
  const entries = [];

  let pendingInfo = null;
  let pendingGroup = null;
  const pendingHeaders = {};
  const pendingProps = {};
  const headerCatchup = {};

  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim().replace(/^\uFEFF/, "");
    if (!line) continue;

    if (line.startsWith("#EXTM3U") || line.startsWith("#extm3u")) {
      const attrs = attributes(line);
      const catchupKeys = [
        "catchup",
        "catchup-type",
        "catchup-source",
        "catchup-days",
        "catchup-correction",
        "tvg-rec",
        "timeshift"
      ];
      for (const k of catchupKeys) {
        if (attrs[k] && attrs[k].trim()) headerCatchup[k] = attrs[k];
      }
      const epgKeys = ["url-tvg", "x-tvg-url", "tvg-url"];
      for (const key of epgKeys) {
        const v = attrs[key];
        if (v) {
          for (const u of v.split(",")) {
            const trimmed = u.trim();
            if (trimmed.startsWith("http")) epgUrls.push(trimmed);
          }
        }
      }
      continue;
    }

    if (line.startsWith("#EXTINF") || line.startsWith("#extinf")) {
      pendingInfo = line;
      pendingGroup = null;
      continue;
    }

    if (line.startsWith("#EXTGRP:") || line.startsWith("#extgrp:")) {
      pendingGroup = line.substring(line.indexOf(":") + 1).trim() || null;
      continue;
    }

    if (line.startsWith("#EXTVLCOPT:") || line.startsWith("#extvlcopt:")) {
      const opt = line.substring(line.indexOf(":") + 1);
      const eq = opt.indexOf("=");
      const key = opt.substring(0, eq).trim().toLowerCase();
      const value = eq >= 0 ? opt.substring(eq + 1).trim() : "";
      if (key === "http-user-agent") pendingHeaders["User-Agent"] = value;
      else if (key === "http-referrer" || key === "http-referer") pendingHeaders["Referer"] = value;
      else if (key === "http-origin") pendingHeaders["Origin"] = value;
      continue;
    }

    if (line.startsWith("#EXTHTTP:") || line.startsWith("#exthttp:")) {
      try {
        const o = JSON.parse(line.substring(line.indexOf(":") + 1));
        for (const k of Object.keys(o)) pendingHeaders[normalizeHeader(k)] = String(o[k]);
      } catch {}
      continue;
    }

    if (line.startsWith("#KODIPROP:") || line.startsWith("#kodiprop:")) {
      const prop = line.substring(line.indexOf(":") + 1);
      const eq = prop.indexOf("=");
      const key = prop
        .substring(0, eq)
        .trim()
        .toLowerCase()
        .replace(/^inputstream\.adaptive\./, "")
        .replace(/^inputstream\./, "");
      pendingProps[key] = eq >= 0 ? prop.substring(eq + 1).trim() : "";
      continue;
    }

    if (line.startsWith("#")) continue;

    // URL line
    if (pendingInfo !== null) {
      const streamKeys = ["stream_headers", "manifest_headers", "common_headers"];
      for (const key of streamKeys) {
        const v = pendingProps[key];
        if (v && v.trim()) {
          for (const part of v.split("&")) {
            const k = part.substring(0, part.indexOf("=")).trim();
            if (k) {
              const afterEq = part.indexOf("=") >= 0 ? part.substring(part.indexOf("=") + 1) : "";
              try {
                pendingHeaders[normalizeHeader(k)] = decodeURIComponent(afterEq);
              } catch {
                pendingHeaders[normalizeHeader(k)] = afterEq;
              }
            }
          }
        }
      }

      const playlistCatchup = { ...headerCatchup, ...attributes(pendingInfo) };

      const name = displayName(pendingInfo) || playlistCatchup["tvg-name"] || "" || "Channel";

      const headers = { ...pendingHeaders };
      let url = line;
      const pipe = line.indexOf("|");
      if (pipe > 0) {
        url = line.substring(0, pipe);
        const tail = line.substring(pipe + 1);
        for (const part of tail.split("&")) {
          const eq = part.indexOf("=");
          const k = part.substring(0, eq).trim();
          let v = eq >= 0 ? part.substring(eq + 1) : "";
          try {
            v = decodeURIComponent(v);
          } catch {}
          if (k) headers[normalizeHeader(k)] = v;
        }
      }
      if (playlistCatchup["user-agent"]) headers["User-Agent"] = playlistCatchup["user-agent"];
      if (playlistCatchup["http-user-agent"])
        headers["User-Agent"] = playlistCatchup["http-user-agent"];
      if (playlistCatchup["http-referrer"] || playlistCatchup["http-referer"])
        headers["Referer"] = playlistCatchup["http-referrer"] || playlistCatchup["http-referer"];

      const catchupType = playlistCatchup["catchup"] || playlistCatchup["catchup-type"];
      const catchupDaysRaw =
        playlistCatchup["catchup-days"] ||
        playlistCatchup["tvg-rec"] ||
        playlistCatchup["timeshift"];
      const catchupDays = catchupDaysRaw ? parseInt(catchupDaysRaw, 10) || 0 : 0;
      const catchup =
        catchupType != null || catchupDays > 0
          ? new CatchupInfo({
              type: (catchupType || "default").toLowerCase(),
              source: playlistCatchup["catchup-source"] || null,
              days: catchupDays || 1,
              correctionHours: playlistCatchup["catchup-correction"]
                ? parseFloat(String(playlistCatchup["catchup-correction"]).replace(",", ".")) || 0.0
                : 0.0
            })
          : null;

      entries.push(
        new M3uEntry({
          name: name.trim(),
          tvgId: playlistCatchup["tvg-id"] ? playlistCatchup["tvg-id"].trim() || null : null,
          tvgName: playlistCatchup["tvg-name"] ? playlistCatchup["tvg-name"].trim() || null : null,
          logo: (playlistCatchup["tvg-logo"] || playlistCatchup["logo"] || "").trim() || null,
          group:
            playlistCatchup["group-title"] || null || pendingGroup || null
              ? (playlistCatchup["group-title"] || pendingGroup || null).split(";")[0].trim() ||
                null
              : null,
          chno:
            playlistCatchup["tvg-chno"] ||
            playlistCatchup["channel-number"] ||
            playlistCatchup["tvg-num"] ||
            ""
              ? parseInt(
                  (
                    playlistCatchup["tvg-chno"] ||
                    playlistCatchup["channel-number"] ||
                    playlistCatchup["tvg-num"]
                  ).trim(),
                  10
                ) || null
              : null,
          url: url.trim(),
          headers,
          catchup,
          drm: drmFrom(pendingProps)
        })
      );

      pendingInfo = null;
      pendingGroup = null;
      Object.keys(pendingHeaders).forEach((k) => delete pendingHeaders[k]);
      Object.keys(pendingProps).forEach((k) => delete pendingProps[k]);
    }
  }

  return new M3uPlaylist([...new Set(epgUrls)], entries);
}

function drmFrom(props) {
  const type = props["license_type"] || props["drm"] || "";
  const t = String(type).toLowerCase();
  let scheme;
  if (/clearkey|org\.w3/.test(t)) scheme = "clearkey";
  else if (/widevine/.test(t)) scheme = "widevine";
  else if (/playready/.test(t)) scheme = "playready";
  else return null;

  const raw = props["license_key"] || "";
  const parts = String(raw).split("|");
  const license = (parts[0] || "").trim();
  const headers = {};
  const p1 = parts[1];
  if (p1 && p1.includes("=")) {
    for (const h of p1.split("&")) {
      const eq = h.indexOf("=");
      const k = h.substring(0, eq).trim();
      let v = eq >= 0 ? h.substring(eq + 1) : "";
      try {
        v = decodeURIComponent(v);
      } catch {}
      if (k) headers[normalizeHeader(k)] = v;
    }
  }
  const lh = props["license_headers"];
  if (lh && lh.trim()) {
    for (const h of lh.split("&")) {
      const eq = h.indexOf("=");
      const k = h.substring(0, eq).trim();
      let v = eq >= 0 ? h.substring(eq + 1) : "";
      try {
        v = decodeURIComponent(v);
      } catch {}
      if (k) headers[normalizeHeader(k)] = v;
    }
  }
  if (!license && scheme !== "clearkey") return null;
  return new DrmInfo({
    scheme,
    license: scheme === "clearkey" ? raw.trim() : license,
    licenseHeaders: headers,
    manifestType: props["manifest_type"] ? String(props["manifest_type"]).toLowerCase() : null
  });
}
