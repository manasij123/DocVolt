import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Animated,
  Easing,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import api, { CATEGORY_LABELS, Category, DocumentMeta, getToken } from "./api";
import { colors, radius, shadow, categoryGradients } from "./theme";
import { shareDocument, shareDocumentsBulk } from "./share";
import PressableScale from "./PressableScale";
import { useDocsSocket } from "./useDocsSocket";
import { useResponsive } from "./useResponsive";
import { useToast } from "./Toast";

type LegacyKey = "MONTHLY_RETURN" | "FORWARDING_LETTER" | "IFA_REPORT" | "OTHERS";

type Props = {
  /** Legacy enum prop — still supported for backward compatibility. */
  category?: LegacyKey;
  /** Preferred: full per-client Category object. When supplied, it takes
   * priority over `category` and drives the filter (by id) + visuals (color/icon/name). */
  cat?: Category | null;
  adminId?: string;
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  MONTHLY_RETURN: "Periodic monthly returns",
  FORWARDING_LETTER: "Cover & forwarding letters",
  IFA_REPORT: "Independent advisor reports",
  OTHERS: "Other documents",
};

const CATEGORY_ICONS: Record<string, keyof typeof import("@expo/vector-icons/build/Ionicons").default.glyphMap> = {
  MONTHLY_RETURN: "stats-chart",
  FORWARDING_LETTER: "paper-plane",
  IFA_REPORT: "podium",
  OTHERS: "folder",
};

function DocCard({
  doc, index, selecting, selected, onToggle, onLongPress,
}: {
  doc: DocumentMeta;
  index: number;
  selecting: boolean;
  selected: boolean;
  onToggle: () => void;
  onLongPress: () => void;
}) {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 360,
        delay: index * 60,
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: 0,
        duration: 360,
        delay: index * 60,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const grad = categoryGradients[doc.category] || categoryGradients.OTHERS;

  return (
    <Animated.View
      style={{
        opacity: fade,
        transform: [{ translateY: slide }],
      }}
    >
      <PressableScale
        haptic={selecting ? "light" : "light"}
        onPress={selecting ? onToggle : undefined}
        onLongPress={onLongPress}
        delayLongPress={350}
      >
        <View
          style={[styles.docCard, selected && styles.docCardSelected]}
          testID={`doc-card-${doc.id}`}
        >
          <LinearGradient
            colors={grad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.docIconWrap}
          >
            <Ionicons name="document-text" size={20} color="#fff" />
          </LinearGradient>

          <View style={styles.docMeta}>
            <Text style={styles.docTitle} numberOfLines={2}>
              {doc.display_name}
            </Text>
            <View style={styles.docTagRow}>
              {doc.month_label && (
                <View style={styles.tag}>
                  <Ionicons name="calendar" size={10} color={colors.textSecondary} />
                  <Text style={styles.tagText}>{doc.month_label}</Text>
                </View>
              )}
              <View style={styles.tag}>
                <Text style={[styles.tagText, { color: colors.accent }]}>{doc.year}</Text>
              </View>
              <Text style={styles.sizeText}>{(doc.size / 1024).toFixed(0)} KB</Text>
            </View>
          </View>

          {selecting ? (
            <View style={[styles.checkbox, selected && styles.checkboxOn]}>
              {selected && <Ionicons name="checkmark" size={18} color="#fff" />}
            </View>
          ) : (
            <PressableScale
              haptic="medium"
              onPress={() => shareDocument(doc)}
              testID={`btn-share-${doc.id}`}
            >
              <LinearGradient
                colors={["#3B82F6", "#8B5CF6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.shareBtn}
              >
                <Ionicons name="share-social" size={20} color="#fff" />
              </LinearGradient>
            </PressableScale>
          )}
        </View>
      </PressableScale>
    </Animated.View>
  );
}

export default function CategoryView({ category, cat, adminId }: Props) {
  // When a full Category object is passed (new per-client system), use it.
  // Otherwise fall back to the legacy enum-based defaults so existing callers
  // (e.g. tests) keep working.
  const effectiveKey: string = (cat?.key as string) || (category as string) || "OTHERS";
  const effectiveName: string = cat?.name || CATEGORY_LABELS[effectiveKey] || effectiveKey;
  const effectiveDesc: string = cat
    ? (cat.keywords.length > 0 ? `Auto-detected: ${cat.keywords.join(", ")}` : "Documents in this category")
    : (CATEGORY_DESCRIPTIONS[effectiveKey] || "Documents in this category");
  const effectiveIcon: any = (cat?.icon as any) || CATEGORY_ICONS[effectiveKey] || "folder";
  // Build a 2-stop gradient from the cat color (or fall back to the legacy palette)
  const heroGrad: readonly [string, string] = cat
    ? [cat.color, cat.color] as const
    : (categoryGradients[effectiveKey] || categoryGradients.OTHERS);
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Multi-select state for "Select multiple → Share as ZIP"
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sharing, setSharing] = useState(false);
  const toast = useToast();
  const exitSelection = () => { setSelecting(false); setSelected(new Set()); };
  const toggleId = (id: string) => {
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const { isDesktop, docColumns, listMaxWidth } = useResponsive();

  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(20)).current;

  const load = useCallback(async () => {
    try {
      const params: any = {};
      // Prefer category_id when we have a Category object; fall back to legacy key.
      if (cat?.id) params.category_id = cat.id;
      else if (category) params.category = category;
      if (adminId) params.admin_id = adminId;
      const res = await api.get<DocumentMeta[]>("/documents", { params });
      setDocuments(res.data);
      const yset = Array.from(new Set(res.data.map((d) => d.year))).sort((a, b) => b - a);
      setYears(yset);
      if (yset.length > 0) {
        setActiveYear((prev) => (prev && yset.includes(prev) ? prev : yset[0]));
      } else {
        setActiveYear(null);
      }
    } catch {
      setDocuments([]);
      setYears([]);
      setActiveYear(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category, cat?.id, adminId]);

  useEffect(() => {
    setLoading(true);
    load();
    headerFade.setValue(0);
    headerSlide.setValue(20);
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(headerSlide, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  // 🔴 Real-time sync: refresh on relevant doc events
  useDocsSocket((e) => {
    if (e.type === "doc:created" || e.type === "doc:updated") {
      const matchById = !!cat?.id && e.doc?.category_id === cat.id;
      const matchByKey = !cat?.id && e.doc?.category === effectiveKey;
      if (matchById || matchByKey) load();
    } else if (e.type === "doc:deleted") {
      if (documents.some((d) => d.id === e.id)) load();
    }
  });

  const filtered = activeYear ? documents.filter((d) => d.year === activeYear) : [];
  const grad = heroGrad;

  return (
    <View style={styles.container}>
      <View style={[styles.scroller, { maxWidth: listMaxWidth, alignSelf: "center", width: "100%" }]}>
      {/* Hero header card */}
      <Animated.View
        style={[
          styles.heroWrap,
          { opacity: headerFade, transform: [{ translateY: headerSlide }] },
        ]}
      >
        <LinearGradient
          colors={grad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTop}>
            <View style={styles.heroIconBox}>
              <Ionicons name={effectiveIcon} size={22} color="#fff" />
            </View>
            <View style={styles.heroCount}>
              <Text style={styles.heroCountNum}>{documents.length}</Text>
              <Text style={styles.heroCountLabel}>files</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>{effectiveName}</Text>
          <Text style={styles.heroSub}>{effectiveDesc}</Text>
        </LinearGradient>
      </Animated.View>

      {years.length === 0 && !loading ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <Ionicons name="folder-open-outline" size={42} color={colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No documents yet</Text>
          <Text style={styles.emptySub}>The admin will upload them shortly.</Text>
        </View>
      ) : (
        <>
          <View style={styles.yearRowOuter}>
            <FlatList
              data={years}
              keyExtractor={(y) => String(y)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.yearRow}
              renderItem={({ item }) => {
                const isActive = item === activeYear;
                return (
                  <PressableScale
                    haptic="light"
                    onPress={() => setActiveYear(item)}
                    testID={`year-chip-${item}`}
                  >
                    {isActive ? (
                      <LinearGradient
                        colors={["#0B1220", "#1E293B"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.yearChip, styles.yearChipActive]}
                      >
                        <Text style={[styles.yearChipText, styles.yearChipTextActive]}>
                          {item}
                        </Text>
                        <View style={styles.yearChipDot} />
                      </LinearGradient>
                    ) : (
                      <View style={styles.yearChip}>
                        <Text style={styles.yearChipText}>{item}</Text>
                      </View>
                    )}
                  </PressableScale>
                );
              }}
            />
          </View>

          <FlatList
            key={`grid-${docColumns}`}
            data={filtered}
            keyExtractor={(d) => d.id}
            numColumns={docColumns}
            columnWrapperStyle={docColumns > 1 ? { gap: 14 } : undefined}
            renderItem={({ item, index }) => (
              <View style={docColumns > 1 ? { flex: 1 } : undefined}>
                <DocCard
                  doc={item}
                  index={index}
                  selecting={selecting}
                  selected={selected.has(item.id)}
                  onToggle={() => toggleId(item.id)}
                  onLongPress={() => {
                    if (!selecting) setSelecting(true);
                    setSelected((p) => new Set(p).add(item.id));
                  }}
                />
              </View>
            )}
            contentContainerStyle={styles.docList}
            ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
            ListHeaderComponent={
              <View style={styles.bulkBar}>
                {!selecting ? (
                  <PressableScale
                    haptic="light"
                    onPress={() => setSelecting(true)}
                    testID="btn-select-multi"
                  >
                    <View style={styles.selectBtn}>
                      <Ionicons name="checkbox-outline" size={16} color="#1E40AF" />
                      <Text style={styles.selectBtnText}>Select</Text>
                    </View>
                  </PressableScale>
                ) : (
                  <>
                    <PressableScale
                      haptic="light"
                      onPress={() => {
                        const allSel = filtered.length > 0 && filtered.every((d) => selected.has(d.id));
                        setSelected((p) => {
                          const n = new Set(p);
                          for (const d of filtered) allSel ? n.delete(d.id) : n.add(d.id);
                          return n;
                        });
                      }}
                    >
                      <View style={styles.selectBtn}>
                        <Text style={styles.selectBtnText}>
                          {filtered.length > 0 && filtered.every((d) => selected.has(d.id)) ? "Deselect all" : "Select all"}
                        </Text>
                      </View>
                    </PressableScale>
                    <Text style={styles.selCount}>{selected.size} selected</Text>
                    <View style={{ flex: 1 }} />
                    <PressableScale
                      haptic="medium"
                      onPress={async () => {
                        if (selected.size === 0 || sharing) return;
                        setSharing(true);
                        try {
                          const tk = await getToken();
                          await shareDocumentsBulk(Array.from(selected), tk);
                          toast.show(`Shared ${selected.size} document${selected.size !== 1 ? "s" : ""}`, { kind: "success", icon: "share-social" });
                          exitSelection();
                        } catch (e: any) {
                          toast.show(e?.message || "Share failed", { kind: "error" });
                        } finally {
                          setSharing(false);
                        }
                      }}
                      disabled={selected.size === 0 || sharing}
                      testID="btn-share-multi"
                    >
                      <LinearGradient
                        colors={selected.size === 0 ? ["#94A3B8", "#94A3B8"] : ["#3B82F6", "#8B5CF6"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.shareMultiBtn}
                      >
                        <Ionicons name={sharing ? "hourglass" : "share-social"} size={16} color="#fff" />
                        <Text style={styles.shareMultiText}>
                          {sharing ? "Preparing…" : `Share (${selected.size})`}
                        </Text>
                      </LinearGradient>
                    </PressableScale>
                    <PressableScale haptic="light" onPress={exitSelection} disabled={sharing}>
                      <View style={styles.cancelBtn}>
                        <Ionicons name="close" size={16} color="#5F6368" />
                      </View>
                    </PressableScale>
                  </>
                )}
              </View>
            }
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
            }
            ListEmptyComponent={
              <View style={styles.emptyInner}>
                <Text style={styles.emptySub}>No documents for {activeYear}</Text>
              </View>
            }
          />
        </>
      )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroller: { flex: 1, paddingHorizontal: 6 },
  heroWrap: { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 4 },
  hero: {
    borderRadius: radius.xl,
    padding: 20,
    ...shadow.md,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  heroIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroCount: {
    flexDirection: "row",
    alignItems: "baseline",
    backgroundColor: "rgba(255,255,255,0.20)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 4,
  },
  heroCountNum: { color: "#fff", fontWeight: "800", fontSize: 14 },
  heroCountLabel: { color: "#E0E7FF", fontWeight: "600", fontSize: 11 },
  heroTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  heroSub: {
    color: "rgba(255,255,255,0.85)",
    marginTop: 4,
    fontSize: 13,
  },

  yearRowOuter: { paddingTop: 6 },
  yearRow: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 10,
  },
  yearChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: 8,
    gap: 8,
    ...shadow.sm,
  },
  yearChipActive: {
    borderColor: "transparent",
  },
  yearChipText: {
    color: colors.textSecondary,
    fontWeight: "700",
    fontSize: 14,
  },
  yearChipTextActive: { color: "#fff" },
  yearChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#3B82F6",
  },

  docList: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 40,
  },
  docCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  docCardSelected: {
    borderColor: "#3B82F6",
    backgroundColor: "rgba(59,130,246,0.05)",
  },
  checkbox: {
    width: 28, height: 28, borderRadius: 8,
    borderWidth: 2, borderColor: "#94A3B8",
    backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
    marginLeft: 8,
  },
  checkboxOn: {
    borderColor: "#3B82F6",
    backgroundColor: "#3B82F6",
  },

  // Multi-select toolbar shown above the doc list
  bulkBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  selectBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1, borderColor: "rgba(30,64,175,0.20)",
  },
  selectBtnText: { color: "#1E40AF", fontSize: 13, fontWeight: "800", letterSpacing: -0.2 },
  selCount: {
    fontSize: 12, fontWeight: "800",
    color: "#1E40AF",
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999,
  },
  shareMultiBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 999,
  },
  shareMultiText: { color: "#fff", fontSize: 13, fontWeight: "800", letterSpacing: -0.2 },
  cancelBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#F1F5F9",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  docIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  docMeta: { flex: 1, minWidth: 0, marginRight: 8 },
  docTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
    letterSpacing: -0.1,
  },
  docTagRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 6,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.inputBg,
    gap: 4,
  },
  tagText: { color: colors.textSecondary, fontSize: 11, fontWeight: "700" },
  sizeText: { color: colors.textMuted, fontSize: 11, marginLeft: 4 },
  shareBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },

  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 36,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  emptySub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 6,
    textAlign: "center",
  },
  emptyInner: {
    alignItems: "center",
    padding: 40,
  },
});
