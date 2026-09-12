import { Link, router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { VocalProfile } from "../src/lib/pitch.ts";
import { profileFromPcm } from "../src/lib/voiceAnalysis.ts";
import { decodeWavPcm16 } from "../src/lib/wav.ts";
import { PROFILE_KEY, theme } from "../src/theme";

// Web: app/scan/page.tsx — getUserMedia + AudioContext + live detectPitch() loop
// App v1: record uncompressed WAV → decode bytes → profileFromPcm() (YIN) →
// save profile → /matches. No live note display yet (needs frame processor);
// analysis runs at Finish, ~1-2s for a 10s clip. Same math as web.
export default function Scan() {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [profile, setProfile] = useState<VocalProfile | null>(null);
  const [metering, setMetering] = useState<number | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  async function startScan() {
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Microphone needed", "Allow mic access to analyze your voice.");
      return;
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const rec = new Audio.Recording();
    await rec.prepareToRecordAsync({
      ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
      android: {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
        extension: ".wav",
        outputFormat: Audio.AndroidOutputFormat.DEFAULT,
        audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
      },
      ios: {
        extension: ".wav",
        outputFormat: Audio.IOSOutputFormat.LINEARPCM,
        audioQuality: Audio.IOSAudioQuality.HIGH,
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 16 * 44100,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      isMeteringEnabled: true,
    });
    rec.setOnRecordingStatusUpdate((st) => {
      if (st.isRecording) setMetering(st.metering ?? null);
    });
    await rec.startAsync();
    setProfile(null);
    setRecording(rec);
  }

  async function stopScan() {
    if (!recording) return;
    const uri = recording.getURI();
    try {
      await recording.stopAndUnloadAsync();
    } catch {}
    setRecording(null);
    setMetering(null);
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

    if (!uri) {
      Alert.alert("No recording", "Nothing was captured. Try again.");
      return;
    }
    setAnalyzing(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const raw = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const { pcm, sampleRate } = decodeWavPcm16(raw);
      const result = profileFromPcm(pcm, sampleRate);
      if (!result) {
        Alert.alert(
          "Couldn't hear enough",
          "Hum or sing comfortably for a few seconds, then finish again."
        );
        return;
      }
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(result));
      setProfile(result);
      router.push("/matches");
    } catch (e) {
      Alert.alert(
        "Analysis failed",
        e instanceof Error ? e.message : "Could not decode the recording."
      );
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <View style={s.root}>
      <Link href="/" style={s.back}>
        <Text style={s.backText}>← Home</Text>
      </Link>
      <Text style={s.kicker}>Voice Analysis</Text>
      <Text style={s.title}>Let&apos;s find your range.</Text>
      <Text style={s.sub}>Speak, hum or sing comfortably. Don&apos;t strain.</Text>

      {!recording && !profile && !analyzing && (
        <TouchableOpacity style={s.cta} onPress={startScan}>
          <Text style={s.ctaText}>Start voice scan →</Text>
        </TouchableOpacity>
      )}
      {analyzing && (
        <View style={s.card}>
          <Text style={s.live}>Analyzing your voice…</Text>
        </View>
      )}
      {recording && (
        <View style={s.card}>
          <Text style={s.live}>● Listening{metering != null ? `  ${metering.toFixed(0)} dB` : ""}</Text>
          <TouchableOpacity style={s.stop} onPress={stopScan}>
            <Text style={s.ctaText}>Finish scan</Text>
          </TouchableOpacity>
        </View>
      )}
      {profile && (
        <View style={s.card}>
          <Text style={s.range}>
            {profile.lowNote} – {profile.highNote}
          </Text>
          <Text style={s.sub}>{profile.voiceType}</Text>
        </View>
      )}
    </View>
  );
}

// NOTE(native-pitch): v1 analyzes the finished WAV file (decode →
// profileFromPcm → YIN per 2048-window). Live note display during recording
// still needs a frame processor (expo-audio streams / dev-client module) —
// that is the next native step, not a blocker for real profiles.

const s = StyleSheet.create({
  root: { flex: 1, padding: 24, paddingTop: 64, backgroundColor: theme.bg },
  back: { marginBottom: 24 },
  backText: { color: theme.muted },
  kicker: { color: theme.accent, fontWeight: "800", fontSize: 12, letterSpacing: 2 },
  title: { marginTop: 8, fontSize: 36, fontWeight: "900", color: theme.text },
  sub: { marginTop: 8, color: theme.muted, fontSize: 15, lineHeight: 22 },
  cta: { marginTop: 24, backgroundColor: theme.accent, borderRadius: 16, padding: 18, alignItems: "center" },
  ctaText: { color: "#000", fontWeight: "900", fontSize: 16 },
  card: { marginTop: 24, borderWidth: 1, borderColor: theme.border, borderRadius: 20, padding: 20 },
  live: { color: theme.accent, fontWeight: "800", textAlign: "center" },
  stop: { marginTop: 16, borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 14, alignItems: "center" },
  range: { fontSize: 44, fontWeight: "900", color: theme.text, textAlign: "center" },
  dev: { marginTop: 24, color: theme.faint, textAlign: "center", fontSize: 12 },
});
