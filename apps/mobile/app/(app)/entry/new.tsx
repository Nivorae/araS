import { useState } from "react";
import {
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react-native";
import { CATEGORIES, type CategoryNode, type TopCategory } from "@/lib/categoryConfig";

if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
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
    if (state.level === "drill") {
      setState({ level: "root", expanded: state.topCat.name });
      return;
    }
    if (state.level === "root" && state.expanded) {
      setState({ level: "root", expanded: null });
      return;
    }
    router.back();
  };

  const pushToForm = (topCat: TopCategory, subName: string) => {
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

  const title = state.level === "drill" ? state.title : "新增帳戶";

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

      <ScrollView contentContainerStyle={s.scrollContent}>
        {state.level === "drill" ? (
          <View style={s.card}>
            {state.items.map((node, idx) => {
              const Icon = node.icon;
              const accentColor = state.topCat.color === "#FFFFFF" ? "#374254" : state.topCat.color;
              const isLast = idx === state.items.length - 1;
              return (
                <View key={node.name}>
                  <TouchableOpacity
                    onPress={() => pushToForm(state.topCat, node.name)}
                    style={s.subItem}
                    activeOpacity={0.7}
                  >
                    <View style={[s.nodeIcon, { backgroundColor: accentColor + "20" }]}>
                      <Icon size={20} color={accentColor} />
                    </View>
                    <Text style={s.nodeLabel}>{node.name}</Text>
                  </TouchableOpacity>
                  {!isLast && <View style={s.sep} />}
                </View>
              );
            })}
          </View>
        ) : (
          CATEGORIES.map((topCat) => {
            const isExpanded = state.expanded === topCat.name;
            const isDark = topCat.textColor === "#ffffff";
            return (
              <View key={topCat.name} style={s.section}>
                <TouchableOpacity
                  onPress={() => {
                    if (topCat.name === "保險") {
                      router.push("/insurance/new");
                      return;
                    }
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setState({ level: "root", expanded: isExpanded ? null : topCat.name });
                  }}
                  style={[s.sectionHeader, { backgroundColor: topCat.color }]}
                  activeOpacity={0.85}
                >
                  <Text style={[s.sectionTitle, { color: topCat.textColor }]}>{topCat.name}</Text>
                  {isExpanded ? (
                    <ChevronDown size={18} color={topCat.textColor} />
                  ) : (
                    <ChevronRight size={18} color={topCat.textColor} />
                  )}
                </TouchableOpacity>

                {isExpanded && (
                  <View style={s.subList}>
                    {topCat.children.map((node, idx) => {
                      const Icon = node.icon;
                      const hasChildren = !!node.children?.length;
                      const isLast = idx === topCat.children.length - 1;
                      const iconColor = isDark ? topCat.color : "#3c3c3e";
                      const iconBg = isDark ? topCat.color + "20" : "rgba(0,0,0,0.06)";
                      return (
                        <View key={node.name}>
                          <TouchableOpacity
                            onPress={() => handleSubItemClick(node, topCat)}
                            style={s.subItem}
                            activeOpacity={0.7}
                          >
                            <View style={[s.nodeIcon, { backgroundColor: iconBg }]}>
                              <Icon size={18} color={iconColor} />
                            </View>
                            <Text style={[s.nodeLabel, s.flex1]}>{node.name}</Text>
                            {hasChildren && <ChevronRight size={16} color="#c7c7cc" />}
                          </TouchableOpacity>
                          {!isLast && <View style={s.sep} />}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f2f7" },
  flex1: { flex: 1 },

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

  scrollContent: { padding: 16, paddingBottom: 40, gap: 12 },

  section: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  sectionTitle: { fontSize: 17, fontWeight: "600" },

  subList: { backgroundColor: "#fff" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  subItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#f2f2f7",
    marginHorizontal: 20,
  },
  nodeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  nodeLabel: { fontSize: 15, fontWeight: "500", color: "#1c1c1e" },
});
