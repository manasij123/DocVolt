import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api, { CATEGORY_LABELS, DocumentMeta } from "./api";
import { colors, radius, shadow } from "./theme";
import { shareDocument } from "./share";

type Props = {
  category: "MONTHLY_RETURN" | "FORWARDING_LETTER" | "IFA_REPORT" | "OTHERS";
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function CategoryView({ category }: Props) {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<DocumentMeta[]>("/documents", { params: { category } });
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
  }, [category]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const filtered = activeYear ? documents.filter((d) => d.year === activeYear) : [];

  const renderDoc = ({ item }: { item: DocumentMeta }) => (
    <View style={styles.docCard} testID={`doc-card-${item.id}`}>
      <View style={styles.docIconWrap}>
        <Ionicons name="document-text" size={22} color={colors.accent} />
      </View>
      <View style={styles.docMeta}>
        <Text style={styles.docTitle} numberOfLines={2}>
          {item.display_name}
        </Text>
        <Text style={styles.docSub}>
          {item.month_label ? `${item.month_label} ` : ""}
          {item.year} · {(item.size / 1024).toFixed(0)} KB
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => shareDocument(item)}
        style={styles.shareBtn}
        testID={`btn-share-${item.id}`}
      >
        <Ionicons name="share-social" size={22} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{CATEGORY_LABELS[category]}</Text>
      <Text style={styles.subheading}>{documents.length} document{documents.length === 1 ? "" : "s"}</Text>

      {years.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="folder-open-outline" size={56} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>No documents yet</Text>
          <Text style={styles.emptySub}>The admin will upload them shortly.</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={years}
            keyExtractor={(y) => String(y)}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.yearRow}
            renderItem={({ item }) => {
              const isActive = item === activeYear;
              return (
                <TouchableOpacity
                  onPress={() => setActiveYear(item)}
                  style={[styles.yearChip, isActive && styles.yearChipActive]}
                  testID={`year-chip-${item}`}
                >
                  <Text style={[styles.yearChipText, isActive && styles.yearChipTextActive]}>{item}</Text>
                </TouchableOpacity>
              );
            }}
          />

          <FlatList
            data={filtered}
            keyExtractor={(d) => d.id}
            renderItem={renderDoc}
            contentContainerStyle={styles.docList}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptySub}>No documents for {activeYear}</Text>
              </View>
            }
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
    paddingHorizontal: 24,
  },
  subheading: {
    fontSize: 13,
    color: colors.textSecondary,
    paddingHorizontal: 24,
    marginTop: 4,
    marginBottom: 16,
  },
  yearRow: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    gap: 10,
  },
  yearChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: 8,
  },
  yearChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  yearChipText: {
    color: colors.textSecondary,
    fontWeight: "600",
    fontSize: 14,
  },
  yearChipTextActive: {
    color: "#fff",
  },
  docList: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },
  docCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    ...shadow.sm,
  },
  docIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.iconBlueBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  docMeta: { flex: 1 },
  docTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  docSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  shareBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: 16,
  },
  emptySub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 6,
    textAlign: "center",
  },
});
