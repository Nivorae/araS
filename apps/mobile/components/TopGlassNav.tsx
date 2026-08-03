import { useCallback, useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname, useRouter } from "expo-router";
import {
  BarChart3,
  GalleryVerticalEnd,
  PiggyBank,
  Plus,
  Settings,
  type LucideIcon,
} from "lucide-react-native";

/** Height the floating nav occupies below the safe-area top inset. */
export const NAV_CLEARANCE = 60;

const ACTIVE = "rgba(30,30,40,0.85)";
const INACTIVE = "rgba(30,30,40,0.32)";

// Same stiffness/damping/mass shape used by CategoryCardStack's SPRING_OPEN
// and settings.tsx's SPRING_PRESS, rather than inventing a speed/bounciness
// variant just for this component.
const SPRING_PRESS = { stiffness: 300, damping: 20, mass: 1, useNativeDriver: true } as const;
const SPRING_HIGHLIGHT = { stiffness: 240, damping: 20, mass: 1, useNativeDriver: true } as const;
const SPRING_BOUNCE = { stiffness: 220, damping: 14, mass: 1, useNativeDriver: true } as const;

interface TabDef {
  route: string;
  match: string;
  icon: LucideIcon;
}

const TABS: TabDef[] = [
  { route: "/(app)/(tabs)", match: "", icon: GalleryVerticalEnd },
  { route: "/(app)/(tabs)/transactions", match: "transactions", icon: BarChart3 },
  { route: "/(app)/(tabs)/retirement", match: "retirement", icon: PiggyBank },
];

// One animated value set per tab, plus its derived interpolations computed
// once up front — not every render, which is what happens if `.interpolate()`
// is called inline in JSX.
interface TabAnim {
  scale: Animated.Value;
  bounce: Animated.Value;
  highlight: Animated.Value;
  highlightScale: Animated.AnimatedInterpolation<number>;
  bounceY: Animated.AnimatedInterpolation<number>;
}

interface TopGlassNavProps {
  /** Overrides the "+" button action. Defaults to opening the entry form. */
  onAddPress?: () => void;
}

export function TopGlassNav({ onAddPress }: TopGlassNavProps = {}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (match: string) => {
    if (match === "") return pathname === "/" || pathname === "";
    return pathname.includes(match);
  };

  // Per-tab animated values (persistent across renders — one set per route).
  const anim = useRef<Record<string, TabAnim>>({}).current;
  TABS.forEach(({ route, match }) => {
    if (anim[route]) return;
    const scale = new Animated.Value(1);
    const bounce = new Animated.Value(0);
    const highlight = new Animated.Value(isActive(match) ? 1 : 0);
    anim[route] = {
      scale,
      bounce,
      highlight,
      highlightScale: highlight.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
      bounceY: bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }),
    };
  });

  const pressIn = useCallback(
    (route: string) =>
      Animated.timing(anim[route]!.scale, {
        toValue: 0.72,
        duration: 80,
        useNativeDriver: true,
      }).start(),
    [anim]
  );
  const pressOut = useCallback(
    (route: string) => Animated.spring(anim[route]!.scale, { toValue: 1, ...SPRING_PRESS }).start(),
    [anim]
  );

  // Switching tabs: the newly-active icon jumps up and lands with a bouncy
  // overshoot, while a filled pill fades/scales in behind it — and the pill
  // behind the tab we're leaving fades back out. Much more visible than a
  // plain colour swap. Only the tab losing and the tab gaining active state
  // need a spring — the rest are already at rest.
  const prevActiveRoute = useRef<string | null>(null);
  useEffect(() => {
    const activeTab = TABS.find((t) => isActive(t.match));
    if (!activeTab || prevActiveRoute.current === activeTab.route) return;
    const prevRoute = prevActiveRoute.current;
    prevActiveRoute.current = activeTab.route;

    if (prevRoute) {
      Animated.spring(anim[prevRoute]!.highlight, { toValue: 0, ...SPRING_HIGHLIGHT }).start();
    }
    Animated.spring(anim[activeTab.route]!.highlight, { toValue: 1, ...SPRING_HIGHLIGHT }).start();

    const bounce = anim[activeTab.route]!.bounce;
    bounce.setValue(0);
    Animated.sequence([
      Animated.timing(bounce, { toValue: 1, duration: 130, useNativeDriver: true }),
      Animated.spring(bounce, { toValue: 0, ...SPRING_BOUNCE }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <View style={[s.wrap, { top: insets.top + 22 }]} pointerEvents="box-none">
      <View style={s.pill}>
        {/* Tab buttons */}
        {TABS.map(({ route, match, icon: Icon }) => {
          const active = isActive(match);
          return (
            <Pressable
              key={route}
              onPress={() => router.navigate(route as never)}
              onPressIn={() => pressIn(route)}
              onPressOut={() => pressOut(route)}
              style={s.btn}
              hitSlop={4}
            >
              <Animated.View
                style={[
                  s.highlight,
                  {
                    opacity: anim[route]!.highlight,
                    transform: [{ scale: anim[route]!.highlightScale }],
                  },
                ]}
              />
              <Animated.View
                style={{
                  transform: [{ scale: anim[route]!.scale }, { translateY: anim[route]!.bounceY }],
                }}
              >
                <Icon
                  size={22}
                  color={active ? ACTIVE : INACTIVE}
                  strokeWidth={active ? 2.5 : 1.5}
                />
              </Animated.View>
            </Pressable>
          );
        })}

        {/* Settings (account, sign out, delete account) */}
        <Pressable onPress={() => router.push("/settings")} style={s.btn} hitSlop={4}>
          <Settings size={22} color={INACTIVE} strokeWidth={1.5} />
        </Pressable>

        {/* Divider */}
        <View style={s.divider} />

        {/* Add */}
        <Pressable onPress={onAddPress ?? (() => router.push("/entry/new"))} style={s.addBtn}>
          <View style={s.addInner}>
            <Plus size={18} color="#ffffff" strokeWidth={2.5} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 100,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.10)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  btn: {
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  highlight: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(30,30,40,0.08)",
  },
  divider: {
    width: 1,
    height: 20,
    marginHorizontal: 4,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  addBtn: {},
  addInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2f3a4a",
    borderTopWidth: 1.5,
    borderTopColor: "rgba(255,255,255,0.22)",
    shadowColor: "rgb(40,50,64)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
});
