import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import CategoryView from "../../../src/CategoryView";
import { Category, listCategories, getToken } from "../../../src/api";
import { colors } from "../../../src/theme";
import PressableScale from "../../../src/PressableScale";
import { useDocsSocket } from "../../../src/useDocsSocket";

/**
 * Per-admin client landing page.
 *
 * Renders a horizontally scrollable category-pill bar at the top
 * (showing every category the admin has set up — defaults + custom)
 * and the selected category's CategoryView underneath.
 *
 * Replaces the previous fixed Tabs nav (monthly/forwarding/ifa/others)
 * so custom admin categories also reach the client.
 */
export default function ClientAdminLanding() {
  const { adminId } = useLocalSearchParams<{ adminId: string }>();
  const [cats, setCats] = useState<Category[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    if (!adminId) return;
    try {
      const tok = await getToken();
      const list = await listCategories({ admin_id: String(adminId) }, tok || undefined);
      setCats(list);
      // Preserve selection if still present, otherwise pick the first row.
      setActiveId((prev) => (prev && list.some((c) => c.id === prev) ? prev : (list[0]?.id || "")));
    } catch {
      setCats([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [adminId]);

  // Keep the pill-bar in sync with admin-side category changes in real time.
  useDocsSocket((e: any) => {
    if (!e || !adminId) return;
    if (e.type === "category:created" && e.category?.admin_id === adminId) {
      setCats((p) => p.some((c) => c.id === e.category.id) ? p : [...p, e.category].sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)));
    } else if (e.type === "category:updated" && e.category?.admin_id === adminId) {
      setCats((p) => p.map((c) => (c.id === e.category.id ? e.category : c)));
    } else if (e.type === "category:deleted" && e.admin_id === adminId) {
      setCats((p) => {
        const next = p.filter((c) => c.id !== e.id);
        if (activeId === e.id) setActiveId(next[0]?.id || "");
        return next;
      });
    }
  });

  const activeCat: Category | null = useMemo(
    () => cats.find((c) => c.id === activeId) || null,
    [cats, activeId],
  );

  if (loading) {
    return (
      <View style={[s.root, s.center]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (cats.length === 0) {
    return (
      <View style={[s.root, s.center]}>
        <Ionicons name="folder-open-outline" size={50} color="#94A3B8" />
        <Text style={s.emptyTitle}>No categories yet</Text>
        <Text style={s.emptySub}>The admin hasn't set up any tabs.</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Horizontally scrollable category pill bar */}
      <View style={s.pillsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.pillsRow}
        >
          {cats.map((c) => {
            const active = c.id === activeId;
            return (
              <PressableScale key={c.id} onPress={() => setActiveId(c.id)} haptic="light">
                <View
                  style={[
                    s.pill,
                    active ? { borderColor: c.color, backgroundColor: `${c.color}1a` } : null,
                  ]}
                >
                  <Ionicons
                    name={c.icon as any}
                    size={15}
                    color={active ? c.color : "#64748B"}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    numberOfLines={1}
                    style={[s.pillText, active ? { color: c.color } : null]}
                  >
                    {c.name}
                  </Text>
                </View>
              </PressableScale>
            );
          })}
        </ScrollView>
      </View>

      {/* Selected category — full doc list lives in CategoryView */}
      <View style={{ flex: 1 }}>
        {activeCat && (
          <CategoryView
            key={activeCat.id}
            cat={activeCat}
            adminId={String(adminId || "")}
          />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: "center", justifyContent: "center", padding: 30 },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: colors.text, marginTop: 14 },
  emptySub: { fontSize: 13, color: "#64748B", marginTop: 6, textAlign: "center" },

  pillsWrap: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: 60,
  },
  pillsRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    alignItems: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  pillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
});
