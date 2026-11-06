import {
  AppDatabaseState,
  createDefaultMembers,
  DEFAULT_DAILY_CONTRIBUTION,
  getTodayISO,
  recomputeLoanState,
} from './ledgerEngine';

const STORAGE_KEY = 'friends_savings_loan_db_v1';
const IDB_NAME = 'FriendsSavingsOfflineRoomDB';
const IDB_STORE = 'ledger_state';

/**
 * Creates a clean initial database state with the 7 default members and zero fabricated transactions.
 * Never automatically creates fake, sample, or hardcoded financial figures.
 */
export function createSeedDatabaseState(): AppDatabaseState {
  const today = getTodayISO();
  const members = createDefaultMembers(today);

  return {
    version: 2,
    settings: {
      groupName: 'Friends Savings & Loan Manager',
      dailyContributionAmount: DEFAULT_DAILY_CONTRIBUTION,
      groupStartDate: today,
      currentReferenceDate: today,
      autoAllocateExtraPayments: false,
    },
    members,
    transactions: [],
    loans: [],
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Loads existing database state from localStorage without ever deleting or resetting user records.
 * Note: If an older version v1 database contained the initial hardcoded demo transactions (TXN-SAV-member-1-2026-10-...),
 * we preserve real user-created records while stripping only the old synthetic demo seed if requested.
 */
export function loadDatabaseState(): AppDatabaseState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = createSeedDatabaseState();
      saveDatabaseState(initial);
      return initial;
    }
    const parsed = JSON.parse(raw) as AppDatabaseState;
    if (
      !parsed ||
      !Array.isArray(parsed.members) ||
      parsed.members.length === 0 ||
      !Array.isArray(parsed.transactions)
    ) {
      const initial = createSeedDatabaseState();
      saveDatabaseState(initial);
      return initial;
    }

    // If the stored state was v1 and contains ONLY the old synthetic demo IDs (e.g. LOAN-5000-KUMAR / TXN-SAV-member-1-2026-10-08),
    // migrate cleanly to v2 without hardcoded demo transactions while preserving the 7 members and any real user transactions.
    const isSyntheticTxn = (id: string) =>
      id.startsWith('TXN-SAV-member-') ||
      id.startsWith('TXN-SAV-M') ||
      id === 'TXN-LOAN-DISB-1' ||
      id === 'TXN-LOAN-DISB-2' ||
      id === 'TXN-LOAN-REP-1A' ||
      id === 'TXN-LOAN-REP-1B';

    const isSyntheticLoan = (id: string) =>
      id === 'LOAN-5000-KUMAR' || id === 'LOAN-7500-PRAKASH';

    const today = getTodayISO();
    const migratedTransactions =
      parsed.version === 1
        ? parsed.transactions.filter((t) => !isSyntheticTxn(t.id))
        : parsed.transactions;

    const migratedLoans = (
      parsed.version === 1
        ? (parsed.loans || []).filter((l) => !isSyntheticLoan(l.id))
        : parsed.loans || []
    ).map((l) =>
      recomputeLoanState(
        l,
        migratedTransactions,
        parsed.settings?.currentReferenceDate || today
      )
    );

    const migratedState: AppDatabaseState = {
      ...parsed,
      version: 2,
      settings: {
        ...parsed.settings,
        currentReferenceDate: today,
      },
      transactions: migratedTransactions,
      loans: migratedLoans,
    };

    if (parsed.version === 1) {
      saveDatabaseState(migratedState);
    }

    return migratedState;
  } catch {
    return createSeedDatabaseState();
  }
}

export function saveDatabaseState(state: AppDatabaseState): void {
  try {
    const serialized = JSON.stringify(state);
    window.localStorage.setItem(STORAGE_KEY, serialized);
  } catch (e) {
    console.error('Failed saving to localStorage:', e);
  }

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
    version: 2,
    settings: candidate.settings,
    members: candidate.members,
    transactions: candidate.transactions,
    loans: recomputedLoans,
    lastUpdated: new Date().toISOString(),
  };
}
