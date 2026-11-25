# Audio update verification
Original procedural composition and sound effects generated from code, rather than prerecorded assets. No external service or licensed samples. Four looping instrumental patterns, filtered city ambience, fifteen event categories with randomized pitch/noise variations. Audio starts only after an interaction; visibility changes suspend or resume it. Four persistent independent volume settings and existing master mute.
## Device acceptance checklist
- [ ] Fresh launch: first tap unlocks music, buttons audible on Android.
- [ ] Continue an existing game; audio works and save is unchanged.
- [ ] Check market, travel, combat, victory, loss, territory, recruitment, deals, close week and ad reward.
- [ ] Check music transition menu/street/combat/territory.
- [ ] Set each slider to 0 and 100; test independent mix, mute, unmute and restart persistence.
- [ ] Background/foreground, lock/unlock and return from ad; no doubled loops or stuck audio.
- [ ] Confirm heading reads The Tape.
- [ ] Run npm test and npm run build, then build and install Android bundle.
