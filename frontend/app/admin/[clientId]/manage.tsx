import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api, { CATEGORY_LABELS, DocumentMeta } from "../../../src/api";
import { colors, radius, shadow, categoryGradients } from "../../../src/theme";
import { LinearGradient } from "expo-linear-gradient";
import PressableScale from "../../../src/PressableScale";
import GradientButton from "../../../src/GradientButton";
import { useDocsSocket } from "../../../src/useDocsSocket";
import { useLocalSearchParams } from "expo-router";

const MONTHS = [
  { v: 1, l: "Jan" }, { v: 2, l: "Feb" }, { v: 3, l: "Mar" }, { v: 4, l: "Apr" },
  { v: 5, l: "May" }, { v: 6, l: "Jun" }, { v: 7, l: "Jul" }, { v: 8, l: "Aug" },
  { v: 9, l: "Sep" }, { v: 10, l: "Oct" }, { v: 11, l: "Nov" }, { v: 12, l: "Dec" },
];

export default function ManageScreen() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterCat, setFilterCat] = useState<string>("ALL");

  const [editing, setEditing] = useState<DocumentMeta | null>(null);
  const [editName, setEditName] = useState("");
  const [editCat, setEditCat] = useState<string>("OTHERS");
  const [editYear, setEditYear] = useState<number>(new Date().getFullYear());
  const [editMonth, setEditMonth] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<DocumentMeta[]>("/documents", { params: { client_id: clientId } });
      setDocs(res.data);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  // 🔴 Real-time sync (WhatsApp-Web style) — keeps the manage list in sync
  // with the website / other devices without needing pull-to-refresh.
  useDocsSocket((e) => {
    if (e.type === "doc:created") {
      setDocs((prev) => (prev.some((d) => d.id === e.doc.id) ? prev : [e.doc, ...prev]));
    } else if (e.type === "doc:updated") {
      setDocs((prev) => prev.map((d) => (d.id === e.doc.id ? e.doc : d)));
    } else if (e.type === "doc:deleted") {
      setDocs((prev) => prev.filter((d) => d.id !== e.id));
    }
  });

  const onDelete = (doc: DocumentMeta) => {
    const proceed = async () => {
      try {
        await api.delete(`/documents/${doc.id}`);
        setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      } catch (e: any) {
        Alert.alert("Delete failed", e?.message || "Try again");
      }
    };
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(`Delete "${doc.display_name}"?`)) {
        proceed();
      }
      return;
    }
    Alert.alert("Delete document?", doc.display_name, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: proceed },
    ]);
  };

  const openEdit = (doc: DocumentMeta) => {
    setEditing(doc);
    setEditName(doc.display_name);
    setEditCat(doc.category);
    setEditYear(doc.year);
    setEditMonth(doc.month);
  };

  const closeEdit = () => {
    setEditing(null);
    setSaving(false);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await api.put<DocumentMeta>(`/documents/${editing.id}`, {
        display_name: editName,
        category: editCat,
        year: editYear,
        month: editMonth,
      });
      setDocs((prev) => prev.map((d) => (d.id === editing.id ? res.data : d)));
      closeEdit();
    } catch (e: any) {
      Alert.alert("Save failed", e?.message || "Try again");
      setSaving(false);
    }
  };

  const filtered = filterCat === "ALL" ? docs : docs.filter((d) => d.category === filterCat);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const renderItem = ({ item }: { item: DocumentMeta }) => {
    const grad = categoryGradients[item.category] || categoryGradients.OTHERS;
    return (
      <View style={styles.card} testID={`manage-card-${item.id}`}>
        <LinearGradient
          colors={grad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconWrap}
        >
          <Ionicons name="document-text" size={18} color="#fff" />
        </LinearGradient>
        <View style={styles.metaWrap}>
          <Text style={styles.docTitle} numberOfLines={2}>{item.display_name}</Text>
          <Text style={styles.docSub} numberOfLines={1}>
            {CATEGORY_LABELS[item.category]} · {item.month_label ? `${item.month_label} ` : ""}{item.year}
          </Text>
        </View>
        <View style={styles.actions}>
          <PressableScale onPress={() => openEdit(item)} haptic="light" testID={`btn-edit-${item.id}`}>
            <View style={[styles.iconBtn, styles.editBtn]}>
              <Ionicons name="create-outline" size={18} color={colors.accent} />
            </View>
          </PressableScale>
          <PressableScale onPress={() => onDelete(item)} haptic="medium" testID={`btn-delete-${item.id}`}>
            <View style={[styles.iconBtn, styles.delBtn]}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </View>
          </PressableScale>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
    <View style={styles.inner}>
      <Text style={styles.title}>Manage Documents</Text>
      <Text style={styles.subtitle}>{docs.length} total</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {["ALL", "MONTHLY_RETURN", "FORWARDING_LETTER", "IFA_REPORT", "OTHERS"].map((k) => {
          const active = k === filterCat;
          const label = k === "ALL" ? "All" : CATEGORY_LABELS[k];
          return (
            <PressableScale key={k} onPress={() => setFilterCat(k)} haptic="light">
              <View
                style={[
                  styles.filterChip,
                  active ? styles.filterChipActive : null,
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.filterText,
                    active ? styles.filterTextActive : null,
                  ]}
                >
                  {label}
                </Text>
              </View>
            </PressableScale>
          );
        })}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={(d) => d.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 24, paddingTop: 8, paddingBottom: 80 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        ListEmptyComponent={
          <View style={[styles.center, { paddingVertical: 60 }]}>
            <Ionicons name="folder-open-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.empty}>No documents</Text>
          </View>
        }
      />
    </View>

      <Modal visible={!!editing} animationType="slide" transparent onRequestClose={closeEdit}>
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={closeEdit} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Edit Document</Text>

            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 480 }}>
              <Text style={styles.label}>Display Name</Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                style={styles.input}
                placeholderTextColor={colors.textSecondary}
                testID="input-edit-name"
              />

              <Text style={styles.label}>Category</Text>
              <View style={styles.chipRow}>
                {Object.keys(CATEGORY_LABELS).map((k) => {
                  const active = k === editCat;
                  return (
                    <TouchableOpacity key={k} style={[styles.chip, active && styles.chipActive]} onPress={() => setEditCat(k)}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{CATEGORY_LABELS[k]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Year</Text>
              <TextInput
                value={String(editYear)}
                onChangeText={(t) => setEditYear(parseInt(t.replace(/[^0-9]/g, "") || "0", 10) || 0)}
                keyboardType="number-pad"
                style={styles.input}
                testID="input-edit-year"
              />

              <Text style={styles.label}>Month</Text>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, editMonth === null && styles.chipActive]}
                  onPress={() => setEditMonth(null)}
                >
                  <Text style={[styles.chipText, editMonth === null && styles.chipTextActive]}>None</Text>
                </TouchableOpacity>
                {MONTHS.map((m) => {
                  const active = m.v === editMonth;
                  return (
                    <TouchableOpacity key={m.v} style={[styles.chip, active && styles.chipActive]} onPress={() => setEditMonth(m.v)}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{m.l}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.sheetActions}>
              <View style={{ flex: 1 }}>
                <GradientButton title="Cancel" variant="ghost" onPress={closeEdit} />
              </View>
              <View style={{ flex: 1 }}>
                <GradientButton
                  title="Save"
                  icon="checkmark"
                  onPress={saveEdit}
                  loading={saving}
                  testID="btn-save-edit"
                  haptic="medium"
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  inner: { flex: 1, maxWidth: 1100, width: "100%", alignSelf: "center" },
  title: { fontSize: 24, fontWeight: "700", color: colors.textPrimary, paddingHorizontal: 24, paddingTop: 16 },
  subtitle: { fontSize: 13, color: colors.textSecondary, paddingHorizontal: 24, marginTop: 4 },
  filterRow: { paddingHorizontal: 24, paddingVertical: 14, gap: 8 },
  filterChip: {
    minHeight: 38,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
  filterTextActive: { color: "#fff", fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { color: colors.textSecondary, marginTop: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    ...shadow.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.iconBlueBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  metaWrap: { flex: 1, minWidth: 0, marginRight: 8 },
  docTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  docSub: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  actions: { flexDirection: "row", gap: 8, flexShrink: 0 },
  iconBtn: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  editBtn: { backgroundColor: colors.iconBlueBg },
  delBtn: { backgroundColor: "#FEF2F2" },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: colors.textPrimary, marginBottom: 12 },
  label: { fontSize: 12, fontWeight: "700", color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 14, marginBottom: 8 },
  input: {
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.textPrimary,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  sheetActions: { flexDirection: "row", gap: 12, marginTop: 20 },
  sheetBtn: { flex: 1, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  btnCancel: { backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border },
  btnCancelText: { color: colors.textPrimary, fontWeight: "700" },
  btnSave: { backgroundColor: colors.accent },
  btnSaveText: { color: "#fff", fontWeight: "700" },
});
