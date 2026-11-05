import React from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowUpRight,
  Wallet,
  UserCheck,
  UserX,
  SlidersHorizontal,
} from 'lucide-react';
import {
  AppDatabaseState,
  addDaysISO,
  calculateGroupFinancialSummary,
  formatDateDDMMYYYY,
  formatINR,
  getDailyCollectionDashboard,
  getDatesInRange,
  PaymentStatus,
} from '../domain/ledgerEngine';

interface DashboardViewProps {
  state: AppDatabaseState;
  selectedDate: string;
  onSelectDate: (isoDate: string) => void;
  onOpenRecordSavings: (memberId?: string, dateISO?: string) => void;
  onOpenMemberProfile: (memberId: string) => void;
  onNavigateTab: (tab: 'dashboard' | 'members' | 'savings' | 'loans' | 'reports') => void;
  onUpdateDailyContribution: (newAmount: number) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  state,
  selectedDate,
  onSelectDate,
  onOpenRecordSavings,
  onOpenMemberProfile,
  onNavigateTab,
  onUpdateDailyContribution,
}) => {
  const [editingRate, setEditingRate] = React.useState(false);
  const [rateInput, setRateInput] = React.useState(
    String(state.settings.dailyContributionAmount)
  );

  const dailySummary = getDailyCollectionDashboard(state, selectedDate);
  const groupSummary = calculateGroupFinancialSummary(state);

  // Build 7-day quick date strip around selectedDate
  const stripStart = addDaysISO(selectedDate, -3);
  const stripEnd = addDaysISO(selectedDate, 3);
  const quickDates = getDatesInRange(stripStart, stripEnd);

  const renderStatusIndicator = (status: PaymentStatus, paidViaCarryover: boolean) => {
    switch (status) {
      case 'Paid':
        return (
          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Paid{paidViaCarryover ? ' (Allocated)' : ''}</span>
          </span>
        );
      case 'Missed':
        return (
          <span className="inline-flex items-center gap-1.5 font-semibold text-red-600 text-xs">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>Missed</span>
          </span>
        );
      case 'Partially Paid':
        return (
          <span className="inline-flex items-center gap-1.5 font-semibold text-amber-600 text-xs">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Partially Paid</span>
          </span>
        );
      case 'Advance':
        return (
          <span className="inline-flex items-center gap-1.5 font-semibold text-blue-600 text-xs">
            <ArrowUpRight className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Advance Payment</span>
          </span>
        );
    }
  };

  const getRowBorderIndicator = (status: PaymentStatus) => {
    switch (status) {
      case 'Paid':
        return 'bg-emerald-50/40 hover:bg-emerald-50/80';
      case 'Missed':
        return 'bg-red-50/35 hover:bg-red-50/70';
      case 'Partially Paid':
        return 'bg-amber-50/40 hover:bg-amber-50/80';
      case 'Advance':
        return 'bg-blue-50/40 hover:bg-blue-50/80';
    }
  };

  const handleSaveContributionRate = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(rateInput);
    if (Number.isFinite(parsed) && parsed > 0) {
      onUpdateDailyContribution(Math.round(parsed));
      setEditingRate(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* SECTION 1: DAILY COLLECTION DASHBOARD */}
      <section aria-labelledby="daily-collection-heading" className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
              <span className="whitespace-nowrap">Daily Collection Ledger</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums font-medium text-slate-700 whitespace-nowrap">
                {formatDateDDMMYYYY(selectedDate)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="whitespace-nowrap">
                {formatINR(state.settings.dailyContributionAmount)} / member
              </span>
              <button
                type="button"
                onClick={() => {
                  setRateInput(String(state.settings.dailyContributionAmount));
                  setEditingRate(!editingRate);
                }}
                className="text-emerald-700 hover:underline font-medium inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Configure Rate</span>
              </button>
            </div>
            <h1
              id="daily-collection-heading"
              className="text-xl sm:text-2xl font-bold text-slate-900 mt-1"
            >
              Daily Collection Dashboard
            </h1>
          </div>

          {/* Date Selector Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-100 rounded-xl p-1">
              <button
                type="button"
                onClick={() => onSelectDate(addDaysISO(selectedDate, -1))}
                aria-label="Previous day"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-700 hover:bg-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <label className="relative flex items-center gap-2 px-3 py-1.5 cursor-pointer">
                <Calendar className="w-4 h-4 text-slate-600 shrink-0" />
                <span className="font-mono tabular-nums text-xs sm:text-sm font-semibold text-slate-900 whitespace-nowrap">
                  {formatDateDDMMYYYY(selectedDate)}
                </span>
                <input
                  type="date"
                  aria-label="Select collection date"
                  value={selectedDate}
                  onChange={(e) => {
                    if (e.target.value) onSelectDate(e.target.value);
                  }}
                  className="sr-only"
                />
              </label>
              <button
                type="button"
                onClick={() => onSelectDate(addDaysISO(selectedDate, 1))}
                aria-label="Next day"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-700 hover:bg-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {selectedDate !== state.settings.currentReferenceDate && (
              <button
                type="button"
                onClick={() => onSelectDate(state.settings.currentReferenceDate)}
                className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors min-h-[40px] whitespace-nowrap"
              >
                Jump to Today ({formatDateDDMMYYYY(state.settings.currentReferenceDate)})
              </button>
            )}

            <button
              type="button"
              onClick={() => onOpenRecordSavings(undefined, selectedDate)}
              className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors flex items-center gap-2 min-h-[44px] whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Record Savings</span>
            </button>
          </div>
        </div>

        {/* Admin Configurable Daily Contribution Form */}
        {editingRate && (
          <form
            onSubmit={handleSaveContributionRate}
            className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-end gap-4"
          >
            <div>
              <label
                htmlFor="daily-contribution-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Daily Contribution per Member (₹)
              </label>
              <input
                id="daily-contribution-input"
                type="number"
                min={1}
                step={1}
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                className="mt-1 w-40 px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono tabular-nums text-sm text-slate-900"
              />
            </div>
            <div className="text-xs text-slate-600 pb-2">
              Expected Daily Group Collection (7 members):{' '}
              <strong className="font-mono tabular-nums text-slate-900">
                {formatINR((Number(rateInput) || 0) * state.members.length)}
              </strong>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 min-h-[40px]"
              >
                Save Rate
              </button>
              <button
                type="button"
                onClick={() => setEditingRate(false)}
                className="px-3 py-2 rounded-lg bg-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-300 min-h-[40px]"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Horizontal 7-Day Date Scroller */}
        <div className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-1">
          {quickDates.map((d) => {
            const isSelected = d === selectedDate;
            const dayStat = getDailyCollectionDashboard(state, d);
            const allPaid = dayStat.paidCount === state.members.length;
            return (
              <button
                key={d}
                type="button"
                onClick={() => onSelectDate(d)}
                className={`px-3 py-2 rounded-xl text-left transition-colors shrink-0 min-h-[44px] border ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="font-mono tabular-nums text-xs font-semibold whitespace-nowrap">
                  {formatDateDDMMYYYY(d)}
                </div>
                <div
                  className={`text-[11px] font-mono tabular-nums mt-0.5 ${
                    isSelected
                      ? 'text-emerald-300'
                      : allPaid
                      ? 'text-emerald-700'
                      : 'text-slate-500'
                  }`}
                >
                  {formatINR(dayStat.totalAllocatedForDate)} / {formatINR(dayStat.expectedCollection)}
                </div>
              </button>
            );
          })}
        </div>

        {/* 5 Core Daily Collection Metrics */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-xs text-slate-500 font-medium">
              Expected Collection
            </div>
            <div
              data-testid="daily-expected-amount"
              className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1"
            >
              {formatINR(dailySummary.expectedCollection)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {state.members.length} members × {formatINR(state.settings.dailyContributionAmount)}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
            <div className="text-xs text-emerald-800 font-medium">
              Amount Collected
            </div>
            <div
              data-testid="daily-collected-amount"
              className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1"
            >
              {formatINR(dailySummary.totalAllocatedForDate)}
            </div>
            <div className="text-[11px] text-emerald-700 mt-1 font-mono tabular-nums">
              Cash on date: {formatINR(dailySummary.totalCashCollectedOnDate)}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/80">
            <div className="text-xs text-amber-900 font-medium">
              Pending Collection
            </div>
            <div
              data-testid="daily-pending-amount"
              className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-amber-700 mt-1"
            >
              {formatINR(dailySummary.totalPendingCollection)}
            </div>
            <div className="text-[11px] text-amber-800 mt-1">
              Remaining for {formatDateDDMMYYYY(selectedDate)}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Members Paid</span>
            </div>
            <div
              data-testid="daily-paid-count"
              className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1"
            >
              {dailySummary.paidCount} <span className="text-sm font-normal text-slate-500">/ {state.members.length}</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {dailySummary.partiallyPaidCount > 0
                ? `${dailySummary.partiallyPaidCount} partially paid`
                : 'Full or advance settled'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-red-50/50 border border-red-200/80 col-span-2 sm:col-span-1">
            <div className="text-xs text-red-800 font-medium flex items-center gap-1.5">
              <UserX className="w-3.5 h-3.5 text-red-600" />
              <span>Members Missed</span>
            </div>
            <div
              data-testid="daily-missed-count"
              className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-red-600 mt-1"
            >
              {dailySummary.missedCount} <span className="text-sm font-normal text-red-400">/ {state.members.length}</span>
            </div>
            <div className="text-[11px] text-red-700 mt-1">
              Unpaid for {formatDateDDMMYYYY(selectedDate)}
            </div>
          </div>
        </div>

        {/* Status Legend */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-semibold text-slate-800">Status Key:</span>
            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
              Green: Paid
            </span>
            <span className="inline-flex items-center gap-1.5 text-red-600 font-medium">
              <span className="w-2.5 h-2.5 rounded-xs bg-red-600 inline-block" />
              Red: Missed
            </span>
            <span className="inline-flex items-center gap-1.5 text-amber-600 font-medium">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
              Orange: Partially Paid
            </span>
            <span className="inline-flex items-center gap-1.5 text-blue-600 font-medium">
              <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 inline-block" />
              Blue: Advance Payment
            </span>
          </div>
        </div>

        {/* 7 Members Daily Payment Status Table */}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-3">Member Name</th>
                <th className="py-3 px-3">Payment Status</th>
                <th className="py-3 px-3 text-right">Expected</th>
                <th className="py-3 px-3 text-right">Allocated</th>
                <th className="py-3 px-3 text-right">Pending</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 text-sm">
              {dailySummary.memberStatuses.map((ms, index) => (
                <tr
                  key={ms.memberId}
                  className={`transition-colors ${getRowBorderIndicator(ms.status)}`}
                >
                  <td className="py-3.5 px-3 font-mono tabular-nums text-xs text-slate-500">
                    0{index + 1}
                  </td>
                  <td className="py-3.5 px-3 font-semibold text-slate-900">
                    <button
                      type="button"
                      onClick={() => onOpenMemberProfile(ms.memberId)}
                      className="hover:text-emerald-700 hover:underline text-left font-semibold"
                    >
                      {ms.memberName}
                    </button>
                  </td>
                  <td className="py-3.5 px-3">
                    {renderStatusIndicator(ms.status, ms.paidViaAdvanceOrCarryover)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono tabular-nums text-slate-600">
                    {formatINR(ms.expectedAmount)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                    {formatINR(ms.allocatedAmount)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono tabular-nums font-medium text-slate-700">
                    {ms.pendingAmount > 0 ? (
                      <span className="text-red-600 font-semibold">
                        {formatINR(ms.pendingAmount)}
                      </span>
                    ) : (
                      <span className="text-slate-400">₹0</span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => onOpenRecordSavings(ms.memberId, selectedDate)}
                      aria-label={`Record payment for ${ms.memberName}`}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[38px] whitespace-nowrap ${
                        ms.pendingAmount > 0
                          ? 'bg-slate-900 text-white hover:bg-slate-800'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {ms.pendingAmount > 0 ? 'Collect ₹' + ms.pendingAmount : '+ Extra / Advance'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 2: GROUP FINANCIAL SUMMARY & AVAILABLE CASH LEDGER */}
      <section aria-labelledby="group-financial-heading" className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-slate-200">
          <div>
            <div className="text-xs text-slate-500">
              Group Treasury · Strictly Separated Savings &amp; Loan Principal
            </div>
            <h2
              id="group-financial-heading"
              className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5"
            >
              Group Financial Summary
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateTab('loans')}
              className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors min-h-[40px]"
            >
              Manage Emergency Loans ({groupSummary.activeLoansCount} Active)
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('reports')}
              className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-200 text-xs font-semibold transition-colors min-h-[40px]"
            >
              Export Statements
            </button>
          </div>
        </div>

        {/* Available Cash Highlight & Formula Breakdown */}
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-900 text-white flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Available Group Cash Balance</span>
                <Wallet className="w-4 h-4 text-emerald-400" />
              </div>
              <div
                data-testid="available-group-cash"
                className="text-3xl sm:text-4xl font-bold font-mono tabular-nums text-emerald-400 mt-2"
              >
                {formatINR(groupSummary.availableGroupCash)}
              </div>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                Ready for interest-free emergency loans. Outstanding loan principal (
                <span className="font-mono tabular-nums text-white">
                  {formatINR(groupSummary.totalOutstandingLoanPrincipal)}
                </span>
                ) is excluded from available cash.
              </p>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-800 text-xs font-mono tabular-nums space-y-1 text-slate-300">
              <div className="flex justify-between">
                <span>+ Actual Savings Collected:</span>
                <span className="text-white font-semibold">
                  {formatINR(groupSummary.totalSavingsCollected)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>+ Loan Repayments Received:</span>
                <span className="text-emerald-300 font-semibold">
                  {formatINR(groupSummary.totalLoanPrincipalRepaid)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>- Total Loans Issued:</span>
                <span className="text-amber-300 font-semibold">
                  {formatINR(groupSummary.totalLoansIssued)}
                </span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-slate-800 text-white font-bold">
                <span>= Available Group Cash:</span>
                <span className="text-emerald-400">
                  {formatINR(groupSummary.availableGroupCash)}
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 grid grid-cols-2 gap-3 sm:gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
              <div className="text-xs font-medium text-slate-500">
                Total Savings Collected
              </div>
              <div
                data-testid="group-total-savings"
                className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-2"
              >
                {formatINR(groupSummary.totalSavingsCollected)}
              </div>
              <div className="text-xs text-slate-500 mt-2">
                Cumulative daily contributions across 7 members
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
              <div className="text-xs font-medium text-slate-500">
                Total Loans Issued
              </div>
              <div
                data-testid="group-total-loans-issued"
                className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-2"
              >
                {formatINR(groupSummary.totalLoansIssued)}
              </div>
              <div className="text-xs text-slate-500 mt-2">
                0% interest emergency disbursements
              </div>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 flex flex-col justify-between">
              <div className="text-xs font-medium text-emerald-900">
                Total Loan Principal Repaid
              </div>
              <div
                data-testid="group-total-loan-repaid"
                className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-2"
              >
                {formatINR(groupSummary.totalLoanPrincipalRepaid)}
              </div>
              <div className="text-xs text-emerald-800 mt-2">
                Returned to available group pool
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 flex flex-col justify-between">
              <div className="text-xs font-medium text-amber-900">
                Outstanding Loan Principal
              </div>
              <div
                data-testid="group-outstanding-principal"
                className="text-2xl font-bold font-mono tabular-nums text-amber-800 mt-2"
              >
                {formatINR(groupSummary.totalOutstandingLoanPrincipal)}
              </div>
              <div className="text-xs text-amber-800 mt-2">
                {groupSummary.overdueInstalmentsCount > 0
                  ? `${groupSummary.overdueInstalmentsCount} overdue weekly instalment(s)`
                  : 'All active instalments on schedule'}
              </div>
            </div>
          </div>
        </div>

        {/* Member-wise Savings & Loan Balances Summary Table */}
        <div className="mt-6">
          <h3 className="text-sm font-bold text-slate-900 mb-3">
            Member-Wise Savings &amp; Loan Balances
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-2.5 px-3">Member</th>
                  <th className="py-2.5 px-3 text-right">Savings Contributed</th>
                  <th className="py-2.5 px-3 text-right">Missed Days</th>
                  <th className="py-2.5 px-3 text-right">Pending Savings</th>
                  <th className="py-2.5 px-3 text-right">Loans Taken</th>
                  <th className="py-2.5 px-3 text-right">Loan Repaid</th>
                  <th className="py-2.5 px-3 text-right">Remaining Loan Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 text-sm">
                {groupSummary.memberSavingsBalances.map((mb) => (
                  <tr key={mb.memberId} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-semibold text-slate-900">
                      <button
                        type="button"
                        onClick={() => onOpenMemberProfile(mb.memberId)}
                        className="hover:text-emerald-700 hover:underline text-left"
                      >
                        {mb.memberName}
                      </button>
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-emerald-700">
                      {formatINR(mb.totalSaved)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                      {mb.missedDaysCount}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-red-600">
                      {formatINR(mb.outstandingSavingsAmount)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                      {formatINR(mb.totalLoansTaken)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-700">
                      {formatINR(mb.totalLoanRepaid)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {mb.remainingLoanBalance > 0 ? (
                        <span className="text-amber-700">
                          {formatINR(mb.remainingLoanBalance)}
                        </span>
                      ) : (
                        <span className="text-slate-400">₹0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};
