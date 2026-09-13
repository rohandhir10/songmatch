import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import { buyPackage, loadOfferings, restore } from "../src/lib/entitlements";
import { paywallCopy } from "../src/lib/paywall";
import { theme } from "../src/theme";

// Paywall: ?item=songs|training. Offers come from RevenueCat; with no keys
// configured yet it explains setup instead of crashing. __DEV__ builds get
// a bypass so flows are testable before store products exist.
export default function Paywall() {
  const { item } = useLocalSearchParams<{ item?: string }>();
  const key = item === "training" ? "training" : "songs";
  const copy = paywallCopy(key);
  const [packs, setPacks] = useState<PurchasesPackage[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadOfferings().then((o) => {
      const current = o?.current;
      if (current?.availablePackages?.length) {
        setPacks([...current.availablePackages]);
      }
    });
  }, []);

  async function buy(pkg: PurchasesPackage) {
    setBusy(true);
    try {
      if (await buyPackage(pkg)) router.back();
      else
        Alert.alert(
          "No charge made",
          "If you cancelled, nothing happened. Otherwise check your connection and try again."
        );
    } finally {
      setBusy(false);
    }
  }

  async function onRestore() {
    setBusy(true);
    try {
      if (await restore()) router.back();
      else Alert.alert("Nothing to restore", "No Pro purchase found.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.root}>
      <Text style={s.logo}>
        song<Text style={s.accent}>match</Text> Pro
      </Text>
      <Text style={s.title}>{copy.title}</Text>
      <Text style={s.sub}>{copy.body}</Text>

      {packs.length === 0 ? (
        <View style={s.card}>
          <Text style={s.sub}>
            Subscriptions aren't connected yet — products get created in App
            Store Connect / Play Console + RevenueCat, then appear here.
          </Text>
          {__DEV__ && (
            <TouchableOpacity style={s.cta} onPress={() => router.back()}>
              <Text style={s.ctaText}>Continue (dev bypass) →</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        packs.map((p) => (
          <TouchableOpacity
            key={p.identifier}
            style={[s.cta, busy && s.ctaBusy]}
            disabled={busy}
            onPress={() => buy(p)}
          >
            <Text style={s.ctaText}>
              {busy
                ? "Working…"
                : `${p.product.title} · ${p.product.priceString}`}
            </Text>
          </TouchableOpacity>
        ))
      )}

      <TouchableOpacity disabled={busy} onPress={onRestore}>
        <Text style={s.restore}>Restore purchase</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 24, paddingTop: 96, backgroundColor: theme.bg },
  logo: { fontSize: 22, fontWeight: "900", color: theme.text },
  accent: { color: theme.accent },
  title: { marginTop: 16, fontSize: 34, fontWeight: "900", color: theme.text },
  sub: { marginTop: 12, fontSize: 15, lineHeight: 23, color: theme.muted },
  card: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 20,
    padding: 20,
  },
  cta: {
    marginTop: 16,
    backgroundColor: theme.accent,
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
  },
  ctaBusy: { opacity: 0.6 },
  ctaText: { color: "#000", fontWeight: "900", fontSize: 16 },
  restore: { marginTop: 20, color: theme.muted, textAlign: "center" },
});
