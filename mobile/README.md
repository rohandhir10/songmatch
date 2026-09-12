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

Mic permissions are pre-declared in `app.json`
(`NSMicrophoneUsageDescription` / `RECORD_AUDIO`).

## Next native work (in order)

1. Pitch frame processor (dev client module or WAV-chunk `detectPitch()` in JS) to replace the dev-demo profile path in `scan.tsx`
2. Backing tracks + synced lyrics + scoring in `karaoke/[songId].tsx`
3. Move `songs` to API + add search/filter, favorites, history
4. Icons/splash, EAS Build, TestFlight + Play internal track
