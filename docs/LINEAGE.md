# Nuvio/webOS lineage — main head + satellite map (2026-11-02, tau max-plan 5.23)

**Verdict: `nuviotv-webos` (`NuvioWeb`, app id `space.nuvio.webos`, v1.2.10) is
the WORKING fork and the main head for webOS.** It already carries the merged
NuvioTV Xtream/EPG/catch-up engine that the merge phase wanted.

## Main head

| Field       | Value                                                             |
| ----------- | ----------------------------------------------------------------- |
| Product dir | `pens/ranch/products/nuviotv-webos`                               |
| Remote      | `github.com/toxicwind/NuvioWeb.git`                               |
| appinfo     | `space.nuvio.webos`, version 1.2.10, type `web`                   |
| HEAD        | `cadd294f` (merge of origin/main)                                 |
| Engine      | Ported NuvioTV Xtream (M3U/XMLTV/catch-up) merged into webOS main |

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
