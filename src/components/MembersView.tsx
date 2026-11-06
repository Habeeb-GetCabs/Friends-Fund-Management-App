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
  XCircle,
  Trash2,
} from 'lucide-react';
import {
  AppDatabaseState,
  calculateGroupFinancialSummary,
  formatDateDDMMYYYY,
  formatINR,
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
  onDeleteTransaction: (transactionId: string) => void;
}

export const MembersView: React.FC<MembersViewProps> = ({
  state,
  selectedMemberId,
  onSelectMember,
  onRenameMember,
  onOpenRecordSavings,
  onDeleteTransaction,
}) => {
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

  const groupSummary = calculateGroupFinancialSummary(state);
  const activeMember =
    state.members.find((m) => m.id === selectedMemberId) || null;
  const activeBalance = groupSummary.memberSavingsBalances.find(
    (b) => b.memberId === selectedMemberId
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
      `Member_Statement_${member.name}_${formatDateDDMMYYYY(
        state.settings.currentReferenceDate
      )}.pdf`,
      `Individual Financial Statement — ${member.name}`,
      `Date: ${formatDateDDMMYYYY(state.settings.currentReferenceDate)}`,
      [
        { label: 'Total Savings', value: formatINR(bal.totalSaved) },
        { label: 'Loans Received', value: formatINR(bal.totalLoansTaken) },
        { label: 'Loan Repaid', value: formatINR(bal.totalLoanRepaid) },
        { label: 'Outstanding Loan', value: formatINR(bal.remainingLoanBalance) },
      ],
      ['Date (DD-MM-YYYY)', 'Category', 'Amount', 'Details'],
      memberTxns.map((t) => [
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
      ['Date (DD-MM-YYYY)', 'Category', 'Amount (INR)', 'Description', 'Notes'],
      memberTxns.map((t) => [
        formatDateDDMMYYYY(t.transactionDate),
        t.category,
        t.amount,
        t.description || '',
        t.notes || '',
      ])
    );
  };

  // Detailed Single Member View (Transaction History & Financial Statement)
  if (activeMember && activeBalance) {
    const todayStat = getMemberSavingsForDate(
      state,
      activeMember.id,
      state.settings.currentReferenceDate
    );
    const isPaidToday =
      todayStat.cashPaidOnDate > 0 || todayStat.allocatedAmount > 0;
    const memberTxns = state.transactions.filter(
      (t) => t.memberId === activeMember.id
    );

    return (
      <div className="space-y-6">
        <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onSelectMember(null)}
                aria-label="Back to members list"
                className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                {editingMemberId === activeMember.id ? (
                  <form
                    onSubmit={(e) => handleRenameSubmit(e, activeMember.id)}
                    className="flex items-center gap-2"
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
                      Save
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
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-slate-900">
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
                <div className="text-xs text-slate-500 mt-0.5">
                  Current Status ({formatDateDDMMYYYY(state.settings.currentReferenceDate)}):{' '}
                  {isPaidToday ? (
                    <span className="text-emerald-700 font-semibold">Paid</span>
                  ) : (
                    <span className="text-red-600 font-semibold">Not Paid</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => exportMemberStatementPDF(activeMember.id)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold inline-flex items-center gap-1.5 min-h-[42px]"
              >
                <FileText className="w-4 h-4 text-slate-600" />
                <span>Statement PDF</span>
              </button>
              <button
                type="button"
                onClick={() => exportMemberStatementExcel(activeMember.id)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold inline-flex items-center gap-1.5 min-h-[42px]"
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
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 min-h-[42px]"
              >
                <Plus className="w-4 h-4" />
                <span>Record Savings</span>
              </button>
            </div>
          </div>

          {/* 4 Simple Member Financial Metrics */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500">Total Savings</div>
              <div className="text-xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                {formatINR(activeBalance.totalSaved)}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500">Total Loans Received</div>
              <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {formatINR(activeBalance.totalLoansTaken)}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500">Loan Repaid</div>
              <div className="text-xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                {formatINR(activeBalance.totalLoanRepaid)}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500">
                Outstanding Loan Balance
              </div>
              <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {formatINR(activeBalance.remainingLoanBalance)}
              </div>
            </div>
          </div>

          {/* Member Transaction History */}
          <div className="mt-6">
            <h2 className="text-base font-bold text-slate-900 mb-3">
              Transaction History ({memberTxns.length})
            </h2>
            {memberTxns.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                No transactions recorded for {activeMember.name} yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Details</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 text-sm">
                    {memberTxns.map((txn) => (
                      <tr key={txn.id} className="hover:bg-slate-50">
                        <td className="py-3 px-3 font-mono tabular-nums text-xs text-slate-800">
                          {formatDateDDMMYYYY(txn.transactionDate)}
                        </td>
                        <td className="py-3 px-3 text-xs font-semibold text-slate-700">
                          {txn.category}
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-600">
                          {txn.description || txn.notes || '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                          {formatINR(txn.amount)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => onDeleteTransaction(txn.id)}
                            aria-label={`Delete ${txn.category} transaction of ${formatINR(txn.amount)}`}
                            className="px-2.5 py-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold inline-flex items-center gap-1 min-h-[32px]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  // Simplified 7 Members List View
  return (
    <div className="space-y-6">
      <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs">
        <div className="pb-4 border-b border-slate-200">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">
            Members ({state.members.length})
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Select a member to view transaction history, financial statement, or edit name
          </p>
        </div>

        {renameError && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
            {renameError}
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {state.members.map((member, idx) => {
            const bal = groupSummary.memberSavingsBalances.find(
              (b) => b.memberId === member.id
            );
            const todayStat = getMemberSavingsForDate(
              state,
              member.id,
              state.settings.currentReferenceDate
            );
            const isPaidToday =
              todayStat.cashPaidOnDate > 0 || todayStat.allocatedAmount > 0;
            const isEditing = editingMemberId === member.id;

            return (
              <div
                key={member.id}
                data-testid={`member-card-${member.id}`}
                className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono tabular-nums text-xs text-slate-400">
                        {idx + 1}.
                      </span>
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
                    </div>

                    {/* Current Payment Status */}
                    <div>
                      {isPaidToday ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Paid Today</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
                          <XCircle className="w-3.5 h-3.5 text-red-500" />
                          <span>Not Paid</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Required 3 Financial Figures per Member Card */}
                  {bal && (
                    <div className="mt-4 pt-3.5 border-t border-slate-100 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-slate-500">Total Savings</div>
                        <div className="font-mono tabular-nums font-bold text-sm text-emerald-700 mt-0.5">
                          {formatINR(bal.totalSaved)}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Loans Received</div>
                        <div className="font-mono tabular-nums font-bold text-sm text-slate-900 mt-0.5">
                          {formatINR(bal.totalLoansTaken)}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Loan Balance</div>
                        <div className="font-mono tabular-nums font-bold text-sm text-slate-900 mt-0.5">
                          {formatINR(bal.remainingLoanBalance)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Member Card Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectMember(member.id)}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs font-semibold transition-colors min-h-[40px]"
                  >
                    History &amp; Statement
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenRecordSavings(
                        member.id,
                        state.settings.currentReferenceDate
                      )
                    }
                    className="py-2 px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors min-h-[40px]"
                  >
                    Record Savings
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
