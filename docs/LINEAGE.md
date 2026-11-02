# Nuvio/webOS lineage — main head + satellite map (2026-11-02, tau max-plan 5.23)

**Verdict (2026-11-02 evening, reconciled with tau-maximal-audit ground
truth): the WORKING fork / main head is `nuvio-default`** — the TV is ALIVE
(webOS 4.4.84, hbchannel/inputhook) and its installed bundle (Nov 1 04:48-05:07
update, modern esbuild from the nuvio-default dev-server pipeline) matches
`nuvio-default/webos-app/appinfo.json` (id `space.nuvio.webos`, v1.2.10,
vendor "Nuvio Media"). `nuviotv-webos` remains the merged-engine reference fork
and carries the NuvioTV Xtream/EPG/catch-up engine; treat it as the engine
LINEAGE source, not the deployed artifact.

## Main head

| Field       | Value                                                                    |
| ----------- | ------------------------------------------------------------------------ |
| Product dir | `pens/ranch/products/nuvio-default` (deployed; engine lineage here)      |
| Remote      | `github.com/toxicwind/nuvio-webos-lg.git`                                |
| appinfo     | `space.nuvio.webos`, version 1.2.10, type `web`                          |
| Evidence    | TV alive (webOS 4.4.84); installed bundle matches appinfo (Nov 1 update) |
| Engine ref  | `nuviotv-webos` carries the ported NuvioTV Xtream (M3U/XMLTV/catch-up)   |

## Satellite forks (NOT heads)

| Dir                     | Remote                                        | Role                                                               |
| ----------------------- | --------------------------------------------- | ------------------------------------------------------------------ |
| `homelessbrian-NuvioTV` | `github.com/homelessbrian/NuvioTV`            | Upstream original (read-only).                                     |
| `nuvio-default`         | `github.com/toxicwind/nuvio-webos-lg.git`     | **Android** NuvioTV app (gradle, libmpv, DV7) — separate platform. |
| `nuviotv-bun`           | `github.com/toxicwind/nuviotv-bun.git`        | Bun backend (multi-M3U/EPG TiviMate guide services).               |
| `NuvioTVSmart`          | `github.com/toxicwind/NuvioTVSmart.git`       | Smart-TV variant (state sync only, no unique work vs main).        |
| `NuvioTVWebOS`          | `github.com/toxicwind/NuvioTVWebOS`           | Early webOS experiment (eidos scaffold, no engine).                |
| `nuvioweb`              | `github.com/toxicwind/nuvioweb.git`           | Scaffold (eidos state sync).                                       |
| `nuvio`                 | `github.com/toxicwind/nuvio.git`              | Scaffold (eidos state sync).                                       |
| `kerloys-iptv-webos`    | `github.com/toxicwind/kerloys-iptv-webos.git` | Feature source: xtream engine port (already merged to main).       |
| `IPTV-BRIDGE`           | `github.com/toxicwind/IPTV-BRIDGE.git`        | Feature source: addon bridge (merge candidate next).               |

## Lineage notes

- The `aether → slate` rename (com.toxicwind.slate_1.1.0_all.ipk) referenced in
  earlier plans is **not present as a product checkout** today; the live webOS
  identity is `space.nuvio.webos` v1.2.10. If the slate ipk exists it was built
  from this tree's predecessor — verify against the installed TV app id before
  claiming parity.
- Phase 5.24 (rename "streamers" → 10 options) is a **naming decision for the
  architect** — not a code task. The webOS head keeps `space.nuvio.webos`.
- Phase 5.25 merge tail: `IPTV-BRIDGE` addon + any surviving fork feature not in
  `ca8f556f` — audit diff against main before merging (weave/suture), lose nothing.

## Phase 5.25 merge verdict (2026-11-02) — ALREADY COMPLETE, no tail

Audited the main head (`nuviotv-webos`, `space.nuvio.webos` v1.2.10) against
every fork feature source:

- **Xtream/EPG/catch-up** — resident (`js/data/xtream/` 5 files:
  xtreamEngine, m3uParser, xmltvParser, catchupUrlBuilder, index) + merged set.
- **Subtitles** — main has a 218+ file native stack (ASS renderer, SRT/VTT
  sniffing, bitmap subtitle decoder with WASM, AVPlay/Luna track selection) —
  SUPERSET of kerloys' `src/services/subtitles` (srtToVtt/vttParser). No port.
- **Streams/debrid/p2p/party/trakt/tmdb/cloud/sync** — main services surface
  far richer than any fork.
- **kerloys-iptv-webos** — React/Vite UI shell (`com.kerloy.iptv_1.0.0_all.ipk`);
  its data services (epg/m3u/search) duplicate main; only the UI framework is
  distinct, and merging a second UI stack into the vanilla-JS app would create
  a dual-architecture mess. No merge — documented as superseded.
- **IPTV-BRIDGE** (`ip-stream-addon`) — Stremio/Nuvio ADDON BACKEND (src/api,
  src/iptv, src/tmdb), not TV-app UI. Complementary server component; stays a
  standalone repo and is consumed via the app's addon surface, not merged.

**Nothing to weave/suture.** Main head carries every fork feature as a superset.
The remaining work is not code — it is product naming (Phase 5.24, architect's
decision) and on-TV verification (Phase 5.35: ares-cli deploy + Pixel UI check).
