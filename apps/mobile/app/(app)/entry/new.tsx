import { useState } from "react";
import {
  Dimensions,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import {
  CATEGORIES,
  getTopCategory,
  type CategoryNode,
  type TopCategory,
} from "@/lib/categoryConfig";

if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const HERO_HEIGHT = Dimensions.get("window").height * 0.4;
const GRID_COLUMNS = 3;
const GRID_GAP = 12;
const BODY_PADDING = 16;
const GRID_ITEM_WIDTH =
  (Dimensions.get("window").width - BODY_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) /
  GRID_COLUMNS;

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

type PickerState =
  | { level: "root"; expanded: string | null }
  | { level: "drill"; topCat: TopCategory; items: CategoryNode[]; title: string };

export default function NewEntryScreen() {
  const router = useRouter();
  const { topCategory } = useLocalSearchParams<{ topCategory?: string }>();
  const [state, setState] = useState<PickerState>({
    level: "root",
    expanded: topCategory ?? null,
  });

  const handleBack = () => {
    router.back();
  };

  const pushToForm = (topCat: TopCategory, subName: string) => {
    if (topCat.name === "保險") {
      router.push("/insurance/new");
      return;
    }
    router.push(
      `/entry/form?topCategory=${encodeURIComponent(topCat.name)}&subCategory=${encodeURIComponent(subName)}`
    );
  };

  const handleSubItemClick = (node: CategoryNode, topCat: TopCategory) => {
    if (node.children && node.children.length > 0) {
      setState({ level: "drill", topCat, items: node.children, title: node.name });
    } else {
      pushToForm(topCat, node.name);
    }
  };

  const handleTopCategoryPress = (topCat: TopCategory) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const alreadyExpanded = state.level === "root" && state.expanded === topCat.name;
    setState({ level: "root", expanded: alreadyExpanded ? null : topCat.name });
  };

  const activeTopCat: TopCategory | null =
    state.level === "drill"
      ? state.topCat
      : state.expanded
        ? (getTopCategory(state.expanded) ?? null)
        : null;
  const gridItems: CategoryNode[] =
    state.level === "drill" ? state.items : (activeTopCat?.children ?? []);

  const title = state.level === "drill" ? state.title : "新增帳戶";

  const isActiveDark = activeTopCat?.textColor === "#ffffff";
  const heroIconColor = isActiveDark ? (activeTopCat?.color ?? "#3c3c3e") : "#3c3c3e";
  const gridRows = chunk(gridItems, GRID_COLUMNS);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={s.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={24} color="#1c1c1e" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{title}</Text>
        <View style={s.placeholder} />
      </View>

      <View style={s.body}>
        <View style={s.hero}>
          {activeTopCat ? (
            <>
              <activeTopCat.icon size={128} color={heroIconColor} strokeWidth={1.5} />
              <Text style={s.heroLabel}>{activeTopCat.name}</Text>
            </>
          ) : (
            <Text style={s.heroLabelEmpty}>請選擇分類</Text>
          )}
        </View>

        <View style={s.dotRow}>
          {CATEGORIES.map((topCat) => {
            const isSelected = activeTopCat?.name === topCat.name;
            return (
              <TouchableOpacity
                key={topCat.name}
                onPress={() => handleTopCategoryPress(topCat)}
                style={[s.dot, { backgroundColor: topCat.color }, isSelected && s.dotSelected]}
                activeOpacity={0.85}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              />
            );
          })}
        </View>

        <View style={s.gridArea}>
          {gridRows.map((row, rowIdx) => (
            <View key={rowIdx} style={s.gridRow}>
              {row.map((node) => {
                const Icon = node.icon;
                const isDark = activeTopCat?.textColor === "#ffffff";
                const iconColor = isDark ? (activeTopCat?.color ?? "#3c3c3e") : "#3c3c3e";
                return (
                  <TouchableOpacity
                    key={node.name}
                    onPress={() => activeTopCat && handleSubItemClick(node, activeTopCat)}
                    style={s.gridItem}
                    activeOpacity={0.7}
                  >
                    <View style={s.gridIcon}>
                      <Icon size={28} color={iconColor} />
                    </View>
                    <Text style={s.gridLabel} numberOfLines={2}>
                      {node.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f2f7" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5ea",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f2f2f7",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#1c1c1e" },
  placeholder: { width: 40 },

  body: { flex: 1, padding: BODY_PADDING, gap: 16 },

  hero: {
    height: HERO_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  heroLabel: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: "700",
    color: "#1c1c1e",
  },
  heroLabelEmpty: {
    fontSize: 16,
    fontWeight: "500",
    color: "#8e8e93",
  },

  dotRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  dot: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
  },
  dotSelected: {
    borderWidth: 2,
    borderColor: "#1c1c1e",
  },

  gridArea: { flex: 1 },
  gridRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    columnGap: GRID_GAP,
  },
  gridItem: {
    width: GRID_ITEM_WIDTH,
    alignItems: "center",
    justifyContent: "center",
  },
  gridIcon: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  gridLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#1c1c1e",
    textAlign: "center",
  },
});
