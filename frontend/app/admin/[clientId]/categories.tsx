import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import {
  Category,
  listCategories,
  createCategory,
  updateCategoryApi,
  deleteCategoryApi,
  generateCategoryIcon,
  CATEGORY_COLOR_PRESETS,
  CATEGORY_ICON_PRESETS,
  getToken,
} from "../../../src/api";
import { colors, radius } from "../../../src/theme";
import { useDocsSocket } from "../../../src/useDocsSocket";
import { suggestColorFromText } from "../../../src/colorTheme";
import { useToast } from "../../../src/Toast";
import GradientButton from "../../../src/GradientButton";
import PressableScale from "../../../src/PressableScale";

export default function CategoriesScreen() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const toast = useToast();

  const reload = async () => {
    if (!clientId) {
      // No clientId on first render; don't leave the spinner forever.
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const token = await getToken();
      const list = await listCategories({ client_id: String(clientId) }, token || undefined);
      setCats(list);
    } catch (e: any) {
      console.error("[categories] load failed", e?.response?.status, e?.response?.data, "clientId=", clientId);
      const msg = e?.response?.data?.detail || "Failed to load categories";
      toast?.show?.(msg, { kind: "error", icon: "alert-circle" });
      setCats([]); // show empty state instead of infinite spinner
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-line */ }, [clientId]);

  // Real-time updates from web admin or other clients
  useDocsSocket((e: any) => {
    if (!e || !clientId) return;
    if (e.type === "category:created" && e.category?.client_id === clientId) {
      setCats((p) => p.some((c) => c.id === e.category.id) ? p : [...p, e.category].sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)));
    } else if (e.type === "category:updated" && e.category?.client_id === clientId) {
      setCats((p) => p.map((c) => (c.id === e.category.id ? e.category : c)));
    } else if (e.type === "category:deleted" && e.client_id === clientId) {
      setCats((p) => p.filter((c) => c.id !== e.id));
    }
  });

  const remove = async (c: Category) => {
    Alert.alert(
      `Delete "${c.name}"?`,
      `Any documents in this category will be moved to "Others".`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setBusyId(c.id);
            try {
              const token = await getToken();
              const r = await deleteCategoryApi(c.id, token || undefined);
              toast?.show?.(
                r.moved_to_others > 0
                  ? `Deleted. ${r.moved_to_others} doc${r.moved_to_others === 1 ? "" : "s"} moved to Others.`
                  : "Category deleted",
                { kind: "success", icon: "checkmark-circle" }
              );
              reload();
            } catch (e: any) {
              const msg = e?.response?.data?.detail || "Delete failed";
              toast?.show?.(msg, { kind: "error", icon: "alert-circle" });
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Categories</Text>
            <Text style={s.sub} numberOfLines={2}>
              Customise tab labels for this client. Renaming the 4 defaults is OK; "Others" can't be deleted.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={{ padding: 30, alignItems: "center" }}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : cats.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="pricetags-outline" size={50} color="#94A3B8" />
            <Text style={s.emptyText}>No categories yet</Text>
          </View>
        ) : (
          cats.map((c) => (
            <View key={c.id} style={s.row}>
              <View style={[s.iconBox, { backgroundColor: c.custom_icon_b64 ? "#fff" : `${c.color}1a`, borderColor: `${c.color}33`, padding: c.custom_icon_b64 ? 0 : undefined, overflow: "hidden" }]}>
                {c.custom_icon_b64 ? (
                  <Image source={{ uri: `data:image/png;base64,${c.custom_icon_b64}` }} style={{ width: 44, height: 44 }} resizeMode="cover" />
                ) : (
                  <Ionicons name={c.icon as any} size={22} color={c.color} />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.name} numberOfLines={1}>{c.name}</Text>
                <View style={s.metaRow}>
                  {c.is_default && (
                    <View style={s.badge}><Text style={s.badgeText}>Default</Text></View>
                  )}
                  {c.keywords.length > 0 && (
                    <Text style={s.kw} numberOfLines={1}>
                      {c.keywords.slice(0, 3).join(", ")}{c.keywords.length > 3 ? "…" : ""}
                    </Text>
                  )}
                </View>
              </View>
              <PressableScale onPress={() => setEditingCat(c)}>
                <View style={s.editBtn}>
                  <Ionicons name="create-outline" size={18} color={colors.accent} />
                </View>
              </PressableScale>
              {c.key !== "OTHERS" && (
                <PressableScale onPress={() => remove(c)}>
                  <View style={s.deleteBtn}>
                    {busyId === c.id ? (
                      <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    )}
                  </View>
                </PressableScale>
              )}
            </View>
          ))
        )}
      </ScrollView>

      <View style={s.fabWrap}>
        <GradientButton
          icon="add-circle"
          title="New Category"
          onPress={() => {
            console.log("[categories] New Category tapped, clientId=", clientId);
            setCreating(true);
          }}
        />
      </View>

      {/* Modal is ALWAYS mounted and controlled by `visible` prop — this is the
          standard React Native pattern and avoids any cases where a conditional
          render could cause the Modal not to appear. `key` forces a fresh
          mount per open, so form state (name/color/icon) resets reliably. */}
      <CategoryEditorModal
        key={editingCat?.id || (creating ? "new" : "idle")}
        visible={creating || !!editingCat}
        clientId={clientId ? String(clientId) : ""}
        existing={editingCat}
        onClose={() => { setCreating(false); setEditingCat(null); }}
        onSaved={() => { setCreating(false); setEditingCat(null); reload(); toast?.show?.(editingCat ? "Saved" : "Created", { kind: "success", icon: "checkmark-circle" }); }}
      />
    </View>
  );
}

function CategoryEditorModal({ visible, clientId, existing, onClose, onSaved }: {
  visible: boolean;
  clientId: string;
  existing: Category | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(existing?.name || "");
  const [color, setColor] = useState(existing?.color || CATEGORY_COLOR_PRESETS[0]);
  const [icon, setIcon] = useState(existing?.icon || "folder-open");
  const [keywordsRaw, setKeywordsRaw] = useState((existing?.keywords || []).join(", "));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // AI icon generation state
  const [aiOpen, setAiOpen] = useState(!!existing?.custom_icon_b64);
  const [aiDesc, setAiDesc] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiPreview, setAiPreview] = useState<string | null>(existing?.custom_icon_b64 || null);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [colorPickedManually, setColorPickedManually] = useState(!!existing?.color);
  const [colorAutoSuggested, setColorAutoSuggested] = useState(false);

  const generate = async () => {
    if (!aiDesc.trim() || aiDesc.trim().length < 5) {
      setAiErr("Please describe the icon in a few words (min 5 characters)");
      return;
    }
    setAiBusy(true); setAiErr(null);
    if (!colorPickedManually) {
      const suggested = suggestColorFromText(`${name} ${aiDesc} ${keywordsRaw}`);
      if (suggested) {
        setColor(suggested);
        setColorAutoSuggested(true);
      }
    }
    try {
      const tok = await getToken();
      const r = await generateCategoryIcon({ description: aiDesc.trim() }, tok || undefined);
      setAiPreview(r.image_base64);
    } catch (e: any) {
      setAiErr(e?.response?.data?.detail || "Generation failed. Please try again.");
    } finally {
      setAiBusy(false);
    }
  };

  const save = async () => {
    if (!name.trim()) {
      setErr("Name is required");
      return;
    }
    if (!clientId || clientId === "undefined") {
      setErr("Client ID missing. Please close this dialog, go back to the client list and re-open this client.");
      return;
    }
    setSaving(true);
    setErr(null);
    const keywords = keywordsRaw.split(",").map((k) => k.trim()).filter(Boolean);
    try {
      const token = await getToken();
      if (existing) {
        await updateCategoryApi(existing.id, {
          name: name.trim(), color, icon, keywords,
          custom_icon_b64: aiPreview || "",
        } as any, token || undefined);
      } else {
        // Atomic create — include the AI icon in the POST so the row never
        // appears with the default preset icon before the custom one loads.
        await createCategory({
          client_id: clientId,
          name: name.trim(),
          color,
          icon,
          keywords,
          custom_icon_b64: aiPreview || undefined,
        } as any, token || undefined);
      }
      onSaved();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Save failed");
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={s.modalBack}
      >
        <View style={s.modalCard}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle}>{existing ? "Edit Category" : "New Category"}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#475569" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 540 }} showsVerticalScrollIndicator={false}>
            {err && (
              <View style={s.errBox}>
                <Ionicons name="alert-circle" size={16} color="#B91C1C" />
                <Text style={s.errText}>{err}</Text>
              </View>
            )}

            <Text style={s.fieldLabel}>Name</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Invoice, Tax Filing, Bank Statement"
              maxLength={40}
              placeholderTextColor="#94A3B8"
            />

            <Text style={s.fieldLabel}>Color</Text>
            {colorAutoSuggested && !colorPickedManually && (
              <View style={s.autoBadge}>
                <Ionicons name="sparkles" size={11} color="#7C3AED" />
                <Text style={s.autoBadgeText}>Auto-suggested from your AI prompt</Text>
              </View>
            )}
            <View style={s.swatchRow}>
              {CATEGORY_COLOR_PRESETS.map((c) => (
                <PressableScale key={c} onPress={() => { setColor(c); setColorPickedManually(true); setColorAutoSuggested(false); }}>
                  <View style={[s.swatch, { backgroundColor: c, borderColor: color === c ? "#0F172A" : "transparent", borderWidth: color === c ? 3 : 1 }]}>
                    {color === c && <Ionicons name="checkmark" size={18} color="#fff" />}
                  </View>
                </PressableScale>
              ))}
            </View>
            {/* Free hex picker — type any #RRGGBB and the swatch updates live. */}
            <View style={s.hexRow}>
              <View style={[s.hexPreview, { backgroundColor: color }]} />
              <TextInput
                style={s.hexInput}
                value={color}
                onChangeText={(v) => {
                  let t = v.trim();
                  if (t && !t.startsWith("#")) t = "#" + t;
                  setColor(t.slice(0, 9));
                  setColorPickedManually(true);
                  setColorAutoSuggested(false);
                }}
                placeholder="#3B82F6"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={9}
              />
              <Text style={s.hexHint}>Any HEX</Text>
            </View>

            <Text style={s.fieldLabel}>✨ Custom icon with AI</Text>
            {!aiOpen ? (
              <TouchableOpacity onPress={() => setAiOpen(true)} style={s.aiOpenBtn}>
                <Ionicons name="sparkles" size={18} color="#7C3AED" />
                <Text style={s.aiOpenText}>Generate icon with AI</Text>
              </TouchableOpacity>
            ) : (
              <View style={s.aiBox}>
                <Text style={s.helperText}>
                  Describe what icon you want. Tip: name the subject, mention style ("flat", "minimal"), avoid text or scenes.
                </Text>
                <Text style={[s.helperText, { fontSize: 11, fontStyle: "italic", marginTop: 2 }]}>
                  e.g. "iron tablet pill being given to a school student"
                </Text>
                <TextInput
                  style={[s.input, { minHeight: 60, textAlignVertical: "top" }]}
                  value={aiDesc}
                  onChangeText={setAiDesc}
                  placeholder="Describe the icon…"
                  placeholderTextColor="#94A3B8"
                  multiline
                  maxLength={400}
                />
                {aiErr && (
                  <View style={s.errBox}>
                    <Ionicons name="alert-circle" size={14} color="#B91C1C" />
                    <Text style={s.errText}>{aiErr}</Text>
                  </View>
                )}
                <View style={{ flexDirection: "row", gap: 8, marginTop: 10, alignItems: "center" }}>
                  <TouchableOpacity onPress={generate} disabled={aiBusy} style={[s.aiGenBtn, aiBusy && { opacity: 0.6 }]}>
                    {aiBusy ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name={aiPreview ? "refresh" : "sparkles"} size={16} color="#fff" />
                    )}
                    <Text style={s.aiGenText}>
                      {aiBusy ? "Generating… (~30s)" : (aiPreview ? "Regenerate" : "Generate")}
                    </Text>
                  </TouchableOpacity>
                  {aiPreview && (
                    <TouchableOpacity onPress={() => { setAiPreview(null); setAiDesc(""); }} style={s.aiClearBtn}>
                      <Text style={s.aiClearText}>✕ Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {aiBusy && <Text style={[s.helperText, { marginTop: 6 }]}>This typically takes 30-60 seconds.</Text>}
                {aiPreview && (
                  <View style={s.aiPreviewBox}>
                    <Image
                      source={{ uri: `data:image/png;base64,${aiPreview}` }}
                      style={[s.aiPreviewImg, { borderColor: color }]}
                      resizeMode="cover"
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ fontWeight: "800", fontSize: 13, color: "#0F172A" }}>Your AI icon</Text>
                      <Text style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                        Will replace the emoji icon when saved.
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            <Text style={s.fieldLabel}>{aiPreview ? "Fallback icon" : "Icon"}</Text>
            <View style={[s.iconGrid, aiPreview && { opacity: 0.5 }]}>
              {CATEGORY_ICON_PRESETS.map((p) => {
                const active = !aiPreview && icon === p.name;
                return (
                  <PressableScale key={p.name} onPress={() => setIcon(p.name)}>
                    <View style={[s.iconChoice, active && { borderColor: color, backgroundColor: `${color}1a` }]}>
                      <Ionicons name={p.name as any} size={20} color={active ? color : "#475569"} />
                    </View>
                  </PressableScale>
                );
              })}
            </View>
            {aiPreview && (
              <Text style={[s.helperText, { color: "#10B981", marginTop: 4 }]}>
                ✓ AI-generated icon is active. The preset icon is only used if you remove the custom icon.
              </Text>
            )}

            <Text style={s.fieldLabel}>Keywords</Text>
            <Text style={s.helperText}>
              Comma separated. Used to auto-detect category when uploading by filename.
            </Text>
            <TextInput
              style={s.input}
              value={keywordsRaw}
              onChangeText={setKeywordsRaw}
              placeholder="invoice, bill, inv"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
            />
          </ScrollView>

          <View style={s.modalActions}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <GradientButton
                icon={existing ? "checkmark" : "add"}
                title={saving ? "Saving…" : (existing ? "Save" : "Create")}
                onPress={save}
                disabled={saving}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  title: { fontSize: 22, fontWeight: "800", color: colors.textPrimary },
  sub: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  empty: { padding: 60, alignItems: "center", gap: 10 },
  emptyText: { color: "#64748B", fontSize: 14 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconBox: {
    width: 44, height: 44, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
  },
  name: { fontSize: 15, fontWeight: "800", color: colors.textPrimary },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" },
  badge: { backgroundColor: "#EEF2FF", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { color: "#4F46E5", fontWeight: "700", fontSize: 10 },
  kw: { color: "#64748B", fontSize: 12, flexShrink: 1 },

  editBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#EEF2FF",
    alignItems: "center", justifyContent: "center",
  },
  deleteBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#FEF2F2",
    alignItems: "center", justifyContent: "center",
  },

  fabWrap: { position: "absolute", bottom: 16, left: 16, right: 16 },

  // Modal
  modalBack: { flex: 1, backgroundColor: "rgba(15,23,42,0.50)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 28,
    maxHeight: "92%",
  },
  modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: colors.textPrimary },

  fieldLabel: { fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, color: "#64748B", marginTop: 14, marginBottom: 8 },
  helperText: { fontSize: 12, color: "#64748B", marginTop: -4, marginBottom: 6 },
  input: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },

  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  swatch: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center",
  },

  hexRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginTop: 10,
  },
  hexPreview: {
    width: 38, height: 38, borderRadius: 10,
    borderWidth: 2, borderColor: "#0F172A22",
  },
  hexInput: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, fontWeight: "700",
    color: colors.textPrimary,
    borderWidth: 1, borderColor: colors.border,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  hexHint: { fontSize: 11, color: "#64748B", fontWeight: "700" },

  autoBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    alignSelf: "flex-start",
    backgroundColor: "#F3E8FF",
    borderColor: "#C4B5FD",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
    marginBottom: 8,
  },
  autoBadgeText: { fontSize: 11, fontWeight: "700", color: "#7C3AED" },

  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  iconChoice: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: "#F1F5F9",
    borderWidth: 1.5, borderColor: "transparent",
    alignItems: "center", justifyContent: "center",
  },

  errBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FEF2F2", padding: 10, borderRadius: 8, marginBottom: 8 },
  errText: { color: "#B91C1C", fontSize: 12, fontWeight: "700", flex: 1 },

  // AI generation styles
  aiOpenBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "#EEF2FF", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: "#C7D2FE",
  },
  aiOpenText: { color: "#7C3AED", fontWeight: "800", fontSize: 13 },
  aiBox: {
    backgroundColor: "#F5F3FF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  aiGenBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#7C3AED",
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10,
  },
  aiGenText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  aiClearBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  aiClearText: { color: "#64748B", fontWeight: "700", fontSize: 12 },
  aiPreviewBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 12, padding: 10, marginTop: 12,
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  aiPreviewImg: { width: 70, height: 70, borderRadius: 12, borderWidth: 3 },

  modalActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  cancelBtn: { paddingHorizontal: 18, justifyContent: "center", borderRadius: 10, backgroundColor: "#F1F5F9" },
  cancelText: { color: colors.textSecondary, fontWeight: "700", fontSize: 14 },
});
