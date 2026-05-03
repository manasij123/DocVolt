import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  Animated,
  Easing,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, shadow, categoryGradients } from "../../../src/theme";
import { CATEGORY_LABELS, Category, listCategories, autoDetectCategoryId, suggestCategory } from "../../../src/api";
import api, { getToken } from "../../../src/api";
import { useLocalSearchParams, useRouter } from "expo-router";
import PressableScale from "../../../src/PressableScale";
import GradientButton from "../../../src/GradientButton";

const MONTHS = [
  { v: 1, l: "Jan" }, { v: 2, l: "Feb" }, { v: 3, l: "Mar" }, { v: 4, l: "Apr" },
  { v: 5, l: "May" }, { v: 6, l: "Jun" }, { v: 7, l: "Jul" }, { v: 8, l: "Aug" },
  { v: 9, l: "Sep" }, { v: 10, l: "Oct" }, { v: 11, l: "Nov" }, { v: 12, l: "Dec" },
];

const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function detectCategory(name: string) {
  const n = name.toLowerCase();
  if (n.includes("monthly return") || n.includes("monthly_return")) return "MONTHLY_RETURN";
  if (n.includes("forwarding-letter") || n.includes("forwarding letter") || n.includes("forwarding_letter")) return "FORWARDING_LETTER";
  if (n.includes("ifa report") || n.includes("ifa_report") || n.includes("ifareport")) return "IFA_REPORT";
  return "OTHERS";
}

function detectMonthYear(name: string): { month: number | null; year: number | null } {
  const n = name.replace(/[_\-]/g, " ");
  const re = /\b([A-Za-z]{3,9})\s*['\u2019]?\s*(\d{2,4})(?!\d)/g;
  let m;
  while ((m = re.exec(n)) !== null) {
    const monStr = m[1].toLowerCase();
    if (MONTH_MAP[monStr]) {
      let year = parseInt(m[2], 10);
      if (year < 100) year += 2000;
      return { month: MONTH_MAP[monStr], year };
    }
  }
  const yMatch = n.match(/\b(20\d{2})\b/);
  if (yMatch) return { month: null, year: parseInt(yMatch[1], 10) };
  return { month: null, year: null };
}

type PickedFile = {
  uri: string;
  name: string;
  size: number;
  mimeType?: string;
};

type Stage = "idle" | "scanned" | "manual";

export default function UploadScreen() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const router = useRouter();
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  // Per-client categories — admin may have customised them.
  const [cats, setCats] = useState<Category[]>([]);

  const [detectedCategoryId, setDetectedCategoryId] = useState<string>("");
  const [detectedYear, setDetectedYear] = useState<number | null>(null);
  const [detectedMonth, setDetectedMonth] = useState<number | null>(null);

  const [categoryId, setCategoryId] = useState<string>("");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number | null>(null);

  const [uploading, setUploading] = useState(false);
  const [lastUpload, setLastUpload] = useState<string | null>(null);
  // 🧠 Learning-based suggestion info for the UI hint
  const [suggestionInfo, setSuggestionInfo] = useState<{ source: "learned" | "local" | "none"; learnedCount?: number; matchedTokens?: string[] }>({ source: "none" });

  const cardFade = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(20)).current;

  // Load categories on mount + whenever clientId changes
  useEffect(() => {
    if (!clientId) return;
    (async () => {
      try {
        const tok = await getToken();
        const list = await listCategories({ client_id: String(clientId) }, tok || undefined);
        setCats(list);
      } catch { /* ignore */ }
    })();
  }, [clientId]);

  useEffect(() => {
    if (stage !== "idle") {
      cardFade.setValue(0);
      cardSlide.setValue(20);
      Animated.parallel([
        Animated.timing(cardFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(cardSlide, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    }
  }, [stage]);

  const reset = () => {
    setPicked(null);
    setStage("idle");
    setDetectedCategoryId("");
    setDetectedYear(null);
    setDetectedMonth(null);
    setCategoryId("");
    setYear(new Date().getFullYear());
    setMonth(null);
    setSuggestionInfo({ source: "none" });
  };

  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (res.canceled) return;
    const file = res.assets[0];
    const name = file.name || "document.pdf";
    setPicked({
      uri: file.uri,
      name,
      size: file.size || 0,
      mimeType: file.mimeType || "application/pdf",
    });

    // 🧠 Try learning-based suggestion first (server-side, includes learned
    // weights from past uploads). Fall back to local heuristics.
    let chosen = "";
    let info: typeof suggestionInfo = { source: "none" };
    try {
      const tok = await getToken();
      const r = await suggestCategory(String(clientId), name, tok || undefined);
      if (r.suggested?.id) {
        chosen = r.suggested.id;
        info = {
          source: (r.learned_count || 0) > 0 ? "learned" : "local",
          learnedCount: r.learned_count || 0,
          matchedTokens: r.matched_tokens || [],
        };
      }
    } catch {
      // server unreachable — ignore, use local fallback below
    }
    if (!chosen) {
      chosen = autoDetectCategoryId(name, cats);
      info = chosen ? { source: "local" } : { source: "none" };
    }

    const my = detectMonthYear(name);
    setDetectedCategoryId(chosen);
    setDetectedYear(my.year);
    setDetectedMonth(my.month);
    setSuggestionInfo(info);

    setCategoryId(chosen);
    if (my.year) setYear(my.year);
    setMonth(my.month);

    setStage("scanned");
    setLastUpload(null);
  };

  const doUpload = async (
    catIdToSend: string,
    yearToSend: number,
    monthToSend: number | null,
  ) => {
    if (!picked) {
      Alert.alert("No file", "Please pick a PDF first");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      if (Platform.OS === "web") {
        const response = await fetch(picked.uri);
        const blob = await response.blob();
        form.append("file", blob, picked.name);
      } else {
        form.append("file", {
          uri: picked.uri,
          name: picked.name,
          type: picked.mimeType || "application/pdf",
        } as any);
      }
      if (catIdToSend) form.append("category_id", catIdToSend);
      form.append("year_override", String(yearToSend));
      if (monthToSend !== null) form.append("month_override", String(monthToSend));
      form.append("client_id", String(clientId || ""));

      const token = await getToken();
      const res = await api.post("/documents/upload", form, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });
      setLastUpload(res.data.display_name);
      reset();
      Alert.alert("Uploaded", "Document uploaded successfully");
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || "Upload failed";
      Alert.alert("Upload failed", typeof msg === "string" ? msg : "Try again");
    } finally {
      setUploading(false);
    }
  };

  const confirmDetection = () => {
    const yearToSend = detectedYear ?? new Date().getFullYear();
    doUpload(detectedCategoryId, yearToSend, detectedMonth);
  };

  const goManual = () => setStage("manual");

  const submitManual = () => doUpload(categoryId, year, month);

  const yearOptions = [year - 2, year - 1, year, year + 1];
  const monthLabel = (m: number | null) => (m ? MONTHS[m - 1].l : "—");

  // Look up the detected category (or fallback OTHERS) for label/color display
  const detectedCat = cats.find((c) => c.id === detectedCategoryId);
  const formatLooksGood =
    !!detectedCat && detectedCat.key !== "OTHERS" && detectedYear !== null && detectedMonth !== null;

  const detectGrad = formatLooksGood && detectedCat
    ? ([detectedCat.color, detectedCat.color] as const)
    : (["#F59E0B", "#D97706"] as const);

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.inner, { paddingBottom: 60 }]}>
      <Text style={styles.title}>Upload PDF</Text>
      <Text style={styles.subtitle}>
        Pick a PDF — the app will scan its name and tell you which tab/year/month it belongs to.
      </Text>

      {/* Bulk upload entry point — sends user to /admin/[clientId]/bulk-upload */}
      <PressableScale
        onPress={() => router.push(`/admin/${clientId}/bulk-upload` as any)}
        hapticStyle="light"
        testID="btn-bulk-upload"
      >
        <View style={styles.bulkLinkCard}>
          <View style={styles.bulkLinkIcon}>
            <Ionicons name="documents" size={20} color="#1E40AF" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.bulkLinkTitle}>Multiple PDFs at once?</Text>
            <Text style={styles.bulkLinkSub}>Open Bulk Upload — sequential, with progress</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color="#1E40AF" />
        </View>
      </PressableScale>

      {/* Step 1: file picker */}
      <PressableScale onPress={pick} haptic="medium" testID="btn-pick-file">
        <LinearGradient
          colors={picked ? ["#EFF6FF", "#F5F3FF"] : ["#F8FAFC", "#F1F5F9"]}
          style={styles.dropzone}
        >
          <View style={styles.dropIconWrap}>
            <LinearGradient
              colors={["#3B82F6", "#8B5CF6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.dropIconBg}
            >
              <Ionicons
                name={picked ? "document-attach" : "cloud-upload"}
                size={26}
                color="#fff"
              />
            </LinearGradient>
          </View>
          <Text style={styles.dropTitle} numberOfLines={2}>
            {picked ? picked.name : "Tap to choose a PDF"}
          </Text>
          <Text style={styles.dropSub}>
            {picked ? `${(picked.size / 1024).toFixed(0)} KB · Tap to change` : "PDF files only"}
          </Text>
        </LinearGradient>
      </PressableScale>

      {/* Step 2: detection result */}
      {stage === "scanned" && picked && (
        <Animated.View
          style={[
            styles.detectCard,
            { opacity: cardFade, transform: [{ translateY: cardSlide }] },
          ]}
          testID="detection-card"
        >
          <View style={styles.detectHeader}>
            <LinearGradient
              colors={detectGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.detectStatusIcon}
            >
              <Ionicons
                name={formatLooksGood ? "checkmark-circle" : "alert-circle"}
                size={18}
                color="#fff"
              />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.detectTitle}>
                {formatLooksGood ? "Filename matched" : "Format unclear"}
              </Text>
              <Text style={styles.detectHint}>
                {formatLooksGood ? "Auto-detected from filename" : "Some details missing"}
              </Text>
            </View>
          </View>

          {suggestionInfo.source === "learned" && (suggestionInfo.learnedCount || 0) > 0 && (
            <View style={styles.learnedHint}>
              <View style={styles.learnedBadge}>
                <Text style={styles.learnedBadgeTxt}>🧠 AI</Text>
              </View>
              <Text style={styles.learnedTxt}>
                Suggested by learning from{" "}
                <Text style={styles.learnedTxtBold}>
                  {suggestionInfo.learnedCount} past upload{suggestionInfo.learnedCount === 1 ? "" : "s"}
                </Text>
                {suggestionInfo.matchedTokens && suggestionInfo.matchedTokens.length > 0 && (
                  <>
                    {" · matched "}
                    <Text style={styles.learnedTxtBold}>"{suggestionInfo.matchedTokens.slice(0, 3).join(", ")}"</Text>
                  </>
                )}
              </Text>
            </View>
          )}

          <View style={styles.detectBody}>
            <View style={styles.detectRow}>
              <Text style={styles.detectLabel}>Tab</Text>
              <View style={styles.detectValueWrap}>
                <View style={[styles.dotInline, { backgroundColor: detectGrad[0] }]} />
                <Text style={[styles.detectValue, (!detectedCat || detectedCat.key === "OTHERS") && styles.detectValueWarn]}>
                  {detectedCat ? detectedCat.name : "—"}
                </Text>
              </View>
            </View>
            <View style={styles.detectRow}>
              <Text style={styles.detectLabel}>Year</Text>
              <Text style={[styles.detectValue, !detectedYear && styles.detectValueWarn]}>
                {detectedYear ?? "—"}
              </Text>
            </View>
            <View style={[styles.detectRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.detectLabel}>Month</Text>
              <Text style={[styles.detectValue, !detectedMonth && styles.detectValueWarn]}>
                {monthLabel(detectedMonth)}
              </Text>
            </View>
          </View>

          <Text style={styles.askText}>Is this format correct?</Text>

          <View style={styles.confirmRow}>
            <View style={{ flex: 1 }}>
              <GradientButton
                title="No, manual"
                variant="ghost"
                icon="close"
                onPress={goManual}
                disabled={uploading}
                testID="btn-format-no"
                haptic="light"
              />
            </View>
            <View style={{ flex: 1 }}>
              <GradientButton
                title="Yes, upload"
                icon="checkmark"
                onPress={confirmDetection}
                loading={uploading}
                testID="btn-format-yes"
                haptic="medium"
              />
            </View>
          </View>
        </Animated.View>
      )}

      {/* Step 3: manual */}
      {stage === "manual" && picked && (
        <Animated.View
          style={[styles.manualWrap, { opacity: cardFade, transform: [{ translateY: cardSlide }] }]}
          testID="manual-form"
        >
          <View style={styles.manualHeader}>
            <Ionicons name="settings" size={18} color={colors.accent} />
            <Text style={styles.manualTitle}>Set category & date manually</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Category</Text>
            <View style={styles.chipRow}>
              {cats.map((c) => {
                const active = c.id === categoryId;
                return (
                  <PressableScale
                    key={c.id}
                    onPress={() => setCategoryId(c.id)}
                    haptic="light"
                    testID={`chip-cat-${c.id}`}
                  >
                    {active ? (
                      <LinearGradient
                        colors={[c.color, c.color]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.chip, styles.chipActive]}
                      >
                        <Text style={styles.chipTextActive}>{c.name}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.chip}>
                        <Text style={styles.chipText}>{c.name}</Text>
                      </View>
                    )}
                  </PressableScale>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Year</Text>
            <View style={styles.chipRow}>
              {yearOptions.map((y) => {
                const active = y === year;
                return (
                  <PressableScale
                    key={y}
                    onPress={() => setYear(y)}
                    haptic="light"
                    testID={`chip-year-${y}`}
                  >
                    {active ? (
                      <LinearGradient
                        colors={["#0B1220", "#1E293B"]}
                        style={[styles.chip, styles.chipActive]}
                      >
                        <Text style={styles.chipTextActive}>{y}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.chip}>
                        <Text style={styles.chipText}>{y}</Text>
                      </View>
                    )}
                  </PressableScale>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Month</Text>
            <View style={styles.chipRow}>
              <PressableScale onPress={() => setMonth(null)} haptic="light">
                {month === null ? (
                  <LinearGradient
                    colors={["#0B1220", "#1E293B"]}
                    style={[styles.chip, styles.chipActive]}
                  >
                    <Text style={styles.chipTextActive}>None</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>None</Text>
                  </View>
                )}
              </PressableScale>
              {MONTHS.map((m) => {
                const active = m.v === month;
                return (
                  <PressableScale
                    key={m.v}
                    onPress={() => setMonth(m.v)}
                    haptic="light"
                    testID={`chip-month-${m.v}`}
                  >
                    {active ? (
                      <LinearGradient
                        colors={["#0B1220", "#1E293B"]}
                        style={[styles.chip, styles.chipActive]}
                      >
                        <Text style={styles.chipTextActive}>{m.l}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.chip}>
                        <Text style={styles.chipText}>{m.l}</Text>
                      </View>
                    )}
                  </PressableScale>
                );
              })}
            </View>
          </View>

          <View style={styles.manualActions}>
            <View style={{ flex: 1 }}>
              <GradientButton
                title="Back"
                variant="ghost"
                icon="chevron-back"
                onPress={() => setStage("scanned")}
                disabled={uploading}
                testID="btn-manual-back"
              />
            </View>
            <View style={{ flex: 1 }}>
              <GradientButton
                title="Upload"
                icon="cloud-upload"
                onPress={submitManual}
                loading={uploading}
                testID="btn-manual-upload"
                haptic="medium"
              />
            </View>
          </View>
        </Animated.View>
      )}

      {lastUpload && (
        <View style={styles.successBanner} testID="upload-success-banner">
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={14} color="#fff" />
          </View>
          <Text style={styles.successText} numberOfLines={2}>
            Uploaded: {lastUpload}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  inner: {
    padding: 22,
    maxWidth: 900,
    width: "100%",
    alignSelf: "center",
  },
  title: { fontSize: 26, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.6 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4, marginBottom: 22, lineHeight: 18 },

  dropzone: {
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderStyle: "dashed",
    borderRadius: radius.xl,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 180,
  },
  dropIconWrap: { marginBottom: 14 },
  dropIconBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  dropTitle: { fontSize: 15, fontWeight: "700", color: colors.textPrimary, textAlign: "center" },
  dropSub: { fontSize: 12, color: colors.textSecondary, marginTop: 6 },

  // "Multiple PDFs at once?" entry point styles
  bulkLinkCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: "rgba(30,64,175,0.06)",
    borderWidth: 1, borderColor: "rgba(30,64,175,0.18)",
    borderRadius: radius.md,
    marginBottom: 14,
  },
  bulkLinkIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },
  bulkLinkTitle: { fontSize: 14, fontWeight: "800", color: "#1E40AF", letterSpacing: -0.2 },
  bulkLinkSub:   { fontSize: 11, color: "#5F6368", marginTop: 2 },

  detectCard: {
    marginTop: 22,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.md,
  },
  detectHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  detectStatusIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  detectTitle: { fontSize: 15, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.2 },
  detectHint: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  // 🧠 AI-learned suggestion hint
  learnedHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#F5F1FF",
    borderWidth: 1,
    borderColor: "#D6C8FF",
  },
  learnedBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  learnedBadgeTxt: { color: "#fff", fontWeight: "800", fontSize: 10, letterSpacing: 0.3 },
  learnedTxt: { flex: 1, color: "#1E1B4B", fontSize: 12, lineHeight: 16 },
  learnedTxtBold: { fontWeight: "800", color: colors.primary },

  detectBody: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    padding: 4,
  },
  detectRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detectLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  detectValueWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  dotInline: { width: 8, height: 8, borderRadius: 4 },
  detectValue: { fontSize: 14, color: colors.textPrimary, fontWeight: "700" },
  detectValueWarn: { color: colors.warning },

  askText: {
    marginTop: 18,
    marginBottom: 12,
    fontSize: 11,
    fontWeight: "800",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    textAlign: "center",
  },
  confirmRow: { flexDirection: "row", gap: 10 },

  manualWrap: {
    marginTop: 22,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.md,
  },
  manualHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  manualTitle: { fontSize: 15, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.2 },

  section: { marginTop: 18 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: "transparent" },
  chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: "#fff", fontSize: 13, fontWeight: "700" },

  manualActions: { flexDirection: "row", gap: 10, marginTop: 22 },

  successBanner: {
    marginTop: 18,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.successSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  successIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  successText: { color: "#065F46", fontSize: 13, flex: 1, fontWeight: "600" },
});
