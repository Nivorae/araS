# 保險模組 Mobile UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the already-complete insurance data/API layer (Plan C1) a working mobile UI: a new-policy form, a themed entry-list card, and a policy detail screen with edit/delete, on `apps/mobile`.

**Architecture:** `保險` is promoted from a leaf under `固定資產` to its own top-level `categoryConfig` entry. A brand-new `InsuranceForm` component (not the generic `EntryForm`) drives creation and editing, posting straight to `/api/insurances/**` and calling the existing `fetchAll()` to resync the entries list — the same "escape the generic Entry form" pattern the codebase already uses for loans. A dedicated `insurance/[id].tsx` route (keyed by the insurance record's own id, not the entry id) renders the detail page. No new Zustand store slice — the full insurance record is fetched on demand into local screen state.

**Tech Stack:** Expo Router (file-based, explicitly registered in `app/(app)/_layout.tsx`), React Native (pure-JS components only — no new native modules), Zustand (`useFinanceStore`), Zod (`@repo/shared`), Prisma (`apps/web`), Vitest (`packages/shared`, `apps/web`).

## Global Constraints

- No new native modules — mobile UI must stay OTA-safe (project convention, see `apps/mobile/lib/categoryConfig.ts` and existing pure-JS pickers).
- `apps/mobile` has no automated test runner — every mobile task's "test" step is `pnpm --filter @repo/mobile type-check` (runs `tsc --noEmit`) plus a manual Expo Go smoke-test description. Only Task 1 (touches `packages/shared` + `apps/web`) has real automated tests.
- Three required insurance fields are `insurer`, `insuredName`, `insuranceType` — client-side validation must block submit on any of these being empty (spec: `docs/superpowers/specs/2026-07-22-insurance-module-design.md`).
- Coverage items: max 3, structure `{ key, label, value }`; for the six structured `InsuranceType`s the `key` must come from `INSURANCE_COVERAGE_OPTIONS[type]`; `OTHER` allows free-form `label` with a client-generated `key`.
- Insurance entries never carry a real amount — `Entry.value` is always `0` and `Entry.includeInChart` is always `false` (enforced server-side in `insurance.service.ts`, not something mobile needs to set).
- Design doc: `docs/superpowers/specs/2026-07-22-insurance-mobile-ui-design.md`. Field/flow spec: `docs/superpowers/specs/2026-07-22-insurance-module-design.md`. Data/API layer (already shipped): `docs/superpowers/specs/2026-07-22-insurance-data-api.md`.

---

### Task 1: Expose `insurance.id` on the entry list payload

**Files:**

- Modify: `packages/shared/src/schemas/finance.ts:75-80` (`InsuranceSummarySchema`)
- Modify: `apps/web/services/entries.service.ts:57` (Prisma `select`)
- Modify: `apps/web/tests/services/entries.service.test.ts:59-92` (existing test, extend mock + assertions)

**Interfaces:**

- Consumes: nothing new.
- Produces: `InsuranceSummary` now has `id: string`. `Entry.insurance` (from `GET /api/entries`) carries `{ id, insuranceType, insurer, insuredName }`. Every later mobile task that needs to navigate from an entry-list row to the full insurance record reads `entry.insurance.id`.

- [ ] **Step 1: Extend the failing test first**

Open `apps/web/tests/services/entries.service.test.ts`. In the `"includes an insurance summary on the listed entries"` test (starts at line 59), add `id: "ins1"` to the mocked `insurance` object and assert it comes through, and assert the Prisma `select` now includes `id: true`:

```ts
it("includes an insurance summary on the listed entries", async () => {
  vi.mocked(prisma.entry.findMany).mockResolvedValue([
    {
      id: "e1",
      userId: USER_ID,
      name: "醫療險",
      topCategory: "保險",
      subCategory: "MEDICAL",
      stockCode: null,
      bankCode: null,
      note: null,
      value: 0,
      includeInChart: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      loan: null,
      history: [],
      insurance: {
        id: "ins1",
        insuranceType: "MEDICAL",
        insurer: "國泰人壽",
        insuredName: "本人",
      },
    },
  ] as never);
  const entries = await entriesService.list(USER_ID);
  const entry = entries[0]!;
  expect(entry.insurance).toEqual({
    id: "ins1",
    insuranceType: "MEDICAL",
    insurer: "國泰人壽",
    insuredName: "本人",
  });
  expect(prisma.entry.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      include: expect.objectContaining({
        insurance: {
          select: { id: true, insuranceType: true, insurer: true, insuredName: true },
        },
      }),
    })
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @repo/web exec vitest run tests/services/entries.service.test.ts`
Expected: FAIL — the mocked `insurance.id` isn't asserted-away yet, but the `select` assertion fails because the real code doesn't select `id` yet (actual `toHaveBeenCalledWith` mismatch on the `insurance.select` object).

- [ ] **Step 3: Add `id` to `InsuranceSummarySchema`**

In `packages/shared/src/schemas/finance.ts`, update:

```ts
export const InsuranceSummarySchema = z.object({
  id: z.string(),
  insuranceType: InsuranceTypeSchema,
  insurer: z.string(),
  insuredName: z.string(),
});
```

- [ ] **Step 4: Add `id` to the Prisma select in `entries.service.ts`**

In `apps/web/services/entries.service.ts`, line 57:

```ts
        insurance: { select: { id: true, insuranceType: true, insurer: true, insuredName: true } },
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @repo/web exec vitest run tests/services/entries.service.test.ts`
Expected: PASS

- [ ] **Step 6: Run the full shared + web suites to confirm no regressions**

Run: `pnpm --filter @repo/shared exec vitest run && pnpm --filter @repo/web exec vitest run`
Expected: all tests PASS (shared 7/7 baseline + web 140/140 baseline, both unchanged in count except this one extended assertion)

- [ ] **Step 7: Type-check both packages**

Run: `pnpm --filter @repo/shared exec tsc --noEmit && pnpm --filter @repo/web exec tsc --noEmit`
Expected: 0 errors

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/schemas/finance.ts apps/web/services/entries.service.ts apps/web/tests/services/entries.service.test.ts
git commit -m "feat: expose insurance id on entry list summary"
```

---

### Task 2: Promote 保險 to a top-level category

**Files:**

- Modify: `apps/mobile/lib/categoryConfig.ts:87-98` (remove 保險 leaf, add new `TopCategory`)
- Modify: `apps/mobile/app/(app)/entry/new.tsx` (route 保險 straight to the new insurance form)

**Interfaces:**

- Consumes: nothing new.
- Produces: `CATEGORIES` now has a `保險` top category (`isLiability: false`, `children: []`, color `#B8865E`/`#FFFFFF`). `getTopCategory("保險")` returns it. Later tasks (`CategoryCardStack`, `index.tsx`) rely on `topCategory.name === "保險"` to special-case rendering.

- [ ] **Step 1: Remove the 保險 leaf from 固定資產 and add the new top category**

In `apps/mobile/lib/categoryConfig.ts`, remove the `{ name: "保險", icon: Shield }` entry from 固定資產's `children` (line 96), and add a new top-level entry after `固定資產` (before `應收款`):

```ts
  {
    name: "固定資產",
    color: "#374254",
    textColor: "#ffffff",
    isLiability: false,
    children: [
      { name: "房屋", icon: Home },
      { name: "車輛", icon: Car },
      { name: "其他資產", icon: Building2 },
    ],
  },
  {
    name: "保險",
    color: "#B8865E",
    textColor: "#ffffff",
    isLiability: false,
    // Empty on purpose: 險種 (7-way) isn't picked via this drill-down menu — it's
    // step 1 of InsuranceForm itself. Selecting this category skips straight to
    // /insurance/new (see entry/new.tsx).
    children: [],
  },
  {
    name: "應收款",
```

`Shield` stays imported (still used by the icon list) — no import changes needed since it's still referenced... actually it is NOT referenced anywhere else once removed from 固定資產's children. Remove the now-unused `Shield` import from the `lucide-react-native` import block at the top of the file.

- [ ] **Step 2: Route 保險 straight to `/insurance/new`, skipping the child-item drill-down**

In `apps/mobile/app/(app)/entry/new.tsx`, the root-level category header's `onPress` (line 106-109) currently always toggles the expand/collapse state. Add a check: if the tapped category is 保險 (which has no children), navigate directly instead of expanding an empty list. Replace:

```tsx
                <TouchableOpacity
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setState({ level: "root", expanded: isExpanded ? null : topCat.name });
                  }}
                  style={[s.sectionHeader, { backgroundColor: topCat.color }]}
                  activeOpacity={0.85}
                >
```

with:

```tsx
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
```

`router` is already in scope (`const router = useRouter();` at the top of the component). Also hide the chevron for 保險 since it never expands — the `ChevronDown`/`ChevronRight` block right after (lines 114-118) can stay as-is (it'll show `ChevronRight` since `isExpanded` is always false for 保險), which is fine — it reads as "tap to go", consistent with a leaf affordance.

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @repo/mobile type-check`
Expected: 0 errors (note: `/insurance/new` doesn't exist as a route yet — Task 7 creates it — so `router.push("/insurance/new")` will show an expo-router typed-routes error if typed routes are enabled; if so, this is expected to go red until Task 7 lands. If the type-check fails ONLY on this line with an "unknown route" error, that's acceptable at this checkpoint — re-run after Task 7. If it fails for any other reason, fix it now.)

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/lib/categoryConfig.ts "apps/mobile/app/(app)/entry/new.tsx"
git commit -m "feat: promote 保險 to a top-level category"
```

---

### Task 3: `InsurerPickerModal` component

**Files:**

- Create: `apps/mobile/components/InsurerPickerModal.tsx`

**Interfaces:**

- Consumes: `INSURER_LIST` from `@repo/shared`.
- Produces: `InsurerPickerModal` component with props `{ visible: boolean; selected?: string | null; onClose: () => void; onSelect: (insurer: string) => void }`. Selecting the "其他" row calls `onSelect("")` — callers treat an empty string as "switch to free-text entry". Used by Task 6 (`InsuranceForm`).

- [ ] **Step 1: Write the component**

```tsx
import { useMemo, useState } from "react";
import { FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Search } from "lucide-react-native";
import { INSURER_LIST } from "@repo/shared";

const OTHER_LABEL = "其他（自行填寫）";

interface Props {
  visible: boolean;
  selected?: string | null;
  onClose: () => void;
  onSelect: (insurer: string) => void;
}

export function InsurerPickerModal({ visible, selected, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");

  const data = useMemo(() => {
    const q = query.trim();
    const filtered = q ? INSURER_LIST.filter((name) => name.includes(q)) : INSURER_LIST;
    return [...filtered, OTHER_LABEL];
  }, [query]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <TouchableOpacity
            onPress={onClose}
            style={s.closeBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronLeft size={24} color="#1c1c1e" />
          </TouchableOpacity>
          <Text style={s.title}>選擇保險公司</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={s.searchRow}>
          <Search size={16} color="#8e8e93" />
          <TextInput
            style={s.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="搜尋保險公司"
            placeholderTextColor="#c7c7cc"
          />
        </View>

        <FlatList
          data={data}
          keyExtractor={(item) => item}
          contentContainerStyle={s.list}
          ItemSeparatorComponent={() => <View style={s.sep} />}
          renderItem={({ item }) => {
            const isOther = item === OTHER_LABEL;
            const isSelected = !isOther && item === selected;
            return (
              <TouchableOpacity
                onPress={() => {
                  onSelect(isOther ? "" : item);
                  onClose();
                }}
                style={s.row}
                activeOpacity={0.7}
              >
                <Text style={[s.rowLabel, isSelected && s.rowLabelActive, isOther && s.otherLabel]}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
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
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5ea",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f2f2f7",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "700", color: "#1c1c1e" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  searchInput: { flex: 1, fontSize: 15, color: "#1c1c1e" },
  list: { paddingTop: 12, paddingBottom: 24 },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#e5e5ea",
    marginHorizontal: 16,
  },
  row: { paddingHorizontal: 20, paddingVertical: 14, backgroundColor: "#fff" },
  rowLabel: { fontSize: 15, color: "#1c1c1e" },
  rowLabelActive: { fontWeight: "700", color: "#374254" },
  otherLabel: { color: "#374254", fontWeight: "600" },
});
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @repo/mobile type-check`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/InsurerPickerModal.tsx
git commit -m "feat: add InsurerPickerModal for insurance form"
```

---

### Task 4: `CoverageItemPicker` component

**Files:**

- Create: `apps/mobile/components/CoverageItemPicker.tsx`

**Interfaces:**

- Consumes: `CoverageOption` type from `@repo/shared`.
- Produces: `CoverageItemPicker` component with props `{ visible: boolean; options: CoverageOption[]; onClose: () => void; onSelect: (option: CoverageOption) => void }`. Used by Task 6 (`InsuranceForm`) — caller is responsible for passing only the not-yet-added options.

- [ ] **Step 1: Write the component**

```tsx
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import type { CoverageOption } from "@repo/shared";

interface Props {
  visible: boolean;
  options: CoverageOption[];
  onClose: () => void;
  onSelect: (option: CoverageOption) => void;
}

export function CoverageItemPicker({ visible, options, onClose, onSelect }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <TouchableOpacity
            onPress={onClose}
            style={s.closeBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronLeft size={24} color="#1c1c1e" />
          </TouchableOpacity>
          <Text style={s.title}>選擇保障項目</Text>
          <View style={{ width: 40 }} />
        </View>

        <FlatList
          data={options}
          keyExtractor={(item) => item.key}
          contentContainerStyle={s.list}
          ItemSeparatorComponent={() => <View style={s.sep} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyText}>已選滿保障項目</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => {
                onSelect(item);
                onClose();
              }}
              style={s.row}
              activeOpacity={0.7}
            >
              <Text style={s.rowLabel}>{item.label}</Text>
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    </Modal>
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
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5ea",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f2f2f7",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "700", color: "#1c1c1e" },
  list: { paddingTop: 12, paddingBottom: 24, flexGrow: 1 },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#e5e5ea",
    marginHorizontal: 16,
  },
  row: { paddingHorizontal: 20, paddingVertical: 14, backgroundColor: "#fff" },
  rowLabel: { fontSize: 15, color: "#1c1c1e" },
  empty: { paddingVertical: 40, alignItems: "center" },
  emptyText: { fontSize: 14, color: "#8e8e93" },
});
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @repo/mobile type-check`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/CoverageItemPicker.tsx
git commit -m "feat: add CoverageItemPicker for insurance form"
```

---

### Task 5: `useFinanceActions` insurance methods

**Files:**

- Modify: `apps/mobile/hooks/useFinanceActions.ts`

**Interfaces:**

- Consumes: `Insurance`, `CreateInsurance`, `UpdateInsurance` types from `@repo/shared`; existing `useApi()`.
- Produces: `useFinanceActions()` now also returns `addInsurance(data: CreateInsurance): Promise<Insurance>`, `updateInsurance(id: string, data: UpdateInsurance): Promise<Insurance>`, `deleteInsurance(id: string): Promise<void>`, `fetchInsurance(id: string): Promise<Insurance | null>`. None of these touch the Zustand store (matches the loan precedent and the design doc's "no new store slice" decision) — callers refresh `entries` themselves via the existing `fetchAll()` when they need the list to reflect a change.

- [ ] **Step 1: Add the type imports**

In `apps/mobile/hooks/useFinanceActions.ts`, extend the `@repo/shared` import (currently lines 4-17) to add three types:

```ts
import type {
  Entry,
  EntryHistory,
  Transaction,
  PortfolioItem,
  Recurrence,
  Insurance,
  CreateEntry,
  UpdateEntry,
  CreateTransaction,
  CreatePortfolioItem,
  UpdatePortfolioItem,
  CreateRecurrence,
  UpdateRecurrence,
  CreateInsurance,
  UpdateInsurance,
} from "@repo/shared";
```

- [ ] **Step 2: Add the four methods**

Insert after `deleteRecurrence` (currently lines 185-191, right before the `return { ... }` block):

```ts
const addInsurance = useCallback(
  async (data: CreateInsurance) => api.post<Insurance>("/api/insurances", data),
  [api]
);

const updateInsurance = useCallback(
  async (id: string, data: UpdateInsurance) => api.patch<Insurance>(`/api/insurances/${id}`, data),
  [api]
);

const deleteInsurance = useCallback(
  async (id: string) => {
    await api.delete(`/api/insurances/${id}`);
  },
  [api]
);

const fetchInsurance = useCallback(
  async (id: string): Promise<Insurance | null> => {
    try {
      return await api.get<Insurance>(`/api/insurances/${id}`);
    } catch {
      return null;
    }
  },
  [api]
);
```

- [ ] **Step 3: Return the new methods**

Update the `return { ... }` block at the end of the hook:

```ts
return {
  fetchAll,
  fetchEntryHistory,
  addEntry,
  updateEntry,
  deleteEntry,
  addTransaction,
  deleteTransaction,
  addPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  addRecurrence,
  updateRecurrence,
  deleteRecurrence,
  addInsurance,
  updateInsurance,
  deleteInsurance,
  fetchInsurance,
};
```

- [ ] **Step 4: Type-check**

Run: `pnpm --filter @repo/mobile type-check`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/hooks/useFinanceActions.ts
git commit -m "feat: add insurance CRUD methods to useFinanceActions"
```

---

### Task 6: `InsuranceForm` component

**Files:**

- Create: `apps/mobile/components/InsuranceForm.tsx`

**Interfaces:**

- Consumes: `InsurerPickerModal` (Task 3), `CoverageItemPicker` (Task 4), `useFinanceActions().addInsurance/updateInsurance/fetchAll` (Task 5), existing `DatePickerModal`, `useApi`/`ApiError` from `@/lib/api`, `INSURANCE_TYPES`, `INSURANCE_TYPE_LABELS`, `INSURANCE_COVERAGE_OPTIONS`, `MAX_COVERAGE_ITEMS`, `INSURER_LIST`, `CreateInsurance`, `UpdateInsurance`, `CoverageItem`, `CoverageOption`, `InsuranceType` from `@repo/shared`.
- Produces: `InsuranceForm` component, exported `InsuranceFormInitial` type. Props: `{ isEdit: boolean; insuranceId?: string; initial?: InsuranceFormInitial; onBack: () => void; onSaved: () => void }`. Used by Task 7 (`insurance/new.tsx`, `isEdit=false`) and Task 9 (`insurance/[id].tsx`, `isEdit=true`).

- [ ] **Step 1: Write the component**

```tsx
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Calendar, Check, ChevronLeft, ChevronRight, X } from "lucide-react-native";
import {
  INSURANCE_TYPES,
  INSURANCE_TYPE_LABELS,
  INSURANCE_COVERAGE_OPTIONS,
  MAX_COVERAGE_ITEMS,
  INSURER_LIST,
  type InsuranceType,
  type CoverageItem,
  type CoverageOption,
  type CreateInsurance,
  type UpdateInsurance,
} from "@repo/shared";
import { useFinanceActions } from "@/hooks/useFinanceActions";
import { ApiError } from "@/lib/api";
import { InsurerPickerModal } from "./InsurerPickerModal";
import { CoverageItemPicker } from "./CoverageItemPicker";
import { DatePickerModal } from "./DatePickerModal";

function parseISODate(s: string): Date {
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}
function toISODate(d: Date): string {
  return d.toISOString().split("T")[0] ?? "";
}
function formatDisplayDate(s: string): string {
  if (!s) return "選擇日期";
  const d = parseISODate(s);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

let _coverageKeySeq = 0;
function generateCoverageKey(): string {
  _coverageKeySeq += 1;
  return `custom_${Date.now()}_${_coverageKeySeq}`;
}

interface CoverageRowState {
  key: string;
  label: string;
  valueStr: string;
}

export interface InsuranceFormInitial {
  insurer: string;
  insuredName: string;
  insuranceType: InsuranceType;
  policyName: string | null;
  policyNumber: string | null;
  startDate: string | null;
  paymentTermYears: number | null;
  coveragePeriod: string | null;
  annualPremium: number | null;
  coverage: CoverageItem[];
}

export interface InsuranceFormProps {
  isEdit: boolean;
  insuranceId?: string;
  initial?: InsuranceFormInitial;
  onBack: () => void;
  onSaved: () => void;
}

export function InsuranceForm({
  isEdit,
  insuranceId,
  initial,
  onBack,
  onSaved,
}: InsuranceFormProps) {
  const { addInsurance, updateInsurance, fetchAll } = useFinanceActions();
  const router = useRouter();

  const [insuranceType, setInsuranceType] = useState<InsuranceType | null>(
    initial?.insuranceType ?? null
  );
  const [insurerMode, setInsurerMode] = useState<"list" | "other">(() =>
    initial && !(INSURER_LIST as readonly string[]).includes(initial.insurer) ? "other" : "list"
  );
  const [insurer, setInsurer] = useState(initial?.insurer ?? "");
  const [showInsurerPicker, setShowInsurerPicker] = useState(false);
  const [insuredName, setInsuredName] = useState(initial?.insuredName ?? "本人");
  const [policyName, setPolicyName] = useState(initial?.policyName ?? "");
  const [policyNumber, setPolicyNumber] = useState(initial?.policyNumber ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [paymentTermYears, setPaymentTermYears] = useState(
    initial?.paymentTermYears != null ? String(initial.paymentTermYears) : ""
  );
  const [coveragePeriod, setCoveragePeriod] = useState(initial?.coveragePeriod ?? "");
  const [annualPremium, setAnnualPremium] = useState(
    initial?.annualPremium != null ? String(initial.annualPremium) : ""
  );
  const [coverage, setCoverage] = useState<CoverageRowState[]>(
    () =>
      initial?.coverage.map((c) => ({ key: c.key, label: c.label, valueStr: String(c.value) })) ??
      []
  );
  const [showCoveragePicker, setShowCoveragePicker] = useState(false);

  const [errors, setErrors] = useState<{
    insuranceType?: string;
    insurer?: string;
    insuredName?: string;
  }>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const remainingOptions: CoverageOption[] = useMemo(() => {
    if (!insuranceType || insuranceType === "OTHER") return [];
    const used = new Set(coverage.map((c) => c.key));
    return INSURANCE_COVERAGE_OPTIONS[insuranceType].filter((o) => !used.has(o.key));
  }, [insuranceType, coverage]);

  const canAddMore =
    coverage.length < MAX_COVERAGE_ITEMS &&
    !!insuranceType &&
    (insuranceType === "OTHER" || remainingOptions.length > 0);

  const handleSelectType = (type: InsuranceType) => {
    if (type === insuranceType) return;
    setInsuranceType(type);
    setCoverage([]); // stale coverage keys don't necessarily belong to the new type
    setErrors((e) => ({ ...e, insuranceType: undefined }));
  };

  const handleAddCoverage = () => {
    if (!insuranceType) return;
    if (insuranceType === "OTHER") {
      setCoverage((prev) => [...prev, { key: generateCoverageKey(), label: "", valueStr: "" }]);
    } else {
      setShowCoveragePicker(true);
    }
  };

  const updateCoverageLabel = (key: string, label: string) =>
    setCoverage((prev) => prev.map((c) => (c.key === key ? { ...c, label } : c)));
  const updateCoverageValue = (key: string, valueStr: string) =>
    setCoverage((prev) => prev.map((c) => (c.key === key ? { ...c, valueStr } : c)));
  const removeCoverage = (key: string) => setCoverage((prev) => prev.filter((c) => c.key !== key));

  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (!insuranceType) errs.insuranceType = "請選擇險種";
    if (!insurer.trim()) errs.insurer = "請輸入保險公司";
    if (!insuredName.trim()) errs.insuredName = "請輸入被保人";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !insuranceType) return;
    setError(null);
    setSubmitting(true);
    try {
      const trimmedCoverage = coverage
        .filter((c) => c.label.trim().length > 0)
        .map((c) => ({ key: c.key, label: c.label.trim(), value: Number(c.valueStr) || 0 }));

      if (isEdit && insuranceId) {
        const payload: UpdateInsurance = {
          insurer: insurer.trim(),
          insuredName: insuredName.trim(),
          insuranceType,
          policyName: policyName.trim() || null,
          policyNumber: policyNumber.trim() || null,
          startDate: startDate || null,
          paymentTermYears: paymentTermYears ? parseInt(paymentTermYears, 10) : null,
          coveragePeriod: coveragePeriod.trim() || null,
          annualPremium: annualPremium ? parseFloat(annualPremium) : null,
          coverage: trimmedCoverage,
        };
        await updateInsurance(insuranceId, payload);
      } else {
        const payload: CreateInsurance = {
          insurer: insurer.trim(),
          insuredName: insuredName.trim(),
          insuranceType,
          ...(policyName.trim() ? { policyName: policyName.trim() } : {}),
          ...(policyNumber.trim() ? { policyNumber: policyNumber.trim() } : {}),
          ...(startDate ? { startDate } : {}),
          ...(paymentTermYears ? { paymentTermYears: parseInt(paymentTermYears, 10) } : {}),
          ...(coveragePeriod.trim() ? { coveragePeriod: coveragePeriod.trim() } : {}),
          ...(annualPremium ? { annualPremium: parseFloat(annualPremium) } : {}),
          ...(trimmedCoverage.length > 0 ? { coverage: trimmedCoverage } : {}),
        };
        await addInsurance(payload);
      }
      await fetchAll();
      onSaved();
    } catch (e) {
      if (e instanceof ApiError && e.code === "PREMIUM_REQUIRED") {
        Alert.alert("保單管理是 Premium 功能", "升級 Premium 即可無限新增與管理保單。", [
          { text: "稍後再決定", style: "cancel" },
          { text: "解鎖 Premium", onPress: () => router.push("/paywall") },
        ]);
        return;
      }
      setError(e instanceof Error ? e.message : "儲存失敗，請重試");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          style={s.flex}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.navRow}>
            <TouchableOpacity
              onPress={onBack}
              style={s.navCircle}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ChevronLeft size={20} color="#1c1c1e" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting}
              style={[s.navCircle, { opacity: submitting ? 0.4 : 1 }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#B8865E" />
              ) : (
                <Check size={20} color="#1c1c1e" strokeWidth={2.5} />
              )}
            </TouchableOpacity>
          </View>

          <Text style={s.titleText}>{isEdit ? "編輯保單" : "新增保單"}</Text>

          {/* ── Step 1: 險種 ─────────────────────────────────────────── */}
          <View style={s.card}>
            <Text style={s.sectionLabel}>險種</Text>
            <View style={s.chipRow}>
              {INSURANCE_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => handleSelectType(type)}
                  style={[s.chip, insuranceType === type && s.chipActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[s.chipText, insuranceType === type && s.chipTextActive]}>
                    {INSURANCE_TYPE_LABELS[type]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.insuranceType && <Text style={s.err}>{errors.insuranceType}</Text>}
          </View>

          {/* ── Step 2: 基本資料 ─────────────────────────────────────── */}
          <View style={s.card}>
            <View style={s.row}>
              <Text style={s.rowLabel}>保險公司</Text>
              {insurerMode === "list" ? (
                <TouchableOpacity
                  onPress={() => setShowInsurerPicker(true)}
                  style={s.rowRight}
                  activeOpacity={0.7}
                >
                  <Text style={insurer ? s.rowValue : s.placeholderText}>
                    {insurer || "未選擇"}
                  </Text>
                  <ChevronRight size={16} color="#c7c7cc" />
                </TouchableOpacity>
              ) : (
                <View style={s.rowRight}>
                  <TextInput
                    style={s.inputRight}
                    value={insurer}
                    onChangeText={setInsurer}
                    placeholder="輸入保險公司名稱"
                    placeholderTextColor="#c7c7cc"
                  />
                </View>
              )}
            </View>
            {insurerMode === "other" && (
              <TouchableOpacity
                onPress={() => {
                  setInsurerMode("list");
                  setInsurer("");
                }}
                style={s.switchModeRow}
              >
                <Text style={s.switchModeLink}>改用清單選擇</Text>
              </TouchableOpacity>
            )}
            {errors.insurer && <Text style={s.err}>{errors.insurer}</Text>}
            <View style={s.sep} />

            <View style={s.row}>
              <Text style={s.rowLabel}>被保人</Text>
              <TextInput
                style={s.inputRight}
                value={insuredName}
                onChangeText={setInsuredName}
                placeholder="本人"
                placeholderTextColor="#c7c7cc"
              />
            </View>
            {errors.insuredName && <Text style={s.err}>{errors.insuredName}</Text>}
            <View style={s.sep} />

            <View style={s.row}>
              <Text style={s.rowLabel}>保單名稱</Text>
              <TextInput
                style={s.inputRight}
                value={policyName}
                onChangeText={setPolicyName}
                placeholder="選填"
                placeholderTextColor="#c7c7cc"
              />
            </View>
            <View style={s.sep} />

            <View style={s.row}>
              <Text style={s.rowLabel}>保單號碼</Text>
              <TextInput
                style={s.inputRight}
                value={policyNumber}
                onChangeText={setPolicyNumber}
                placeholder="選填"
                placeholderTextColor="#c7c7cc"
              />
            </View>
            <View style={s.sep} />

            <TouchableOpacity
              style={s.row}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.7}
            >
              <Text style={s.rowLabel}>投保日期</Text>
              <View style={s.rowRight}>
                <Text style={startDate ? s.rowValue : s.placeholderText}>
                  {formatDisplayDate(startDate)}
                </Text>
                <Calendar size={16} color="#8e8e93" />
              </View>
            </TouchableOpacity>
            <View style={s.sep} />

            <View style={s.row}>
              <Text style={s.rowLabel}>繳費年期（年）</Text>
              <TextInput
                style={s.inputRight}
                value={paymentTermYears}
                onChangeText={setPaymentTermYears}
                placeholder="選填"
                placeholderTextColor="#c7c7cc"
                keyboardType="number-pad"
              />
            </View>
            <View style={s.sep} />

            <View style={s.row}>
              <Text style={s.rowLabel}>保障期間</Text>
              <TextInput
                style={s.inputRight}
                value={coveragePeriod}
                onChangeText={setCoveragePeriod}
                placeholder="終身／定期到 X 歲"
                placeholderTextColor="#c7c7cc"
              />
            </View>
            <View style={s.sep} />

            <View style={s.row}>
              <Text style={s.rowLabel}>年繳保費</Text>
              <TextInput
                style={s.inputRight}
                value={annualPremium}
                onChangeText={setAnnualPremium}
                placeholder="選填"
                placeholderTextColor="#c7c7cc"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* ── Step 3: 保障細項（B 區） ──────────────────────────────── */}
          {insuranceType && (
            <View style={s.card}>
              <Text style={s.sectionLabel}>保障項目（最多 {MAX_COVERAGE_ITEMS} 項）</Text>
              {coverage.map((item) => (
                <View key={item.key} style={s.coverageRow}>
                  {insuranceType === "OTHER" ? (
                    <TextInput
                      style={s.coverageLabelInput}
                      value={item.label}
                      onChangeText={(t) => updateCoverageLabel(item.key, t)}
                      placeholder="保障名稱"
                      placeholderTextColor="#c7c7cc"
                    />
                  ) : (
                    <Text style={s.coverageLabel} numberOfLines={1}>
                      {item.label}
                    </Text>
                  )}
                  <TextInput
                    style={s.coverageValueInput}
                    value={item.valueStr}
                    onChangeText={(t) => updateCoverageValue(item.key, t)}
                    placeholder="0"
                    placeholderTextColor="#c7c7cc"
                    keyboardType="decimal-pad"
                  />
                  <TouchableOpacity onPress={() => removeCoverage(item.key)} hitSlop={8}>
                    <X size={16} color="#8e8e93" />
                  </TouchableOpacity>
                </View>
              ))}
              {canAddMore && (
                <TouchableOpacity
                  onPress={handleAddCoverage}
                  style={s.addCoverageBtn}
                  activeOpacity={0.7}
                >
                  <Text style={s.addCoverageText}>+ 新增保障</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {error != null && <Text style={s.errorText}>{error}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>

      <InsurerPickerModal
        visible={showInsurerPicker}
        selected={insurerMode === "list" ? insurer : null}
        onClose={() => setShowInsurerPicker(false)}
        onSelect={(value) => {
          if (value === "") {
            setInsurerMode("other");
            setInsurer("");
          } else {
            setInsurerMode("list");
            setInsurer(value);
          }
        }}
      />

      <CoverageItemPicker
        visible={showCoveragePicker}
        options={remainingOptions}
        onClose={() => setShowCoveragePicker(false)}
        onSelect={(option) =>
          setCoverage((prev) => [...prev, { key: option.key, label: option.label, valueStr: "" }])
        }
      />

      <DatePickerModal
        visible={showDatePicker}
        date={parseISODate(startDate)}
        onConfirm={(picked) => setStartDate(toISODate(picked))}
        onClose={() => setShowDatePicker(false)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f2f7" },
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 48 },

  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
    paddingBottom: 16,
  },
  navCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },

  titleText: { fontSize: 22, fontWeight: "700", color: "#1c1c1e", marginBottom: 16 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: "#f2f2f7", marginHorizontal: 20 },

  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8e8e93",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 16 },
  chip: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "#f2f2f7",
  },
  chipActive: { backgroundColor: "#B8865E" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#8e8e93" },
  chipTextActive: { color: "#ffffff" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 52,
  },
  rowLabel: { fontSize: 15, fontWeight: "500", color: "#1c1c1e", flexShrink: 0 },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    justifyContent: "flex-end",
  },
  rowValue: { fontSize: 15, color: "#1c1c1e" },
  placeholderText: { fontSize: 15, color: "#c7c7cc" },
  inputRight: { flex: 1, textAlign: "right", fontSize: 15, color: "#1c1c1e" },
  switchModeRow: { paddingHorizontal: 20, paddingBottom: 8 },
  switchModeLink: { fontSize: 12, color: "#374254", textAlign: "right" },
  err: { fontSize: 12, color: "#ff3b30", paddingHorizontal: 20, paddingBottom: 8 },

  coverageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  coverageLabel: { flex: 1, fontSize: 14, color: "#1c1c1e" },
  coverageLabelInput: {
    flex: 1,
    fontSize: 14,
    color: "#1c1c1e",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5ea",
    paddingVertical: 4,
  },
  coverageValueInput: {
    width: 90,
    fontSize: 14,
    color: "#1c1c1e",
    textAlign: "right",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5ea",
    paddingVertical: 4,
  },
  addCoverageBtn: { paddingHorizontal: 20, paddingVertical: 14 },
  addCoverageText: { fontSize: 14, fontWeight: "600", color: "#374254" },

  errorText: {
    marginTop: 4,
    marginBottom: 12,
    textAlign: "center",
    fontSize: 13,
    color: "#ff3b30",
  },
});
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @repo/mobile type-check`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/InsuranceForm.tsx
git commit -m "feat: add InsuranceForm component"
```

---

### Task 7: `/insurance/new` route

**Files:**

- Create: `apps/mobile/app/(app)/insurance/new.tsx`
- Modify: `apps/mobile/app/(app)/_layout.tsx`

**Interfaces:**

- Consumes: `InsuranceForm` (Task 6).
- Produces: navigable route `/insurance/new`. Fixes the `router.push("/insurance/new")` call added in Task 2.

- [ ] **Step 1: Create the route screen**

```tsx
import { useRouter } from "expo-router";
import { InsuranceForm } from "@/components/InsuranceForm";

export default function NewInsuranceScreen() {
  const router = useRouter();

  return (
    <InsuranceForm
      isEdit={false}
      onBack={() => router.back()}
      onSaved={() => router.navigate("/(app)/(tabs)")}
    />
  );
}
```

- [ ] **Step 2: Register the route in the stack navigator**

In `apps/mobile/app/(app)/_layout.tsx`, add `insurance/new` (and `insurance/[id]`, which Task 9 creates — registering it now avoids a second edit to this file):

```tsx
import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="entry/new" />
      <Stack.Screen name="entry/form" />
      <Stack.Screen name="entry/[id]" />
      <Stack.Screen name="entry/[id]/edit" />
      <Stack.Screen name="insurance/new" />
      <Stack.Screen name="insurance/[id]" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @repo/mobile type-check`
Expected: 0 errors. The Task 2 route-typing warning (if any appeared) should now be gone since `/insurance/new` exists.

- [ ] **Step 4: Manual smoke test (Expo Go)**

Start the dev server (`pnpm dev` at repo root, `pnpm --filter @repo/mobile start -c` for the app) and on a device/simulator: tap `+` → tap 保險 → confirm it navigates straight to the new insurance form (no intermediate sub-category list) → tap back arrow → confirm it returns to the `+` picker without crashing.

- [ ] **Step 5: Commit**

```bash
git add "apps/mobile/app/(app)/insurance/new.tsx" "apps/mobile/app/(app)/_layout.tsx"
git commit -m "feat: add insurance new-policy route"
```

---

### Task 8: Insurance card rendering in the entry list

**Files:**

- Modify: `apps/mobile/components/CategoryCardStack.tsx` (header total + row display)
- Modify: `apps/mobile/app/(app)/(tabs)/index.tsx` (route insurance rows to the insurance detail screen)

**Interfaces:**

- Consumes: `entry.insurance` (now carries `id`, from Task 1) already flows through `Entry` from `@repo/shared` — no new imports needed beyond what's already there.
- Produces: the 保險 category card shows "共 N 張保單" instead of a currency total; its member rows show `保險公司 · 險種` instead of an amount; tapping a row with `entry.insurance` set navigates to `/insurance/[id]` using the insurance record's own id.

- [ ] **Step 1: Card header — show a count for 保險 instead of a currency sum**

In `apps/mobile/components/CategoryCardStack.tsx`, the header `Pressable` (currently lines 307-312):

```tsx
<Pressable onPress={() => handleCardPress(cat.name)} style={st.header}>
  <Text style={[st.headerTitle, { color: cat.textColor }]}>{cat.name}</Text>
  <Text style={[st.headerTotal, { color: cat.textColor }]}>
    {hideBalance ? "••••••" : formatCurrency(cat.total)}
  </Text>
</Pressable>
```

replace with:

```tsx
<Pressable onPress={() => handleCardPress(cat.name)} style={st.header}>
  <Text style={[st.headerTitle, { color: cat.textColor }]}>{cat.name}</Text>
  <Text style={[st.headerTotal, { color: cat.textColor }]}>
    {cat.name === "保險"
      ? `共 ${cat.entries.length} 張保單`
      : hideBalance
        ? "••••••"
        : formatCurrency(cat.total)}
  </Text>
</Pressable>
```

- [ ] **Step 2: Entry row — show insurer/type instead of an amount for insurance entries**

In the same file, the row `Pressable` (currently lines 334-354):

```tsx
<Pressable key={entry.id} onPress={() => onEntryClick(entry)} style={st.entryRow}>
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
  <Text style={st.entryValue}>{hideBalance ? "••••" : formatCurrency(entry.value)}</Text>
  <Text style={st.chevron}>›</Text>
</Pressable>
```

replace with:

```tsx
<Pressable key={entry.id} onPress={() => onEntryClick(entry)} style={st.entryRow}>
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
  {entry.insurance ? (
    <Text style={st.entryValue} numberOfLines={1}>
      {entry.insurance.insurer}
    </Text>
  ) : (
    <Text style={st.entryValue}>{hideBalance ? "••••" : formatCurrency(entry.value)}</Text>
  )}
  <Text style={st.chevron}>›</Text>
</Pressable>
```

- [ ] **Step 3: Route insurance entries to `/insurance/[id]`**

In `apps/mobile/app/(app)/(tabs)/index.tsx`, line 190:

```tsx
              onEntryClick={(entry) => router.push(`/entry/${entry.id}`)}
```

replace with:

```tsx
              onEntryClick={(entry) =>
                entry.insurance
                  ? router.push(`/insurance/${entry.insurance.id}`)
                  : router.push(`/entry/${entry.id}`)
              }
```

- [ ] **Step 4: Type-check**

Run: `pnpm --filter @repo/mobile type-check`
Expected: 0 errors (the `/insurance/[id]` route doesn't exist until Task 9 — same caveat as Task 2 Step 3: acceptable if the only failure is an unknown-typed-route error on this one line).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/CategoryCardStack.tsx "apps/mobile/app/(app)/(tabs)/index.tsx"
git commit -m "feat: render insurance entries distinctly in the entry list"
```

---

### Task 9: Insurance detail screen

**Files:**

- Create: `apps/mobile/app/(app)/insurance/[id].tsx`

**Interfaces:**

- Consumes: `useFinanceActions().fetchInsurance/deleteInsurance/fetchAll` (Task 5), `InsuranceForm` (Task 6, `isEdit=true` for the edit path), `Insurance` type from `@repo/shared`, `INSURANCE_TYPE_LABELS` from `@repo/shared`.
- Produces: navigable route `/insurance/[id]` (matches the `[id]` param to the insurance record's own id, per Task 1/Task 8 wiring). Terminal task for the create/read/update/delete loop.

- [ ] **Step 1: Create the route screen**

```tsx
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Pencil, Trash2 } from "lucide-react-native";
import { INSURANCE_TYPE_LABELS, type Insurance } from "@repo/shared";
import { useFinanceActions } from "@/hooks/useFinanceActions";
import { InsuranceForm } from "@/components/InsuranceForm";
import { formatCurrency } from "@/lib/format";

const UNKNOWN = "不確定";

function formatDate(iso: string | null): string {
  if (!iso) return UNKNOWN;
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

export default function InsuranceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { fetchInsurance, deleteInsurance, fetchAll } = useFinanceActions();

  const [insurance, setInsurance] = useState<Insurance | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const result = await fetchInsurance(id);
    setInsurance(result);
    setLoading(false);
  }, [id, fetchInsurance]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleDelete = () => {
    if (!insurance) return;
    Alert.alert("刪除保單", "確定要刪除這張保單嗎？此動作無法復原。", [
      { text: "取消", style: "cancel" },
      {
        text: "刪除",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteInsurance(insurance.id);
            await fetchAll();
            router.back();
          } catch {
            Alert.alert("刪除失敗", "請稍後再試");
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.root, s.center]}>
        <ActivityIndicator size="large" color="#B8865E" />
      </SafeAreaView>
    );
  }

  if (!insurance) {
    return (
      <SafeAreaView style={[s.root, s.center]}>
        <Text style={s.notFound}>找不到這張保單</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.backLink}>
          <Text style={s.backLinkText}>返回</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (mode === "edit") {
    return (
      <InsuranceForm
        isEdit
        insuranceId={insurance.id}
        initial={{
          insurer: insurance.insurer,
          insuredName: insurance.insuredName,
          insuranceType: insurance.insuranceType,
          policyName: insurance.policyName,
          policyNumber: insurance.policyNumber,
          startDate: insurance.startDate,
          paymentTermYears: insurance.paymentTermYears,
          coveragePeriod: insurance.coveragePeriod,
          annualPremium: insurance.annualPremium,
          coverage: insurance.coverage,
        }}
        onBack={() => setMode("view")}
        onSaved={() => {
          setMode("view");
          load();
        }}
      />
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.navRow}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.navCircle}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={20} color="#1c1c1e" />
        </TouchableOpacity>
        <View style={s.navRight}>
          <TouchableOpacity
            onPress={() => setMode("edit")}
            style={s.navCircle}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Pencil size={18} color="#1c1c1e" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDelete}
            disabled={deleting}
            style={[s.navCircle, { opacity: deleting ? 0.4 : 1 }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Trash2 size={18} color="#ff3b30" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scrollContent}>
        <Text style={s.titleText}>{insurance.policyName ?? insurance.insurer}</Text>
        <Text style={s.titleSub}>{INSURANCE_TYPE_LABELS[insurance.insuranceType]}</Text>

        <View style={s.card}>
          <Field label="保險公司" value={insurance.insurer} />
          <View style={s.sep} />
          <Field label="被保人" value={insurance.insuredName} />
          <View style={s.sep} />
          <Field label="險種" value={INSURANCE_TYPE_LABELS[insurance.insuranceType]} />
          <View style={s.sep} />
          <Field label="保單名稱" value={insurance.policyName ?? UNKNOWN} />
          <View style={s.sep} />
          <Field label="保單號碼" value={insurance.policyNumber ?? UNKNOWN} />
        </View>

        {insurance.coverage.length > 0 && (
          <View style={s.card}>
            <Text style={s.sectionLabel}>保障項目</Text>
            {insurance.coverage.map((item, idx) => (
              <View key={item.key}>
                {idx > 0 && <View style={s.sep} />}
                <Field label={item.label} value={formatCurrency(item.value)} />
              </View>
            ))}
          </View>
        )}

        <View style={s.card}>
          <Field
            label="年繳保費"
            value={
              insurance.annualPremium != null ? formatCurrency(insurance.annualPremium) : UNKNOWN
            }
          />
          <View style={s.sep} />
          <Field
            label="繳費年期"
            value={
              insurance.paymentTermYears != null ? `${insurance.paymentTermYears} 年` : UNKNOWN
            }
          />
          <View style={s.sep} />
          <Field label="保障期間" value={insurance.coveragePeriod ?? UNKNOWN} />
          <View style={s.sep} />
          <Field label="投保日期" value={formatDate(insurance.startDate)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f2f7" },
  center: { alignItems: "center", justifyContent: "center" },
  notFound: { fontSize: 15, color: "#8e8e93" },
  backLink: { marginTop: 12 },
  backLinkText: { fontSize: 14, color: "#374254", fontWeight: "600" },

  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  navRight: { flexDirection: "row", gap: 8 },
  navCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 48 },
  titleText: { fontSize: 22, fontWeight: "700", color: "#1c1c1e", marginTop: 8 },
  titleSub: { fontSize: 14, color: "#8e8e93", marginBottom: 16, marginTop: 2 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: "#f2f2f7", marginHorizontal: 20 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8e8e93",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 52,
  },
  rowLabel: { fontSize: 15, fontWeight: "500", color: "#1c1c1e" },
  rowValue: { fontSize: 15, color: "#1c1c1e", flexShrink: 1, textAlign: "right" },
});
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @repo/mobile type-check`
Expected: 0 errors

- [ ] **Step 3: Manual smoke test (Expo Go) — full loop**

On a device/simulator, walk the whole loop: `+` → 保險 → fill in a MEDICAL policy with 2 coverage items → save → confirm it appears in the entry list under a 保險 card showing "共 1 張保單" (no amount) → tap the row → confirm the detail page shows the right fields, with any left-blank field showing "不確定" → tap edit (pencil) → change 保單名稱 → save → confirm the change reflects on the detail page → tap delete (trash) → confirm the delete confirmation, confirm it → confirm the 保險 card either shows "共 0 張保單"'s equivalent (empty, card disappears since `stackCategories` skips empty categories) or updates correctly.

Also test the OTHER 險種 path (free-form coverage label/value) and the "其他" insurer free-text path.

- [ ] **Step 4: Commit**

```bash
git add "apps/mobile/app/(app)/insurance/[id].tsx"
git commit -m "feat: add insurance detail screen with edit and delete"
```

---

### Task 10: Final sweep

**Files:** none (verification only)

**Interfaces:** none — this task only runs checks across everything Tasks 1-9 touched.

- [ ] **Step 1: Full type-check across affected packages**

Run: `pnpm --filter @repo/shared exec tsc --noEmit && pnpm --filter @repo/web exec tsc --noEmit && pnpm --filter @repo/mobile type-check`
Expected: 0 errors in all three

- [ ] **Step 2: Full automated suites**

Run: `pnpm --filter @repo/shared exec vitest run && pnpm --filter @repo/web exec vitest run`
Expected: all PASS, no regressions vs. the Task 1 baseline

- [ ] **Step 3: Mobile lint**

Run: `pnpm --filter @repo/mobile lint`
Expected: 0 errors (warnings acceptable only if they already existed before this plan — do not introduce new ones)

- [ ] **Step 4: Full manual regression pass (Expo Go, real device)**

Repeat Task 9 Step 3's full loop once more end-to-end, plus: confirm existing non-insurance flows are untouched — add a 流動資金/現金 entry, confirm it still works exactly as before (proves the `CategoryCardStack`/`index.tsx` edits didn't regress the generic path); confirm 固定資產 card no longer shows a 保險 leaf item (since it moved to its own top-level card).

- [ ] **Step 5: Update the progress ledger**

Append a "Plan C2" section to `.superpowers/sdd/progress.md`, following the same format as the existing Plan A / Plan C1 sections (task checklist + log + any follow-up notes).

- [ ] **Step 6: Commit**

```bash
git add .superpowers/sdd/progress.md
git commit -m "docs: record Plan C2 completion in progress ledger"
```
