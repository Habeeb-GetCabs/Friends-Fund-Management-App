import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  PlusCircle,
  HandCoins,
  Settings,
  Trash2,
} from 'lucide-react';
import {
  AppDatabaseState,
  calculateGroupFinancialSummary,
  formatDateDDMMYYYY,
  formatINR,
  getDailyCollectionDashboard,
} from '../domain/ledgerEngine';

interface DashboardViewProps {
  state: AppDatabaseState;
  selectedDate: string;
  onSelectDate: (isoDate: string) => void;
  onOpenRecordSavings: (memberId?: string, dateISO?: string) => void;
  onOpenMemberProfile: (memberId: string) => void;
  onNavigateTab: (
    tab: 'dashboard' | 'members' | 'savings' | 'loans' | 'reports'
  ) => void;
  onUpdateDailyContribution: (newAmount: number) => void;
  onDeleteMemberSavingsOnDate: (memberId: string, dateISO: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  state,
  selectedDate,
  onOpenRecordSavings,
  onOpenMemberProfile,
  onNavigateTab,
  onUpdateDailyContribution,
  onDeleteMemberSavingsOnDate,
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [rateInput, setRateInput] = useState(
    String(state.settings.dailyContributionAmount)
  );

  const todayISO = state.settings.currentReferenceDate;
  const todaySummary = getDailyCollectionDashboard(state, todayISO);
  const groupSummary = calculateGroupFinancialSummary(state);

  const todayCollected =
    todaySummary.totalCashCollectedOnDate > 0
      ? todaySummary.totalCashCollectedOnDate
      : todaySummary.totalAllocatedForDate;

  const handleSaveRate = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(rateInput);
    if (Number.isFinite(num) && num > 0) {
      onUpdateDailyContribution(Math.round(num));
      setShowSettings(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* CLEAN MINIMAL SUMMARY CARD */}
      <section
        aria-labelledby="dashboard-summary-heading"
        className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs"
      >
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1
              id="dashboard-summary-heading"
              className="text-lg sm:text-xl font-bold text-slate-900"
            >
              Group Overview
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Today: {formatDateDDMMYYYY(todayISO)} · Expected Daily Contribution:{' '}
              {formatINR(state.settings.dailyContributionAmount)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setRateInput(String(state.settings.dailyContributionAmount));
              setShowSettings(!showSettings);
            }}
            aria-label="Configure expected daily contribution"
            className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 min-h-[40px]"
          >
            <Settings className="w-3.5 h-3.5 text-slate-500" />
            <span>Settings</span>
          </button>
        </div>

        {showSettings && (
          <form
            onSubmit={handleSaveRate}
            className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-end gap-3"
          >
            <div>
              <label
                htmlFor="expected-daily-rate-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Expected Daily Contribution per Member (₹)
              </label>
              <input
                id="expected-daily-rate-input"
                type="number"
                min={1}
                step={1}
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                className="mt-1 w-36 px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono tabular-nums text-sm font-semibold text-slate-900"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 min-h-[38px]"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="px-3 py-2 rounded-lg bg-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-300 min-h-[38px]"
            >
              Cancel
            </button>
          </form>
        )}

        {/* 6 REQUIRED DASHBOARD METRICS */}
        <div className="mt-5 grid grid-cols-2 lg:grid-cols-3 gap-3.5">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs text-slate-500 font-medium">
              Today&apos;s Collection
            </div>
            <div
              data-testid="dashboard-today-collection"
              className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1"
            >
              {formatINR(todayCollected)}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs text-slate-500 font-medium">
              Total Group Savings
            </div>
            <div
              data-testid="dashboard-total-savings"
              className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1"
            >
              {formatINR(groupSummary.totalSavingsCollected)}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs text-slate-500 font-medium">
              Available Cash
            </div>
            <div
              data-testid="dashboard-available-cash"
              className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1"
            >
              {formatINR(groupSummary.availableGroupCash)}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs text-slate-500 font-medium">
              Total Outstanding Loans
            </div>
            <div
              data-testid="dashboard-outstanding-loans"
              className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1"
            >
              {formatINR(groupSummary.totalOutstandingLoanPrincipal)}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200">
            <div className="text-xs text-emerald-900 font-medium">
              Members Paid Today
            </div>
            <div
              data-testid="dashboard-paid-today"
              className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1"
            >
              {todaySummary.paidCount} / {state.members.length}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-red-50/50 border border-red-200">
            <div className="text-xs text-red-900 font-medium">
              Members Not Paid Today
            </div>
            <div
              data-testid="dashboard-unpaid-today"
              className="text-2xl font-bold font-mono tabular-nums text-red-600 mt-1"
            >
              {todaySummary.missedCount} / {state.members.length}
            </div>
          </div>
        </div>

        {/* TWO PROMINENT PRIMARY ACTIONS */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onOpenRecordSavings(undefined, selectedDate)}
            className="w-full py-3.5 px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 min-h-[48px] shadow-xs"
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span>Record Daily Collection</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('loans')}
            className="w-full py-3.5 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 min-h-[48px] shadow-xs"
          >
            <HandCoins className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>Manage Loans</span>
          </button>
        </div>
      </section>

      {/* SIMPLE 7 MEMBERS LIST */}
      <section
        aria-labelledby="dashboard-members-heading"
        className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <h2
            id="dashboard-members-heading"
            className="text-base font-bold text-slate-900"
          >
            Members — Today&apos;s Status ({formatDateDDMMYYYY(todayISO)})
          </h2>
          <button
            type="button"
            onClick={() => onOpenRecordSavings(undefined, todayISO)}
            className="text-xs font-semibold text-emerald-700 hover:underline"
          >
            Open Register
          </button>
        </div>

        <div className="divide-y divide-slate-200/80 mt-2">
          {todaySummary.memberStatuses.map((ms, idx) => {
            const isPaidToday = ms.cashPaidOnDate > 0 || ms.allocatedAmount > 0;
            const amountToday =
              ms.cashPaidOnDate > 0 ? ms.cashPaidOnDate : ms.allocatedAmount;

            return (
              <div
                key={ms.memberId}
                className="py-3.5 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono tabular-nums text-xs text-slate-400 w-5">
                    {idx + 1}.
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenMemberProfile(ms.memberId)}
                    className="text-sm font-semibold text-slate-900 hover:text-emerald-700 hover:underline text-left"
                  >
                    {ms.memberName}
                  </button>
                </div>

                <div className="flex items-center gap-2.5">
                  {isPaidToday ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 font-mono tabular-nums">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Paid ({formatINR(amountToday)})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onDeleteMemberSavingsOnDate(ms.memberId, todayISO)
                        }
                        aria-label={`Delete today's payment for ${ms.memberName}`}
                        title="Delete payment entry"
                        className="px-2 py-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-semibold inline-flex items-center gap-1 min-h-[32px]"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600">
                      <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                      <span>Not Paid</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
