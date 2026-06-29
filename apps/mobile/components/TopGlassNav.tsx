import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname, useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import {
  BarChart3,
  Building2,
  LogOut,
  PiggyBank,
  Plus,
  type LucideIcon,
} from "lucide-react-native";

/** Height the floating nav occupies below the safe-area top inset. */
export const NAV_CLEARANCE = 60;

const ACTIVE = "rgba(30,30,40,0.85)";
const INACTIVE = "rgba(30,30,40,0.32)";

interface TabDef {
  route: string;
  match: string;
  icon: LucideIcon;
}

const TABS: TabDef[] = [
  { route: "/(app)/(tabs)", match: "", icon: Building2 },
  { route: "/(app)/(tabs)/transactions", match: "transactions", icon: BarChart3 },
  { route: "/(app)/(tabs)/retirement", match: "retirement", icon: PiggyBank },
];

export function TopGlassNav() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useAuth();

  const isActive = (match: string) => {
    if (match === "") return pathname === "/" || pathname === "";
    return pathname.includes(match);
  };

  return (
    <View style={[s.wrap, { top: insets.top + 14 }]} pointerEvents="box-none">
      <View style={s.pill}>
        {/* Tab buttons */}
        {TABS.map(({ route, match, icon: Icon }) => {
          const active = isActive(match);
          return (
            <Pressable
              key={route}
              onPress={() => router.navigate(route as never)}
              style={s.btn}
              hitSlop={4}
            >
              <Icon size={22} color={active ? ACTIVE : INACTIVE} strokeWidth={active ? 2.5 : 1.5} />
            </Pressable>
          );
        })}

        {/* Logout */}
        <Pressable onPress={() => signOut()} style={s.btn} hitSlop={4}>
          <LogOut size={22} color={INACTIVE} strokeWidth={1.5} />
        </Pressable>

        {/* Divider */}
        <View style={s.divider} />

        {/* Add */}
        <Pressable onPress={() => router.push("/entry/new")} style={s.addBtn}>
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
