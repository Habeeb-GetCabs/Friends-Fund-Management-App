import React, { useState } from 'react';
import {
  PlusCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
} from 'lucide-react';
import {
  AppDatabaseState,
  EmergencyLoan,
  addDaysISO,
  calculateGroupFinancialSummary,
  formatDateDDMMYYYY,
  formatINR,
} from '../domain/ledgerEngine';

interface LoansViewProps {
  state: AppDatabaseState;
  onIssueLoan: (params: {
    borrowerId: string;
    principalAmount: number;
    issueDateISO: string;
    firstInstalmentDateISO: string;
    repaymentDurationWeeks: number;
    purpose?: string;
    allowExceedAvailableCash?: boolean;
  }) => void;
  onRecordRepayment: (params: {
    loanId: string;
    paymentAmount: number;
    paymentDateISO: string;
    notes?: string;
  }) => void;
}

export const LoansView: React.FC<LoansViewProps> = ({
  state,
  onIssueLoan,
  onRecordRepayment,
}) => {
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [borrowerId, setBorrowerId] = useState(
    state.members[0]?.id || 'member-1'
  );
  // IMPORTANT: Never automatically prefill loan amount!
  const [loanAmountText, setLoanAmountText] = useState('');
  const [issueDate, setIssueDate] = useState(
    state.settings.currentReferenceDate
  );
  const [firstRepaymentDate, setFirstRepaymentDate] = useState(
    addDaysISO(state.settings.currentReferenceDate, 7)
  );
  const [durationWeeksText, setDurationWeeksText] = useState('10');
  const [purpose, setPurpose] = useState('');
  const [allowExceedCash, setAllowExceedCash] = useState(false);
  const [loanError, setLoanError] = useState<string | null>(null);

  // Simple Record Repayment Modal State (asks ONLY for Payment Date, Actual Amount Received, Optional Notes)
  const [activeRepaymentLoan, setActiveRepaymentLoan] =
    useState<EmergencyLoan | null>(null);
  const [repaymentDate, setRepaymentDate] = useState(
    state.settings.currentReferenceDate
  );
  // IMPORTANT: Never automatically prefill repayment amount!
  const [repaymentAmountText, setRepaymentAmountText] = useState('');
  const [repaymentNotes, setRepaymentNotes] = useState('');
  const [repaymentError, setRepaymentError] = useState<string | null>(null);

  const groupSummary = calculateGroupFinancialSummary(state);

  const parsedPrincipal = Number(loanAmountText) || 0;
  const parsedWeeks = Math.max(1, Math.round(Number(durationWeeksText) || 10));
  const calculatedWeeklyInstalment =
    parsedPrincipal > 0 ? Math.round(parsedPrincipal / parsedWeeks) : 0;

  const handleCreateLoan = (e: React.FormEvent) => {
    e.preventDefault();
    setLoanError(null);
    if (!loanAmountText.trim() || parsedPrincipal <= 0) {
      setLoanError('Please enter a valid loan amount greater than ₹0.');
      return;
    }
    try {
      onIssueLoan({
        borrowerId,
        principalAmount: parsedPrincipal,
        issueDateISO: issueDate,
        firstInstalmentDateISO: firstRepaymentDate,
        repaymentDurationWeeks: parsedWeeks,
        purpose,
        allowExceedAvailableCash: allowExceedCash,
      });
      setShowIssueModal(false);
      setLoanAmountText('');
      setPurpose('');
    } catch (err) {
      setLoanError((err as Error).message);
    }
  };

  const openRecordRepaymentModal = (loan: EmergencyLoan) => {
    setActiveRepaymentLoan(loan);
    setRepaymentDate(state.settings.currentReferenceDate);
    setRepaymentAmountText(''); // Unprefilled!
    setRepaymentNotes('');
    setRepaymentError(null);
  };

  const handleSaveRepayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRepaymentLoan) return;
    setRepaymentError(null);

    const amountNum = Number(repaymentAmountText);
    if (!repaymentAmountText.trim() || !Number.isFinite(amountNum) || amountNum <= 0) {
      setRepaymentError('Please enter the actual repayment amount received.');
      return;
    }

    try {
      onRecordRepayment({
        loanId: activeRepaymentLoan.id,
        paymentAmount: amountNum,
        paymentDateISO: repaymentDate,
        notes: repaymentNotes,
      });
      setActiveRepaymentLoan(null);
    } catch (err) {
      setRepaymentError((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      {/* LOAN SUMMARY (4 Required Metrics + Issue New Loan button) */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">
              Interest-Free Loan Tracker
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              0% Interest · No Late Penalties · Automatic Principal Allocation
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setLoanAmountText('');
              setPurpose('');
              setLoanError(null);
              setShowIssueModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 min-h-[44px]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Issue New Loan</span>
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs text-slate-500">Total Loans Issued</div>
            <div
              data-testid="loans-total-issued"
              className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1"
            >
              {formatINR(groupSummary.totalLoansIssued)}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs text-slate-500">Total Principal Repaid</div>
            <div
              data-testid="loans-total-repaid"
              className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1"
            >
              {formatINR(groupSummary.totalLoanPrincipalRepaid)}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs text-slate-500">
              Outstanding Loan Principal
            </div>
            <div
              data-testid="loans-outstanding-principal"
              className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1"
            >
              {formatINR(groupSummary.totalOutstandingLoanPrincipal)}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200">
            <div className="text-xs text-emerald-900">Available Group Cash</div>
            <div
              data-testid="loans-available-cash"
              className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1"
            >
              {formatINR(groupSummary.availableGroupCash)}
            </div>
          </div>
        </div>
      </section>

      {/* SIMPLE LOAN DETAILS LIST */}
      {state.loans.length === 0 ? (
        <section className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-2xs">
          <p className="text-sm text-slate-600 font-medium">
            No active or historical loans recorded yet.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Click &ldquo;Issue New Loan&rdquo; above when a member needs an
            interest-free emergency loan.
          </p>
        </section>
      ) : (
        <div className="space-y-4">
          {state.loans.map((loan) => {
            const borrower = state.members.find(
              (m) => m.id === loan.borrowerId
            );
            const totalRepaid = loan.instalments.reduce(
              (sum, i) => sum + i.amountPaid,
              0
            );
            const remaining = Math.max(0, loan.principalAmount - totalRepaid);

            return (
              <section
                key={loan.id}
                data-testid={`loan-card-${loan.id}`}
                className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {borrower?.name || 'Member'}
                    </h2>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Issued: {formatDateDDMMYYYY(loan.issueDate)} ·{' '}
                      {loan.repaymentDurationWeeks || 10} Weeks · Interest: ₹0
                      {loan.purpose ? ` · ${loan.purpose}` : ''}
                    </div>
                  </div>

                  {remaining > 0 ? (
                    <button
                      type="button"
                      onClick={() => openRecordRepaymentModal(loan)}
                      className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold tracking-wide transition-colors min-h-[44px] shrink-0"
                    >
                      RECORD REPAYMENT
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Loan Fully Repaid</span>
                    </span>
                  )}
                </div>

                {/* Simple 3-Metric Loan Status */}
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-xs text-slate-500">Original Loan</div>
                    <div className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                      {formatINR(loan.principalAmount)}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-xs text-slate-500">Total Repaid</div>
                    <div className="text-lg font-bold font-mono tabular-nums text-emerald-700 mt-0.5">
                      {formatINR(totalRepaid)}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-xs text-slate-500">Remaining</div>
                    <div className="text-lg font-bold font-mono tabular-nums text-red-600 mt-0.5">
                      {formatINR(remaining)}
                    </div>
                  </div>
                </div>

                {/* Simple Weekly Repayment History: Week 1 — ₹500 — Paid */}
                <div className="mt-5">
                  <h3 className="text-xs font-bold text-slate-700 mb-2">
                    Weekly Repayment Schedule
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {loan.instalments.map((inst) => {
                      const statusLabel =
                        inst.status === 'Paid'
                          ? 'Paid'
                          : inst.status === 'Partially Paid'
                          ? 'Partially Paid'
                          : inst.isOverdue
                          ? 'Overdue'
                          : 'Pending';

                      const statusStyle =
                        inst.status === 'Paid'
                          ? 'text-emerald-700 bg-emerald-50/50 border-emerald-200'
                          : inst.status === 'Partially Paid'
                          ? 'text-amber-700 bg-amber-50/50 border-amber-200'
                          : inst.isOverdue
                          ? 'text-red-600 bg-red-50/50 border-red-200'
                          : 'text-slate-600 bg-slate-50 border-slate-200';

                      return (
                        <div
                          key={inst.instalmentNumber}
                          className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between text-xs font-mono tabular-nums ${statusStyle}`}
                        >
                          <span className="font-semibold">
                            Week {inst.instalmentNumber} ({formatDateDDMMYYYY(inst.dueDate)})
                          </span>
                          <span>—</span>
                          <span className="font-bold">
                            {formatINR(inst.amountPaid)} / {formatINR(inst.expectedAmount)}
                          </span>
                          <span>—</span>
                          <span className="font-sans font-semibold flex items-center gap-1">
                            {inst.status === 'Paid' && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            )}
                            {inst.status === 'Partially Paid' && (
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                            )}
                            <span>{statusLabel}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* MODAL 1: ISSUE NEW LOAN (6 Simple Fields, No Prefilled Loan Amount) */}
      {showIssueModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="issue-loan-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-lg my-auto">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <h2
                id="issue-loan-modal-title"
                className="text-lg font-bold text-slate-900"
              >
                Issue New Loan
              </h2>
              <button
                type="button"
                onClick={() => setShowIssueModal(false)}
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
              <div>
                <label
                  htmlFor="simple-loan-borrower"
                  className="block text-xs font-semibold text-slate-700"
                >
                  1. Borrower
                </label>
                <select
                  id="simple-loan-borrower"
                  value={borrowerId}
                  onChange={(e) => setBorrowerId(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900 min-h-[44px]"
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
                  htmlFor="simple-loan-amount"
                  className="block text-xs font-semibold text-slate-700"
                >
                  2. Loan Amount (₹)
                </label>
                <input
                  id="simple-loan-amount"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="Enter principal amount (e.g. 5000)"
                  value={loanAmountText}
                  onChange={(e) => setLoanAmountText(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono tabular-nums text-sm font-semibold text-slate-900 min-h-[44px]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="simple-loan-issue-date"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    3. Issue Date
                  </label>
                  <input
                    id="simple-loan-issue-date"
                    type="date"
                    value={issueDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setIssueDate(val);
                      if (val) setFirstRepaymentDate(addDaysISO(val, 7));
                    }}
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 font-mono tabular-nums text-xs min-h-[42px]"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="simple-loan-first-date"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    4. First Repayment Date
                  </label>
                  <input
                    id="simple-loan-first-date"
                    type="date"
                    value={firstRepaymentDate}
                    onChange={(e) => setFirstRepaymentDate(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 font-mono tabular-nums text-xs min-h-[42px]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="simple-loan-duration"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    5. Duration (Weeks)
                  </label>
                  <input
                    id="simple-loan-duration"
                    type="number"
                    min={1}
                    max={52}
                    value={durationWeeksText}
                    onChange={(e) => setDurationWeeksText(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 font-mono tabular-nums text-sm font-semibold min-h-[42px]"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="simple-loan-purpose"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    6. Purpose (Optional)
                  </label>
                  <input
                    id="simple-loan-purpose"
                    type="text"
                    placeholder="Optional purpose"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 text-sm min-h-[42px]"
                  />
                </div>
              </div>

              {/* Automatic Equal Weekly Instalment Summary */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1 font-mono tabular-nums">
                <div className="flex justify-between">
                  <span className="text-slate-500">Loan Amount:</span>
                  <span className="font-bold text-slate-900">
                    {formatINR(parsedPrincipal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Duration:</span>
                  <span className="font-semibold text-slate-800">
                    {parsedWeeks} weeks
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Weekly Instalment:</span>
                  <span className="font-bold text-emerald-700">
                    {formatINR(calculatedWeeklyInstalment)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Interest:</span>
                  <span className="font-bold text-emerald-700">₹0</span>
                </div>
              </div>

              {parsedPrincipal > groupSummary.availableGroupCash && (
                <label className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowExceedCash}
                    onChange={(e) => setAllowExceedCash(e.target.checked)}
                    className="rounded border-amber-400"
                  />
                  <span>
                    Allow issuing loan exceeding current available cash (
                    {formatINR(groupSummary.availableGroupCash)})
                  </span>
                </label>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold min-h-[44px]"
                >
                  Save &amp; Issue Loan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SIMPLE RECORD REPAYMENT (Only Date, Actual Amount Received, Optional Notes) */}
      {activeRepaymentLoan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="simple-repayment-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-lg my-auto">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h2
                  id="simple-repayment-title"
                  className="text-lg font-bold text-slate-900"
                >
                  Record Loan Repayment
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {
                    state.members.find(
                      (m) => m.id === activeRepaymentLoan.borrowerId
                    )?.name
                  }{' '}
                  · Automatically reduces remaining loan principal
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

            <form onSubmit={handleSaveRepayment} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="simple-repayment-date"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Payment Date ({formatDateDDMMYYYY(repaymentDate)})
                </label>
                <input
                  id="simple-repayment-date"
                  type="date"
                  value={repaymentDate}
                  onChange={(e) => setRepaymentDate(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono tabular-nums text-sm min-h-[44px]"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="simple-repayment-amount"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Actual Amount Received (₹)
                </label>
                <input
                  id="simple-repayment-amount"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="Enter amount received"
                  value={repaymentAmountText}
                  onChange={(e) => setRepaymentAmountText(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono tabular-nums text-sm font-semibold text-slate-900 min-h-[44px]"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="simple-repayment-notes"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Optional Notes
                </label>
                <input
                  id="simple-repayment-notes"
                  type="text"
                  placeholder="Optional note"
                  value={repaymentNotes}
                  onChange={(e) => setRepaymentNotes(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 min-h-[42px]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveRepaymentLoan(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold min-h-[44px]"
                >
                  Save Repayment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
