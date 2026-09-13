import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  HISTORY_KEY,
  bestBySong,
  dayStreak,
  type PerformanceEntry,
} from "../src/lib/history";
import { theme } from "../src/theme";

// Progress: streak, best takes, recent history from on-device storage.
export default function Progress() {
  const [history, setHistory] = useState<PerformanceEntry[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(HISTORY_KEY);
        if (raw) setHistory(JSON.parse(raw) as PerformanceEntry[]);
      } catch {
        // Empty state covers it.
      }
    })();
  }, []);

  const streak = dayStreak(history);
  const bests = [...bestBySong(history).values()]
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 5);

  return (
    <ScrollView style={s.root} contentContainerStyle={s.pad}>
      <Text style={s.logo}>
        song<Text style={s.accent}>match</Text>
      </Text>
      <Text style={s.title}>Your progress.</Text>
      <View style={s.card}>
        <Text style={s.big}>{streak}</Text>
        <Text style={s.muted}>
          day streak{streak === 1 ? "" : "s"} — sing or train daily to keep it
          alive.
        </Text>
      </View>

      <Text style={s.section}>Best takes</Text>
      {bests.length === 0 ? (
        <View style={s.card}>
          <Text style={s.muted}>
            Nothing scored yet. Train a drill or sing a song and it lands
            here.
          </Text>
        </View>
      ) : (
        bests.map((e) => (
          <View key={e.songId} style={s.row}>
            <View style={s.rowBody}>
              <Text style={s.rowTitle}>{e.songTitle}</Text>
              <Text style={s.muted}>
                Grade {e.grade}
                {e.level ? ` · ${e.level}` : ""}
              </Text>
            </View>
            <Text style={s.rowScore}>{e.accuracy}%</Text>
          </View>
        ))
      )}

      <Text style={s.section}>Recent</Text>
      {history.slice(0, 10).map((e, i) => (
        <View key={`${e.at}-${i}`} style={s.row}>
          <View style={s.rowBody}>
            <Text style={s.rowTitle}>{e.songTitle}</Text>
            <Text style={s.muted}>
              {new Date(e.at).toLocaleDateString()}
            </Text>
          </View>
          <Text style={s.rowScore}>{e.accuracy}%</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  pad: { padding: 24, paddingBottom: 48 },
  logo: { fontSize: 22, fontWeight: "900", color: theme.text },
  accent: { color: theme.accent },
  title: { marginTop: 12, fontSize: 36, fontWeight: "900", color: theme.text },
  muted: { marginTop: 4, fontSize: 14, lineHeight: 20, color: theme.muted },
  card: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 20,
    padding: 20,
  },
  big: { fontSize: 56, fontWeight: "900", color: theme.accent },
  section: {
    marginTop: 24,
    fontSize: 18,
    fontWeight: "900",
    color: theme.text,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    padding: 14,
  },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: "700", color: theme.text },
  rowScore: {
    fontSize: 20,
    fontWeight: "900",
    color: theme.accent,
  },
});
