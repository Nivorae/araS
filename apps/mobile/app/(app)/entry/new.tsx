import { useRef, useState } from "react";
import {
  LayoutAnimation,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { CATEGORIES, type CategoryNode, type TopCategory } from "@/lib/categoryConfig";
import { useResponsive } from "@/hooks/useResponsive";

if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const H_PADDING = 16;

/**
 * 版面比例：上方 15%、空隙 0%、卡片堆疊區 85%。
 *
 * ⚠️ 這是 flex 權重不是百分比，只因為總和是 100 才剛好相等。改動時要維持總和，
 * 否則其他兩塊的實際比例會跟著變。
 *
 * 另外：上方區塊的內容（返回鍵列 + 搜尋框）自然高度只有約 96pt，不會拉長去
 * 填滿區塊，多的空間會留在它底部、和空隙區連成同一片。所以卡片上方的可見空隙
 * 是 (TOP_FLEX + GAP_FLEX) 佔的高度減掉 96pt —— 在這兩者之間搬動數字沒有任何
 * 效果，要縮小空隙只能減少它們的總和。
 *
 * 三個區塊用 flex 權重瓜分 SafeAreaView 的可用高度 —— 刻意不用
 * `useWindowDimensions()` 去算絕對 pt：那是整個螢幕的高度，扣掉瀏海與 Home
 * Indicator 之後實際可用的更少，15 + 75 = 90% 會超出可用區，瀏海越高的機型
 * 超得越多。用 flex 權重則自動適配每台裝置，也不需要讀螢幕尺寸。
 */
const TOP_FLEX = 15;
const GAP_FLEX = 0;
const STACK_FLEX = 85;

/**
 * 卡片彼此重疊多少。堆疊感全靠這個負的 marginTop —— 每張卡的圓角上緣壓在前一
 * 張卡的下緣上，像 Wallet 的卡片堆。第一張不套用。
 *
 * 它不影響卡片的可見高度（那個由 STACK_FLEX 區塊平分而來），只決定露出多少
 * 下一張卡的顏色。
 */
const CARD_OVERLAP = 28;

/** 展開時子項目下方的呼吸空間。算高度時要一起算進去。 */
const EXPANDED_PAD_BOTTOM = 24;

/**
 * 卡片列再怎麼壓縮也不能低於這個高度。子項目多到擠不下時寧可讓整疊超出容器、
 * 恢復成可捲動，也不要把卡片壓成一條線。
 */
const MIN_BAND = 56;

/**
 * 流動資金是 #FFFFFF、保險是 #f2f2f7，跟頁面底色 #f2f2f7 幾乎同色。堆疊版面
 * 靠卡片邊界辨識層次，這兩張會整片糊在一起，所以偵測出「淺色卡」後補一條上緣
 * 細線。不改 categoryConfig 的顏色 —— 那組色票同時被 entry 詳情頁與圖表使用。
 *
 * 用相對亮度而不是寫死那兩個色碼，之後有人調色票也不會默默失效。
 * 現有色票的亮度：#FFFFFF 1.00、#f2f2f7 0.95、#C7C7D4 0.79、其餘 <0.3。
 */
function isPaleColor(hex: string): boolean {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.85;
}

type PickerState =
  | { level: "root"; expanded: string | null }
  | { level: "drill"; topCat: TopCategory; items: CategoryNode[]; title: string };

export default function NewEntryScreen() {
  const router = useRouter();
  const { isTablet, contentWidth } = useResponsive();
  const { topCategory } = useLocalSearchParams<{ topCategory?: string }>();

  const [state, setState] = useState<PickerState>({
    level: "root",
    expanded: topCategory ?? null,
  });

  // 卡片高度是「容器決定內容」而不是內容撐出來的，所以得先量到堆疊區的實際
  // 高度才能平分。量到之前不畫卡片 —— 先用 0 畫再跳到正確高度會閃一下。
  const [stackHeight, setStackHeight] = useState(0);
  // 展開的子項目區實際多高（chip 會依寬度換行，行數算不出來，只能量）。
  const [subHeight, setSubHeight] = useState(0);

  /**
   * 容器高度是固定的 75%，所以一張卡展開時必須由六張一起讓出空間 —— 而不是
   * 讓整疊長出容器再靠捲動補救。捲動的版本會把最上面那張推出畫面，等於用一個
   * 問題換另一個問題。
   *
   * 這裡把展開區的高度先扣掉，剩下的才平分給六張的內容列。子項目區的高度與
   * band 無關（chip 換行只取決於寬度），所以不會發生「量了改、改了又要重量」
   * 的回饋迴圈。
   */
  const expandedExtra =
    state.level === "root" && state.expanded ? subHeight + EXPANDED_PAD_BOTTOM : 0;
  const band =
    stackHeight > 0 ? Math.max(MIN_BAND, (stackHeight - expandedExtra) / CATEGORIES.length) : 0;

  /**
   * 每個分類的子項目區高度，key 是分類名稱。由下面的隱形量測層在掛載時一次
   * 填滿，之後每次 press 都能在當下就給出最終高度。
   *
   * 為什麼非要預先量：不知道高度時，一次展開要跑兩個 layout pass —— pass 1
   * 做視覺上最大的那段變化（舊卡的子項目卸載、新卡的掛載、六張 band 重算），
   * pass 2 才把 band 修正到最終值。而 pass 2 的 `configureNext` 是在 pass 1
   * 的 300ms 動畫還在跑的時候呼叫的，RN 遇到這種情況會把進行中的動畫直接中止、
   * 瞬間跳到結束狀態。結果就是「展開中的卡片馬上點另一張」時，收合與展開都
   * 看不到動畫 —— 最大的那段變化被切掉了，只剩幅度很小的修正在動。
   *
   * 預先量完，每次 press 都是單一 pass，沒有第二次 configureNext 去打斷它。
   */
  const subHeightCache = useRef<Record<string, number>>({});
  // 六張都量到之後就把量測層拆掉，不留在樹上。
  const [measured, setMeasured] = useState(false);

  const onMeasureLayout = (name: string, h: number) => {
    subHeightCache.current[name] = h;
    if (Object.keys(subHeightCache.current).length === CATEGORIES.length) setMeasured(true);
  };

  const onSubLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (Math.abs(subHeight - h) <= 0.5) return;
    if (state.level === "root" && state.expanded) {
      subHeightCache.current[state.expanded] = h;
    }
    // 有量測層之後，正常情況這裡的 guard 會提早 return（快取值就是實際值），
    // 走到這行只剩「量測層量完後版面寬度又變了」之類的情況 —— 例如 iPad 旋轉
    // 讓 chip 換行行數改變。那時仍要修正，並補排一次動畫。
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSubHeight(h);
  };

  const onStackLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    // 只在真的變了才 setState，否則每次 layout 都觸發一次 re-render。
    setStackHeight((prev) => (Math.abs(prev - h) > 0.5 ? h : prev));
  };

  /**
   * 子項目 chip 的唯一來源 —— 隱形量測層與真實卡片共用同一份 JSX，否則兩邊
   * 只要有一點差異（少一個 icon、padding 不同），量到的高度就不是真的高度。
   */
  const chipsFor = (topCat: TopCategory) => {
    const isDark = topCat.textColor === "#ffffff";
    // 卡片自己就是底色，所以 chip 用同色系的透明疊層，而不是另外挑一個會跟
    // 六種底色打架的固定色。
    const chipBg = isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.06)";
    return topCat.children.map((node) => {
      const SubIcon = node.icon;
      const hasChildren = !!(node.children && node.children.length > 0);
      return (
        <TouchableOpacity
          key={node.name}
          onPress={() => handleSubItemClick(node, topCat)}
          style={[s.subChip, { backgroundColor: chipBg }]}
          activeOpacity={0.7}
        >
          <SubIcon size={16} color={topCat.textColor} />
          <Text style={[s.subChipText, { color: topCat.textColor }]}>{node.name}</Text>
          {hasChildren && <ChevronRight size={13} color={topCat.textColor} opacity={0.6} />}
        </TouchableOpacity>
      );
    });
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
    // 收合歸零，否則 band 會一直扣著上一張的展開高度不還回來；展開則優先用
    // 快取值，量過的卡片就能一個 pass 直接到位。
    setSubHeight(alreadyExpanded ? 0 : (subHeightCache.current[topCat.name] ?? 0));
    setState({ level: "root", expanded: alreadyExpanded ? null : topCat.name });
  };

  /**
   * 點卡片以外的區域（上方標題區）收合展開中的卡片。
   *
   * header 裡的返回鍵是巢狀的 TouchableOpacity —— RN 的觸控回應系統會讓子元件
   * 贏得手勢，所以按返回鍵不會順帶觸發這裡。
   */
  const collapseAll = () => {
    if (state.level !== "root" || !state.expanded) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSubHeight(0);
    setState({ level: "root", expanded: null });
  };

  // 從鑽進去的層級（例：股票 → 台股/美股）退回包含它的大類，而不是像 header
  // 的返回鍵那樣直接離開整個畫面。
  const handleDrillBack = () => {
    if (state.level !== "drill") return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setState({ level: "root", expanded: state.topCat.name });
  };

  const title = state.level === "drill" ? state.title : "新增帳戶";
  const centered = isTablet ? { width: contentWidth, alignSelf: "center" as const } : null;

  const headerBlock = (
    <View style={[s.header, centered]}>
      <TouchableOpacity
        onPress={state.level === "drill" ? handleDrillBack : () => router.back()}
        style={s.backBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <ChevronLeft size={24} color="#1c1c1e" />
      </TouchableOpacity>
      <Text style={s.headerTitle}>{title}</Text>
      <View style={s.placeholder} />
    </View>
  );

  if (state.level === "drill") {
    return (
      <SafeAreaView style={s.root}>
        {headerBlock}
        <ScrollView style={s.scroll} contentContainerStyle={[s.drillBody, centered]}>
          {state.items.map((node) => {
            const Icon = node.icon;
            const isDark = state.topCat.textColor === "#ffffff";
            const iconColor = isDark ? state.topCat.color : "#3c3c3e";
            return (
              <TouchableOpacity
                key={node.name}
                onPress={() => pushToForm(state.topCat, node.name)}
                style={s.drillRow}
                activeOpacity={0.7}
              >
                <Icon size={22} color={iconColor} />
                <Text style={s.drillLabel}>{node.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // 搜尋時不套 15/75 比例 —— 結果應該接在搜尋框底下，而不是被壓到畫面下方
  // 75% 的框裡，中間空一大塊。

  return (
    <SafeAreaView style={s.root}>
      {/* justifyContent 讓整列在這 15% 的區塊裡垂直置中 */}
      <Pressable style={s.topBlock} onPress={collapseAll}>
        {headerBlock}
      </Pressable>

      <View style={s.gapBlock} />

      <View style={s.stackBlock} onLayout={onStackLayout}>
        {band > 0 && (
          /* 滿版堆疊：contentContainer 不留左右 padding，卡片自己貼齊兩側。 */
          <ScrollView
            style={s.scroll}
            contentContainerStyle={[s.stackBody, centered]}
            // 這疊卡片的設計是「永遠剛好填滿容器」（展開時由六張一起讓出空間），
            // 所以正常情況根本不需要捲動。留著 iOS 的彈性回捲只會讓使用者一拖就
            // 把整疊拉動、放開再彈回來，看起來像沒對齊。
            //
            // 不是 scrollEnabled={false} —— 子項目多到觸發 MIN_BAND 地板時內容
            // 真的會超出容器，那時仍然要能捲。
            bounces={false}
            overScrollMode="never"
          >
            {CATEGORIES.map((topCat, idx) => {
              const isExpanded = state.expanded === topCat.name;
              // 最後一張沒有下一張壓上來，所以不需要那段被蓋住的下緣補償，
              // 並補圓下緣兩角讓整疊有明確的結尾。
              const isLast = idx === CATEGORIES.length - 1;
              const pale = isPaleColor(topCat.color);
              // 被下一張蓋住的那段要額外撐出來，卡片的「可見高度」才等於 band。
              const hiddenPad = isLast ? 0 : CARD_OVERLAP;
              return (
                <View
                  key={topCat.name}
                  style={[
                    s.card,
                    { backgroundColor: topCat.color },
                    // 後面的卡片要壓在前面的卡片上，堆疊順序才對。
                    { zIndex: idx + 1 },
                    // 展開時額外給子項目一點下緣呼吸空間。
                    { paddingBottom: hiddenPad + (isExpanded ? EXPANDED_PAD_BOTTOM : 0) },
                    idx > 0 && { marginTop: -CARD_OVERLAP },
                    pale && s.cardPale,
                    isLast && s.cardLast,
                    isLast && pale && s.cardLastPale,
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => handleTopCategoryPress(topCat)}
                    // minHeight 而非 height —— 展開時內容比 band 高，要能長出去。
                    style={[s.cardTop, { minHeight: band }]}
                    activeOpacity={0.85}
                  >
                    <Text style={[s.cardTitle, { color: topCat.textColor }]} numberOfLines={1}>
                      {topCat.name}
                    </Text>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={s.subWrap} onLayout={onSubLayout}>
                      {chipsFor(topCat)}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/*
        隱形量測層：把六張卡的子項目用「和真實卡片完全相同的寬度與 padding」
        排一次，量到高度就寫進 subHeightCache，六張都齊了就整層拆掉。

        opacity 0 + pointerEvents none，不會被看到也不會擋到觸控；width 取
        contentWidth（手機上就是螢幕寬）確保 chip 的換行行數與真實卡片一致 ——
        寬度不一樣的話量到的高度就沒有意義。
      */}
      {!measured && (
        <View style={[s.measureLayer, { width: contentWidth }]} pointerEvents="none">
          {CATEGORIES.map((topCat) => (
            <View key={topCat.name} style={s.measureCard}>
              <View
                style={s.subWrap}
                onLayout={(e) => onMeasureLayout(topCat.name, e.nativeEvent.layout.height)}
              >
                {chipsFor(topCat)}
              </View>
            </View>
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f2f7" },

  // 內容只有一列，justifyContent 讓它在區塊內垂直置中。
  topBlock: { flex: TOP_FLEX, justifyContent: "center" },
  gapBlock: { flex: GAP_FLEX },
  stackBlock: { flex: STACK_FLEX },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: H_PADDING,
    paddingTop: 4,
    paddingBottom: 12,
  },
  // 沒有底色 —— 返回鍵只剩箭頭本身。固定寬高是為了跟右側的 placeholder 對稱，
  // 標題才會落在整列的正中央而不是被箭頭推偏。
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#1c1c1e" },
  placeholder: { width: 40 },

  scroll: { flex: 1 },
  // 內容剛好等於容器高度時這兩個都不影響；卡片展開後內容變高就正常捲動。
  stackBody: { flexGrow: 1, justifyContent: "flex-end" },

  card: {
    // 滿版：不設左右 margin，只圓上緣兩角 —— 下緣會被下一張卡蓋住，圓了也看不到。
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    // 陰影朝上，投在被壓住的那張卡上，堆疊的層次才看得出來。
    shadowOffset: { width: 0, height: -4 },
    elevation: 4,
  },
  cardPale: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#d8d8de",
  },
  cardLast: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  cardLastPale: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#d8d8de",
  },

  // 卡片列只剩名稱：alignItems 讓它在 band 的高度內垂直置中，
  // cardTitle 的 flex:1 + textAlign 讓它水平置中並在過長時截斷。
  cardTop: { flexDirection: "row", alignItems: "center" },
  cardTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
    textAlign: "center",
  },

  subWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  // 量測層疊在畫面上但完全透明；measureCard 的左右內距必須和 card 一致，
  // 否則 chip 可用寬度不同，換行行數就會跟真實卡片對不上。
  measureLayer: { position: "absolute", top: 0, opacity: 0 },
  measureCard: { paddingHorizontal: 20 },
  subChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  subChipText: { fontSize: 14, fontWeight: "600" },

  drillBody: { paddingHorizontal: H_PADDING, paddingTop: 14, paddingBottom: 32, gap: 12 },
  drillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: "#fff",
  },
  drillLabel: { fontSize: 16, fontWeight: "500", color: "#1c1c1e" },
});
