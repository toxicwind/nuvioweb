// lg-fleet xtream engine — ported from homelessbrian/NuvioTV LiveTvRepository.kt
// webOS/JS rewrite, API-identical to the Kotlin original. Zero deps.

export const XTREAM_ACTIONS = {
  LIVE_CATS: "get_live_categories",
  LIVE_STREAMS: "get_live_streams",
  VOD_CATS: "get_vod_categories",
  VOD_STREAMS: "get_vod_streams",
  SERIES_CATS: "get_series_categories",
  SERIES: "get_series",
  VOD_INFO: "get_vod_info",
  SERIES_INFO: "get_series_info"
};

const ENC = (s) => encodeURIComponent(String(s ?? "").trim());

const DASH_RE = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g;
const INVIS_RE = /[\u200B-\u200D\u2060\uFEFF\u00A0\s]/g;

export function tidyLink(raw) {
  return String(raw ?? "")
    .replace(DASH_RE, "-")
    .replace(INVIS_RE, "");
}

export function cleanXtreamServer(raw) {
  let s = tidyLink(raw).trim();
  s = s.replace(/\\/g, "/");
  s = s.replace(/^[a-z]+:\/\//i, "");
  s = s.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(s)) s = "http://" + s;
  return s;
}

export function xtreamApiUrl(server, user, pass) {
  return `${cleanXtreamServer(server)}/player_api.php?username=${ENC(user)}&password=${ENC(pass)}`;
}

export function xtreamEpgUrl(server, user, pass) {
  return `${cleanXtreamServer(server)}/xmltv.php?username=${ENC(user)}&password=${ENC(pass)}`;
}

export function xtreamPlaylistUrl(server, user, pass, output = "ts") {
  return `${cleanXtreamServer(server)}/get.php?username=${ENC(user)}&password=${ENC(pass)}&type=m3u_plus&output=${output}`;
}

// account check -> {user_info, server_info}; throws with reason on auth/expiry
export async function xtreamAccount(server, user, pass, fetchFn = fetch) {
  const res = await fetchFn(xtreamApiUrl(server, user, pass));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const info = await res.json();
  const ui = info.user_info;
  if (!ui) throw new Error("Not an Xtream API response");
  if (String(ui.auth) === "0") throw new Error("Login failed: check the username and password");
  const status = String(ui.status || "");
  if (status && status.toLowerCase() !== "active") throw new Error(`Account ${status}`);
  const exp = Number(ui.exp_date || 0);
  if (exp > 0 && exp * 1000 < Date.now())
    throw new Error(`Account expired on ${new Date(exp * 1000).toDateString()}`);
  return info;
}

// get a category map for an action
export async function xtreamCategories(apiBase, action, fetchFn = fetch) {
  const out = {};
  try {
    const res = await fetchFn(`${apiBase}&action=${action}`);
    const arr = await res.json();
    for (const c of Array.isArray(arr) ? arr : []) {
      if (c && c.category_id) out[String(c.category_id)] = String(c.category_name || "Other");
    }
  } catch {}
  return out;
}

// stream list — tolerates BOTH array and keyed-object panels (keyed: {"0": {...}})
export async function* xtreamStreams(apiBase, action, fetchFn = fetch) {
  const res = await fetchFn(`${apiBase}&action=${action}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (Array.isArray(body)) {
    for (const f of body) yield f;
    return;
  }
  if (body && typeof body === "object") {
    for (const k of Object.keys(body)) {
      if (body[k] && typeof body[k] === "object") yield body[k];
    }
  }
}

// build #EXTM3U from live streams, resolution-preferring per allowed formats
export async function buildXtreamM3U(
  server,
  user,
  pass,
  allowedFormats = new Set(),
  fetchFn = fetch
) {
  const api = xtreamApiUrl(server, user, pass);
  const cats = await xtreamCategories(api, XTREAM_ACTIONS.LIVE_CATS, fetchFn);
  const useHls = allowedFormats.size > 0 && !allowedFormats.has("ts") && allowedFormats.has("m3u8");
  const ext = useHls ? "m3u8" : "ts";
  const base = cleanXtreamServer(server);
  let out = "#EXTM3U\n";
  for await (const f of xtreamStreams(api, XTREAM_ACTIONS.LIVE_STREAMS, fetchFn)) {
    const name = f.name || f.num || "?";
    const id = f.stream_id;
    const logo = f.stream_icon || "";
    const cat = cats[String(f.category_id)] || f.category_name || "";
    out += `#EXTINF:-1 tvg-id=${id} tvg-name=${name} tvg-logo=${logo} group-title=${cat},${name}\n`;
    out += `${base}/${f.direct_source || "live"}/${ENC(user)}/${ENC(pass)}/${id}.${ext}\n`;
  }
  return out;
}
