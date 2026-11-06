import React, { useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import {
  AppDatabaseState,
  addDaysISO,
  calculateGroupFinancialSummary,
  formatDateDDMMYYYY,
  formatINR,
  getDailyCollectionDashboard,
  getDatesInRange,
  getMemberSavingsForDate,
} from '../domain/ledgerEngine';
import {
  exportDatabaseBackupJSON,
  exportReportToPDF,
  exportTableToExcelCSV,
} from '../utils/exportUtils';

export type ReportType =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'member'
  | 'missed'
  | 'loan-repayment'
  | 'outstanding-loan'
  | 'group-statement';

interface ReportsViewProps {
  state: AppDatabaseState;
  onRestoreBackup: (jsonContent: string) => void;
  onResetToDefaultSeed: () => void;
  onDeleteTransaction: (transactionId: string) => void;
  onDeleteLoan: (loanId: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  state,
  onRestoreBackup,
  onDeleteTransaction,
  onDeleteLoan,
}) => {
  const [activeReport, setActiveReport] = useState<ReportType>('daily');
  const [reportDate, setReportDate] = useState<string>(
    state.settings.currentReferenceDate
  );
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    state.members[0]?.id || 'member-1'
  );
  const [backupMessage, setBackupMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const groupSummary = calculateGroupFinancialSummary(state);

  const reportTabs: Array<{ id: ReportType; label: string }> = [
    { id: 'daily', label: '1. Daily Collection' },
    { id: 'weekly', label: '2. Weekly Collection' },
    { id: 'monthly', label: '3. Monthly Collection' },
    { id: 'member', label: '4. Member Statement' },
    { id: 'missed', label: '5. Missed Payments' },
    { id: 'loan-repayment', label: '6. Loan Repayments' },
    { id: 'outstanding-loan', label: '7. Outstanding Loans' },
    { id: 'group-statement', label: '8. Complete Group Statement' },
  ];

  // Dynamically build report data (title, subtitle, summaryMetrics, headers, rows) matching transaction ledger
  const buildCurrentReportPayload = () => {
    if (activeReport === 'daily') {
      const daily = getDailyCollectionDashboard(state, reportDate);
      return {
        filename: `Daily_Collection_Report_${formatDateDDMMYYYY(reportDate)}`,
        title: `Daily Collection Report — ${formatDateDDMMYYYY(reportDate)}`,
        subtitle: `Expected Daily Group Collection: ${formatINR(daily.expectedCollection)} (${state.members.length} members × ${formatINR(state.settings.dailyContributionAmount)})`,
        metrics: [
          { label: 'Expected', value: formatINR(daily.expectedCollection) },
          { label: 'Collected', value: formatINR(daily.totalAllocatedForDate) },
          { label: 'Pending', value: formatINR(daily.totalPendingCollection) },
          { label: 'Paid Members', value: `${daily.paidCount} / ${state.members.length}` },
          { label: 'Missed Members', value: `${daily.missedCount} / ${state.members.length}` },
        ],
        headers: ['Member Name', 'Date (DD-MM-YYYY)', 'Status', 'Expected', 'Allocated', 'Pending'],
        rows: daily.memberStatuses.map((ms) => [
          ms.memberName,
          formatDateDDMMYYYY(ms.date),
          ms.status,
          formatINR(ms.expectedAmount),
          formatINR(ms.allocatedAmount),
          formatINR(ms.pendingAmount),
        ]),
      };
    }

    if (activeReport === 'weekly') {
      const startWeek = addDaysISO(reportDate, -6);
      const dates = getDatesInRange(startWeek, reportDate);
      let totalExpected = 0;
      let totalCollected = 0;
      let totalPending = 0;
      const rows = dates.map((d) => {
        const dStat = getDailyCollectionDashboard(state, d);
        totalExpected += dStat.expectedCollection;
        totalCollected += dStat.totalAllocatedForDate;
        totalPending += dStat.totalPendingCollection;
        return [
          formatDateDDMMYYYY(d),
          formatINR(dStat.expectedCollection),
          formatINR(dStat.totalAllocatedForDate),
          formatINR(dStat.totalPendingCollection),
          `${dStat.paidCount} Paid / ${dStat.missedCount} Missed`,
        ];
      });
      return {
        filename: `Weekly_Collection_Report_${formatDateDDMMYYYY(reportDate)}`,
        title: `Weekly Collection Report (${formatDateDDMMYYYY(startWeek)} to ${formatDateDDMMYYYY(reportDate)})`,
        subtitle: '7-Day Rolling Group Collection Summary',
        metrics: [
          { label: 'Weekly Expected', value: formatINR(totalExpected) },
          { label: 'Weekly Collected', value: formatINR(totalCollected) },
          { label: 'Weekly Pending', value: formatINR(totalPending) },
        ],
        headers: ['Date (DD-MM-YYYY)', 'Expected Collection', 'Collected', 'Pending', 'Attendance Summary'],
        rows,
      };
    }

    if (activeReport === 'monthly') {
      const yearMonth = reportDate.slice(0, 7); // YYYY-MM
      const allDates = getDatesInRange(
        state.settings.groupStartDate,
        state.settings.currentReferenceDate
      ).filter((d) => d.startsWith(yearMonth));

      const rows = state.members.map((m) => {
        let expected = 0;
        let collected = 0;
        let pending = 0;
        let missedDays = 0;
        for (const d of allDates) {
          const st = getMemberSavingsForDate(state, m.id, d);
          expected += st.expectedAmount;
          collected += st.allocatedAmount;
          pending += st.pendingAmount;
          if (st.status === 'Missed') missedDays++;
        }
        return [
          m.name,
          `${allDates.length} days`,
          formatINR(expected),
          formatINR(collected),
          formatINR(pending),
          `${missedDays} missed`,
        ];
      });

      return {
        filename: `Monthly_Collection_Report_${yearMonth}`,
        title: `Monthly Collection Report (${yearMonth})`,
        subtitle: `Member-wise savings collection for ${yearMonth} (${allDates.length} tracked days)`,
        metrics: [
          { label: 'Tracked Days in Month', value: String(allDates.length) },
          { label: 'Group Savings Pool', value: formatINR(groupSummary.totalSavingsCollected) },
        ],
        headers: ['Member Name', 'Tracked Days', 'Expected', 'Collected', 'Pending', 'Missed Days'],
        rows,
      };
    }

    if (activeReport === 'member') {
      const member =
        state.members.find((m) => m.id === selectedMemberId) || state.members[0];
      const bal = groupSummary.memberSavingsBalances.find(
        (b) => b.memberId === member.id
      );
      const txns = state.transactions.filter((t) => t.memberId === member.id);
      return {
        filename: `Individual_Statement_${member.name}`,
        title: `Individual Member Statement — ${member.name}`,
        subtitle: `Complete savings and loan ledger for ${member.name}`,
        metrics: [
          { label: 'Total Saved', value: formatINR(bal?.totalSaved || 0) },
          { label: 'Pending Savings', value: formatINR(bal?.outstandingSavingsAmount || 0) },
          { label: 'Loans Received', value: formatINR(bal?.totalLoansTaken || 0) },
          { label: 'Loan Repaid', value: formatINR(bal?.totalLoanRepaid || 0) },
          { label: 'Remaining Loan', value: formatINR(bal?.remainingLoanBalance || 0) },
        ],
        headers: ['Transaction ID', 'Date (DD-MM-YYYY)', 'Category', 'Amount', 'Description / Allocation'],
        rows: txns.map((t) => [
          t.id,
          formatDateDDMMYYYY(t.transactionDate),
          t.category,
          formatINR(t.amount),
          t.description || t.notes || '—',
        ]),
      };
    }

    if (activeReport === 'missed') {
      const allDates = getDatesInRange(
        state.settings.groupStartDate,
        state.settings.currentReferenceDate
      );
      const missedRows: (string | number)[][] = [];
      let totalMissedValue = 0;

      for (const d of allDates) {
        for (const m of state.members) {
          const st = getMemberSavingsForDate(state, m.id, d);
          if (st.pendingAmount > 0) {
            totalMissedValue += st.pendingAmount;
            missedRows.push([
              formatDateDDMMYYYY(d),
              m.name,
              st.status,
              formatINR(st.expectedAmount),
              formatINR(st.allocatedAmount),
              formatINR(st.pendingAmount),
            ]);
          }
        }
      }

      return {
        filename: `Missed_Payment_Report_${formatDateDDMMYYYY(state.settings.currentReferenceDate)}`,
        title: 'Missed & Pending Savings Payment Report',
        subtitle: `All unpaid and partially paid daily contributions from ${formatDateDDMMYYYY(state.settings.groupStartDate)} to ${formatDateDDMMYYYY(state.settings.currentReferenceDate)}`,
        metrics: [
          { label: 'Pending Entries', value: String(missedRows.length) },
          { label: 'Total Pending Amount', value: formatINR(totalMissedValue) },
        ],
        headers: ['Date (DD-MM-YYYY)', 'Member Name', 'Status', 'Expected', 'Paid', 'Pending Balance'],
        rows: missedRows,
      };
    }

    if (activeReport === 'loan-repayment') {
      const repaymentTxns = state.transactions.filter(
        (t) => t.category === 'Loan Repayment'
      );
      return {
        filename: `Loan_Repayment_Report_${formatDateDDMMYYYY(state.settings.currentReferenceDate)}`,
        title: 'Loan Repayment Report',
        subtitle: 'All weekly interest-free loan repayments received',
        metrics: [
          { label: 'Total Loan Repayments', value: formatINR(groupSummary.totalLoanPrincipalRepaid) },
          { label: 'Repayment Transactions', value: String(repaymentTxns.length) },
        ],
        headers: ['Transaction ID', 'Payment Date', 'Borrower', 'Loan ID', 'Amount Repaid', 'Instalment Details'],
        rows: repaymentTxns.map((t) => {
          const member = state.members.find((m) => m.id === t.memberId);
          return [
            t.id,
            formatDateDDMMYYYY(t.transactionDate),
            member?.name || t.memberId,
            t.loanId || '—',
            formatINR(t.amount),
            t.description || '—',
          ];
        }),
      };
    }

    if (activeReport === 'outstanding-loan') {
      const rows = state.loans.map((loan) => {
        const borrower = state.members.find((m) => m.id === loan.borrowerId);
        const repaid = loan.instalments.reduce((s, i) => s + i.amountPaid, 0);
        const rem = Math.max(0, loan.principalAmount - repaid);
        const overdueInst = loan.instalments.filter((i) => i.isOverdue).length;
        return [
          loan.id,
          borrower?.name || loan.borrowerId,
          formatDateDDMMYYYY(loan.issueDate),
          formatINR(loan.principalAmount),
          formatINR(repaid),
          formatINR(rem),
          overdueInst > 0 ? `${overdueInst} Overdue` : 'On Schedule',
        ];
      });

      return {
        filename: `Outstanding_Loans_Report_${formatDateDDMMYYYY(state.settings.currentReferenceDate)}`,
        title: 'Outstanding Emergency Loan Report',
        subtitle: '10-week interest-free loans principal and outstanding balances',
        metrics: [
          { label: 'Total Issued', value: formatINR(groupSummary.totalLoansIssued) },
          { label: 'Total Repaid', value: formatINR(groupSummary.totalLoanPrincipalRepaid) },
          { label: 'Total Outstanding Principal', value: formatINR(groupSummary.totalOutstandingLoanPrincipal) },
        ],
        headers: ['Loan ID', 'Borrower', 'Issue Date', 'Principal (0%)', 'Repaid', 'Outstanding Balance', 'Schedule Status'],
        rows,
      };
    }

    // Default: Complete Group Financial Statement
    return {
      filename: `Complete_Group_Financial_Statement_${formatDateDDMMYYYY(state.settings.currentReferenceDate)}`,
      title: 'Complete Group Financial Statement & Transaction Ledger',
      subtitle: `Available Group Cash = Actual Savings (${formatINR(groupSummary.totalSavingsCollected)}) + Loan Repayments (${formatINR(groupSummary.totalLoanPrincipalRepaid)}) - Loans Issued (${formatINR(groupSummary.totalLoansIssued)}) = ${formatINR(groupSummary.availableGroupCash)}`,
      metrics: [
        { label: 'Savings Collected', value: formatINR(groupSummary.totalSavingsCollected) },
        { label: 'Loans Issued', value: formatINR(groupSummary.totalLoansIssued) },
        { label: 'Loan Principal Repaid', value: formatINR(groupSummary.totalLoanPrincipalRepaid) },
        { label: 'Outstanding Loans', value: formatINR(groupSummary.totalOutstandingLoanPrincipal) },
        { label: 'Available Group Cash', value: formatINR(groupSummary.availableGroupCash) },
      ],
      headers: ['Txn ID', 'Date (DD-MM-YYYY)', 'Member', 'Category', 'Amount', 'Description / Notes'],
      rows: state.transactions.map((t) => {
        const member = state.members.find((m) => m.id === t.memberId);
        return [
          t.id,
          formatDateDDMMYYYY(t.transactionDate),
          member?.name || t.memberId,
          t.category,
          formatINR(t.amount),
          t.description || t.notes || '—',
        ];
      }),
    };
  };

  const currentReport = buildCurrentReportPayload();

  const handleFileUploadRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const content = String(reader.result || '');
        onRestoreBackup(content);
        setBackupMessage({
          type: 'success',
          text: `Backup restored successfully from ${file.name}. All transactions and member records verified.`,
        });
      } catch (err) {
        setBackupMessage({
          type: 'error',
          text: (err as Error).message,
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-8">
      {/* SECTION 1: 8 COMPREHENSIVE REPORTS & PDF/EXCEL EXPORT */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <div className="text-xs text-slate-500">
              Reconciled with Transaction Ledger · PDF &amp; Excel (.CSV) Export
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
              Financial Reports &amp; Statements
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                exportReportToPDF(
                  currentReport.filename,
                  currentReport.title,
                  currentReport.subtitle,
                  currentReport.metrics,
                  currentReport.headers,
                  currentReport.rows
                )
              }
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 min-h-[44px]"
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Export PDF</span>
            </button>

            <button
              type="button"
              onClick={() =>
                exportTableToExcelCSV(
                  currentReport.filename,
                  currentReport.title,
                  currentReport.headers,
                  currentReport.rows
                )
              }
              className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 min-h-[44px]"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel (.CSV)</span>
            </button>
          </div>
        </div>

        {/* 8 Report Selector Tabs */}
        <div className="mt-4 flex flex-wrap gap-1.5 bg-slate-100 p-1.5 rounded-xl">
          {reportTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveReport(tab.id)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                activeReport === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Contextual Filter Controls for Daily/Weekly/Monthly/Member Reports */}
        {(activeReport === 'daily' ||
          activeReport === 'weekly' ||
          activeReport === 'monthly' ||
          activeReport === 'member') && (
          <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-4">
            {activeReport !== 'member' && (
              <div className="flex items-center gap-2">
                <label
                  htmlFor="report-date-picker"
                  className="text-xs font-semibold text-slate-700"
                >
                  Reference Date ({formatDateDDMMYYYY(reportDate)}):
                </label>
                <input
                  id="report-date-picker"
                  type="date"
                  value={reportDate}
                  onChange={(e) => {
                    if (e.target.value) setReportDate(e.target.value);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono tabular-nums text-xs"
                />
              </div>
            )}

            {activeReport === 'member' && (
              <div className="flex items-center gap-2">
                <label
                  htmlFor="report-member-select"
                  className="text-xs font-semibold text-slate-700"
                >
                  Select Member:
                </label>
                <select
                  id="report-member-select"
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                >
                  {state.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Active Report Header & Summary Metrics */}
        <div className="mt-5">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            {currentReport.title}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {currentReport.subtitle}
          </p>

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {currentReport.metrics.map((m, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200"
              >
                <div className="text-xs text-slate-500">{m.label}</div>
                <div className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Report Data Table */}
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                {currentReport.headers.map((h, i) => (
                  <th key={i} className="py-3 px-3">
                    {h}
                  </th>
                ))}
                {(activeReport === 'member' ||
                  activeReport === 'loan-repayment' ||
                  activeReport === 'outstanding-loan' ||
                  activeReport === 'group-statement') && (
                  <th className="py-3 px-3 text-right">Action</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 text-xs sm:text-sm">
              {currentReport.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={currentReport.headers.length + 1}
                    className="py-8 text-center text-slate-500"
                  >
                    No matching records for this report period.
                  </td>
                </tr>
              ) : (
                currentReport.rows.slice(0, 80).map((row, rIdx) => {
                  const firstCell = String(row[0] || '');
                  const isTxnRow = firstCell.startsWith('TXN-');
                  const isLoanRow = firstCell.startsWith('LOAN-');

                  return (
                    <tr key={rIdx} className="hover:bg-slate-50">
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className="py-2.5 px-3 font-mono tabular-nums text-slate-800"
                        >
                          {cell}
                        </td>
                      ))}
                      {(isTxnRow || isLoanRow) && (
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              if (isTxnRow) onDeleteTransaction(firstCell);
                              if (isLoanRow) onDeleteLoan(firstCell);
                            }}
                            className="px-2.5 py-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold inline-flex items-center gap-1 min-h-[30px]"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 2: DATA SAFETY, OFFLINE BACKUP & RESTORE */}
      <section
        aria-labelledby="backup-restore-heading"
        className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6"
      >
        <div className="pb-4 border-b border-slate-200">
          <div className="text-xs text-slate-500">
            Offline-First Persistence · Complete Backup &amp; Restore
          </div>
          <h2
            id="backup-restore-heading"
            className="text-lg font-bold text-slate-900 mt-0.5"
          >
            Data Safety, Backup &amp; Restore
          </h2>
        </div>

        {backupMessage && (
          <div
            className={`mt-4 p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
              backupMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {backupMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            )}
            <span>{backupMessage.text}</span>
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Full JSON Backup */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                1. Export Complete Database Backup
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Downloads a complete JSON snapshot containing all 7 members,{' '}
                {state.transactions.length} transactions, audit trails, and{' '}
                {state.loans.length} loans.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                exportDatabaseBackupJSON(state);
                setBackupMessage({
                  type: 'success',
                  text: 'Database backup file downloaded successfully.',
                });
              }}
              className="mt-4 w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 min-h-[42px]"
            >
              <Download className="w-4 h-4" />
              <span>Download Backup (.JSON)</span>
            </button>
          </div>

          {/* Card 2: Restore Backup */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                2. Restore from Backup File
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Select a previously exported JSON backup file to restore all
                member balances, savings records, and loan schedules.
              </p>
            </div>
            <label className="mt-4 w-full py-2.5 px-4 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold inline-flex items-center justify-center gap-2 min-h-[42px] cursor-pointer">
              <Upload className="w-4 h-4 text-emerald-700" />
              <span>Restore Backup (.JSON)</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileUploadRestore}
                className="sr-only"
              />
            </label>
          </div>
        </div>
      </section>
    </div>
  );
};
