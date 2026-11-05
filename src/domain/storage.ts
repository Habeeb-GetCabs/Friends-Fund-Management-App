import {
  AppDatabaseState,
  createDefaultMembers,
  DEFAULT_DAILY_CONTRIBUTION,
  FinancialTransaction,
  EmergencyLoan,
  recomputeLoanState,
} from './ledgerEngine';

const STORAGE_KEY = 'friends_savings_loan_db_v1';
const IDB_NAME = 'FriendsSavingsOfflineRoomDB';
const IDB_STORE = 'ledger_state';

/**
 * Creates deterministic, realistic initial state for the 7 default friends
 * covering 01-11-2026 through 05-11-2026 so every status (Paid, Missed, Partially Paid, Advance)
 * and 10-week interest-free loans (₹5,000 and ₹10,000) are immediately live and verifiable.
 */
export function createSeedDatabaseState(): AppDatabaseState {
  const startDate = '2026-10-08';
  const currentRefDate = '2026-11-05';
  const members = createDefaultMembers(startDate);

  // Members:
  // 0: Sathish (member-1)
  // 1: Kumar (member-2)
  // 2: Santhosh (member-3)
  // 3: Prakash (member-4)
  // 4: Ranjth (member-5)
  // 5: Basheer (member-6)
  // 6: Mahalakshmi (member-7)

  const transactions: FinancialTransaction[] = [];

  // 1. Seed base savings pool from 08-10-2026 to 31-10-2026 (24 days × ₹700 = ₹16,800) so Available Group Cash is positive (₹8,100)
  const priorDays = [
    '2026-10-08',
    '2026-10-09',
    '2026-10-10',
    '2026-10-11',
    '2026-10-12',
    '2026-10-13',
    '2026-10-14',
    '2026-10-15',
    '2026-10-16',
    '2026-10-17',
    '2026-10-18',
    '2026-10-19',
    '2026-10-20',
    '2026-10-21',
    '2026-10-22',
    '2026-10-23',
    '2026-10-24',
    '2026-10-25',
    '2026-10-26',
    '2026-10-27',
    '2026-10-28',
    '2026-10-29',
    '2026-10-30',
    '2026-10-31',
  ];

  for (const m of members) {
    for (const d of priorDays) {
      transactions.push({
        id: `TXN-SAV-${m.id}-${d}`,
        memberId: m.id,
        category: 'Daily Savings',
        amount: 100,
        transactionDate: d,
        createdAt: `${d}T09:00:00.000Z`,
        description: `Daily savings contribution`,
        notes: 'Regular daily collection',
        savingsAllocations: [{ targetDate: d, amount: 100 }],
        auditTrail: [],
      });
    }
  }

  // 2. November 1 to November 4 (2026-11-01 to 2026-11-04)
  const novDates = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'];
  for (const d of novDates) {
    for (const m of members) {
      // Let Prakash miss 2026-11-04 and Ranjth miss 2026-11-03 & 2026-11-04 so missed dates exist for allocation testing
      if (m.id === 'member-4' && d === '2026-11-04') continue;
      if (m.id === 'member-5' && (d === '2026-11-03' || d === '2026-11-04')) continue;

      transactions.push({
        id: `TXN-SAV-${m.id}-${d}`,
        memberId: m.id,
        category: 'Daily Savings',
        amount: 100,
        transactionDate: d,
        createdAt: `${d}T09:30:00.000Z`,
        description: `Daily savings contribution`,
        notes: '',
        savingsAllocations: [{ targetDate: d, amount: 100 }],
        auditTrail: [],
      });
    }
  }

  // 3. Today's Collection (2026-11-05) showcasing all 4 statuses clearly:
  // - Sathish (member-1): Paid ₹100 (Green: Paid)
  // - Kumar (member-2): Paid ₹100 (Green: Paid)
  // - Santhosh (member-3): Paid ₹50 partial (Orange: Partially Paid)
  // - Prakash (member-4): Missed today (Red: Missed)
  // - Ranjth (member-5): Missed today (Red: Missed)
  // - Basheer (member-6): Paid ₹200 Advance covering 05-11-2026 (₹100) and 06-11-2026 (₹100) (Blue: Advance)
  // - Mahalakshmi (member-7): Paid ₹100 (Green: Paid)

  transactions.push({
    id: 'TXN-SAV-M1-20261105',
    memberId: 'member-1',
    category: 'Daily Savings',
    amount: 100,
    transactionDate: '2026-11-05',
    createdAt: '2026-11-05T08:15:00.000Z',
    description: 'Daily savings contribution (05-11-2026: ₹100)',
    savingsAllocations: [{ targetDate: '2026-11-05', amount: 100 }],
    auditTrail: [],
  });

  transactions.push({
    id: 'TXN-SAV-M2-20261105',
    memberId: 'member-2',
    category: 'Daily Savings',
    amount: 100,
    transactionDate: '2026-11-05',
    createdAt: '2026-11-05T08:25:00.000Z',
    description: 'Daily savings contribution (05-11-2026: ₹100)',
    savingsAllocations: [{ targetDate: '2026-11-05', amount: 100 }],
    auditTrail: [],
  });

  transactions.push({
    id: 'TXN-SAV-M3-20261105',
    memberId: 'member-3',
    category: 'Daily Savings',
    amount: 50,
    transactionDate: '2026-11-05',
    createdAt: '2026-11-05T08:40:00.000Z',
    description: 'Partial daily savings contribution (05-11-2026: ₹50)',
    notes: 'Will pay remaining ₹50 tomorrow',
    savingsAllocations: [{ targetDate: '2026-11-05', amount: 50 }],
    auditTrail: [],
  });

  transactions.push({
    id: 'TXN-SAV-M6-20261105',
    memberId: 'member-6',
    category: 'Daily Savings',
    amount: 200,
    transactionDate: '2026-11-05',
    createdAt: '2026-11-05T09:00:00.000Z',
    description: 'Advance savings contribution (05-11-2026: ₹100, 06-11-2026: ₹100)',
    notes: 'Advance payment covering today and tomorrow',
    savingsAllocations: [
      { targetDate: '2026-11-05', amount: 100 },
      { targetDate: '2026-11-06', amount: 100 },
    ],
    auditTrail: [],
  });

  transactions.push({
    id: 'TXN-SAV-M7-20261105',
    memberId: 'member-7',
    category: 'Daily Savings',
    amount: 100,
    transactionDate: '2026-11-05',
    createdAt: '2026-11-05T09:10:00.000Z',
    description: 'Daily savings contribution (05-11-2026: ₹100)',
    savingsAllocations: [{ targetDate: '2026-11-05', amount: 100 }],
    auditTrail: [],
  });

  // 4. Seed two realistic 10-week 0% Interest Emergency Loans:
  // Loan 1: Kumar (member-2) borrowed ₹5,000 on 20-10-2026 (10 instalments × ₹500)
  // First instalment: 27-10-2026 (Paid ₹500), Second instalment: 03-11-2026 (Partially Paid ₹250, overdue remainder ₹250)
  const loan1Id = 'LOAN-5000-KUMAR';
  transactions.push({
    id: 'TXN-LOAN-DISB-1',
    memberId: 'member-2',
    category: 'Loan Disbursement',
    amount: 5000,
    transactionDate: '2026-10-20',
    createdAt: '2026-10-20T14:00:00.000Z',
    loanId: loan1Id,
    description: 'Interest-Free Emergency Loan Issued (10 weekly instalments × ₹500)',
    notes: 'Medical family emergency',
    auditTrail: [],
  });

  transactions.push({
    id: 'TXN-LOAN-REP-1A',
    memberId: 'member-2',
    category: 'Loan Repayment',
    amount: 500,
    transactionDate: '2026-10-27',
    createdAt: '2026-10-27T11:00:00.000Z',
    loanId: loan1Id,
    instalmentAllocations: [{ loanId: loan1Id, instalmentNumber: 1, amount: 500 }],
    description: 'Loan repayment (Inst #1: ₹500)',
    notes: 'Week 1 full instalment',
    auditTrail: [],
  });

  transactions.push({
    id: 'TXN-LOAN-REP-1B',
    memberId: 'member-2',
    category: 'Loan Repayment',
    amount: 250,
    transactionDate: '2026-11-03',
    createdAt: '2026-11-03T15:00:00.000Z',
    loanId: loan1Id,
    instalmentAllocations: [{ loanId: loan1Id, instalmentNumber: 2, amount: 250 }],
    description: 'Loan repayment (Inst #2: ₹250)',
    notes: 'Partial payment for Week 2',
    auditTrail: [],
  });

  // Loan 2: Prakash (member-4) borrowed ₹7,500 on 25-10-2026 (10 instalments × ₹750)
  // First instalment due 01-11-2026 (Overdue - unpaid)
  const loan2Id = 'LOAN-7500-PRAKASH';
  transactions.push({
    id: 'TXN-LOAN-DISB-2',
    memberId: 'member-4',
    category: 'Loan Disbursement',
    amount: 7500,
    transactionDate: '2026-10-25',
    createdAt: '2026-10-25T16:00:00.000Z',
    loanId: loan2Id,
    description: 'Interest-Free Emergency Loan Issued (10 weekly instalments × ₹750)',
    notes: 'Two-wheeler repair & school fee emergency',
    auditTrail: [],
  });

  const baseLoan1: EmergencyLoan = {
    id: loan1Id,
    borrowerId: 'member-2',
    principalAmount: 5000,
    issueDate: '2026-10-20',
    firstInstalmentDate: '2026-10-27',
    repaymentDurationWeeks: 10,
    numberOfInstalments: 10,
    interestRate: 0,
    totalRepayment: 5000,
    weeklyInstalmentAmount: 500,
    purpose: 'Medical family emergency',
    notes: 'Approved by all 7 members',
    instalments: [],
  };

  const baseLoan2: EmergencyLoan = {
    id: loan2Id,
    borrowerId: 'member-4',
    principalAmount: 7500,
    issueDate: '2026-10-25',
    firstInstalmentDate: '2026-11-01',
    repaymentDurationWeeks: 10,
    numberOfInstalments: 10,
    interestRate: 0,
    totalRepayment: 7500,
    weeklyInstalmentAmount: 750,
    purpose: 'Two-wheeler repair & school fee',
    notes: '10-week zero-interest emergency support',
    instalments: [],
  };

  const loans = [
    recomputeLoanState(baseLoan1, transactions, currentRefDate),
    recomputeLoanState(baseLoan2, transactions, currentRefDate),
  ];

  // Sort transactions newest first
  transactions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    version: 1,
    settings: {
      groupName: 'Seven Friends Savings & Emergency Fund',
      dailyContributionAmount: DEFAULT_DAILY_CONTRIBUTION,
      groupStartDate: startDate,
      currentReferenceDate: currentRefDate,
      autoAllocateExtraPayments: false,
    },
    members,
    transactions,
    loans,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Loads state synchronously from localStorage (with schema validation), falling back to seed state.
 */
export function loadDatabaseState(): AppDatabaseState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = createSeedDatabaseState();
      saveDatabaseState(seed);
      return seed;
    }
    const parsed = JSON.parse(raw) as AppDatabaseState;
    if (
      !parsed ||
      !Array.isArray(parsed.members) ||
      parsed.members.length === 0 ||
      !Array.isArray(parsed.transactions)
    ) {
      const seed = createSeedDatabaseState();
      saveDatabaseState(seed);
      return seed;
    }
    // Recompute loan states to ensure consistency
    parsed.loans = (parsed.loans || []).map((l) =>
      recomputeLoanState(l, parsed.transactions, parsed.settings.currentReferenceDate)
    );
    return parsed;
  } catch {
    const seed = createSeedDatabaseState();
    return seed;
  }
}

/**
 * Saves state atomically to both localStorage and IndexedDB for offline resilience
 */
export function saveDatabaseState(state: AppDatabaseState): void {
  try {
    const serialized = JSON.stringify(state);
    window.localStorage.setItem(STORAGE_KEY, serialized);
  } catch (e) {
    console.error('Failed saving to localStorage:', e);
  }

  // Also persist to IndexedDB asynchronously
  try {
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      const req = window.indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(state, 'primary');
      };
    }
  } catch {
    // Ignore IDB errors in restricted contexts
  }
}

/**
 * Validates and imports a backup JSON string
 */
export function validateAndParseBackup(jsonString: string): AppDatabaseState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('Invalid JSON file. Please select a valid backup file.');
  }

  const candidate = parsed as Partial<AppDatabaseState>;
  if (
    !candidate ||
    !candidate.settings ||
    typeof candidate.settings.dailyContributionAmount !== 'number' ||
    !Array.isArray(candidate.members) ||
    candidate.members.length < 1 ||
    !Array.isArray(candidate.transactions) ||
    !Array.isArray(candidate.loans)
  ) {
    throw new Error(
      'Backup file is missing required ledger tables (settings, members, transactions, or loans).'
    );
  }

  const recomputedLoans = candidate.loans.map((l) =>
    recomputeLoanState(
      l,
      candidate.transactions!,
      candidate.settings!.currentReferenceDate
    )
  );

  return {
    version: candidate.version || 1,
    settings: candidate.settings,
    members: candidate.members,
    transactions: candidate.transactions,
    loans: recomputedLoans,
    lastUpdated: new Date().toISOString(),
  };
}
