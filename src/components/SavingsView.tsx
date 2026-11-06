import React, { useState } from 'react';
import {
  PlusCircle,
  CheckCircle2,
  XCircle,
  Edit3,
  Trash2,
} from 'lucide-react';
import {
  AppDatabaseState,
  formatDateDDMMYYYY,
  formatINR,
  getDailyCollectionDashboard,
} from '../domain/ledgerEngine';

interface SavingsViewProps {
  state: AppDatabaseState;
  onOpenRecordSavings: (memberId?: string, dateISO?: string) => void;
  onDeleteMemberSavingsOnDate: (memberId: string, dateISO: string) => void;
}

export const SavingsView: React.FC<SavingsViewProps> = ({
  state,
  onOpenRecordSavings,
  onDeleteMemberSavingsOnDate,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(
    state.settings.currentReferenceDate.slice(0, 7)
  );
  const [selectedDateDetail, setSelectedDateDetail] = useState<string | null>(
    state.settings.currentReferenceDate
  );

  // Collect all distinct dates that have savings transactions, plus today's date
  const dateSet = new Set<string>([state.settings.currentReferenceDate]);
  for (const txn of state.transactions) {
    if (
      txn.category === 'Daily Savings' ||
      txn.category === 'Savings Correction' ||
      txn.category === 'Refund or Reversal'
    ) {
      dateSet.add(txn.transactionDate);
      if (txn.savingsAllocations) {
        for (const a of txn.savingsAllocations) {
          if (a.amount > 0) dateSet.add(a.targetDate);
        }
      }
    }
  }

  const chronologicalDates = Array.from(dateSet).sort((a, b) =>
    b.localeCompare(a)
  );

  // Monthly Summary calculations
  const monthDates = chronologicalDates.filter((d) =>
    d.startsWith(selectedMonth)
  );
  let monthlyTotalCollected = 0;
  let monthlyActiveDays = 0;
  for (const d of monthDates) {
    const stat = getDailyCollectionDashboard(state, d);
    const collected =
      stat.totalCashCollectedOnDate > 0
        ? stat.totalCashCollectedOnDate
        : stat.totalAllocatedForDate;
    if (collected > 0) {
      monthlyTotalCollected += collected;
      monthlyActiveDays++;
    }
  }

  const activeDateISO =
    selectedDateDetail || state.settings.currentReferenceDate;
  const activeDateSummary = getDailyCollectionDashboard(state, activeDateISO);

  return (
    <div className="space-y-6">
      {/* SIMPLE MONTHLY SUMMARY */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">
              Savings Collection Register
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Chronological daily collection history and monthly summary
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <span>Month:</span>
              <input
                type="month"
                aria-label="Select month for summary"
                value={selectedMonth}
                onChange={(e) => {
                  if (e.target.value) setSelectedMonth(e.target.value);
                }}
                className="px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono tabular-nums text-xs text-slate-900 min-h-[40px]"
              />
            </label>

            <button
              type="button"
              onClick={() =>
                onOpenRecordSavings(
                  undefined,
                  state.settings.currentReferenceDate
                )
              }
              className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 min-h-[44px]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Record Daily Collection</span>
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3.5">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs text-slate-500">
              Monthly Total Collected ({selectedMonth})
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
              {formatINR(monthlyTotalCollected)}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs text-slate-500">
              Collection Days Recorded
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {monthlyActiveDays}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 col-span-2 sm:col-span-1">
            <div className="text-xs text-slate-500">
              Expected Daily Rate
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {formatINR(state.settings.dailyContributionAmount)} / member
            </div>
          </div>
        </div>
      </section>

      {/* CHRONOLOGICAL COLLECTION REGISTER: Date | Members Paid | Amount Collected */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs">
          <h2 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-200">
            Chronological Collection Register
          </h2>

          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Members Paid</th>
                  <th className="py-3 px-3 text-right">Amount Collected</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 text-sm">
                {chronologicalDates.map((d) => {
                  const stat = getDailyCollectionDashboard(state, d);
                  const collected =
                    stat.totalCashCollectedOnDate > 0
                      ? stat.totalCashCollectedOnDate
                      : stat.totalAllocatedForDate;
                  const isSelected = d === activeDateISO;

                  return (
                    <tr
                      key={d}
                      onClick={() => setSelectedDateDetail(d)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-emerald-50/60 font-semibold'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3.5 px-3 font-mono tabular-nums text-slate-900">
                        {formatDateDDMMYYYY(d)}
                      </td>
                      <td className="py-3.5 px-3 font-mono tabular-nums text-slate-700">
                        <span
                          className={
                            stat.paidCount > 0
                              ? 'text-emerald-700 font-semibold'
                              : 'text-slate-500'
                          }
                        >
                          {stat.paidCount} / {state.members.length}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                        {formatINR(collected)}
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenRecordSavings(undefined, d);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-800 inline-flex items-center gap-1 min-h-[36px]"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit / Record</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* SELECTED DATE: 7 MEMBERS INDIVIDUAL PAYMENT STATUSES */}
        <section className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Date Details: {formatDateDDMMYYYY(activeDateISO)}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Paid: {activeDateSummary.paidCount} / {state.members.length} ·
                Collected:{' '}
                {formatINR(
                  activeDateSummary.totalCashCollectedOnDate > 0
                    ? activeDateSummary.totalCashCollectedOnDate
                    : activeDateSummary.totalAllocatedForDate
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenRecordSavings(undefined, activeDateISO)}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold min-h-[38px]"
            >
              Update Date
            </button>
          </div>

          <div className="divide-y divide-slate-200/70 mt-2">
            {activeDateSummary.memberStatuses.map((ms, idx) => {
              const paidAmt =
                ms.cashPaidOnDate > 0 ? ms.cashPaidOnDate : ms.allocatedAmount;
              const isPaid = paidAmt > 0;

              return (
                <div
                  key={ms.memberId}
                  className="py-3 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono tabular-nums text-xs text-slate-400 w-5">
                      {idx + 1}.
                    </span>
                    <span className="font-semibold text-slate-900">
                      {ms.memberName}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isPaid ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 font-mono tabular-nums">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Paid {formatINR(paidAmt)}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onDeleteMemberSavingsOnDate(
                              ms.memberId,
                              activeDateISO
                            )
                          }
                          aria-label={`Delete payment for ${ms.memberName} on ${formatDateDDMMYYYY(activeDateISO)}`}
                          className="px-2 py-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-semibold inline-flex items-center gap-1 min-h-[32px]"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600">
                        <XCircle className="w-4 h-4 text-red-500" />
                        <span>Unpaid (₹0)</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
