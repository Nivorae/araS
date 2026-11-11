"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import type { Entry } from "@repo/shared";
import { useFinanceStore } from "../../store/useFinanceStore";
import { AccountFormPage } from "./AccountFormPage";
import { EntryDetailPage } from "./EntryDetailPage";
import { InsuranceOverviewPage } from "./InsuranceOverviewPage";
import { getTopCategory } from "./categoryConfig";

export interface NewEntryConfig {
  topCategory: string;
  isLiability: boolean;
  color: string;
  subCategoryName: string;
}

export interface EntrySheetsHandle {
  /** Open an entry the way mobile does: insurance → policy overview deck, else the detail page. */
  openEntry: (entry: Entry) => void;
  /** Open the entry form for a brand-new entry. */
  openNewEntry: (config: NewEntryConfig) => void;
}

type FormState =
  | { kind: "new"; config: NewEntryConfig }
  | { kind: "addRecord"; entry: Entry }
  | { kind: "edit"; entry: Entry };

/**
 * The sheets reachable from an entry — detail page, the entry form in its
 * three modes, and the insurance policy view — shared by every page that
 * lists entries (mobile pushes `/entry/[id]` from both the assets and the
 * 資產損益 tabs). `onNewEntrySaved` lets the caller close its own pickers.
 */
export const EntrySheetsHost = forwardRef<EntrySheetsHandle, { onNewEntrySaved?: () => void }>(
  function EntrySheetsHost({ onNewEntrySaved }, ref) {
    const { deleteEntry, refreshEntries } = useFinanceStore();
    const [detailId, setDetailId] = useState<string | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [form, setForm] = useState<FormState | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [insuranceId, setInsuranceId] = useState<string | null>(null);
    const [insuranceOpen, setInsuranceOpen] = useState(false);

    useImperativeHandle(ref, () => ({
      openEntry: (entry) => {
        if (entry.insurance) {
          setInsuranceId(entry.insurance.id);
          setInsuranceOpen(true);
          return;
        }
        setDetailId(entry.id);
        setDetailOpen(true);
      },
      openNewEntry: (config) => {
        setForm({ kind: "new", config });
        setFormOpen(true);
      },
    }));

    const formEntry = form && form.kind !== "new" ? form.entry : null;
    const formTop = formEntry ? getTopCategory(formEntry.topCategory) : null;

    return (
      <>
        <EntryDetailPage
          open={detailOpen}
          entryId={detailId}
          onClose={() => setDetailOpen(false)}
          onAddRecord={(entry) => {
            setForm({ kind: "addRecord", entry });
            setFormOpen(true);
          }}
          onEdit={(entry) => {
            setForm({ kind: "edit", entry });
            setFormOpen(true);
          }}
          onDelete={async (id) => {
            await deleteEntry(id);
            setDetailOpen(false);
          }}
        />

        <AccountFormPage
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            if (form?.kind === "new") onNewEntrySaved?.();
          }}
          topCategory={
            form?.kind === "new" ? form.config.topCategory : (formEntry?.topCategory ?? "")
          }
          isLiability={
            form?.kind === "new" ? form.config.isLiability : (formTop?.isLiability ?? false)
          }
          categoryColor={form?.kind === "new" ? form.config.color : (formTop?.color ?? "#374254")}
          subCategoryName={
            form?.kind === "new" ? form.config.subCategoryName : (formEntry?.subCategory ?? "")
          }
          entry={formEntry}
          addRecord={form?.kind === "addRecord"}
        />

        <InsuranceOverviewPage
          open={insuranceOpen}
          focusId={insuranceId}
          onClose={() => setInsuranceOpen(false)}
          onChanged={() => void refreshEntries()}
        />
      </>
    );
  }
);
