import React, { useState } from 'react';
import {
  Edit3,
  FileSpreadsheet,
  FileText,
  Plus,
  Check,
  X,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import {
  AppDatabaseState,
  calculateGroupFinancialSummary,
  formatDateDDMMYYYY,
  formatINR,
  getDatesInRange,
  getMemberSavingsForDate,
} from '../domain/ledgerEngine';
import {
  exportReportToPDF,
  exportTableToExcelCSV,
} from '../utils/exportUtils';

interface MembersViewProps {
  state: AppDatabaseState;
  selectedMemberId: string | null;
  onSelectMember: (memberId: string | null) => void;
  onRenameMember: (memberId: string, newName: string) => void;
  onOpenRecordSavings: (memberId: string, dateISO?: string) => void;
}

export const MembersView: React.FC<MembersViewProps> = ({
  state,
  selectedMemberId,
  onSelectMember,
  onRenameMember,
  onOpenRecordSavings,
}) => {
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

  const groupSummary = calculateGroupFinancialSummary(state);
  const activeMemberId = selectedMemberId || null;
  const activeMember = state.members.find((m) => m.id === activeMemberId) || null;
  const activeBalance = groupSummary.memberSavingsBalances.find(
    (b) => b.memberId === activeMemberId
  );

  const startEditing = (memberId: string, currentName: string) => {
    setEditingMemberId(memberId);
    setEditingNameValue(currentName);
    setRenameError(null);
  };

  const handleRenameSubmit = (e: React.FormEvent, memberId: string) => {
    e.preventDefault();
    try {
      onRenameMember(memberId, editingNameValue);
      setEditingMemberId(null);
      setRenameError(null);
    } catch (err) {
      setRenameError((err as Error).message);
    }
  };

  const exportMemberStatementPDF = (memberId: string) => {
    const member = state.members.find((m) => m.id === memberId);
    const bal = groupSummary.memberSavingsBalances.find(
      (b) => b.memberId === memberId
    );
    if (!member || !bal) return;

    const memberTxns = state.transactions.filter((t) => t.memberId === memberId);
    exportReportToPDF(
      `Member_Statement_${member.name}_${formatDateDDMMYYYY(state.settings.currentReferenceDate)}.pdf`,
      `Individual Member Financial Statement — ${member.name}`,
      `Generated on ${formatDateDDMMYYYY(state.settings.currentReferenceDate)} | Member ID: ${member.id}`,
      [
        { label: 'Total Saved', value: formatINR(bal.totalSaved) },
        { label: 'Missed Days', value: String(bal.missedDaysCount) },
        { label: 'Pending Savings', value: formatINR(bal.outstandingSavingsAmount) },
        { label: 'Loans Taken', value: formatINR(bal.totalLoansTaken) },
        { label: 'Loan Repaid', value: formatINR(bal.totalLoanRepaid) },
        { label: 'Loan Balance', value: formatINR(bal.remainingLoanBalance) },
      ],
      ['Txn ID', 'Date (DD-MM-YYYY)', 'Category', 'Amount', 'Details'],
      memberTxns.map((t) => [
        t.id,
        formatDateDDMMYYYY(t.transactionDate),
        t.category,
        formatINR(t.amount),
        t.description || t.notes || '—',
      ])
    );
  };

  const exportMemberStatementExcel = (memberId: string) => {
    const member = state.members.find((m) => m.id === memberId);
    if (!member) return;
    const memberTxns = state.transactions.filter((t) => t.memberId === memberId);
    exportTableToExcelCSV(
      `Member_Statement_${member.name}.csv`,
      `Member Financial Statement - ${member.name}`,
      ['Transaction ID', 'Date (DD-MM-YYYY)', 'Category', 'Amount (INR)', 'Description', 'Notes'],
      memberTxns.map((t) => [
        t.id,
        formatDateDDMMYYYY(t.transactionDate),
        t.category,
        t.amount,
        t.description || '',
        t.notes || '',
      ])
    );
  };

  // Detailed Single Member Profile View
  if (activeMember && activeBalance) {
    const allDates = getDatesInRange(
      state.settings.groupStartDate,
      state.settings.currentReferenceDate
    ).reverse();

    const memberSavingsTxns = state.transactions.filter(
      (t) =>
        t.memberId === activeMember.id &&
        (t.category === 'Daily Savings' ||
          t.category === 'Savings Correction' ||
          t.category === 'Refund or Reversal')
    );

    const memberLoans = state.loans.filter(
      (l) => l.borrowerId === activeMember.id
    );

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onSelectMember(null)}
                aria-label="Back to all members"
                className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="text-xs text-slate-500">
                  Member Profile &amp; Individual Financial Statement · Joined{' '}
                  {formatDateDDMMYYYY(activeMember.joinedDate)}
                </div>
                {editingMemberId === activeMember.id ? (
                  <form
                    onSubmit={(e) => handleRenameSubmit(e, activeMember.id)}
                    className="mt-1 flex items-center gap-2"
                  >
                    <input
                      type="text"
                      aria-label="Edit member name"
                      value={editingNameValue}
                      onChange={(e) => setEditingNameValue(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-base font-bold text-slate-900"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold min-h-[38px]"
                    >
                      Save Name
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingMemberId(null)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-200 text-slate-700 text-xs font-semibold min-h-[38px]"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2.5 mt-0.5">
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                      {activeMember.name}
                    </h1>
                    <button
                      type="button"
                      onClick={() =>
                        startEditing(activeMember.id, activeMember.name)
                      }
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium inline-flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Name</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => exportMemberStatementPDF(activeMember.id)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold inline-flex items-center gap-1.5 min-h-[40px]"
              >
                <FileText className="w-4 h-4 text-slate-600" />
                <span>Statement PDF</span>
              </button>
              <button
                type="button"
                onClick={() => exportMemberStatementExcel(activeMember.id)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold inline-flex items-center gap-1.5 min-h-[40px]"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span>Statement Excel</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onOpenRecordSavings(
                    activeMember.id,
                    state.settings.currentReferenceDate
                  )
                }
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 min-h-[40px]"
              >
                <Plus className="w-4 h-4" />
                <span>Add Savings for {activeMember.name}</span>
              </button>
            </div>
          </div>

          {activeMember.nameHistory && activeMember.nameHistory.length > 0 && (
            <div className="mt-3 text-xs text-slate-500">
              Historical Name Record Preserved:{' '}
              {activeMember.nameHistory
                .map(
                  (nh) =>
                    `${nh.oldName} → ${nh.newName} (${formatDateDDMMYYYY(
                      nh.changedAt
                    )})`
                )
                .join(' · ')}
            </div>
          )}

          {/* 6 Required Member Profile Summary Metrics */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200">
              <div className="text-xs text-emerald-800 font-medium">
                Total Savings Contributed
              </div>
              <div className="text-xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                {formatINR(activeBalance.totalSaved)}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-red-50/60 border border-red-200">
              <div className="text-xs text-red-800 font-medium">
                Missed Contributions
              </div>
              <div className="text-xl font-bold font-mono tabular-nums text-red-600 mt-1">
                {activeBalance.missedDaysCount} Days
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200">
              <div className="text-xs text-amber-900 font-medium">
                Outstanding Savings
              </div>
              <div className="text-xl font-bold font-mono tabular-nums text-amber-800 mt-1">
                {formatINR(activeBalance.outstandingSavingsAmount)}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-600 font-medium">
                Total Loans Received
              </div>
              <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {formatINR(activeBalance.totalLoansTaken)}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-600 font-medium">
                Loan Repayments Made
              </div>
              <div className="text-xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                {formatINR(activeBalance.totalLoanRepaid)}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-600 font-medium">
                Remaining Loan Balance
              </div>
              <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {formatINR(activeBalance.remainingLoanBalance)}
              </div>
            </div>
          </div>

          {/* Calendar-Based Daily Savings Ledger for this Member */}
          <div className="mt-6">
            <h2 className="text-base font-bold text-slate-900">
              Daily Savings Attendance Calendar ({activeMember.name})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any missed or partial date below to allocate a payment directly to that date.
            </p>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {allDates.map((d) => {
                const stat = getMemberSavingsForDate(state, activeMember.id, d);
                const statusColor =
                  stat.status === 'Paid'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : stat.status === 'Advance'
                    ? 'bg-blue-50 border-blue-200 text-blue-900'
                    : stat.status === 'Partially Paid'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-red-50 border-red-200 text-red-900';
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onOpenRecordSavings(activeMember.id, d)}
                    className={`p-2.5 rounded-xl border text-left transition-colors hover:opacity-90 ${statusColor}`}
                  >
                    <div className="font-mono tabular-nums text-xs font-bold">
                      {formatDateDDMMYYYY(d)}
                    </div>
                    <div className="text-[11px] font-semibold mt-1">
                      {stat.status}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums mt-0.5">
                      {formatINR(stat.allocatedAmount)} / {formatINR(stat.expectedAmount)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Complete Loan History for Member */}
          <div className="mt-7 pt-6 border-t border-slate-200">
            <h2 className="text-base font-bold text-slate-900">
              Complete Loan History ({memberLoans.length})
            </h2>
            {memberLoans.length === 0 ? (
              <p className="text-xs text-slate-500 mt-2">
                No emergency loans taken by {activeMember.name}.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {memberLoans.map((loan) => {
                  const repaid = loan.instalments.reduce(
                    (s, i) => s + i.amountPaid,
                    0
                  );
                  const rem = Math.max(0, loan.principalAmount - repaid);
                  return (
                    <div
                      key={loan.id}
                      className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4"
                    >
                      <div>
                        <div className="text-sm font-bold text-slate-900">
                          {formatINR(loan.principalAmount)} Interest-Free Loan ·{' '}
                          <span className="font-normal text-slate-600">
                            {loan.purpose}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                          Issued: {formatDateDDMMYYYY(loan.issueDate)} · 1st Due:{' '}
                          {formatDateDDMMYYYY(loan.firstInstalmentDate)} · 10 ×{' '}
                          {formatINR(loan.weeklyInstalmentAmount)}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 font-mono tabular-nums text-xs">
                        <div>
                          <span className="text-slate-500">Repaid: </span>
                          <strong className="text-emerald-700">
                            {formatINR(repaid)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Remaining: </span>
                          <strong className="text-amber-700">
                            {formatINR(rem)}
                          </strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Complete Savings Transaction History for Member */}
          <div className="mt-7 pt-6 border-t border-slate-200">
            <h2 className="text-base font-bold text-slate-900">
              Complete Savings Transaction History ({memberSavingsTxns.length})
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                    <th className="py-2.5 px-3">Transaction ID</th>
                    <th className="py-2.5 px-3">Payment Date</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Allocated Date(s)</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 text-sm">
                  {memberSavingsTxns.map((txn) => (
                    <tr key={txn.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono tabular-nums text-xs text-slate-500">
                        {txn.id}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-xs text-slate-800">
                        {formatDateDDMMYYYY(txn.transactionDate)}
                      </td>
                      <td className="py-2.5 px-3 text-xs font-medium text-slate-700">
                        {txn.category}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-600 font-mono tabular-nums">
                        {txn.savingsAllocations && txn.savingsAllocations.length > 0
                          ? txn.savingsAllocations
                              .map(
                                (a) =>
                                  `${formatDateDDMMYYYY(a.targetDate)} (${formatINR(
                                    a.amount
                                  )})`
                              )
                              .join(', ')
                          : formatDateDDMMYYYY(txn.transactionDate)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-emerald-700">
                        {formatINR(txn.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default 7 Members Directory View
  return (
    <div className="space-y-6">
      <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-slate-200">
          <div>
            <div className="text-xs text-slate-500">
              7 Preconfigured Group Members · Rename Safe (Preserves All Ledger History)
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
              Group Members &amp; Individual Profiles
            </h1>
          </div>
        </div>

        {renameError && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
            {renameError}
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {state.members.map((member, idx) => {
            const bal = groupSummary.memberSavingsBalances.find(
              (b) => b.memberId === member.id
            );
            const todayStat = getMemberSavingsForDate(
              state,
              member.id,
              state.settings.currentReferenceDate
            );
            const isEditing = editingMemberId === member.id;

            return (
              <div
                key={member.id}
                data-testid={`member-card-${member.id}`}
                className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-slate-900 text-white font-mono tabular-nums text-xs font-bold flex items-center justify-center shrink-0">
                        0{idx + 1}
                      </div>
                      <div>
                        {isEditing ? (
                          <form
                            onSubmit={(e) => handleRenameSubmit(e, member.id)}
                            className="flex items-center gap-1.5"
                          >
                            <input
                              type="text"
                              aria-label={`New name for ${member.name}`}
                              value={editingNameValue}
                              onChange={(e) =>
                                setEditingNameValue(e.target.value)
                              }
                              className="w-36 px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-sm font-bold text-slate-900"
                              autoFocus
                            />
                            <button
                              type="submit"
                              aria-label="Save member name"
                              className="p-1.5 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 min-h-[36px] min-w-[36px] flex items-center justify-center"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingMemberId(null)}
                              aria-label="Cancel editing member name"
                              className="p-1.5 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 min-h-[36px] min-w-[36px] flex items-center justify-center"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </form>
                        ) : (
                          <div className="flex items-center gap-2">
                            <h2 className="text-base font-bold text-slate-900">
                              {member.name}
                            </h2>
                            <button
                              type="button"
                              onClick={() =>
                                startEditing(member.id, member.name)
                              }
                              aria-label={`Edit name for ${member.name}`}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        <div className="text-xs text-slate-500 mt-0.5">
                          Today ({formatDateDDMMYYYY(state.settings.currentReferenceDate)}):{' '}
                          {todayStat.status === 'Paid' && (
                            <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Paid
                            </span>
                          )}
                          {todayStat.status === 'Missed' && (
                            <span className="text-red-600 font-semibold inline-flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Missed
                            </span>
                          )}
                          {todayStat.status === 'Partially Paid' && (
                            <span className="text-amber-600 font-semibold inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Partial
                            </span>
                          )}
                          {todayStat.status === 'Advance' && (
                            <span className="text-blue-600 font-semibold inline-flex items-center gap-1">
                              <ArrowUpRight className="w-3 h-3" /> Advance
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Member Financial Breakdown */}
                  {bal && (
                    <div className="mt-4 pt-3.5 border-t border-slate-200/80 grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs">
                      <div>
                        <div className="text-slate-500">Total Saved</div>
                        <div className="font-mono tabular-nums font-bold text-sm text-emerald-700 mt-0.5">
                          {formatINR(bal.totalSaved)}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Pending Savings</div>
                        <div className="font-mono tabular-nums font-bold text-sm text-red-600 mt-0.5">
                          {formatINR(bal.outstandingSavingsAmount)}{' '}
                          <span className="text-[11px] font-normal text-slate-500">
                            ({bal.missedDaysCount}d missed)
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Loans Received</div>
                        <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                          {formatINR(bal.totalLoansTaken)}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Loan Balance</div>
                        <div className="font-mono tabular-nums font-semibold text-amber-800 mt-0.5">
                          {formatINR(bal.remainingLoanBalance)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-slate-200/80 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectMember(member.id)}
                    className="flex-1 py-2 px-3 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold transition-colors min-h-[40px]"
                  >
                    View Profile &amp; Statement
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenRecordSavings(
                        member.id,
                        state.settings.currentReferenceDate
                      )
                    }
                    className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors min-h-[40px]"
                  >
                    + Savings
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
