# SongMatch Mobile (Expo — iOS + Android)

Native shell for SongMatch. Pure logic is shared by copy from web (`src/lib/` mirrors `../lib/`).

## Web → App map

| Web (Next.js) | App (Expo Router) | Change |
|---|---|---|
| `app/page.tsx` (default template) | `app/index.tsx` | Rebuilt as real entry: scan → matches |
| `app/scan/page.tsx` | `app/scan.tsx` | `getUserMedia`+`AudioContext` → `expo-av` Recording + permissions; live PCM pitch still needs a native frame processor (see NOTE in file) |
| `app/matches/page.tsx` | `app/matches.tsx` | `localStorage` → AsyncStorage; MIDI ranges shown as note names via `midiToNote()` |
| `app/karaoke/[songId]/page.tsx` | `app/karaoke/[songId].tsx` | Still placeholder, honestly marked with TODOs |
| `app/layout.tsx` + `globals.css` | `app/_layout.tsx` + `src/theme.ts` | Stack nav + dark theme tokens |
| `lib/pitch.ts` | `src/lib/pitch.ts` | Direct copy — no DOM deps, runs on Hermes |
| `lib/matching.ts` | `src/lib/matching.ts` | Direct copy |
| `lib/songs.ts` | `src/lib/songs.ts` | Direct copy for now → move to API next |

> Sync rule: `src/lib/` mirrors `../lib/` by copy, EXCEPT relative imports
> must end in `.ts` in the mobile copies (Node strip-types test runner
> needs explicit extensions; Metro/Next resolve both, so web stays
> extensionless).

## Run

```bash
cd mobile
npm install
npx expo start
# iOS: npx expo run:ios | Android: npx expo run:android
```

> Deps: Expo SDK 52 pins carry 32 npm-audit findings (xmldom, postcss,
> node-tar — all build-time tooling via Expo CLI/Metro, none ships in the
> app binary). `npm audit fix` can't move them without breaking changes;
> clear them with an Expo SDK upgrade (`npx expo install expo@latest`)
> once there's a device to regression-test on.

Mic permissions are pre-declared in `app.json`
(`NSMicrophoneUsageDescription` / `RECORD_AUDIO`).

## Paywall (RevenueCat, no backend)

- Gating rules live in `src/lib/paywall.ts` (tested): first 8 shelf
  songs + Siren Glide free, everything else Pro.
- `src/lib/entitlements.ts` wraps `react-native-purchases` with
  anonymous IDs — no accounts server needed. Purchases need a dev
  client / EAS build (they do NOT work in Expo Go).
- `app/paywall.tsx` renders offerings, purchase + restore, and a
  `__DEV__` bypass. Until `SET-REVENUECAT-*-KEY` keys are added it
  runs dry and says so instead of crashing.

To go live: (1) create products in App Store Connect (`songmatch_pro_monthly`,
`songmatch_pro_yearly`) + Play Console, (2) add them to a RevenueCat
`pro` entitlement + offerings, (3) paste the two API keys into
`entitlements.ts`, (4) make a test purchase in sandbox first.
Enforcement points land with the mobile Popular + Train screens.

## Next native work (in order)

1. Pitch frame processor (dev client module or WAV-chunk `detectPitch()` in JS) to replace the dev-demo profile path in `scan.tsx`
2. Backing tracks + synced lyrics + scoring in `karaoke/[songId].tsx`
3. Move `songs` to API + add search/filter, favorites, history
4. Icons/splash, EAS Build, TestFlight + Play internal track
