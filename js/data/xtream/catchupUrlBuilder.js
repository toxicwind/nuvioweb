// lg-fleet catch-up URL builder — ported from homelessbrian/NuvioTV CatchupUrlBuilder.kt
// Builds archive (catch-up) URLs for default/append/shift/flussonic/xtream codes.
// Zero deps.

export class CatchupUrlBuilder {
  static isAvailable(catchup, programStartMs, nowMs = Date.now()) {
    if (!catchup) return false;
    if (programStartMs >= nowMs) return false;
    const maxAgeMs = Math.max(catchup.days || 1, 1) * 24 * 60 * 60 * 1000;
    return nowMs - programStartMs <= maxAgeMs;
  }

  static build({
    liveUrl,
    catchup,
    startMs,
    stopMs,
    nowMs = Date.now(),
    preferHls = false,
    serverTimezone = null
  }) {
    if (!catchup || !liveUrl) return null;

    // catchup-correction: playlist's own time fix for this channel, in hours -> ms
    const correctionMs = ((catchup.correctionHours || 0) * 3_600_000) | 0;
    const startMsC = startMs + correctionMs;
    const stopMsC = stopMs + correctionMs;
    const start = Math.floor(startMsC / 1000);
    const end = Math.floor(stopMsC / 1000);
    const now = Math.floor(nowMs / 1000);
    const duration = Math.max(end - start, 60);

    const type = (catchup.type || "default").toLowerCase();
    const source = catchup.source || "";

    switch (type) {
      case "default":
        return `${liveUrl}&start=${start}&end=${end}`;
      case "append": {
        const sep = liveUrl.includes("?") ? "&" : "?";
        return `${liveUrl}${sep}start=${start}&end=${end}`;
      }
      case "shift":
        return `${liveUrl}&start=${start}&end=${end}&duration=${duration}`;
      case "flussonic": {
        const sep = liveUrl.includes("?") ? "&" : "?";
        return `${liveUrl}${sep}start=${start}&end=${end}`;
      }
      case "xtream_codes":
      case "xtream": {
        // player_api.php?action=get_simple_data_stream&stream_id=...&start=...&end=...
        // or append start/end to the stream URL itself
        const sep = liveUrl.includes("?") ? "&" : "?";
        return `${liveUrl}${sep}start=${start}&end=${end}`;
      }
      default:
        // generic: append start/end query
        const sep = liveUrl.includes("?") ? "&" : "?";
        return `${liveUrl}${sep}start=${start}&end=${end}`;
    }
  }
}
