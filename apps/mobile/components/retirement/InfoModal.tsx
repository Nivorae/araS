import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { ModalContent } from "@/lib/retirement";

export function InfoModal({
  content,
  visible,
  onClose,
}: {
  content: ModalContent | null;
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible && content !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Drag handle */}
          <View style={s.handleWrap} pointerEvents="none">
            <View style={s.handle} />
          </View>

          {content && (
            <>
              {/* Hero block — darkest */}
              <View style={s.hero}>
                <View style={s.heroTop}>
                  <Text style={s.heroEyebrow}>計算說明</Text>
                  <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={8}>
                    <Text style={s.closeX}>×</Text>
                  </TouchableOpacity>
                </View>
                <Text style={s.heroTitle}>{content.result.label}</Text>
                <Text style={s.heroValue}>{content.result.value}</Text>
                <Text style={s.heroDesc}>{content.description}</Text>
              </View>

              {/* Formula block — light gray */}
              <ScrollView
                style={s.formula}
                contentContainerStyle={s.formulaContent}
                showsVerticalScrollIndicator={false}
              >
                <Text style={s.formulaTitle}>計算公式</Text>
                {content.steps.map((step) => (
                  <View key={step.label} style={s.stepRow}>
                    <Text style={s.stepLabel}>{step.label}</Text>
                    {step.value && <Text style={s.stepValue}>{step.value}</Text>}
                  </View>
                ))}
                <TouchableOpacity style={s.okBtn} onPress={onClose} activeOpacity={0.8}>
                  <Text style={s.okText}>了解了</Text>
                </TouchableOpacity>
              </ScrollView>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-end",
  },
  sheet: {
    height: "88%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    backgroundColor: "#0e1424",
  },
  handleWrap: {
    position: "absolute",
    top: 10,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  handle: { width: 32, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)" },

  hero: { backgroundColor: "#0e1424", paddingHorizontal: 24, paddingTop: 40, paddingBottom: 32 },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    color: "rgba(255,255,255,0.4)",
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeX: { fontSize: 17, color: "rgba(255,255,255,0.6)", lineHeight: 20 },
  heroTitle: { fontSize: 28, fontWeight: "700", color: "#ffffff" },
  heroValue: { fontSize: 40, fontWeight: "700", color: "#ff9500", marginTop: 20 },
  heroDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: "rgba(255,255,255,0.7)",
    marginTop: 24,
  },

  formula: { flex: 1, backgroundColor: "#f2f2f7" },
  formulaContent: { paddingHorizontal: 20, paddingVertical: 24 },
  formulaTitle: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#8e8e93",
    marginBottom: 12,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  stepLabel: { fontSize: 13, color: "#8e8e93", flex: 1 },
  stepValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1c1c1e",
    marginLeft: 12,
    textAlign: "right",
  },
  okBtn: {
    marginTop: 24,
    backgroundColor: "#1c1c1e",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  okText: { fontSize: 15, fontWeight: "600", color: "#ffffff" },
});
