// lg-fleet XMLTV/EPG parser — ported from homelessbrian/NuvioTV XmltvParser.kt
// DOM-based (no XmlPullParser on webOS). Keeps Kotlin semantics:
//  - time-window filtering, channel filtering, unlisted keep-callback
//  - forgiving parse (keeps everything read up to a break)
//  - programme sorted by startMs, title/desc/episode/year extraction
// Zero deps.

export class XmltvChannel {
  constructor(id, displayNames = [], icon = null) {
    this.id = id;
    this.displayNames = displayNames;
    this.icon = icon;
  }
}

export class EpgProgram {
  constructor({ startMs, stopMs, title = 'No information', description = null,
    category = null, episode = null, icon = null, year = null, people = [] } = {}) {
    this.startMs = startMs;
    this.stopMs = stopMs;
    this.title = title;
    this.description = description;
    this.category = category;
    this.episode = episode;
    this.icon = icon;
    this.year = year;
    this.people = people;
  }
}

export class XmltvResult {
  constructor(channels = {}, programs = {}, error = null, programChannelIds = new Set()) {
    this.channels = channels;      // Map id -> XmltvChannel
    this.programs = programs;      // Map id -> EpgProgram[] sorted by startMs
    this.error = error;            // null or partial-break message
    this.programChannelIds = programChannelIds;
  }
}

const YEAR_IN_PARENS = /\((19\d{2}|20\d{2})\)/;
const DIGITS_ONLY_ID = /^\d{5,}$/;

function parseTime(value) {
  if (!value) return null;
  const v = String(value).trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?([+-]\d{2}:?\d{2})?$/);
  if (!m) return null;
  const [, year, month, day, hour, minute, second, offset] = m;
  const mo = parseInt(month, 10);
  const d = parseInt(day, 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const ms = Date.UTC(parseInt(year, 10), mo - 1, d, parseInt(hour, 10), parseInt(minute, 10), parseInt(second || '0', 10));
  if (offset) {
    const sign = offset[0] === '-' ? -1 : 1;
    const oh = parseInt(offset.substring(1, 3), 10) || 0;
    const om = parseInt(offset.substring(3, 5), 10) || 0;
    return ms - sign * (oh * 3600000 + om * 60000);
  }
  return ms;
}

function cleanEpisode(raw) {
  if (!raw) return null;
  const t = String(raw).trim();
  if (!t || t.length > 24) return null;
  const letters = (t.match(/[a-zA-Z]/g) || []).length;
  const digits = (t.match(/\d/g) || []).length;
  if (digits === 0) return t;
  if (letters === 0 && digits > 4) return null;
  if (/\d{5,}/.test(t)) return null;
  const s = t.match(/\bS(?:eason)?\s*(\d+)/i);
  if (s) { const n = parseInt(s[1], 10); if (n >= 100) return null; }
  return t;
}

function yearIn(text) {
  if (!text) return null;
  const m = YEAR_IN_PARENS.exec(text);
  return m ? parseInt(m[1], 10) : null;
}

// Parse an XMLTV document from a string. Returns XmltvResult.
// keepUnlisted: (channelId) => boolean for guides with no channel list.
// selectChannels: (channels Map) => Set<String> of wanted channel ids.
// windowStartMs / windowEndMs: time window for programmes.
export function parse(xmlText, {
  keepUnlisted = null,
  selectChannels = () => null,
  windowStartMs = 0,
  windowEndMs = Number.MAX_SAFE_INTEGER,
} = {}) {
  const channels = {};
  const programs = {};
  const programChannelIds = new Set();
  let error = null;

  let doc;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(xmlText, 'application/xml');
  } catch (e) {
    return new XmltvResult({}, {}, `parse failed: ${String(e.message || e).slice(0, 140)}`, programChannelIds);
  }

  // Forgiving: if document is malformed, DOMParser may still return partial.
  const root = doc.documentElement;
  if (!root || root.tagName !== 'tv') {
    return new XmltvResult({}, {}, 'no tv root element', programChannelIds);
  }

  // Parse parsererror node if DOMParser surfaced one (still keeps partial)
  const perr = root.querySelector ? root.querySelector('parsererror') : null;
  if (perr) {
    error = 'partial parse: ' + (perr.textContent || '').slice(0, 140);
  }

  const channelEls = root.querySelectorAll ? root.querySelectorAll('channel') : [];
  for (const el of channelEls) {
    const id = el.getAttribute('id');
    if (!id) continue;
    const names = [];
    const nameEls = el.querySelectorAll ? el.querySelectorAll('display-name') : [];
    for (const ne of nameEls) {
      const t = (ne.textContent || '').trim();
      if (t) names.push(t);
    }
    const iconEl = el.querySelector ? el.querySelector('icon') : null;
    const icon = iconEl ? iconEl.getAttribute('src') : null;
    channels[id] = new XmltvChannel(id, names, icon);
  }

  const wanted = selectChannels(channels);
  const wantedResolved = wanted !== null;

  const programmeEls = root.querySelectorAll ? root.querySelectorAll('programme') : [];
  for (const el of programmeEls) {
    const channelId = el.getAttribute('channel');
    if (channelId) programChannelIds.add(channelId);

    let keep;
    if (channelId == null) keep = true;
    else if (wanted != null) keep = wanted.has(channelId);
    else if (keepUnlisted != null) {
      keep = keepUnlisted(channelId);
    } else keep = true;

    if (!keep) continue;

    const start = parseTime(el.getAttribute('start'));
    const stop = parseTime(el.getAttribute('stop'));
    if (start == null || stop == null || stop <= windowStartMs || start >= windowEndMs) continue;

    // read first occurrence of each child (Kotlin semantics)
    let title = null, subTitle = null, desc = null, category = null, episode = null;
    let icon = null, date = null, people = [];

    const children = el.children || el.childNodes || [];
    for (const ch of children) {
      if (ch.nodeType !== 1) continue;
      const name = ch.tagName;
      if (name === 'title' && title == null) title = (ch.textContent || '').trim();
      else if (name === 'sub-title' && subTitle == null) subTitle = (ch.textContent || '').trim();
      else if (name === 'desc' && desc == null) desc = (ch.textContent || '').trim();
      else if (name === 'category' && category == null) category = (ch.textContent || '').trim();
      else if (name === 'icon' && icon == null) icon = ch.getAttribute('src');
      else if (name === 'date' && date == null) date = (ch.textContent || '').trim();
      else if (name === 'episode-num') {
        const system = ch.getAttribute('system');
        const t = (ch.textContent || '').trim();
        if (system === 'xmltv_ns' || episode == null) {
          episode = formatEpisode(system, t);
        }
      } else if (name === 'credits') {
        const credEls = ch.querySelectorAll ? ch.querySelectorAll('actor, director') : [];
        for (const ce of credEls) {
          const t = (ce.textContent || '').trim();
          if (t) people.push(t);
        }
      }
    }

    const ep = cleanEpisode(episode);
    const year = (date && date.trim().length === 4)
      ? (parseInt(date.trim(), 10) || null)
      : (yearIn(title) || yearIn(desc));
    if (year && (year < 1900 || year > 2100)) year = null;

    const fullDescParts = [];
    if (subTitle) fullDescParts.push(subTitle);
    if (desc) fullDescParts.push(desc);
    let fullDesc = fullDescParts.join('\n') || null;
    if (fullDesc && fullDesc.length > 800) fullDesc = fullDesc.slice(0, 800).trimEnd() + '…';

    const progTitle = (title || 'No information').trim();
    const safeTitle = progTitle.length <= 80 ? progTitle : progTitle;

    const prog = new EpgProgram({
      startMs: start,
      stopMs: stop,
      title: safeTitle || 'No information',
      description: fullDesc,
      category: category ? category.trim() : null,
      episode: ep,
      icon,
      year,
      people: people.slice(0, 12),
    });

    if (!programs[channelId]) programs[channelId] = [];
    programs[channelId].push(prog);
  }

  // sort each channel's programmes by startMs
  for (const id of Object.keys(programs)) {
    programs[id].sort((a, b) => a.startMs - b.startMs);
  }

  return new XmltvResult(channels, programs, error, programChannelIds);
}

function formatEpisode(system, raw) {
  const text = (raw || '').trim();
  if (!text) return null;
  if (system === 'xmltv_ns') {
    const parts = text.split('.');
    const season = parts[0] ? parseInt(parts[0].split('/')[0].trim(), 10) : null;
    const ep = parts[1] ? parseInt(parts[1].split('/')[0].trim(), 10) : null;
    if (season != null && season >= 100) return null;
    if (season != null && ep != null) return `S${season + 1} E${ep + 1}`;
    if (ep != null) return `E${ep + 1}`;
    return null;
  }
  if (system != null && system !== 'onscreen') return null;
  return cleanEpisode(text);
}

// String.prototype.substringBefore polyfill-free inline above (used season parse).
