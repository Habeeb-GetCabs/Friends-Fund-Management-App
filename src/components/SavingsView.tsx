import React, { useState } from 'react';
import {
  Plus,
  History,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowUpRight,
  X,
} from 'lucide-react';
import {
  AppDatabaseState,
  FinancialTransaction,
  SavingsAllocation,
  formatDateDDMMYYYY,
  formatINR,
  getDatesInRange,
  getMemberSavingsForDate,
} from '../domain/ledgerEngine';

interface SavingsViewProps {
  state: AppDatabaseState;
  onOpenRecordSavings: (memberId?: string, dateISO?: string) => void;
  onCorrectSavingsTransaction: (params: {
    transactionId: string;
    correctedAmount: number;
    correctedAllocations: SavingsAllocation[];
    reason: string;
  }) => void;
}

export const SavingsView: React.FC<SavingsViewProps> = ({
  state,
  onOpenRecordSavings,
  onCorrectSavingsTransaction,
}) => {
  const [memberFilter, setMemberFilter] = useState<string>('all');
  const [correctingTxn, setCorrectingTxn] =
    useState<FinancialTransaction | null>(null);
  const [correctedAmountInput, setCorrectedAmountInput] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionAllocations, setCorrectionAllocations] = useState<
    SavingsAllocation[]
  >([]);
  const [correctionError, setCorrectionError] = useState<string | null>(null);

  // Recent 10 days for the Calendar Matrix
  const allDates = getDatesInRange(
    state.settings.groupStartDate,
    state.settings.currentReferenceDate
  );
  const matrixDates = allDates.slice(-10).reverse();

  const savingsTransactions = state.transactions.filter((t) => {
    const isSavings =
      t.category === 'Daily Savings' ||
      t.category === 'Savings Correction' ||
      t.category === 'Refund or Reversal';
    if (!isSavings) return false;
    if (memberFilter !== 'all' && t.memberId !== memberFilter) return false;
    return true;
  });

  const openCorrectionModal = (txn: FinancialTransaction) => {
    setCorrectingTxn(txn);
    setCorrectedAmountInput(String(txn.amount));
    setCorrectionReason('');
    setCorrectionAllocations(
      txn.savingsAllocations && txn.savingsAllocations.length > 0
        ? txn.savingsAllocations.map((a) => ({ ...a }))
        : [{ targetDate: txn.transactionDate, amount: txn.amount }]
    );
    setCorrectionError(null);
  };

  const handleSubmitCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingTxn) return;
    try {
      const amt = Number(correctedAmountInput);
      onCorrectSavingsTransaction({
        transactionId: correctingTxn.id,
        correctedAmount: amt,
        correctedAllocations: correctionAllocations,
        reason: correctionReason,
      });
      setCorrectingTxn(null);
    } catch (err) {
      setCorrectionError((err as Error).message);
    }
  };

  return (
    <div className="space-y-8">
      {/* SECTION 1: CALENDAR-BASED DAILY SAVINGS MATRIX */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <div className="text-xs text-slate-500">
              Individual &amp; Group Daily Ledger · {formatINR(state.settings.dailyContributionAmount)} Daily Target
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
              Daily Savings Ledger &amp; Calendar History
            </h1>
          </div>
          <button
            type="button"
            onClick={() =>
              onOpenRecordSavings(
                memberFilter !== 'all' ? memberFilter : undefined,
                state.settings.currentReferenceDate
              )
            }
            className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 min-h-[44px] shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Record Daily Savings</span>
          </button>
        </div>

        <p className="mt-4 text-xs text-slate-600">
          Click any cell in the calendar matrix below to record a payment, settle a missed date, or allocate an extra contribution. Unpaid days are never marked paid automatically.
        </p>

        {/* Calendar Grid Matrix */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                <th className="py-3 px-3 sticky left-0 bg-white z-10">Member</th>
                {matrixDates.map((d) => (
                  <th
                    key={d}
                    className="py-3 px-2.5 text-center font-mono tabular-nums whitespace-nowrap"
                  >
                    {formatDateDDMMYYYY(d).slice(0, 5)}
                    <div className="text-[10px] font-normal text-slate-400">
                      {formatDateDDMMYYYY(d).slice(6)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 text-xs">
              {state.members.map((member) => (
                <tr key={member.id} className="hover:bg-slate-50/80">
                  <td className="py-3 px-3 font-semibold text-slate-900 sticky left-0 bg-white z-10 whitespace-nowrap">
                    {member.name}
                  </td>
                  {matrixDates.map((d) => {
                    const stat = getMemberSavingsForDate(state, member.id, d);
                    const cellStyle =
                      stat.status === 'Paid'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                        : stat.status === 'Advance'
                        ? 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                        : stat.status === 'Partially Paid'
                        ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                        : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100';

                    return (
                      <td key={d} className="p-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => onOpenRecordSavings(member.id, d)}
                          aria-label={`${member.name} on ${formatDateDDMMYYYY(d)}: ${stat.status} (${formatINR(stat.allocatedAmount)})`}
                          className={`w-full min-w-[74px] py-2 px-2 rounded-lg border font-mono tabular-nums transition-colors flex flex-col items-center justify-center ${cellStyle}`}
                        >
                          <div className="font-bold flex items-center gap-1">
                            {stat.status === 'Paid' && (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            )}
                            {stat.status === 'Missed' && (
                              <AlertCircle className="w-3 h-3 text-red-600 shrink-0" />
                            )}
                            {stat.status === 'Partially Paid' && (
                              <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                            )}
                            {stat.status === 'Advance' && (
                              <ArrowUpRight className="w-3 h-3 text-blue-600 shrink-0" />
                            )}
                            <span>{formatINR(stat.allocatedAmount)}</span>
                          </div>
                          <div className="text-[10px] font-sans font-medium opacity-85 mt-0.5">
                            {stat.status === 'Partially Paid'
                              ? 'Partial'
                              : stat.status}
                          </div>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 2: COMPLETE SAVINGS TRANSACTION LEDGER & AUDIT CORRECTIONS */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="text-xs text-slate-500">
              Immutable Financial History · Backdated Entries &amp; Audited Corrections
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-0.5">
              Savings Transaction Ledger ({savingsTransactions.length})
            </h2>
          </div>

          {/* Interactive Member Filter */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setMemberFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                memberFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All 7 Members
            </button>
            {state.members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMemberFilter(m.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  memberFilter === m.id
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                <th className="py-3 px-3">Txn ID</th>
                <th className="py-3 px-3">Payment Date</th>
                <th className="py-3 px-3">Member</th>
                <th className="py-3 px-3">Allocated Target Date(s)</th>
                <th className="py-3 px-3">Notes &amp; Audit History</th>
                <th className="py-3 px-3 text-right">Amount</th>
                <th className="py-3 px-3 text-right">Correction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 text-sm">
              {savingsTransactions.slice(0, 60).map((txn) => {
                const member = state.members.find((m) => m.id === txn.memberId);
                return (
                  <tr key={txn.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-mono tabular-nums text-xs text-slate-500">
                      {txn.id}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-xs font-semibold text-slate-800">
                      {formatDateDDMMYYYY(txn.transactionDate)}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-900">
                      {member?.name || txn.memberId}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-xs text-slate-700">
                      {txn.savingsAllocations &&
                      txn.savingsAllocations.length > 0
                        ? txn.savingsAllocations
                            .map(
                              (a) =>
                                `${formatDateDDMMYYYY(a.targetDate)}: ${formatINR(
                                  a.amount
                                )}`
                            )
                            .join(' · ')
                        : `${formatDateDDMMYYYY(txn.transactionDate)}: ${formatINR(
                            txn.amount
                          )}`}
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-600">
                      <div>{txn.description || txn.notes || '—'}</div>
                      {txn.auditTrail && txn.auditTrail.length > 0 && (
                        <div className="mt-1 text-[11px] text-amber-800 font-medium flex items-center gap-1">
                          <History className="w-3 h-3 shrink-0" />
                          <span>
                            Audited Correction: Original{' '}
                            {formatINR(txn.auditTrail[0].originalAmount)} →{' '}
                            {formatINR(
                              txn.auditTrail[txn.auditTrail.length - 1]
                                .correctedAmount
                            )}{' '}
                            ({txn.auditTrail[txn.auditTrail.length - 1].reason})
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-emerald-700">
                      {formatINR(txn.amount)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => openCorrectionModal(txn)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 inline-flex items-center gap-1 min-h-[36px]"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Correct</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* SAVINGS CORRECTION WITH AUDIT TRAIL MODAL */}
      {correctingTxn && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="correction-modal-title"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3
                  id="correction-modal-title"
                  className="text-lg font-bold text-slate-900"
                >
                  Savings Entry Correction (Audited)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Transaction {correctingTxn.id} · Preserves original amount, corrected amount, date &amp; reason
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCorrectingTxn(null)}
                aria-label="Close correction modal"
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {correctionError && (
              <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {correctionError}
              </div>
            )}

            <form onSubmit={handleSubmitCorrection} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500">Original Amount:</span>
                  <div className="font-mono tabular-nums font-bold text-sm text-slate-900 mt-0.5">
                    {formatINR(correctingTxn.amount)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Payment Date:</span>
                  <div className="font-mono tabular-nums font-bold text-sm text-slate-900 mt-0.5">
                    {formatDateDDMMYYYY(correctingTxn.transactionDate)}
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="corrected-amount-input"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Corrected Total Amount (₹)
                </label>
                <input
                  id="corrected-amount-input"
                  type="number"
                  min={0}
                  step={1}
                  value={correctedAmountInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCorrectedAmountInput(val);
                    const num = Number(val) || 0;
                    if (correctionAllocations.length === 1) {
                      setCorrectionAllocations([
                        {
                          targetDate: correctionAllocations[0].targetDate,
                          amount: num,
                        },
                      ]);
                    }
                  }}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono tabular-nums text-sm"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    Target Date Allocation(s)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setCorrectionAllocations([
                        ...correctionAllocations,
                        {
                          targetDate: correctingTxn.transactionDate,
                          amount: 0,
                        },
                      ])
                    }
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    + Split Across Another Date
                  </button>
                </div>
                <div className="mt-2 space-y-2">
                  {correctionAllocations.map((alloc, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="date"
                        aria-label={`Target date ${i + 1}`}
                        value={alloc.targetDate}
                        onChange={(e) => {
                          const next = [...correctionAllocations];
                          next[i] = { ...next[i], targetDate: e.target.value };
                          setCorrectionAllocations(next);
                        }}
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-300 font-mono tabular-nums text-xs"
                      />
                      <input
                        type="number"
                        aria-label={`Allocated amount ${i + 1}`}
                        value={alloc.amount}
                        onChange={(e) => {
                          const next = [...correctionAllocations];
                          next[i] = {
                            ...next[i],
                            amount: Number(e.target.value) || 0,
                          };
                          setCorrectionAllocations(next);
                        }}
                        className="w-28 px-3 py-2 rounded-lg border border-slate-300 font-mono tabular-nums text-xs"
                      />
                      {correctionAllocations.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setCorrectionAllocations(
                              correctionAllocations.filter((_, idx) => idx !== i)
                            )
                          }
                          className="p-2 text-slate-400 hover:text-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="correction-reason-input"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Reason for Correction (Required for Audit Trail)
                </label>
                <input
                  id="correction-reason-input"
                  type="text"
                  placeholder="e.g., Member paid ₹200 covering missed Day 2 and Day 3"
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCorrectingTxn(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold min-h-[42px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold min-h-[42px]"
                >
                  Save Audited Correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
