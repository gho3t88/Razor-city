# Razor City consolidated tester release checklist

Status legend: source checked = implementation inspected, not a runtime pass. Added = new changes and regression assertions in this commit, CI/device result pending. Do not ship until required gates are green.

| Item | Source status / verification |
| --- | --- |
| #03 Switch covers Market | Added: map-only draggable launcher, edge snap, remembered placement, separate tap, hidden over sheets; tutorial-check exercises drag, reload, resize, tap, market. |
| #03/#08 repeat rewarded ads | Source checked: fresh native ad each request; per-ad earned flag, persisted reward; no game cooldown. Actual two completed consecutive ads on Android still required. |
| Reward scaling | Source checked: level-based 500/1000/2500/5000/10000 tiers; rewards-and-input unit test. |
| #04 home / Continue mismatch, privacy, new-game overwrite, defaults | Source checked for explicit default-name text, privacy placement, new-game confirmation; run start-screen-check and verify old-save upgrade. |
| #04 demand 71% vs 96 buyers and 64 stock | Added: demand index /100 and explanation; buyers and stock remain independent quantities. |
| #04 zero stock sell default | Added: independent buy/sell quantities, zero disabled sale, cap to owned stock and buyer capacity; region-market-check assertion. |
| #11 close week confirmation and dismissible report | Source checked: confirm before closing; fixed Continue footer, nextWeek before interstitial. Cancel/continue and save-relaunch test required. |
| #12 header Deals overlap | Existing layout-check covers header bounds and overlaps; execute on CI and Android. |
| #06 Android Back | Existing layout-check covers Escape and navigation; Android physical Back test required. |
| Android 15+ edge-to-edge/deprecated APIs | Source checked: EdgeToEdge.enable and safe-area styling; android-theme-check plus Android 15/16 gesture and 3-button navigation test required. |
| Inventory and guided Switch tutorial | Existing tutorial and region-market checks; full tutorial completion and replay on upgraded save required. |
| Combat report, recruiting, casualties, treatment, territory management, ambush, weapons, progression, regional prices, bulk deals, map movement | Existing feature implementations and test suites need full regression run and device smoke test; not certified here. |

## Release policy (applies to every update)

1. Add each new tester report and feature request to this checklist, with its regression test or manual verification steps, before creating a candidate. Retain previous entries.
2. The signed internal-test AAB workflow must pass the full reusable web regression workflow before Android packaging/signing. A failed or cancelled gate blocks the signed artifact. This does not prevent debug APKs from being built for troubleshooting.
3. Record the exact candidate commit, version name/code, successful CI and Android build links, and device-test evidence in the candidate record below (copy it for each release). Never carry a PASS forward from an earlier commit without re-running the applicable checks.
4. Keep manual device checks separate from automated passes. Test bundles can be distributed for verification; do not promote to Google Play production until all checklist items pass, signing and version are verified, and tester feedback has been reviewed. No automatic production upload is configured.

## Candidate record (copy per release)
- Commit SHA:
- Version name / code:
- Web checks run URL:
- Signed AAB run URL:
- Android device / OS / fresh vs upgrade:
- Tester feedback reviewed / open blockers:
- Release decision: HOLD until all required checks below pass.

## Release gates
- [ ] CI web checks green for exact candidate commit (unit tests, TypeScript build, Playwright).
- [ ] Android build and signed release AAB green; verify version and package before upload.
- [ ] Android upgrade install without clearing an existing save, and fresh install.
- [ ] Two consecutive rewarded ads credit displayed reward each, including after reload.
- [ ] Test Switch drag using actual touchscreen and rotation; check narrow portrait and landscape.
- [ ] Verify close-week cancel and continue, hardware Back, trade confirmation, all tutorial steps, and gameplay feature smoke tests.
- [ ] Verify Google Play console warnings on uploaded candidate and review test feedback before production.
