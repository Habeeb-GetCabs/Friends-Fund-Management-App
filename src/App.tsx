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
} from 'lucide-react';
import {
  AppDatabaseState,
  InstalmentAllocation,
  SavingsAllocation,
  editSavingsTransactionWithAudit,
  formatDateDDMMYYYY,
  formatINR,
  issueEmergencyLoan,
  recordDailySavingsTransaction,
  recordLoanRepayment,
  renameMember,
} from './domain/ledgerEngine';
import {
  createSeedDatabaseState,
  loadDatabaseState,
  saveDatabaseState,
  validateAndParseBackup,
} from './domain/storage';
import { DashboardView } from './components/DashboardView';
import { MembersView } from './components/MembersView';
import { SavingsView } from './components/SavingsView';
import { LoansView } from './components/LoansView';
import { ReportsView } from './components/ReportsView';
import { RecordSavingsModal } from './components/RecordSavingsModal';
import { PWAInstallButton } from './components/PWAInstallButton';

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

  // Record Savings Modal State
  const [savingsModalOpen, setSavingsModalOpen] = useState(false);
  const [savingsModalMemberId, setSavingsModalMemberId] = useState<
    string | undefined
  >(undefined);
  const [savingsModalDateISO, setSavingsModalDateISO] = useState<
    string | undefined
  >(undefined);

  // Feedback banner for completed financial actions
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    saveDatabaseState(state);
  }, [state]);

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

  const handleRecordSavingsSubmit = (params: {
    memberId: string;
    amount: number;
    transactionDate: string;
    allocations: SavingsAllocation[];
    description?: string;
    notes?: string;
  }) => {
    const next = recordDailySavingsTransaction(state, params);
    setState(next);
    const member = state.members.find((m) => m.id === params.memberId);
    showToast(
      `Saved ${formatINR(params.amount)} contribution for ${
        member?.name || 'Member'
      } (${params.allocations
        .map((a) => formatDateDDMMYYYY(a.targetDate))
        .join(', ')}).`
    );
  };

  const handleRenameMember = (memberId: string, newName: string) => {
    const next = renameMember(state, memberId, newName);
    setState(next);
    showToast(`Member renamed to "${newName.trim()}". All historical transactions preserved.`);
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
      `Daily contribution rate updated to ${formatINR(
        newAmount
      )} per member (Expected daily group total: ${formatINR(
        newAmount * state.members.length
      )}).`
    );
  };

  const handleCorrectSavingsTransaction = (params: {
    transactionId: string;
    correctedAmount: number;
    correctedAllocations: SavingsAllocation[];
    reason: string;
  }) => {
    const next = editSavingsTransactionWithAudit(state, params);
    setState(next);
    showToast(
      `Audited correction saved for ${params.transactionId} (${formatINR(
        params.correctedAmount
      )}).`
    );
  };

  const handleIssueLoan = (params: {
    borrowerId: string;
    principalAmount: number;
    issueDateISO: string;
    firstInstalmentDateISO: string;
    purpose?: string;
    notes?: string;
    allowExceedAvailableCash?: boolean;
  }) => {
    const next = issueEmergencyLoan(state, params);
    setState(next);
    const borrower = state.members.find((m) => m.id === params.borrowerId);
    showToast(
      `Issued ${formatINR(params.principalAmount)} interest-free loan to ${
        borrower?.name || 'Member'
      } (10 weekly instalments generated).`
    );
  };

  const handleRecordLoanRepayment = (params: {
    loanId: string;
    paymentAmount: number;
    paymentDateISO: string;
    instalmentAllocations: InstalmentAllocation[];
    notes?: string;
  }) => {
    const next = recordLoanRepayment(state, params);
    setState(next);
    showToast(
      `Recorded ${formatINR(params.paymentAmount)} weekly loan repayment.`
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
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#dashboard"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('dashboard');
            setSelectedMemberId(null);
          }}
          className="text-sm sm:text-lg font-bold tracking-tight text-slate-900 truncate"
        >
          Friends Savings &amp; Loan Manager
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

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <PWAInstallButton state={state} />
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
          />
        )}

        {activeTab === 'members' && (
          <MembersView
            state={state}
            selectedMemberId={selectedMemberId}
            onSelectMember={setSelectedMemberId}
            onRenameMember={handleRenameMember}
            onOpenRecordSavings={handleOpenRecordSavings}
          />
        )}

        {activeTab === 'savings' && (
          <SavingsView
            state={state}
            onOpenRecordSavings={handleOpenRecordSavings}
            onCorrectSavingsTransaction={handleCorrectSavingsTransaction}
          />
        )}

        {activeTab === 'loans' && (
          <LoansView
            state={state}
            onIssueLoan={handleIssueLoan}
            onRecordRepayment={handleRecordLoanRepayment}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            state={state}
            onRestoreBackup={handleRestoreBackup}
            onResetToDefaultSeed={handleResetToDefaultSeed}
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

      {/* RECORD DAILY SAVINGS MODAL */}
      {savingsModalOpen && (
        <RecordSavingsModal
          state={state}
          initialMemberId={savingsModalMemberId}
          initialDateISO={savingsModalDateISO}
          onClose={() => setSavingsModalOpen(false)}
          onSubmitSavings={handleRecordSavingsSubmit}
        />
      )}
    </div>
  );
}
