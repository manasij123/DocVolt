import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadow } from "../../../src/theme";
import { CATEGORY_LABELS } from "../../../src/api";
import api, { getToken } from "../../../src/api";

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
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [stage, setStage] = useState<Stage>("idle");

  const [detectedCategory, setDetectedCategory] = useState<string>("OTHERS");
  const [detectedYear, setDetectedYear] = useState<number | null>(null);
  const [detectedMonth, setDetectedMonth] = useState<number | null>(null);

  const [category, setCategory] = useState<string>("OTHERS");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number | null>(null);

  const [uploading, setUploading] = useState(false);
  const [lastUpload, setLastUpload] = useState<string | null>(null);

  const reset = () => {
    setPicked(null);
    setStage("idle");
    setDetectedCategory("OTHERS");
    setDetectedYear(null);
    setDetectedMonth(null);
    setCategory("OTHERS");
    setYear(new Date().getFullYear());
    setMonth(null);
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

    const cat = detectCategory(name);
    const my = detectMonthYear(name);
    setDetectedCategory(cat);
    setDetectedYear(my.year);
    setDetectedMonth(my.month);

    setCategory(cat);
    if (my.year) setYear(my.year);
    setMonth(my.month);

    setStage("scanned");
    setLastUpload(null);
  };

  const doUpload = async (
    catToSend: string,
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
      form.append("category_override", catToSend);
      form.append("year_override", String(yearToSend));
      if (monthToSend !== null) form.append("month_override", String(monthToSend));

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
    doUpload(detectedCategory, yearToSend, detectedMonth);
  };

  const goManual = () => {
    setStage("manual");
  };

  const submitManual = () => {
    doUpload(category, year, month);
  };

  const yearOptions = [year - 2, year - 1, year, year + 1];
  const monthLabel = (m: number | null) => (m ? MONTHS[m - 1].l : "—");

  const formatLooksGood = detectedCategory !== "OTHERS" && detectedYear !== null && detectedMonth !== null;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 60 }}>
      <Text style={styles.title}>Upload PDF</Text>
      <Text style={styles.subtitle}>
        Pick a PDF — the app will scan its name and tell you which tab/year/month it belongs to.
      </Text>

      {/* Step 1: file picker */}
      <TouchableOpacity onPress={pick} style={styles.dropzone} testID="btn-pick-file">
        <Ionicons name="cloud-upload-outline" size={36} color={colors.accent} />
        <Text style={styles.dropTitle}>{picked ? picked.name : "Tap to choose a PDF"}</Text>
        <Text style={styles.dropSub}>
          {picked ? `${(picked.size / 1024).toFixed(0)} KB · Tap to change` : "PDF only"}
        </Text>
      </TouchableOpacity>

      {/* Step 2: detection result */}
      {stage === "scanned" && picked && (
        <View style={styles.detectCard} testID="detection-card">
          <View style={styles.detectHeader}>
            <Ionicons
              name={formatLooksGood ? "checkmark-circle" : "alert-circle"}
              size={20}
              color={formatLooksGood ? colors.success : colors.warning}
            />
            <Text style={styles.detectTitle}>
              {formatLooksGood ? "Filename matched a known format" : "Filename format not fully recognised"}
            </Text>
          </View>

          <View style={styles.detectRow}>
            <Text style={styles.detectLabel}>Tab</Text>
            <Text style={[styles.detectValue, detectedCategory === "OTHERS" && styles.detectValueWarn]}>
              {CATEGORY_LABELS[detectedCategory]}
            </Text>
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

          <Text style={styles.askText}>Is this format correct?</Text>

          <View style={styles.confirmRow}>
            <TouchableOpacity
              style={[styles.confirmBtn, styles.btnNo]}
              onPress={goManual}
              disabled={uploading}
              testID="btn-format-no"
            >
              <Ionicons name="close" size={18} color={colors.textPrimary} />
              <Text style={styles.btnNoText}>No, set manually</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, styles.btnYes, uploading && { opacity: 0.6 }]}
              onPress={confirmDetection}
              disabled={uploading}
              testID="btn-format-yes"
            >
              {uploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={styles.btnYesText}>Yes, upload</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Step 3: manual select */}
      {stage === "manual" && picked && (
        <View style={styles.manualWrap} testID="manual-form">
          <View style={styles.manualHeader}>
            <Ionicons name="settings-outline" size={18} color={colors.textPrimary} />
            <Text style={styles.manualTitle}>Set category & date manually</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Category</Text>
            <View style={styles.chipRow}>
              {Object.keys(CATEGORY_LABELS).map((k) => {
                const active = k === category;
                return (
                  <TouchableOpacity
                    key={k}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setCategory(k)}
                    testID={`chip-cat-${k}`}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{CATEGORY_LABELS[k]}</Text>
                  </TouchableOpacity>
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
                  <TouchableOpacity
                    key={y}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setYear(y)}
                    testID={`chip-year-${y}`}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{y}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Month</Text>
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, month === null && styles.chipActive]}
                onPress={() => setMonth(null)}
              >
                <Text style={[styles.chipText, month === null && styles.chipTextActive]}>None</Text>
              </TouchableOpacity>
              {MONTHS.map((m) => {
                const active = m.v === month;
                return (
                  <TouchableOpacity
                    key={m.v}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setMonth(m.v)}
                    testID={`chip-month-${m.v}`}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{m.l}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.manualActions}>
            <TouchableOpacity
              style={[styles.confirmBtn, styles.btnNo]}
              onPress={() => setStage("scanned")}
              disabled={uploading}
              testID="btn-manual-back"
            >
              <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
              <Text style={styles.btnNoText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, styles.btnYes, uploading && { opacity: 0.6 }]}
              onPress={submitManual}
              disabled={uploading}
              testID="btn-manual-upload"
            >
              {uploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={18} color="#fff" />
                  <Text style={styles.btnYesText}>Upload</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {lastUpload && (
        <View style={styles.successBanner} testID="upload-success-banner">
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.successText} numberOfLines={2}>Uploaded: {lastUpload}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, padding: 24 },
  title: { fontSize: 24, fontWeight: "700", color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4, marginBottom: 24, lineHeight: 18 },

  dropzone: {
    borderWidth: 2,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
    backgroundColor: colors.inputBg,
    borderRadius: radius.lg,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 160,
  },
  dropTitle: { marginTop: 14, fontSize: 15, fontWeight: "600", color: colors.textPrimary, textAlign: "center" },
  dropSub: { fontSize: 12, color: colors.textSecondary, marginTop: 6 },

  detectCard: {
    marginTop: 22,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    ...shadow.sm,
  },
  detectHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  detectTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary, flex: 1 },
  detectRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detectLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: "600" },
  detectValue: { fontSize: 15, color: colors.textPrimary, fontWeight: "700" },
  detectValueWarn: { color: colors.warning },
  askText: {
    marginTop: 18,
    marginBottom: 12,
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  confirmRow: { flexDirection: "row", gap: 10 },
  confirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  btnNo: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnNoText: { color: colors.textPrimary, fontWeight: "700", fontSize: 14 },
  btnYes: { backgroundColor: colors.accent },
  btnYesText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  manualWrap: {
    marginTop: 22,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    ...shadow.sm,
  },
  manualHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  manualTitle: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },

  section: { marginTop: 18 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#fff" },

  manualActions: { flexDirection: "row", gap: 10, marginTop: 22 },

  successBanner: {
    marginTop: 18,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: "#ECFDF5",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  successText: { color: "#065F46", fontSize: 13, flex: 1 },
});
