/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  PiggyBank,
  HandCoins,
  FileBarChart2,
  CheckCircle2,
  PlusCircle,
} from 'lucide-react';
import {
  AppDatabaseState,
  DailyRegisterEntryInput,
  deleteLoan,
  deleteMemberDailySavingsOnDate,
  deleteTransaction,
  formatDateDDMMYYYY,
  formatINR,
  issueEmergencyLoan,
  recordLoanRepayment,
  renameMember,
  saveDailyCollectionBatch,
} from './domain/ledgerEngine';
import {
  createSeedDatabaseState,
  loadDatabaseState,
  saveDatabaseState,
  validateAndParseBackup,
} from './domain/storage';
import {
  ExportDocumentPayload,
  subscribeToExports,
} from './utils/exportUtils';
import { DashboardView } from './components/DashboardView';
import { MembersView } from './components/MembersView';
import { SavingsView } from './components/SavingsView';
import { LoansView } from './components/LoansView';
import { ReportsView } from './components/ReportsView';
import { RecordSavingsModal } from './components/RecordSavingsModal';
import { ExportPreviewModal } from './components/ExportPreviewModal';

export type NavTab = 'dashboard' | 'members' | 'savings' | 'loans' | 'reports';

export default function App() {
  const [state, setState] = useState<AppDatabaseState>(() =>
    loadDatabaseState()
  );
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [selectedDate, setSelectedDate] = useState<string>(
    state.settings.currentReferenceDate
  );
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Record Daily Collection Register Modal State
  const [savingsModalOpen, setSavingsModalOpen] = useState(false);
  const [savingsModalMemberId, setSavingsModalMemberId] = useState<
    string | undefined
  >(undefined);
  const [savingsModalDateISO, setSavingsModalDateISO] = useState<
    string | undefined
  >(undefined);

  // Export & Share Modal State (ensures PDF/CSV/JSON exports always work in Android APK WebViews & Browsers)
  const [exportPayload, setExportPayload] =
    useState<ExportDocumentPayload | null>(null);

  // Feedback banner for completed financial actions
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    saveDatabaseState(state);
  }, [state]);

  useEffect(() => {
    return subscribeToExports((payload) => {
      setExportPayload(payload);
    });
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  const handleOpenRecordSavings = (memberId?: string, dateISO?: string) => {
    setSavingsModalMemberId(memberId);
    setSavingsModalDateISO(dateISO || selectedDate);
    setSavingsModalOpen(true);
  };

  const handleSaveCollectionBatch = (params: {
    paymentDateISO: string;
    entries: DailyRegisterEntryInput[];
  }) => {
    const { nextState } = saveDailyCollectionBatch(state, params);
    setState(nextState);
    setSelectedDate(params.paymentDateISO);
    const paidEntries = params.entries.filter(
      (e) => e.paid && e.amount > 0
    );
    const totalCollected = paidEntries.reduce((s, e) => s + e.amount, 0);
    showToast(
      `Saved daily collection for ${formatDateDDMMYYYY(
        params.paymentDateISO
      )} — ${paidEntries.length} / ${
        state.members.length
      } members paid (${formatINR(totalCollected)}).`
    );
  };

  const handleDeleteTransaction = (transactionId: string) => {
    const target = state.transactions.find((t) => t.id === transactionId);
    const next = deleteTransaction(state, transactionId);
    setState(next);
    if (target) {
      const member = state.members.find((m) => m.id === target.memberId);
      showToast(
        `Deleted ${target.category} entry of ${formatINR(target.amount)}${
          member ? ` for ${member.name}` : ''
        }. Balances recalculated.`
      );
    } else {
      showToast('Deleted payment entry. Balances recalculated.');
    }
  };

  const handleDeleteLoan = (loanId: string) => {
    const targetLoan = state.loans.find((l) => l.id === loanId);
    const next = deleteLoan(state, loanId);
    setState(next);
    if (targetLoan) {
      const borrower = state.members.find(
        (m) => m.id === targetLoan.borrowerId
      );
      showToast(
        `Deleted ${formatINR(targetLoan.principalAmount)} loan${
          borrower ? ` for ${borrower.name}` : ''
        }. Available cash and balances updated.`
      );
    } else {
      showToast('Deleted loan entry. Available cash updated.');
    }
  };

  const handleDeleteMemberSavingsOnDate = (
    memberId: string,
    dateISO: string
  ) => {
    const member = state.members.find((m) => m.id === memberId);
    const next = deleteMemberDailySavingsOnDate(state, memberId, dateISO);
    setState(next);
    showToast(
      `Deleted savings payment for ${
        member?.name || 'Member'
      } on ${formatDateDDMMYYYY(dateISO)}.`
    );
  };

  const handleRenameMember = (memberId: string, newName: string) => {
    const next = renameMember(state, memberId, newName);
    setState(next);
    showToast(
      `Member renamed to "${newName.trim()}". All historical transactions preserved.`
    );
  };

  const handleUpdateDailyContribution = (newAmount: number) => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        dailyContributionAmount: newAmount,
      },
      lastUpdated: new Date().toISOString(),
    }));
    showToast(
      `Expected daily contribution updated to ${formatINR(
        newAmount
      )} per member.`
    );
  };

  const handleIssueLoan = (params: {
    borrowerId: string;
    principalAmount: number;
    issueDateISO: string;
    firstInstalmentDateISO: string;
    repaymentDurationWeeks: number;
    purpose?: string;
    allowExceedAvailableCash?: boolean;
  }) => {
    const next = issueEmergencyLoan(state, params);
    setState(next);
    const borrower = state.members.find((m) => m.id === params.borrowerId);
    showToast(
      `Issued ${formatINR(params.principalAmount)} interest-free loan to ${
        borrower?.name || 'Member'
      } (${params.repaymentDurationWeeks} weekly instalments generated).`
    );
  };

  const handleRecordLoanRepayment = (params: {
    loanId: string;
    paymentAmount: number;
    paymentDateISO: string;
    notes?: string;
  }) => {
    const next = recordLoanRepayment(state, params);
    setState(next);
    showToast(
      `Recorded ${formatINR(params.paymentAmount)} loan repayment on ${formatDateDDMMYYYY(
        params.paymentDateISO
      )}.`
    );
  };

  const handleRestoreBackup = (jsonContent: string) => {
    const restored = validateAndParseBackup(jsonContent);
    setState(restored);
    setSelectedDate(restored.settings.currentReferenceDate);
  };

  const handleResetToDefaultSeed = () => {
    const fresh = createSeedDatabaseState();
    setState(fresh);
    setSelectedDate(fresh.settings.currentReferenceDate);
    setSelectedMemberId(null);
  };

  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'savings', label: 'Savings', icon: PiggyBank },
    { id: 'loans', label: 'Loans', icon: HandCoins },
    { id: 'reports', label: 'Reports', icon: FileBarChart2 },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col pb-20 md:pb-10">
      {/* STRICT 3-ZONE TOP BAR CONTRACT */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-8">
        {/* Zone 1: Custom App Icon + Brand Wordmark */}
        <a
          href="#dashboard"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('dashboard');
            setSelectedMemberId(null);
          }}
          className="inline-flex items-center gap-2.5 text-sm sm:text-lg font-bold tracking-tight text-slate-900 truncate"
        >
          <img
            src="/app-icon.png"
            alt=""
            className="w-8 h-8 rounded-lg object-cover shrink-0 shadow-2xs"
          />
          <span className="truncate">Friends Savings &amp; Loan Manager</span>
        </a>

        {/* Zone 2: 5 clean single-line text navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  if (item.id !== 'members') {
                    setSelectedMemberId(null);
                  }
                }}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                  isActive
                    ? 'text-slate-900 font-semibold border-emerald-600'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action (Record Collection) */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => handleOpenRecordSavings(undefined, selectedDate)}
            className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 min-h-[38px]"
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span>Record Collection</span>
          </button>
        </div>
      </header>

      {/* NON-INTRUSIVE ACTION CONFIRMATION TOAST */}
      {toastMessage && (
        <div
          role="status"
          className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-4"
        >
          <div className="p-3 rounded-xl bg-emerald-900 text-white text-xs sm:text-sm font-medium flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-xs text-emerald-200 hover:text-white font-semibold"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT VIEWPORT */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            state={state}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onOpenRecordSavings={handleOpenRecordSavings}
            onOpenMemberProfile={(memberId) => {
              setSelectedMemberId(memberId);
              setActiveTab('members');
            }}
            onNavigateTab={setActiveTab}
            onUpdateDailyContribution={handleUpdateDailyContribution}
            onDeleteMemberSavingsOnDate={handleDeleteMemberSavingsOnDate}
          />
        )}

        {activeTab === 'members' && (
          <MembersView
            state={state}
            selectedMemberId={selectedMemberId}
            onSelectMember={setSelectedMemberId}
            onRenameMember={handleRenameMember}
            onOpenRecordSavings={handleOpenRecordSavings}
            onDeleteTransaction={handleDeleteTransaction}
          />
        )}

        {activeTab === 'savings' && (
          <SavingsView
            state={state}
            onOpenRecordSavings={handleOpenRecordSavings}
            onDeleteMemberSavingsOnDate={handleDeleteMemberSavingsOnDate}
          />
        )}

        {activeTab === 'loans' && (
          <LoansView
            state={state}
            onIssueLoan={handleIssueLoan}
            onRecordRepayment={handleRecordLoanRepayment}
            onDeleteLoan={handleDeleteLoan}
            onDeleteTransaction={handleDeleteTransaction}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            state={state}
            onRestoreBackup={handleRestoreBackup}
            onResetToDefaultSeed={handleResetToDefaultSeed}
            onDeleteTransaction={handleDeleteTransaction}
            onDeleteLoan={handleDeleteLoan}
          />
        )}
      </main>

      {/* BOTTOM NAVIGATION BAR (5 REQUIRED DESTINATIONS: Dashboard, Members, Savings, Loans, Reports) */}
      <nav
        aria-label="Bottom navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 h-16 px-2"
      >
        <div className="max-w-lg mx-auto h-full grid grid-cols-5 items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  if (item.id !== 'members') {
                    setSelectedMemberId(null);
                  }
                }}
                aria-current={isActive ? 'page' : undefined}
                className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors ${
                  isActive
                    ? 'text-emerald-700 font-bold'
                    : 'text-slate-500 hover:text-slate-900 font-medium'
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${
                    isActive ? 'text-emerald-700' : 'text-slate-500'
                  }`}
                />
                <span className="text-[11px] tracking-tight mt-1 whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* DAILY COLLECTION REGISTER MODAL */}
      {savingsModalOpen && (
        <RecordSavingsModal
          state={state}
          initialMemberId={savingsModalMemberId}
          initialDateISO={savingsModalDateISO}
          onClose={() => setSavingsModalOpen(false)}
          onSaveCollectionBatch={handleSaveCollectionBatch}
        />
      )}

      {/* EXPORT & SHARE MODAL (Android WebView + Desktop PDF/CSV/JSON Support) */}
      {exportPayload && (
        <ExportPreviewModal
          payload={exportPayload}
          onClose={() => setExportPayload(null)}
        />
      )}
    </div>
  );
}
