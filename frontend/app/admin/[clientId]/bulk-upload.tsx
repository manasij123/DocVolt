/**
 * Bulk Upload screen for admin → client workspace.
 *
 * Lets the admin pick multiple PDFs at once, auto-categorises each by
 * filename, shows per-row progress, and uploads them sequentially to
 * /api/documents/upload (one POST per file with onUploadProgress).
 *
 * Companion to /app/[clientId]/upload.tsx (the polished single-file flow).
 */
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Pressable,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import api, { CATEGORY_LABELS, getToken } from "../../../src/api";
import { colors, radius, shadow } from "../../../src/theme";
import PressableScale from "../../../src/PressableScale";
import GradientButton from "../../../src/GradientButton";
import { useToast } from "../../../src/Toast";

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_MAP: Record<string, number> = {
  jan:1, january:1, feb:2, february:2, mar:3, march:3, apr:4, april:4, may:5,
  jun:6, june:6, jul:7, july:7, aug:8, august:8, sep:9, sept:9, september:9,
  oct:10, october:10, nov:11, november:11, dec:12, december:12,
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
  let m: RegExpExecArray | null;
  while ((m = re.exec(n)) !== null) {
    const mon = m[1].toLowerCase();
    if (MONTH_MAP[mon]) {
      let yr = parseInt(m[2], 10);
      if (yr < 100) yr += 2000;
      return { month: MONTH_MAP[mon], year: yr };
    }
  }
  const yMatch = n.match(/\b(20\d{2})\b/);
  if (yMatch) return { month: null, year: parseInt(yMatch[1], 10) };
  return { month: null, year: null };
}

type Row = {
  id: string;
  uri: string;
  name: string;
  size: number;
  mimeType?: string;
  category: string;
  year: number;
  month: number | null;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  errorMsg?: string;
  resultName?: string;
};

export default function BulkUploadScreen() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  const pendingCount = useMemo(
    () => rows.filter((r) => r.status === "pending" || r.status === "error").length,
    [rows],
  );
  const doneCount = useMemo(() => rows.filter((r) => r.status === "done").length, [rows]);

  const pickFiles = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (res.canceled) return;
      const next: Row[] = [];
      for (const a of res.assets) {
        const name = a.name || "document.pdf";
        if (!name.toLowerCase().endsWith(".pdf")) continue;
        if (rows.some((r) => r.name === name && r.size === (a.size || 0))) continue;
        const c = detectCategory(name);
        const my = detectMonthYear(name);
        next.push({
          id: Math.random().toString(36).slice(2),
          uri: a.uri,
          name,
          size: a.size || 0,
          mimeType: a.mimeType,
          category: c,
          year: my.year ?? new Date().getFullYear(),
          month: my.month,
          status: "pending",
          progress: 0,
        });
      }
      if (next.length === 0) {
        Alert.alert("No new PDFs", "Either nothing was picked or the files are already in the queue.");
        return;
      }
      setRows((prev) => [...prev, ...next]);
    } catch (e: any) {
      Alert.alert("Picker error", String(e?.message || e));
    }
  };

  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  const uploadAll = async () => {
    if (rows.length === 0) return;
    setBusy(true);
    const token = await getToken();
    const indices = rows.map((r, i) => (r.status === "pending" || r.status === "error" ? i : -1)).filter((i) => i >= 0);
    for (const i of indices) {
      let row: Row | undefined;
      setRows((prev) => {
        row = prev[i];
        return prev.map((r, idx) => idx === i ? { ...r, status: "uploading", progress: 0, errorMsg: undefined } : r);
      });
      if (!row) continue;
      try {
        const form = new FormData();
        if (Platform.OS === "web") {
          const r = await fetch(row.uri); const blob = await r.blob();
          form.append("file", blob, row.name);
        } else {
          form.append("file", { uri: row.uri, name: row.name, type: row.mimeType || "application/pdf" } as any);
        }
        form.append("client_id", String(clientId || ""));
        form.append("category_override", row.category);
        form.append("year_override", String(row.year));
        if (row.month !== null) form.append("month_override", String(row.month));
        const resp = await api.post("/documents/upload", form, {
          headers: { "Content-Type": "multipart/form-data", Authorization: `Bearer ${token}` },
          onUploadProgress: (e) => {
            const pct = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
            setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, progress: pct } : r));
          },
        });
        const display = resp.data?.display_name || row.name;
        setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, status: "done", progress: 100, resultName: display } : r));
      } catch (e: any) {
        const msg = e?.response?.data?.detail || e?.message || "Upload failed";
        setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, status: "error", errorMsg: msg } : r));
      }
    }
    setBusy(false);
    const finalDone = rows.filter((r) => r.status === "done").length + (indices.length);
    toast.show(`Uploaded ${indices.length} document${indices.length !== 1 ? "s" : ""}`, { kind: "success", icon: "checkmark-circle" });
    void finalDone;
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F2F2F2" }}>
      <LinearGradient colors={["#1E40AF", "#3B82F6"]} start={{x:0,y:0}} end={{x:1,y:1}} style={st.headerGrad}>
        <SafeAreaView edges={["top"]}>
          <View style={st.headerRow}>
            <PressableScale onPress={() => router.back()} hapticStyle="light">
              <View style={st.backBtn}><Ionicons name="chevron-back" size={22} color="#fff" /></View>
            </PressableScale>
            <View style={{ flex: 1 }}>
              <Text style={st.title}>Bulk Upload</Text>
              <Text style={st.subtitle}>Pick multiple PDFs · auto-categorise · sequential upload</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
        <PressableScale onPress={pickFiles} disabled={busy}>
          <View style={st.pickCard}>
            <Ionicons name="documents-outline" size={28} color="#1E40AF" />
            <View style={{ flex: 1 }}>
              <Text style={st.pickTitle}>+ Add PDFs</Text>
              <Text style={st.pickSub}>{rows.length === 0 ? "Tap to pick multiple PDFs" : `${rows.length} queued · tap to add more`}</Text>
            </View>
          </View>
        </PressableScale>

        <View style={{ height: 12 }} />

        {rows.length === 0 ? (
          <View style={st.empty}>
            <Ionicons name="folder-open-outline" size={42} color="#9AA0A6" />
            <Text style={st.emptyText}>No files queued yet</Text>
          </View>
        ) : (
          rows.map((r) => (
            <View key={r.id} style={[st.row, st[`row_${r.status}` as const]]}>
              <Ionicons name="document-text" size={22} color="#1E40AF" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={st.rowName} numberOfLines={1}>{r.name}</Text>
                <View style={st.rowSubLine}>
                  <Text style={st.badge}>{CATEGORY_LABELS[r.category]}</Text>
                  {r.month && <Text style={st.badge}>{MONTHS_SHORT[r.month - 1]}</Text>}
                  <Text style={[st.badge, st.badgeYear]}>{r.year}</Text>
                  <Text style={st.sizeText}>{(r.size / 1024).toFixed(0)} KB</Text>
                </View>
                {r.status === "uploading" && (
                  <View style={st.bar}><View style={[st.barFill, { width: `${r.progress}%` }]} /></View>
                )}
                {r.status === "error" && r.errorMsg && (
                  <Text style={st.errText} numberOfLines={2}>⚠ {r.errorMsg}</Text>
                )}
                {r.status === "done" && (
                  <Text style={st.doneText}>✓ Uploaded</Text>
                )}
              </View>
              {r.status === "pending" && <Text style={[st.pill, st.pillPending]}>Pending</Text>}
              {r.status === "uploading" && <Text style={[st.pill, st.pillUploading]}>{r.progress}%</Text>}
              {r.status === "done" && <Text style={[st.pill, st.pillDone]}>Done</Text>}
              {r.status === "error" && <Text style={[st.pill, st.pillError]}>Failed</Text>}
              {!busy && r.status !== "uploading" && (
                <Pressable onPress={() => removeRow(r.id)} style={st.removeBtn} hitSlop={8}>
                  <Ionicons name="close" size={16} color="#80868B" />
                </Pressable>
              )}
            </View>
          ))
        )}

        {rows.length > 0 && (
          <View style={{ marginTop: 18 }}>
            <Text style={st.summary}>{doneCount}/{rows.length} uploaded · {pendingCount} pending</Text>
            <View style={{ height: 10 }} />
            <GradientButton
              label={busy ? "Uploading…" : `Upload all (${pendingCount})`}
              icon={busy ? "hourglass" : "cloud-upload"}
              onPress={uploadAll}
              disabled={busy || pendingCount === 0}
            />
            {!busy && doneCount > 0 && (
              <Pressable onPress={() => setRows([])} style={st.clearBtn}>
                <Text style={st.clearBtnText}>Clear list</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  headerGrad: {
    paddingHorizontal: 4,
    paddingBottom: 16,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingTop: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { color: "#DBEAFE", fontSize: 12, marginTop: 2 },

  pickCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 16,
    backgroundColor: "#fff",
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: "rgba(30,64,175,0.20)",
    ...(shadow as any).sm,
  },
  pickTitle: { fontSize: 16, fontWeight: "800", color: "#1E40AF", letterSpacing: -0.2 },
  pickSub: { fontSize: 12, color: "#5F6368", marginTop: 2 },

  empty: { alignItems: "center", paddingVertical: 32, gap: 10 },
  emptyText: { color: "#9AA0A6", fontSize: 13, fontWeight: "600" },

  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: "#fff",
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: 8,
  },
  row_pending: {},
  row_uploading: { borderColor: "#3B82F6", backgroundColor: "rgba(59,130,246,0.04)" },
  row_done: { borderColor: "#10B981", backgroundColor: "rgba(16,185,129,0.04)" },
  row_error: { borderColor: "#EF4444", backgroundColor: "rgba(239,68,68,0.04)" },

  rowName: { fontSize: 14, fontWeight: "700", color: "#1F2937" },
  rowSubLine: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 4 },
  badge: { fontSize: 10, fontWeight: "800", color: "#3730A3", backgroundColor: "#EEF2FF", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: "hidden" },
  badgeYear: { backgroundColor: "#ECFEFF", color: "#155E75" },
  sizeText: { fontSize: 11, color: "#80868B" },
  bar: { marginTop: 6, height: 4, backgroundColor: "rgba(59,130,246,0.15)", borderRadius: 999, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: "#3B82F6" },
  errText: { marginTop: 4, color: "#B91C1C", fontSize: 11, fontWeight: "600" },
  doneText: { marginTop: 4, color: "#047857", fontSize: 11, fontWeight: "600" },

  pill: { fontSize: 10, fontWeight: "800", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: "hidden", textTransform: "uppercase", letterSpacing: 0.5 },
  pillPending:   { backgroundColor: "#F1F5F9", color: "#475569" },
  pillUploading: { backgroundColor: "#DBEAFE", color: "#1E40AF" },
  pillDone:      { backgroundColor: "#D1FAE5", color: "#047857" },
  pillError:     { backgroundColor: "#FEE2E2", color: "#B91C1C" },

  removeBtn: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#F1F5F9" },
  summary: { color: "#5F6368", fontSize: 13, fontWeight: "600", textAlign: "center" },
  clearBtn: { alignSelf: "center", marginTop: 12, paddingVertical: 8, paddingHorizontal: 14 },
  clearBtnText: { color: "#5F6368", fontSize: 13, fontWeight: "700" },
});
