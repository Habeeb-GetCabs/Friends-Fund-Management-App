import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Plus, Trash2 } from 'lucide-react';
import {
  AppDatabaseState,
  SavingsAllocation,
  buildSavingsAllocations,
  formatDateDDMMYYYY,
  formatINR,
  getMemberPendingDates,
} from '../domain/ledgerEngine';

interface RecordSavingsModalProps {
  state: AppDatabaseState;
  initialMemberId?: string;
  initialDateISO?: string;
  onClose: () => void;
  onSubmitSavings: (params: {
    memberId: string;
    amount: number;
    transactionDate: string;
    allocations: SavingsAllocation[];
    description?: string;
    notes?: string;
  }) => void;
}

export const RecordSavingsModal: React.FC<RecordSavingsModalProps> = ({
  state,
  initialMemberId,
  initialDateISO,
  onClose,
  onSubmitSavings,
}) => {
  const [memberId, setMemberId] = useState<string>(
    initialMemberId || state.members[0]?.id || 'member-1'
  );
  const [paymentDate, setPaymentDate] = useState<string>(
    initialDateISO || state.settings.currentReferenceDate
  );
  const [amountInput, setAmountInput] = useState<string>(
    String(state.settings.dailyContributionAmount)
  );
  const [allocationMode, setAllocationMode] = useState<
    'single-date' | 'cover-missed-then-current' | 'manual'
  >('single-date');
  const [manualAllocations, setManualAllocations] = useState<
    SavingsAllocation[]
  >([
    {
      targetDate: initialDateISO || state.settings.currentReferenceDate,
      amount: state.settings.dailyContributionAmount,
    },
  ]);
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const numericAmount = Number(amountInput) || 0;
  const pendingDaysForMember = getMemberPendingDates(
    state,
    memberId,
    paymentDate
  );

  // Compute live preview allocations when mode is not manual
  const previewAllocations: SavingsAllocation[] =
    allocationMode === 'manual'
      ? manualAllocations
      : buildSavingsAllocations(
          state,
          memberId,
          numericAmount,
          paymentDate,
          allocationMode
        );

  useEffect(() => {
    // If admin enters > dailyContributionAmount and member has missed days, keep mode explicit
    if (allocationMode === 'manual') {
      setManualAllocations((prev) => {
        if (prev.length === 1) {
          return [{ targetDate: paymentDate, amount: numericAmount }];
        }
        return prev;
      });
    }
  }, [numericAmount, paymentDate, allocationMode]);

  const handleQuickAmount = (amt: number, autoCoverMissed = false) => {
    setAmountInput(String(amt));
    if (autoCoverMissed) {
      setAllocationMode('cover-missed-then-current');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      onSubmitSavings({
        memberId,
        amount: numericAmount,
        transactionDate: paymentDate,
        allocations: previewAllocations,
        notes,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-savings-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 shadow-xl my-8">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2
              id="record-savings-title"
              className="text-lg font-bold text-slate-900"
            >
              Record Daily Savings Contribution
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Supports full ({formatINR(state.settings.dailyContributionAmount)}), partial, missed-day compensation &amp; advance payments
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close savings entry modal"
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label
                htmlFor="savings-member-select"
                className="block text-xs font-semibold text-slate-700"
              >
                Member
              </label>
              <select
                id="savings-member-select"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900 min-h-[42px]"
              >
                {state.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="savings-date-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Payment Date ({formatDateDDMMYYYY(paymentDate)})
              </label>
              <input
                id="savings-date-input"
                type="date"
                value={paymentDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setPaymentDate(val);
                  if (manualAllocations.length === 1) {
                    setManualAllocations([
                      { targetDate: val, amount: numericAmount },
                    ]);
                  }
                }}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 font-mono tabular-nums text-sm text-slate-900 min-h-[42px]"
                required
              />
            </div>
          </div>

          {/* Pending / Missed Days Banner for Selected Member */}
          {pendingDaysForMember.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900">
              <div className="font-semibold flex items-center justify-between">
                <span>
                  Pending / Missed Dates up to {formatDateDDMMYYYY(paymentDate)}:{' '}
                  {pendingDaysForMember.length} day(s)
                </span>
                <span className="font-mono tabular-nums font-bold">
                  Total Pending:{' '}
                  {formatINR(
                    pendingDaysForMember.reduce(
                      (s, d) => s + d.pendingAmount,
                      0
                    )
                  )}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5 font-mono tabular-nums text-[11px]">
                {pendingDaysForMember.map((pd) => (
                  <span
                    key={pd.date}
                    className="text-amber-800"
                  >
                    {formatDateDDMMYYYY(pd.date)} ({formatINR(pd.pendingAmount)} due)
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Amount Input & Quick Presets */}
          <div>
            <label
              htmlFor="savings-amount-input"
              className="block text-xs font-semibold text-slate-700"
            >
              Contribution Amount (₹)
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                id="savings-amount-input"
                type="number"
                min={1}
                step={1}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono tabular-nums text-base font-bold text-slate-900 min-h-[44px]"
                required
              />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickAmount(50, false)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono tabular-nums text-xs font-medium"
              >
                ₹50 (Partial)
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickAmount(state.settings.dailyContributionAmount, false)
                }
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono tabular-nums text-xs font-semibold"
              >
                {formatINR(state.settings.dailyContributionAmount)} (1 Day)
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickAmount(
                    state.settings.dailyContributionAmount * 2,
                    true
                  )
                }
                className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono tabular-nums text-xs font-semibold"
              >
                {formatINR(state.settings.dailyContributionAmount * 2)} (Cover Missed + Today)
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickAmount(
                    state.settings.dailyContributionAmount * 3,
                    true
                  )
                }
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono tabular-nums text-xs font-medium"
              >
                {formatINR(state.settings.dailyContributionAmount * 3)} (3 Days)
              </button>
            </div>
          </div>

          {/* Allocation Strategy Selector */}
          <div>
            <span className="block text-xs font-semibold text-slate-700 mb-1.5">
              Payment Date Allocation Mode
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAllocationMode('single-date')}
                className={`p-2.5 rounded-xl border text-left text-xs transition-colors ${
                  allocationMode === 'single-date'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="font-semibold">Selected Date Only</div>
                <div
                  className={`text-[11px] mt-0.5 ${
                    allocationMode === 'single-date'
                      ? 'text-slate-300'
                      : 'text-slate-500'
                  }`}
                >
                  All {formatINR(numericAmount)} on {formatDateDDMMYYYY(paymentDate)}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAllocationMode('cover-missed-then-current')}
                className={`p-2.5 rounded-xl border text-left text-xs transition-colors ${
                  allocationMode === 'cover-missed-then-current'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="font-semibold">Cover Missed + Current</div>
                <div
                  className={`text-[11px] mt-0.5 ${
                    allocationMode === 'cover-missed-then-current'
                      ? 'text-slate-300'
                      : 'text-slate-500'
                  }`}
                >
                  Settles missed days first, then current/advance
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAllocationMode('manual');
                  setManualAllocations(
                    previewAllocations.length > 0
                      ? previewAllocations.map((a) => ({ ...a }))
                      : [{ targetDate: paymentDate, amount: numericAmount }]
                  );
                }}
                className={`p-2.5 rounded-xl border text-left text-xs transition-colors ${
                  allocationMode === 'manual'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="font-semibold">Manual Specific Dates</div>
                <div
                  className={`text-[11px] mt-0.5 ${
                    allocationMode === 'manual'
                      ? 'text-slate-300'
                      : 'text-slate-500'
                  }`}
                >
                  Choose exact dates &amp; rupee split
                </div>
              </button>
            </div>
          </div>

          {/* Allocation Preview or Manual Editor */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
              <span>Ledger Allocation Breakdown</span>
              {allocationMode === 'manual' && (
                <button
                  type="button"
                  onClick={() =>
                    setManualAllocations([
                      ...manualAllocations,
                      {
                        targetDate: paymentDate,
                        amount: state.settings.dailyContributionAmount,
                      },
                    ])
                  }
                  className="text-emerald-700 hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Date Row</span>
                </button>
              )}
            </div>

            {allocationMode === 'manual' ? (
              <div className="mt-2.5 space-y-2">
                {manualAllocations.map((alloc, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="date"
                      aria-label={`Manual target date ${idx + 1}`}
                      value={alloc.targetDate}
                      onChange={(e) => {
                        const next = [...manualAllocations];
                        next[idx] = {
                          ...next[idx],
                          targetDate: e.target.value,
                        };
                        setManualAllocations(next);
                      }}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono tabular-nums text-xs"
                    />
                    <input
                      type="number"
                      aria-label={`Manual allocated amount ${idx + 1}`}
                      min={1}
                      value={alloc.amount}
                      onChange={(e) => {
                        const next = [...manualAllocations];
                        next[idx] = {
                          ...next[idx],
                          amount: Number(e.target.value) || 0,
                        };
                        setManualAllocations(next);
                      }}
                      className="w-28 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono tabular-nums text-xs font-semibold"
                    />
                    {manualAllocations.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setManualAllocations(
                            manualAllocations.filter((_, i) => i !== idx)
                          )
                        }
                        aria-label="Remove date allocation"
                        className="p-1.5 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 space-y-1.5">
                {previewAllocations.map((alloc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs font-mono tabular-nums"
                  >
                    <span className="text-slate-700 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>For Date {formatDateDDMMYYYY(alloc.targetDate)}</span>
                    </span>
                    <span className="font-bold text-slate-900">
                      {formatINR(alloc.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="savings-notes-input"
              className="block text-xs font-semibold text-slate-700"
            >
              Optional Notes
            </label>
            <input
              id="savings-notes-input"
              type="text"
              placeholder="e.g., Paid via UPI / Cash to Treasurer"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold min-h-[44px]"
            >
              Confirm &amp; Save {formatINR(numericAmount)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
