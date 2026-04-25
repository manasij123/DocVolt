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

export default function UploadScreen() {
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [category, setCategory] = useState<string>("OTHERS");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lastUpload, setLastUpload] = useState<string | null>(null);

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
    setCategory(cat);
    if (my.year) setYear(my.year);
    if (my.month !== null) setMonth(my.month);
  };

  const upload = async () => {
    if (!picked) {
      Alert.alert("No file", "Please pick a PDF first");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      if (Platform.OS === "web") {
        // Convert URI to blob for web
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
      form.append("category_override", category);
      form.append("year_override", String(year));
      if (month !== null) form.append("month_override", String(month));

      const token = await getToken();
      const res = await api.post("/documents/upload", form, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });
      setLastUpload(res.data.display_name);
      setPicked(null);
      setMonth(null);
      setCategory("OTHERS");
      Alert.alert("Uploaded", "Document uploaded successfully");
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || "Upload failed";
      Alert.alert("Upload failed", typeof msg === "string" ? msg : "Try again");
    } finally {
      setUploading(false);
    }
  };

  const yearOptions = [year - 2, year - 1, year, year + 1];

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 60 }}>
      <Text style={styles.title}>Upload PDF</Text>
      <Text style={styles.subtitle}>Auto-categorised by filename. You can override below.</Text>

      <TouchableOpacity onPress={pick} style={styles.dropzone} testID="btn-pick-file">
        <Ionicons name="cloud-upload-outline" size={36} color={colors.accent} />
        <Text style={styles.dropTitle}>{picked ? picked.name : "Tap to choose a PDF"}</Text>
        <Text style={styles.dropSub}>
          {picked ? `${(picked.size / 1024).toFixed(0)} KB · Tap to change` : "PDF only"}
        </Text>
      </TouchableOpacity>

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
              <TouchableOpacity key={y} style={[styles.chip, active && styles.chipActive]} onPress={() => setYear(y)}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{y}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Month (optional)</Text>
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
              <TouchableOpacity key={m.v} style={[styles.chip, active && styles.chipActive]} onPress={() => setMonth(m.v)}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{m.l}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.uploadBtn, (!picked || uploading) && { opacity: 0.6 }]}
        onPress={upload}
        disabled={!picked || uploading}
        testID="btn-upload-submit"
      >
        {uploading ? <ActivityIndicator color="#fff" /> : (
          <>
            <Ionicons name="cloud-upload" size={18} color="#fff" />
            <Text style={styles.uploadText}>Upload Document</Text>
          </>
        )}
      </TouchableOpacity>

      {lastUpload && (
        <View style={styles.successBanner}>
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
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4, marginBottom: 24 },
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
  section: { marginTop: 22 },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
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
  uploadBtn: {
    marginTop: 28,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    ...shadow.sm,
  },
  uploadText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  successBanner: {
    marginTop: 16,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: "#ECFDF5",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  successText: { color: "#065F46", fontSize: 13, flex: 1 },
});
