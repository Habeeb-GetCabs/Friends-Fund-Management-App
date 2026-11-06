import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Check } from 'lucide-react';
import {
  AppDatabaseState,
  DailyRegisterEntryInput,
  formatDateDDMMYYYY,
  formatINR,
  getMemberSavingsForDate,
} from '../domain/ledgerEngine';

interface RecordSavingsModalProps {
  state: AppDatabaseState;
  initialMemberId?: string;
  initialDateISO?: string;
  onClose: () => void;
  onSaveCollectionBatch: (params: {
    paymentDateISO: string;
    entries: DailyRegisterEntryInput[];
  }) => void;
}

interface MemberRowState {
  memberId: string;
  memberName: string;
  paid: boolean;
  amountText: string; // Never prefilled for new entries!
  alreadyPaidAmount: number;
  correctionReason: string;
}

export const RecordSavingsModal: React.FC<RecordSavingsModalProps> = ({
  state,
  initialMemberId,
  initialDateISO,
  onClose,
  onSaveCollectionBatch,
}) => {
  const [paymentDate, setPaymentDate] = useState<string>(
    initialDateISO || state.settings.currentReferenceDate
  );
  const [rows, setRows] = useState<MemberRowState[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Sync the 7 member rows whenever paymentDate changes.
  // IMPORTANT:
  // - If a member has already paid for the selected date, show that member as Paid with their recorded amount.
  // - If a member has NOT paid for the selected date, never prefill any payment amount!
  useEffect(() => {
    const nextRows: MemberRowState[] = state.members.map((m) => {
      const stat = getMemberSavingsForDate(state, m.id, paymentDate);
      const existingAmt = stat.cashPaidOnDate > 0 ? stat.cashPaidOnDate : stat.allocatedAmount;
      const alreadyPaid = existingAmt > 0;
      const shouldCheckInitial =
        alreadyPaid || (initialMemberId ? m.id === initialMemberId : false);

      return {
        memberId: m.id,
        memberName: m.name,
        paid: shouldCheckInitial,
        amountText: alreadyPaid ? String(existingAmt) : '',
        alreadyPaidAmount: existingAmt,
        correctionReason: '',
      };
    });
    setRows(nextRows);
    setError(null);
  }, [paymentDate, state, initialMemberId]);

  const handleTogglePaid = (memberId: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.memberId !== memberId) return row;
        const nextPaid = !row.paid;
        return {
          ...row,
          paid: nextPaid,
          // Keep existing recorded amount if already paid, otherwise leave blank (never prefill!)
          amountText: nextPaid
            ? row.alreadyPaidAmount > 0
              ? String(row.alreadyPaidAmount)
              : row.amountText
            : '',
        };
      })
    );
    setError(null);
  };

  const handleAmountChange = (memberId: string, value: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.memberId === memberId ? { ...row, amountText: value } : row
      )
    );
    setError(null);
  };

  const handleReasonChange = (memberId: string, value: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.memberId === memberId ? { ...row, correctionReason: value } : row
      )
    );
  };

  const membersPaidCount = rows.filter((r) => r.paid).length;
  const membersUnpaidCount = rows.length - membersPaidCount;
  const totalAmountCollected = rows.reduce((sum, r) => {
    if (!r.paid) return sum;
    const val = Number(r.amountText);
    return sum + (Number.isFinite(val) && val > 0 ? val : 0);
  }, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate that every checked member has a valid positive amount entered by the treasurer
    for (const r of rows) {
      if (r.paid) {
        const num = Number(r.amountText);
        if (!r.amountText.trim() || !Number.isFinite(num) || num <= 0) {
          setError(
            `Please enter the actual payment amount received for ${r.memberName}.`
          );
          return;
        }
      }
    }

    const entries: DailyRegisterEntryInput[] = rows.map((r) => ({
      memberId: r.memberId,
      paid: r.paid,
      amount: r.paid ? Number(r.amountText) : 0,
      correctionReason: r.correctionReason,
    }));

    try {
      onSaveCollectionBatch({
        paymentDateISO: paymentDate,
        entries,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-collection-register-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 shadow-lg my-auto">
        <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-200">
          <div>
            <h2
              id="daily-collection-register-title"
              className="text-lg font-bold text-slate-900"
            >
              Daily Collection Register
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select date, mark paid members, and enter actual amount received
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close daily collection register"
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-3.5 space-y-3.5">
          {/* STEP 1: SELECT PAYMENT DATE */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <label
              htmlFor="collection-register-date"
              className="text-xs font-semibold text-slate-700"
            >
              Step 1: Payment Date ({formatDateDDMMYYYY(paymentDate)})
            </label>
            <input
              id="collection-register-date"
              type="date"
              value={paymentDate}
              onChange={(e) => {
                if (e.target.value) setPaymentDate(e.target.value);
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono tabular-nums text-xs sm:text-sm font-semibold text-slate-900 min-h-[38px]"
              required
            />
          </div>

          {/* STEP 2 & STEP 3: DISPLAY ALL 7 MEMBERS WITH CHECKBOXES & ACTUAL AMOUNT INPUT */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
              <span>Step 2 &amp; 3: Mark Paid Members &amp; Enter Amount</span>
              <span className="text-slate-500 font-normal">
                No prefilled amounts
              </span>
            </div>

            <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden bg-white">
              {rows.map((row, idx) => {
                const isEditedExisting =
                  row.alreadyPaidAmount > 0 &&
                  (!row.paid ||
                    Number(row.amountText) !== row.alreadyPaidAmount);

                return (
                  <div
                    key={row.memberId}
                    className={`px-3 py-1.5 transition-colors ${
                      row.paid ? 'bg-emerald-50/40' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <label
                        htmlFor={`check-member-${row.memberId}`}
                        className="flex items-center gap-3 cursor-pointer select-none min-h-[40px] flex-1"
                      >
                        <input
                          id={`check-member-${row.memberId}`}
                          type="checkbox"
                          checked={row.paid}
                          onChange={() => handleTogglePaid(row.memberId)}
                          className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer shrink-0"
                        />
                        <span className="font-mono tabular-nums text-xs text-slate-500 w-5">
                          {idx + 1}.
                        </span>
                        <span className="text-sm font-semibold text-slate-900">
                          {row.memberName}
                        </span>
                        <span
                          className={`text-xs font-semibold ml-auto pr-2 ${
                            row.paid ? 'text-emerald-700' : 'text-slate-500'
                          }`}
                        >
                          {row.paid ? 'Paid' : 'Unpaid'}
                        </span>
                      </label>

                      {row.paid && (
                        <div className="w-36 shrink-0">
                          <input
                            type="number"
                            min={1}
                            step={1}
                            aria-label={`Amount received from ${row.memberName}`}
                            placeholder="Enter ₹ amount"
                            value={row.amountText}
                            onChange={(e) =>
                              handleAmountChange(row.memberId, e.target.value)
                            }
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono tabular-nums text-sm font-semibold text-slate-900 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 min-h-[36px]"
                            required
                          />
                        </div>
                      )}
                    </div>

                    {row.alreadyPaidAmount > 0 && !isEditedExisting && (
                      <div className="pb-1 pl-8 flex items-center justify-between gap-2 text-[11px] text-emerald-700 font-medium">
                        <span>
                          Recorded {formatINR(row.alreadyPaidAmount)} on{' '}
                          {formatDateDDMMYYYY(paymentDate)}.
                        </span>
                        <button
                          type="button"
                          onClick={() => handleTogglePaid(row.memberId)}
                          className="text-red-600 hover:underline font-semibold"
                        >
                          Remove / Delete
                        </button>
                      </div>
                    )}

                    {isEditedExisting && (
                      <div className="pb-1.5 pl-8">
                        <input
                          type="text"
                          aria-label={`Correction reason for ${row.memberName}`}
                          placeholder="Reason for editing existing payment (audit trail)"
                          value={row.correctionReason}
                          onChange={(e) =>
                            handleReasonChange(row.memberId, e.target.value)
                          }
                          className="w-full px-3 py-1 rounded-lg border border-amber-300 bg-amber-50/50 text-xs text-slate-800"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* STEP 4: COLLECTION SUMMARY */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs text-slate-500">Members Paid</div>
              <div
                data-testid="register-paid-count"
                className="text-base font-bold font-mono tabular-nums text-emerald-700 mt-0.5"
              >
                {membersPaidCount} / {rows.length}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Total Collected</div>
              <div
                data-testid="register-total-collected"
                className="text-base font-bold font-mono tabular-nums text-slate-900 mt-0.5"
              >
                {formatINR(totalAmountCollected)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Members Unpaid</div>
              <div
                data-testid="register-unpaid-count"
                className="text-base font-bold font-mono tabular-nums text-red-600 mt-0.5"
              >
                {membersUnpaidCount} / {rows.length}
              </div>
            </div>
          </div>

          {/* STEP 5: SAVE DAILY COLLECTION BUTTON */}
          <button
            type="submit"
            className="w-full py-3 px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold tracking-wide transition-colors flex items-center justify-center gap-2 min-h-[46px] shadow-xs"
          >
            <Check className="w-4 h-4" />
            <span>SAVE DAILY COLLECTION</span>
          </button>
        </form>
      </div>
    </div>
  );
};
