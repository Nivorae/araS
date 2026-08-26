import { useEffect, useRef, useState } from "react";
import {
  type LayoutChangeEvent,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ChartPie, TrendingUp, Wallet } from "lucide-react-native";
import { CONTENT_MAX_WIDTH, useResponsive } from "@/hooks/useResponsive";
import { useSheetBottomPadding } from "@/hooks/useSheetBottomPadding";
import { ANALYTICS_EVENTS, track } from "@/lib/analytics";

/**
 * 「這是什麼？」三步說明，由登入頁右上角的 ? 按鈕開啟。
 *
 * 刻意是**使用者主動打開**而不是首次啟動強制顯示：登入頁本身（Logo + 三顆
 * OAuth 按鈕）就是第一個畫面，說明只在有人想看的時候才出現。
 *
 * 沿用 WhatsNewSheet／ReinvestSheet 的 bottom-sheet 視覺，不另創一套。
 *
 * 分析上，`onboarding_complete` 只在**滑到最後一頁並按下「開始使用」**時送出。
 * 中途關掉不送 —— 那是沒看完，用「有 app_open 沒有 onboarding_complete」來量測
 * 比多送一個帶旗標的事件乾淨。
 */

const STEPS = [
  {
    Icon: Wallet,
    title: "所有資產，一個地方",
    body: "現金、股票、基金、加密貨幣、不動產，連同貸款與信用卡，全部記在同一份清單裡。",
  },
  {
    Icon: TrendingUp,
    title: "看見淨值的走勢",
    body: "每次更新金額都會留下一筆紀錄，資產減去負債自動畫成一條淨值曲線。",
  },
  {
    Icon: ChartPie,
    title: "掌握配置與現金流",
    body: "資產配置分析、股利紀錄與退休試算，幫你把「現在」看成「以後」。",
  },
] as const;

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function OnboardingSheet({ visible, onClose }: Props) {
  const { isTablet } = useResponsive();
  const bottomPad = useSheetBottomPadding();
  const scrollRef = useRef<ScrollView>(null);
  // 分頁寬度量自 sheet 自己，而不是螢幕 —— sheet 在平板上有 maxWidth，
  // 用螢幕寬度分頁會整個對不準。
  const [pageWidth, setPageWidth] = useState(0);
  const [step, setStep] = useState(0);

  // 每次重新開啟都從第一頁開始，否則上次看到第三頁關掉，下次打開會停在那裡。
  useEffect(() => {
    if (!visible) return;
    setStep(0);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [visible]);

  const isLastStep = step === STEPS.length - 1;

  const handleLayout = (e: LayoutChangeEvent) => setPageWidth(e.nativeEvent.layout.width);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pageWidth === 0) return;
    const next = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    if (next !== step) setStep(next);
  };

  const handleNext = () => {
    if (!isLastStep) {
      scrollRef.current?.scrollTo({ x: pageWidth * (step + 1), animated: true });
      return;
    }
    track(ANALYTICS_EVENTS.ONBOARDING_COMPLETE, { steps_completed: STEPS.length });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        {/* 內層吃掉點擊，否則點在 sheet 上會被背景的關閉手勢接走。 */}
        <Pressable style={[s.sheet, isTablet && s.sheetTablet]} onPress={() => {}}>
          <View style={s.handle} />

          <View style={s.pagerZone} onLayout={handleLayout}>
            {/* pageWidth 量到之前不渲染分頁內容：寬度是 0 的話 pagingEnabled
                沒有東西可以對齊，第一次開啟會停在半格。 */}
            {pageWidth > 0 ? (
              <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleScroll}
              >
                {STEPS.map(({ Icon, title, body }) => (
                  <View key={title} style={[s.slide, { width: pageWidth }]}>
                    <View style={s.iconBubble}>
                      <Icon size={30} color="#4b5563" />
                    </View>
                    <Text style={s.title}>{title}</Text>
                    <Text style={s.body}>{body}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>

          <View style={s.dots}>
            {STEPS.map((item, i) => (
              <View key={item.title} style={[s.dot, i === step && s.dotActive]} />
            ))}
          </View>

          <View style={[s.actions, { paddingBottom: bottomPad }]}>
            <Pressable
              onPress={handleNext}
              style={({ pressed }) => [s.btn, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={s.btnText}>{isLastStep ? "開始使用" : "繼續"}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  sheetTablet: { width: CONTENT_MAX_WIDTH, alignSelf: "center" },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d1d1d6",
    alignSelf: "center",
    marginTop: 10,
  },

  // 固定高度，讓三頁不會因為文案長短不同而讓 sheet 高度跳動。
  pagerZone: { height: 250, marginTop: 18 },
  slide: { alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 12 },
  iconBubble: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#f2f2f7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: { fontSize: 19, fontWeight: "700", color: "#374254", textAlign: "center" },
  body: { fontSize: 14, lineHeight: 22, color: "#6b7280", textAlign: "center" },

  dots: { flexDirection: "row", justifyContent: "center", gap: 7, marginTop: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#d1d5db" },
  dotActive: { width: 20, backgroundColor: "#374254" },

  actions: { paddingHorizontal: 20, paddingTop: 18 },
  btn: {
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#374254",
  },
  btnText: { fontSize: 15, fontWeight: "600", color: "#ffffff" },
});
