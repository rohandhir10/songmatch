import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { songs } from "../src/lib/songs";
import { matchSongs, type SongMatch } from "../src/lib/matching";
import { midiToNote, type VocalProfile } from "../src/lib/pitch";
import { PROFILE_KEY, theme } from "../src/theme";

// Web: app/matches/page.tsx — reads localStorage:songmatch-profile, matchSongs(), cards
// App: same logic, AsyncStorage instead of localStorage, MIDI shown as note names
export default function Matches() {
  const [profile, setProfile] = useState<VocalProfile | null>(null);
  const [matches, setMatches] = useState<SongMatch[]>([]);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(PROFILE_KEY);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as VocalProfile;
        setProfile(parsed);
        setMatches(matchSongs(parsed, songs));
      } catch {
        await AsyncStorage.removeItem(PROFILE_KEY);
      }
    })();
  }, []);

  if (!profile) {
    return (
      <View style={s.root}>
        <Text style={s.title}>We need your voice first.</Text>
        <Text style={s.sub}>Scan your voice before we recommend songs.</Text>
        <Link href="/scan" style={s.cta}>
          <Text style={s.ctaText}>Scan my voice →</Text>
        </Link>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <Text style={s.kicker}>Your matches</Text>
      <Text style={s.title}>Songs made for your voice.</Text>
      <Text style={s.sub}>
        {profile.voiceType} · {profile.lowNote}–{profile.highNote}
      </Text>
      <FlatList
        data={matches}
        keyExtractor={(m) => m.song.id}
        contentContainerStyle={{ gap: 12, paddingBottom: 40 }}
        renderItem={({ item: m }) => (
          <View style={s.card}>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.song}>{m.song.title}</Text>
                <Text style={s.artist}>{m.song.artist}</Text>
              </View>
              <Text style={s.score}>{m.score}%</Text>
            </View>
            <Text style={s.tags}>
              Key {m.song.key} · {m.song.difficulty} ·{" "}
              {midiToNote(m.song.vocalLowMidi)}–{midiToNote(m.song.vocalHighMidi)}
              {m.recommendedTranspose !== 0
                ? ` · ${m.recommendedTranspose > 0 ? "+" : ""}${m.recommendedTranspose} st`
                : ""}
            </Text>
            <Text style={s.explain}>{m.explanation}</Text>
            <Link href={`/karaoke/${m.song.id}`} style={s.sing}>
              <Text style={s.ctaText}>Sing this song →</Text>
            </Link>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 24, paddingTop: 64, backgroundColor: theme.bg },
  kicker: { color: theme.accent, fontWeight: "800", fontSize: 12, letterSpacing: 2 },
  title: { marginTop: 8, fontSize: 32, fontWeight: "900", color: theme.text },
  sub: { marginTop: 8, color: theme.muted, marginBottom: 16 },
  card: { borderWidth: 1, borderColor: theme.border, borderRadius: 20, padding: 16, backgroundColor: theme.card },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  song: { fontSize: 18, fontWeight: "900", color: theme.text },
  artist: { color: theme.muted, marginTop: 2 },
  score: { fontSize: 22, fontWeight: "900", color: theme.accent },
  tags: { marginTop: 10, color: theme.muted, fontSize: 12 },
  explain: { marginTop: 8, color: theme.muted, fontSize: 13, lineHeight: 19 },
  cta: { marginTop: 20, backgroundColor: theme.accent, borderRadius: 14, padding: 16, alignItems: "center" },
  sing: { marginTop: 12, backgroundColor: theme.accent, borderRadius: 12, padding: 12, alignItems: "center" },
  ctaText: { color: "#000", fontWeight: "900" },
});
