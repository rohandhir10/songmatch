import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  HISTORY_KEY,
  type PerformanceEntry,
} from "../src/lib/history";
import {
  LIBRARY,
} from "../src/lib/learnContent";
import {
  PLANS,
  lessonStatus,
  planProgress,
  planStartsKey,
  type Plan,
} from "../src/lib/curriculum";
import { theme } from "../src/theme";

// Plans: training curriculum with progress from stored history and the
// coaching library. No audio needed — drills run in Train (phase 2).
export default function Plans() {
  const [history, setHistory] = useState<PerformanceEntry[]>([]);
  const [starts, setStarts] = useState<Record<string, number>>({});
  const [openId, setOpenId] = useState<string | null>(PLANS[0].id);
  const [name, setName] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(HISTORY_KEY);
        if (raw) setHistory(JSON.parse(raw) as PerformanceEntry[]);
        const st = await AsyncStorage.getItem(planStartsKey());
        if (st) setStarts(JSON.parse(st) as Record<string, number>);
        const n = await AsyncStorage.getItem("songmatch-name");
        if (n) setName(n);
      } catch {
        // Empty state covers it.
      }
    })();
  }, []);

  async function startPlan(plan: Plan) {
    const next = { ...starts, [plan.id]: Date.now() };
    setStarts(next);
    setOpenId(plan.id);
    try {
      await AsyncStorage.setItem(planStartsKey(), JSON.stringify(next));
    } catch {
      // Session-only.
    }
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.pad}>
      <Text style={s.logo}>
        song<Text style={s.accent}>match</Text>
      </Text>
      <Text style={s.title}>Training plans.</Text>
      <Text style={s.sub}>
        Day-by-day drills that end in a song. Finish every lesson and the
        certificate is yours.
      </Text>
      <TextInput
        value={name}
        onChangeText={async (v) => {
          setName(v);
          try {
            await AsyncStorage.setItem("songmatch-name", v);
          } catch {
            // ignore
          }
        }}
        placeholder="Name for your certificate (optional)"
        placeholderTextColor={theme.faint}
        style={s.input}
      />

      {PLANS.map((plan) => {
        const since = starts[plan.id];
        const open = openId === plan.id;
        const prog = since
          ? planProgress(plan, history, since)
          : { done: 0, open: plan.lessons.length, complete: false };
        const items = LIBRARY.filter((c) => c.forPlans.includes(plan.id));
        return (
          <View key={plan.id} style={s.card}>
            <TouchableOpacity onPress={() => setOpenId(open ? null : plan.id)}>
              <Text style={s.planTitle}>{plan.title}</Text>
              <Text style={s.muted}>{plan.tagline}</Text>
              <View style={s.bar}>
                <View
                  style={[
                    s.fill,
                    {
                      width: `${Math.round((100 * prog.done) / plan.lessons.length)}%`,
                    },
                  ]}
                />
              </View>
              <Text style={s.count}>
                {since
                  ? `${prog.done}/${plan.lessons.length} lessons`
                  : `${plan.lessons.length} lessons · not started`}
              </Text>
            </TouchableOpacity>

            {open && (
              <View style={s.detail}>
                {!since ? (
                  <TouchableOpacity
                    style={s.cta}
                    onPress={() => startPlan(plan)}
                  >
                    <Text style={s.ctaText}>Start this plan →</Text>
                  </TouchableOpacity>
                ) : prog.complete ? (
                  <View style={s.cert}>
                    <Text style={s.certKicker}>CERTIFICATE</Text>
                    <Text style={s.certTitle}>{plan.title}</Text>
                    <Text style={s.muted}>
                      Awarded to {name.trim() || "this singer"} for finishing
                      all {plan.lessons.length} lessons.
                    </Text>
                  </View>
                ) : (
                  plan.lessons.map((l, i) => {
                    const st = lessonStatus(history, l, since);
                    return (
                      <View key={i} style={s.lesson}>
                        <View style={[s.dot, st.done && s.dotDone]}>
                          <Text style={st.done ? s.dotDoneText : s.dotText}>
                            {st.done ? "✓" : l.day}
                          </Text>
                        </View>
                        <View style={s.lessonBody}>
                          <Text style={s.lessonTitle}>{l.title}</Text>
                          <Text style={s.muted}>
                            {l.kind === "exercise" ? "Drill" : "Performance"} ·
                            goal {l.goal}%
                            {st.best !== null && !st.done
                              ? ` · best ${st.best}%`
                              : ""}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}

                {items.length > 0 && (
                  <View style={s.lib}>
                    <Text style={s.libTitle}>Watch & read</Text>
                    {items.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        style={s.libItem}
                        onPress={() => Linking.openURL(c.url)}
                      >
                        <Text style={s.lessonTitle}>
                          {c.kind === "video" ? "▶ " : "📖 "}
                          {c.title}
                        </Text>
                        <Text style={s.muted}>
                          {c.source} · {c.blurb}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  pad: { padding: 24, paddingBottom: 48 },
  logo: { fontSize: 22, fontWeight: "900", color: theme.text },
  accent: { color: theme.accent },
  title: { marginTop: 12, fontSize: 36, fontWeight: "900", color: theme.text },
  sub: { marginTop: 8, fontSize: 15, lineHeight: 23, color: theme.muted },
  input: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 14,
    color: theme.text,
    fontSize: 15,
  },
  card: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 20,
    padding: 20,
  },
  planTitle: { fontSize: 20, fontWeight: "900", color: theme.text },
  muted: { marginTop: 4, fontSize: 14, lineHeight: 20, color: theme.muted },
  bar: {
    marginTop: 12,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: theme.accent },
  count: { marginTop: 6, fontSize: 12, fontWeight: "700", color: theme.faint },
  detail: { marginTop: 16 },
  cta: {
    backgroundColor: theme.accent,
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
  },
  ctaText: { color: "#000", fontWeight: "900", fontSize: 16 },
  cert: {
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  certKicker: { fontSize: 12, fontWeight: "900", color: theme.accent },
  certTitle: { marginTop: 8, fontSize: 22, fontWeight: "900", color: theme.text },
  lesson: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
  },
  lessonBody: { flex: 1 },
  lessonTitle: { fontSize: 15, fontWeight: "700", color: theme.text },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dotDone: { backgroundColor: theme.accent, borderColor: theme.accent },
  dotText: { color: theme.muted, fontSize: 12, fontWeight: "700" },
  dotDoneText: { color: "#000", fontSize: 14, fontWeight: "900" },
  lib: { marginTop: 16 },
  libTitle: { fontSize: 14, fontWeight: "900", color: theme.text },
  libItem: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 12,
  },
});
