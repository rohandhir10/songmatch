import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../src/theme";

// Web: app/page.tsx (default create-next-app template, no SongMatch UI)
// App: real entry — onboarding to scan → matches → karaoke
export default function Home() {
  return (
    <View style={s.root}>
      <Text style={s.logo}>
        song<Text style={s.accent}>match</Text>
      </Text>
      <Text style={s.title}>Sing what suits your voice.</Text>
      <Text style={s.sub}>
        Scan your range, get matched songs, then perform them in karaoke mode.
      </Text>
      <Link href="/scan" style={s.cta}>
        <Text style={s.ctaText}>Start voice scan →</Text>
      </Link>
      <Link href="/matches" style={s.ghost}>
        <Text style={s.ghostText}>View my matches</Text>
      </Link>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: theme.bg },
  logo: { fontSize: 28, fontWeight: "900", color: theme.text, letterSpacing: -1 },
  accent: { color: theme.accent },
  title: { marginTop: 16, fontSize: 40, fontWeight: "900", color: theme.text, letterSpacing: -2 },
  sub: { marginTop: 12, fontSize: 16, lineHeight: 24, color: theme.muted },
  cta: { marginTop: 28, backgroundColor: theme.accent, borderRadius: 16, padding: 18, alignItems: "center" },
  ctaText: { color: "#000", fontWeight: "900", fontSize: 17 },
  ghost: { marginTop: 12, borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 16, alignItems: "center" },
  ghostText: { color: theme.text, fontWeight: "700" },
});
