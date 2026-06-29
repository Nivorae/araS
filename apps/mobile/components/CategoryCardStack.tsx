import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { LucideIcon } from "lucide-react-native";
import type { Entry } from "@repo/shared";
import { formatCurrency } from "@/lib/format";
import { BankLogo } from "./BankLogo";

export interface StackCategory {
  name: string;
  color: string;
  textColor: string;
  isLiability: boolean;
  entries: Entry[];
  total: number;
}

interface Props {
  categories: StackCategory[];
  hideBalance: boolean;
  getEntryIcon: (topCategory: string, subCategory: string) => LucideIcon;
  onEntryClick: (entry: Entry) => void;
  onExpandChange: (expanded: boolean) => void;
  onAddClick?: (categoryName: string) => void;
}

export interface CategoryCardStackHandle {
  collapse: () => void;
}

const MAX_STACK_SPACING = 70;
const FRONT_CARD_HEADER_HEIGHT = 80;

// Web parity (motion/react): lively spring (stiffness 220 / damping 25) when a
// card opens. On collapse the cards return UP and slot back behind the top card;
// an underdamped overshoot would momentarily over-cover the topmost card and look
// "clipped", so collapse uses a near-critical damping (no overshoot).
const SPRING_OPEN = { stiffness: 220, damping: 25, mass: 1, useNativeDriver: true } as const;
const SPRING_CLOSE = { stiffness: 220, damping: 30, mass: 1, useNativeDriver: true } as const;
// Content fades in shortly after the card opens. On collapse the fade-out is
// stretched to span the whole re-stack: the incoming cards wipe up over the list
// while it dims, so there's never a "solid colour, no content" ghost window.
const CONTENT_MOUNT_DELAY = 110;
const CONTENT_FADE_IN = 250;
const CONTENT_FADE_OUT = 300;
const CONTENT_UNMOUNT_DELAY = 340;

export const CategoryCardStack = forwardRef<CategoryCardStackHandle, Props>(
  function CategoryCardStack(
    { categories, hideBalance, getEntryIcon, onEntryClick, onExpandChange, onAddClick },
    ref
  ) {
    const [selectedName, setSelectedName] = useState<string | null>(null);
    const [displayedName, setDisplayedName] = useState<string | null>(null);
    // Measured ONCE. Never updated per-frame, so the top-zone resize animation
    // can't feed back and restart the card springs (the source of the stutter).
    const [zoneHeight, setZoneHeight] = useState(0);
    const measured = useRef(false);

    const contentOpacity = useRef(new Animated.Value(0)).current;
    const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const initialized = useRef(false);

    // one persistent translateY per category name
    const yMap = useRef<Record<string, Animated.Value>>({});
    categories.forEach((c) => {
      if (!yMap.current[c.name]) yMap.current[c.name] = new Animated.Value(0);
    });

    const total = categories.length;
    const spacing =
      total > 1
        ? Math.min(
            MAX_STACK_SPACING,
            Math.floor((zoneHeight - FRONT_CARD_HEADER_HEIGHT) / (total - 1))
          )
        : 0;

    // Position springs run ONLY when the selection (or the one-time measure /
    // category set) changes — never on every layout frame.
    useEffect(() => {
      if (zoneHeight === 0) return;
      const firstRun = !initialized.current;
      initialized.current = true;
      const collapsing = selectedName === null;
      // Just below the zone — guaranteed off-screen even while the zone is
      // expanded (~1.2×), without the huge travel that amplifies overshoot.
      const offScreenY = Math.round(zoneHeight * 1.3);
      const anims: Animated.CompositeAnimation[] = [];
      categories.forEach((cat, index) => {
        const defaultY = (total - 1 - index) * spacing;
        let target: number;
        if (collapsing) target = defaultY;
        else if (selectedName === cat.name) target = 0;
        else target = offScreenY;
        if (firstRun) {
          // place cards instantly on first measure — no intro fan-out
          yMap.current[cat.name]!.setValue(target);
        } else {
          const cfg = collapsing ? SPRING_CLOSE : SPRING_OPEN;
          anims.push(Animated.spring(yMap.current[cat.name]!, { toValue: target, ...cfg }));
        }
      });
      if (anims.length) Animated.parallel(anims).start();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedName, zoneHeight, total]);

    const clearTimers = () => {
      if (openTimer.current) clearTimeout(openTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
      openTimer.current = null;
      closeTimer.current = null;
    };

    const collapse = () => {
      clearTimers();
      setSelectedName(null);
      onExpandChange(false);
      Animated.timing(contentOpacity, {
        toValue: 0,
        duration: CONTENT_FADE_OUT,
        useNativeDriver: true,
      }).start();
      closeTimer.current = setTimeout(() => setDisplayedName(null), CONTENT_UNMOUNT_DELAY);
    };

    useImperativeHandle(ref, () => ({ collapse }));

    useEffect(() => () => clearTimers(), []);

    const handleCardPress = (name: string) => {
      if (selectedName === name) {
        collapse();
        return;
      }
      clearTimers();
      // Card spring starts immediately…
      setSelectedName(name);
      onExpandChange(true);
      // …content mounts + fades in slightly later, so the mount cost lands
      // after the spring's first frames (matches web's delayed content).
      contentOpacity.setValue(0);
      openTimer.current = setTimeout(() => {
        setDisplayedName(name);
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: CONTENT_FADE_IN,
          useNativeDriver: true,
        }).start();
      }, CONTENT_MOUNT_DELAY);
    };

    // Measure once; ignore subsequent resize so the springs never restart.
    const onLayout = (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      if (!measured.current && h > 0) {
        measured.current = true;
        setZoneHeight(h);
      }
    };

    return (
      <View style={st.zone} onLayout={onLayout}>
        {selectedName !== null && <Pressable style={StyleSheet.absoluteFill} onPress={collapse} />}

        {categories.map((cat, index) => {
          const isSelected = selectedName === cat.name;
          const isDisplayed = displayedName === cat.name;
          const widthPct = Math.max(50, 92 - index * 8);
          const leftPct = (100 - widthPct) / 2;
          // Only the actively-selected card floats on top. On collapse it drops
          // to its resting layer immediately, so the other cards wipe up over it
          // instead of it lingering on top as a content-less colour ghost.
          const zIndex = isSelected ? total + 1 : total - index;
          const y = yMap.current[cat.name]!;

          return (
            <Animated.View
              key={cat.name}
              style={[
                st.card,
                {
                  width: `${widthPct}%`,
                  left: `${leftPct}%`,
                  backgroundColor: cat.color,
                  zIndex,
                  transform: [{ translateY: y }],
                },
              ]}
            >
              {/* Always-visible header */}
              <Pressable onPress={() => handleCardPress(cat.name)} style={st.header}>
                <Text style={[st.headerTitle, { color: cat.textColor }]}>{cat.name}</Text>
                <Text style={[st.headerTotal, { color: cat.textColor }]}>
                  {hideBalance ? "••••••" : formatCurrency(cat.total)}
                </Text>
              </Pressable>

              {/* Entry list — deferred mount + fade, kept until card returns home */}
              {isDisplayed && (
                <Animated.View style={[st.contentWrap, { opacity: contentOpacity }]}>
                  <ScrollView
                    contentContainerStyle={st.listContent}
                    showsVerticalScrollIndicator={false}
                  >
                    {cat.entries.map((entry) => {
                      const EntryIcon = getEntryIcon(cat.name, entry.subCategory);
                      return (
                        <Pressable
                          key={entry.id}
                          onPress={() => onEntryClick(entry)}
                          style={st.entryRow}
                        >
                          <View style={st.entryIcon}>
                            {entry.bankCode ? (
                              <BankLogo code={entry.bankCode} name={entry.name} size={28} />
                            ) : (
                              <EntryIcon size={15} color="#1c1c1e" />
                            )}
                          </View>
                          <Text style={st.entryName} numberOfLines={1}>
                            {entry.name}
                          </Text>
                          <Text style={st.entryValue}>
                            {hideBalance ? "••••" : formatCurrency(entry.value)}
                          </Text>
                          <Text style={st.chevron}>›</Text>
                        </Pressable>
                      );
                    })}
                    {onAddClick && (
                      <Pressable
                        onPress={() => onAddClick(cat.name)}
                        style={[st.entryRow, st.addRow]}
                      >
                        <Text style={st.addText}>+ 新增</Text>
                      </Pressable>
                    )}
                  </ScrollView>
                </Animated.View>
              )}
            </Animated.View>
          );
        })}
      </View>
    );
  }
);

const st = StyleSheet.create({
  zone: { flex: 1, position: "relative", overflow: "hidden" },
  card: {
    position: "absolute",
    top: 0,
    height: "100%", // native fill — rises smoothly with the resizing parent
    overflow: "hidden",
    borderRadius: 26,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  header: { alignItems: "center", paddingTop: 14 },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  headerTotal: { fontSize: 12, marginTop: 3, opacity: 0.5 },

  contentWrap: { flex: 1, marginTop: 14 },
  listContent: { paddingHorizontal: "6.5%", gap: 7, paddingBottom: 12 },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  entryIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  entryName: { flex: 1, fontSize: 13, fontWeight: "600", color: "#1c1c1e" },
  entryValue: { fontSize: 12, color: "#1c1c1e" },
  chevron: { fontSize: 11, color: "rgba(0,0,0,0.3)" },
  addRow: { justifyContent: "center", marginTop: 4 },
  addText: { fontSize: 13, fontWeight: "600", color: "#1c1c1e" },
});
