import React, { useState } from 'react';
import {
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  X,
  Wallet,
  Calculator,
} from 'lucide-react';
import {
  AppDatabaseState,
  EmergencyLoan,
  InstalmentAllocation,
  InstalmentStatus,
  addDaysISO,
  calculateGroupFinancialSummary,
  formatDateDDMMYYYY,
  formatINR,
  generateTenWeeklyInstalments,
  proposeLoanRepaymentAllocations,
} from '../domain/ledgerEngine';

interface LoansViewProps {
  state: AppDatabaseState;
  onIssueLoan: (params: {
    borrowerId: string;
    principalAmount: number;
    issueDateISO: string;
    firstInstalmentDateISO: string;
    purpose?: string;
    notes?: string;
    allowExceedAvailableCash?: boolean;
  }) => void;
  onRecordRepayment: (params: {
    loanId: string;
    paymentAmount: number;
    paymentDateISO: string;
    instalmentAllocations: InstalmentAllocation[];
    notes?: string;
  }) => void;
}

export const LoansView: React.FC<LoansViewProps> = ({
  state,
  onIssueLoan,
  onRecordRepayment,
}) => {
  const [showNewLoanModal, setShowNewLoanModal] = useState(false);
  const [borrowerId, setBorrowerId] = useState(
    state.members[0]?.id || 'member-1'
  );
  const [principalInput, setPrincipalInput] = useState('5000');
  const [issueDate, setIssueDate] = useState(
    state.settings.currentReferenceDate
  );
  const [firstInstalmentDate, setFirstInstalmentDate] = useState(
    addDaysISO(state.settings.currentReferenceDate, 7)
  );
  const [loanPurpose, setLoanPurpose] = useState('Medical / Family Emergency');
  const [allowExceedCash, setAllowExceedCash] = useState(false);
  const [loanError, setLoanError] = useState<string | null>(null);

  // Repayment Modal State
  const [activeRepaymentLoan, setActiveRepaymentLoan] =
    useState<EmergencyLoan | null>(null);
  const [repaymentAmountInput, setRepaymentAmountInput] = useState('500');
  const [repaymentDate, setRepaymentDate] = useState(
    state.settings.currentReferenceDate
  );
  const [startingInstalment, setStartingInstalment] = useState<number>(1);
  const [customInstalmentAllocs, setCustomInstalmentAllocs] = useState<
    InstalmentAllocation[] | null
  >(null);
  const [repaymentNotes, setRepaymentNotes] = useState('');
  const [repaymentError, setRepaymentError] = useState<string | null>(null);

  const groupSummary = calculateGroupFinancialSummary(state);

  const previewPrincipal = Number(principalInput) || 0;
  const previewInstalments =
    previewPrincipal > 0
      ? generateTenWeeklyInstalments(
          previewPrincipal,
          firstInstalmentDate,
          state.settings.currentReferenceDate
        )
      : [];

  const handleCreateLoan = (e: React.FormEvent) => {
    e.preventDefault();
    setLoanError(null);
    try {
      onIssueLoan({
        borrowerId,
        principalAmount: previewPrincipal,
        issueDateISO: issueDate,
        firstInstalmentDateISO: firstInstalmentDate,
        purpose: loanPurpose,
        allowExceedAvailableCash: allowExceedCash,
      });
      setShowNewLoanModal(false);
    } catch (err) {
      setLoanError((err as Error).message);
    }
  };

  const openRepaymentForLoan = (
    loan: EmergencyLoan,
    defaultInstalmentNumber?: number
  ) => {
    const firstUnpaid =
      loan.instalments.find((i) => i.remainingBalance > 0)?.instalmentNumber ||
      1;
    const targetInstNum = defaultInstalmentNumber || firstUnpaid;
    const targetInst = loan.instalments.find(
      (i) => i.instalmentNumber === targetInstNum
    );
    const defaultAmt = targetInst
      ? targetInst.remainingBalance
      : loan.weeklyInstalmentAmount;

    setActiveRepaymentLoan(loan);
    setStartingInstalment(targetInstNum);
    setRepaymentAmountInput(String(defaultAmt));
    setRepaymentDate(state.settings.currentReferenceDate);
    setCustomInstalmentAllocs(null);
    setRepaymentNotes('');
    setRepaymentError(null);
  };

  const numericRepaymentAmount = Number(repaymentAmountInput) || 0;
  const proposedRepaymentAllocs = activeRepaymentLoan
    ? customInstalmentAllocs ||
      proposeLoanRepaymentAllocations(
        activeRepaymentLoan,
        numericRepaymentAmount,
        startingInstalment
      )
    : [];

  const handleSubmitRepayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRepaymentLoan) return;
    setRepaymentError(null);
    try {
      onRecordRepayment({
        loanId: activeRepaymentLoan.id,
        paymentAmount: numericRepaymentAmount,
        paymentDateISO: repaymentDate,
        instalmentAllocations: proposedRepaymentAllocs,
        notes: repaymentNotes,
      });
      setActiveRepaymentLoan(null);
    } catch (err) {
      setRepaymentError((err as Error).message);
    }
  };

  const renderInstalmentStatus = (status: InstalmentStatus) => {
    switch (status) {
      case 'Paid':
        return (
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Paid</span>
          </span>
        );
      case 'Partially Paid':
        return (
          <span className="inline-flex items-center gap-1 font-semibold text-amber-600 text-xs">
            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Partially Paid</span>
          </span>
        );
      case 'Overdue':
        return (
          <span className="inline-flex items-center gap-1 font-semibold text-red-600 text-xs">
            <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
            <span>Overdue</span>
          </span>
        );
      case 'Upcoming':
        return (
          <span className="inline-flex items-center gap-1 font-medium text-slate-600 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Upcoming</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* TOP SUMMARY & ISSUE LOAN HEADER */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <div className="text-xs text-slate-500">
              0% Interest Emergency Support · 10 Weeks · 10 Equal Weekly Instalments
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
              Interest-Free Emergency Loan Manager
            </h1>
          </div>

          <button
            type="button"
            onClick={() => {
              setLoanError(null);
              setShowNewLoanModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 min-h-[44px] shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Issue Emergency Loan</span>
          </button>
        </div>

        {/* Loan Pool KPIs */}
        <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-xl bg-slate-900 text-white">
            <div className="text-xs text-slate-300 flex items-center justify-between">
              <span>Available Cash for Loans</span>
              <Wallet className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400 mt-1">
              {formatINR(groupSummary.availableGroupCash)}
            </div>
            <div className="text-[11px] text-slate-300 mt-1">
              Savings + Repaid − Issued
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs text-slate-500">Total Loans Issued</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {formatINR(groupSummary.totalLoansIssued)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {state.loans.length} total loan(s) · 0% interest
            </div>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200">
            <div className="text-xs text-emerald-900">
              Total Principal Repaid
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
              {formatINR(groupSummary.totalLoanPrincipalRepaid)}
            </div>
            <div className="text-[11px] text-emerald-800 mt-1">
              Zero interest or late penalties
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200">
            <div className="text-xs text-amber-900">
              Outstanding Loan Principal
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-amber-800 mt-1">
              {formatINR(groupSummary.totalOutstandingLoanPrincipal)}
            </div>
            <div className="text-[11px] text-amber-800 mt-1">
              {groupSummary.overdueInstalmentsCount} overdue instalment(s)
            </div>
          </div>
        </div>
      </section>

      {/* ACTIVE & HISTORICAL 10-WEEK LOAN REPAYMENT TRACKERS */}
      <div className="space-y-6">
        {state.loans.map((loan) => {
          const borrower = state.members.find((m) => m.id === loan.borrowerId);
          const totalRepaid = loan.instalments.reduce(
            (sum, i) => sum + i.amountPaid,
            0
          );
          const remainingPrincipal = Math.max(
            0,
            loan.principalAmount - totalRepaid
          );
          const paidInstalmentsCount = loan.instalments.filter(
            (i) => i.status === 'Paid'
          ).length;
          const overdueCount = loan.instalments.filter(
            (i) => i.isOverdue
          ).length;

          return (
            <section
              key={loan.id}
              data-testid={`loan-card-${loan.id}`}
              className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6"
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono tabular-nums">{loan.id}</span>
                    <span aria-hidden="true">·</span>
                    <span>Issued {formatDateDDMMYYYY(loan.issueDate)}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      1st Instalment {formatDateDDMMYYYY(loan.firstInstalmentDate)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-emerald-700 font-semibold">
                      0% Interest (Principal Only)
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
                    {borrower?.name || 'Member'} — {formatINR(loan.principalAmount)}{' '}
                    Emergency Loan
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    10 Weekly Instalments × {formatINR(loan.weeklyInstalmentAmount)}{' '}
                    {loan.purpose ? `· Purpose: ${loan.purpose}` : ''}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="text-right font-mono tabular-nums">
                    <div className="text-xs text-slate-500">
                      Repaid / Total Principal
                    </div>
                    <div className="text-sm font-bold text-slate-900">
                      <span className="text-emerald-700">
                        {formatINR(totalRepaid)}
                      </span>{' '}
                      / {formatINR(loan.principalAmount)}
                    </div>
                  </div>

                  <div className="text-right font-mono tabular-nums">
                    <div className="text-xs text-slate-500">
                      Remaining Balance
                    </div>
                    <div className="text-sm font-bold text-amber-800">
                      {formatINR(remainingPrincipal)}
                    </div>
                  </div>

                  {remainingPrincipal > 0 && (
                    <button
                      type="button"
                      onClick={() => openRepaymentForLoan(loan)}
                      className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold min-h-[42px] whitespace-nowrap"
                    >
                      Record Weekly Repayment
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
                  <span>
                    Repayment Progress: {paidInstalmentsCount} of 10 instalments
                    settled
                  </span>
                  <span className="font-mono tabular-nums font-semibold">
                    {Math.round((totalRepaid / loan.principalAmount) * 100)}%
                    {overdueCount > 0 ? ` · ${overdueCount} Overdue` : ''}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((totalRepaid / loan.principalAmount) * 100)
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* 10-Week Instalment Schedule Table */}
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                      <th className="py-2.5 px-3">Instalment #</th>
                      <th className="py-2.5 px-3">Due Date</th>
                      <th className="py-2.5 px-3 text-right">Expected Amount</th>
                      <th className="py-2.5 px-3 text-right">Amount Paid</th>
                      <th className="py-2.5 px-3">Actual Payment Date</th>
                      <th className="py-2.5 px-3 text-right">
                        Remaining Balance
                      </th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 text-sm">
                    {loan.instalments.map((inst) => (
                      <tr
                        key={inst.instalmentNumber}
                        className={`transition-colors ${
                          inst.status === 'Paid'
                            ? 'bg-emerald-50/35'
                            : inst.status === 'Overdue'
                            ? 'bg-red-50/40'
                            : inst.status === 'Partially Paid'
                            ? 'bg-amber-50/40'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3 px-3 font-mono tabular-nums text-xs font-bold text-slate-800">
                          Week #{inst.instalmentNumber} / 10
                        </td>
                        <td className="py-3 px-3 font-mono tabular-nums text-xs text-slate-700">
                          {formatDateDDMMYYYY(inst.dueDate)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                          {formatINR(inst.expectedAmount)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-emerald-700">
                          {formatINR(inst.amountPaid)}
                        </td>
                        <td className="py-3 px-3 font-mono tabular-nums text-xs text-slate-600">
                          {inst.actualPaymentDate
                            ? formatDateDDMMYYYY(inst.actualPaymentDate)
                            : '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {inst.remainingBalance > 0 ? (
                            <span
                              className={
                                inst.isOverdue
                                  ? 'text-red-600'
                                  : 'text-amber-800'
                              }
                            >
                              {formatINR(inst.remainingBalance)}
                            </span>
                          ) : (
                            <span className="text-slate-400">₹0</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {renderInstalmentStatus(inst.status)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {inst.remainingBalance > 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                openRepaymentForLoan(loan, inst.instalmentNumber)
                              }
                              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-800 min-h-[36px]"
                            >
                              Pay {formatINR(inst.remainingBalance)}
                            </button>
                          ) : (
                            <span className="text-xs text-emerald-700 font-medium">
                              Settled
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>

      {/* MODAL 1: ISSUE NEW INTEREST-FREE EMERGENCY LOAN */}
      {showNewLoanModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="issue-loan-title"
        >
          <div className="w-full max-w-xl rounded-2xl bg-white border border-slate-200 p-6 shadow-xl my-8">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h2
                  id="issue-loan-title"
                  className="text-lg font-bold text-slate-900"
                >
                  Issue Interest-Free Emergency Loan
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  10 Weeks Duration · 10 Instalments · 0% Interest · Available Group Cash:{' '}
                  <strong className="font-mono tabular-nums text-emerald-700">
                    {formatINR(groupSummary.availableGroupCash)}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewLoanModal(false)}
                aria-label="Close issue loan modal"
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loanError && (
              <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loanError}</span>
              </div>
            )}

            <form onSubmit={handleCreateLoan} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label
                    htmlFor="loan-borrower-select"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Borrower Name
                  </label>
                  <select
                    id="loan-borrower-select"
                    value={borrowerId}
                    onChange={(e) => setBorrowerId(e.target.value)}
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
                    htmlFor="loan-principal-input"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Principal Amount (₹)
                  </label>
                  <input
                    id="loan-principal-input"
                    type="number"
                    min={10}
                    step={1}
                    value={principalInput}
                    onChange={(e) => setPrincipalInput(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2 rounded-xl border border-slate-300 font-mono tabular-nums text-base font-bold text-slate-900 min-h-[42px]"
                    required
                  />
                </div>
              </div>

              {/* Standard Loan Calculation Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { principal: 5000, weekly: 500 },
                  { principal: 7500, weekly: 750 },
                  { principal: 10000, weekly: 1000 },
                  { principal: 15000, weekly: 1500 },
                ].map((preset) => (
                  <button
                    key={preset.principal}
                    type="button"
                    onClick={() => setPrincipalInput(String(preset.principal))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono tabular-nums font-semibold border transition-colors ${
                      Number(principalInput) === preset.principal
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {formatINR(preset.principal)} (10 × {formatINR(preset.weekly)})
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label
                    htmlFor="loan-issue-date"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Loan Issue Date ({formatDateDDMMYYYY(issueDate)})
                  </label>
                  <input
                    id="loan-issue-date"
                    type="date"
                    value={issueDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setIssueDate(val);
                      if (val) {
                        setFirstInstalmentDate(addDaysISO(val, 7));
                      }
                    }}
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 font-mono tabular-nums text-sm min-h-[42px]"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="loan-first-instalment-date"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    First Instalment Date ({formatDateDDMMYYYY(firstInstalmentDate)})
                  </label>
                  <input
                    id="loan-first-instalment-date"
                    type="date"
                    value={firstInstalmentDate}
                    onChange={(e) => setFirstInstalmentDate(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 font-mono tabular-nums text-sm min-h-[42px]"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="loan-purpose-input"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Emergency Purpose / Notes
                </label>
                <input
                  id="loan-purpose-input"
                  type="text"
                  value={loanPurpose}
                  onChange={(e) => setLoanPurpose(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900"
                />
              </div>

              {/* 10-Instalment Schedule Preview */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-emerald-700" />
                    <span>10-Week Instalment Calculation Preview (0% Interest)</span>
                  </span>
                  <span className="font-mono tabular-nums">
                    Total Repayment: {formatINR(previewPrincipal)}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-1.5 font-mono tabular-nums text-[11px]">
                  {previewInstalments.map((inst) => (
                    <div
                      key={inst.instalmentNumber}
                      className="p-2 rounded-lg bg-white border border-slate-200"
                    >
                      <div className="text-slate-500">
                        #{inst.instalmentNumber} ·{' '}
                        {formatDateDDMMYYYY(inst.dueDate).slice(0, 5)}
                      </div>
                      <div className="font-bold text-slate-900 mt-0.5">
                        {formatINR(inst.expectedAmount)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {previewPrincipal > groupSummary.availableGroupCash && (
                <label className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowExceedCash}
                    onChange={(e) => setAllowExceedCash(e.target.checked)}
                    className="rounded border-amber-400"
                  />
                  <span>
                    Admin Override: Allow issuing loan exceeding current available
                    cash ({formatINR(groupSummary.availableGroupCash)})
                  </span>
                </label>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewLoanModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold min-h-[44px]"
                >
                  Confirm &amp; Issue {formatINR(previewPrincipal)} Loan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RECORD WEEKLY LOAN REPAYMENT (PARTIAL / FULL / MULTI-INSTALMENT) */}
      {activeRepaymentLoan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="repayment-modal-title"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 shadow-xl my-8">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h2
                  id="repayment-modal-title"
                  className="text-lg font-bold text-slate-900"
                >
                  Record Weekly Loan Repayment
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {
                    state.members.find(
                      (m) => m.id === activeRepaymentLoan.borrowerId
                    )?.name
                  }{' '}
                  · {formatINR(activeRepaymentLoan.principalAmount)} Loan ·
                  Supports partial, full &amp; multi-instalment allocation
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveRepaymentLoan(null)}
                aria-label="Close repayment modal"
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {repaymentError && (
              <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{repaymentError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitRepayment} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label
                    htmlFor="repayment-amount-input"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Repayment Amount (₹)
                  </label>
                  <input
                    id="repayment-amount-input"
                    type="number"
                    min={1}
                    step={1}
                    value={repaymentAmountInput}
                    onChange={(e) => {
                      setRepaymentAmountInput(e.target.value);
                      setCustomInstalmentAllocs(null);
                    }}
                    className="mt-1 w-full px-3.5 py-2 rounded-xl border border-slate-300 font-mono tabular-nums text-base font-bold text-slate-900 min-h-[42px]"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="repayment-date-input"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Actual Payment Date ({formatDateDDMMYYYY(repaymentDate)})
                  </label>
                  <input
                    id="repayment-date-input"
                    type="date"
                    value={repaymentDate}
                    onChange={(e) => setRepaymentDate(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 font-mono tabular-nums text-sm min-h-[42px]"
                    required
                  />
                </div>
              </div>

              {/* Quick Repayment Presets: Partial, 1 Instalment, 2 Instalments */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setRepaymentAmountInput(
                      String(
                        Math.round(activeRepaymentLoan.weeklyInstalmentAmount / 2)
                      )
                    );
                    setCustomInstalmentAllocs(null);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono tabular-nums text-xs font-medium"
                >
                  {formatINR(
                    Math.round(activeRepaymentLoan.weeklyInstalmentAmount / 2)
                  )}{' '}
                  (Partial)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRepaymentAmountInput(
                      String(activeRepaymentLoan.weeklyInstalmentAmount)
                    );
                    setCustomInstalmentAllocs(null);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 font-mono tabular-nums text-xs font-semibold"
                >
                  {formatINR(activeRepaymentLoan.weeklyInstalmentAmount)} (1
                  Instalment)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRepaymentAmountInput(
                      String(activeRepaymentLoan.weeklyInstalmentAmount * 2)
                    );
                    setCustomInstalmentAllocs(null);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono tabular-nums text-xs font-semibold"
                >
                  {formatINR(activeRepaymentLoan.weeklyInstalmentAmount * 2)}{' '}
                  (Current + Next Instalment)
                </button>
              </div>

              {/* Proposed Instalment Allocation Breakdown */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs font-semibold text-slate-800">
                  Instalment Allocation Preview
                </div>
                <div className="mt-2 space-y-1.5">
                  {proposedRepaymentAllocs.map((alloc) => {
                    const instObj = activeRepaymentLoan.instalments.find(
                      (i) => i.instalmentNumber === alloc.instalmentNumber
                    );
                    return (
                      <div
                        key={alloc.instalmentNumber}
                        className="flex items-center justify-between text-xs font-mono tabular-nums"
                      >
                        <span className="text-slate-700">
                          Instalment #{alloc.instalmentNumber} (Due{' '}
                          {formatDateDDMMYYYY(instObj?.dueDate)})
                        </span>
                        <span className="font-bold text-emerald-700">
                          {formatINR(alloc.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label
                  htmlFor="repayment-notes-input"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Optional Notes
                </label>
                <input
                  id="repayment-notes-input"
                  type="text"
                  placeholder="e.g., Weekly repayment received in cash"
                  value={repaymentNotes}
                  onChange={(e) => setRepaymentNotes(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveRepaymentLoan(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold min-h-[44px]"
                >
                  Confirm Repayment ({formatINR(numericRepaymentAmount)})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
