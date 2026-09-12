import { Link, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View, Alert } from "react-native";
import { songs } from "../../src/lib/songs";
import { theme } from "../../src/theme";

// Web: app/karaoke/[songId]/page.tsx — static C4 + fake progress + alert button
// App skeleton: same placeholder honestly marked; live pitch + backing + lyrics
// are the native build-out (see TODOs).
export default function Karaoke() {
  const { songId } = useLocalSearchParams<{ songId: string }>();
  const song = songs.find((s) => s.id === songId);

  if (!song) {
    return (
      <View style={s.root}>
        <Link href="/matches">
          <Text style={s.back}>← Matches</Text>
        </Link>
        <Text style={s.title}>Song not found.</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <Link href="/matches">
        <Text style={s.back}>← Matches</Text>
      </Link>
      <Text style={s.kicker}>Karaoke</Text>
      <Text style={s.title}>{song.title}</Text>
      <Text style={s.artist}>{song.artist}</Text>

      <View style={s.stage}>
        <Text style={s.live}>Live pitch</Text>
        <Text style={s.note}>C4</Text>
        <Text style={s.hint}>TODO: wire native pitch engine here (same blocker as Scan).</Text>
        <Text style={s.hint}>TODO: licensed backing track + synced lyrics + scoring.</Text>
      </View>

      <TouchableOpacity
        style={s.cta}
        onPress={() => Alert.alert("Next", "Mic pitch → this screen, then backing tracks + lyrics.")}
      >
        <Text style={s.ctaText}>Start performance</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 24, paddingTop: 64, backgroundColor: theme.bg },
  back: { color: theme.muted, marginBottom: 24 },
  kicker: { color: theme.accent, fontWeight: "800", fontSize: 12, letterSpacing: 2, textAlign: "center" },
  title: { fontSize: 36, fontWeight: "900", color: theme.text, textAlign: "center", marginTop: 8 },
  artist: { color: theme.muted, textAlign: "center", marginTop: 6 },
  stage: { marginTop: 24, borderWidth: 1, borderColor: theme.border, borderRadius: 24, padding: 32, alignItems: "center" },
  live: { color: theme.faint, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  note: { fontSize: 72, fontWeight: "900", color: theme.accent, marginTop: 12 },
  hint: { marginTop: 8, color: theme.faint, fontSize: 12, textAlign: "center" },
  cta: { marginTop: 20, backgroundColor: theme.accent, borderRadius: 16, padding: 18, alignItems: "center" },
  ctaText: { color: "#000", fontWeight: "900", fontSize: 16 },
});
