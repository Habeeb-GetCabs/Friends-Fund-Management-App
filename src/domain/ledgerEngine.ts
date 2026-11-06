export type PaymentStatus = 'Paid' | 'Missed' | 'Partially Paid' | 'Advance';

export type InstalmentStatus = 'Upcoming' | 'Paid' | 'Partially Paid' | 'Overdue';

export type TransactionCategory =
  | 'Daily Savings'
  | 'Loan Disbursement'
  | 'Loan Repayment'
  | 'Savings Correction'
  | 'Refund or Reversal';

export interface Member {
  id: string;
  name: string;
  joinedDate: string; // ISO YYYY-MM-DD
  phone?: string;
  nameHistory?: Array<{
    oldName: string;
    newName: string;
    changedAt: string;
  }>;
}

export interface SavingsAllocation {
  targetDate: string; // ISO YYYY-MM-DD
  amount: number;
}

export interface AuditEntry {
  id: string;
  originalAmount: number;
  correctedAmount: number;
  correctionDate: string; // ISO YYYY-MM-DD
  reason: string;
  previousAllocations?: SavingsAllocation[];
  correctedAllocations?: SavingsAllocation[];
}

export interface InstalmentAllocation {
  loanId: string;
  instalmentNumber: number;
  amount: number;
}

export interface FinancialTransaction {
  id: string;
  memberId: string;
  category: TransactionCategory;
  amount: number;
  transactionDate: string; // ISO YYYY-MM-DD
  createdAt: string; // ISO timestamp
  description?: string;
  notes?: string;
  savingsAllocations?: SavingsAllocation[];
  loanId?: string;
  instalmentAllocations?: InstalmentAllocation[];
  relatedTransactionId?: string;
  auditTrail: AuditEntry[];
}

export interface LoanInstalmentPayment {
  transactionId: string;
  amount: number;
  paymentDate: string; // ISO YYYY-MM-DD
  notes?: string;
}

export interface LoanInstalment {
  instalmentNumber: number;
  dueDate: string; // ISO YYYY-MM-DD
  expectedAmount: number;
  amountPaid: number;
  actualPaymentDate: string | null; // ISO YYYY-MM-DD
  remainingBalance: number;
  status: InstalmentStatus;
  isOverdue: boolean;
  payments: LoanInstalmentPayment[];
}

export interface EmergencyLoan {
  id: string;
  borrowerId: string;
  principalAmount: number;
  issueDate: string; // ISO YYYY-MM-DD
  firstInstalmentDate: string; // ISO YYYY-MM-DD
  repaymentDurationWeeks: number; // default 10
  numberOfInstalments: number; // default 10
  interestRate: 0;
  totalRepayment: number;
  weeklyInstalmentAmount: number;
  purpose?: string;
  notes?: string;
  instalments: LoanInstalment[];
}

export interface AppSettings {
  groupName: string;
  dailyContributionAmount: number; // Configurable in settings (e.g. ₹100)
  groupStartDate: string; // ISO YYYY-MM-DD
  currentReferenceDate: string; // ISO YYYY-MM-DD
  autoAllocateExtraPayments: boolean;
}

export interface AppDatabaseState {
  version: number;
  settings: AppSettings;
  members: Member[];
  transactions: FinancialTransaction[];
  loans: EmergencyLoan[];
  lastUpdated: string;
}

export const DEFAULT_MEMBER_NAMES: readonly string[] = [
  'Sathish',
  'Kumar',
  'Santhosh',
  'Prakash',
  'Ranjth',
  'Basheer',
  'Mahalakshmi',
];

export const DEFAULT_DAILY_CONTRIBUTION = 100;

export function getTodayISO(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatDateDDMMYYYY(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  const clean = isoDate.trim().slice(0, 10);
  const parts = clean.split('-');
  if (parts.length !== 3) return isoDate;
  if (parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return clean;
}

export function parseDDMMYYYYToISO(ddmmyyyy: string): string {
  const clean = ddmmyyyy.trim();
  const parts = clean.split('-');
  if (parts.length !== 3) {
    throw new Error(`Invalid date format: ${ddmmyyyy}. Expected DD-MM-YYYY.`);
  }
  if (parts[0].length === 4) {
    return clean;
  }
  const [dd, mm, yyyy] = parts;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

export function addDaysISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getDatesInRange(startISO: string, endISO: string): string[] {
  if (startISO > endISO) return [];
  const dates: string[] = [];
  let curr = startISO;
  let safety = 0;
  while (curr <= endISO && safety < 2000) {
    dates.push(curr);
    curr = addDaysISO(curr, 1);
    safety++;
  }
  return dates;
}

export function formatINR(amount: number): string {
  const isNegative = amount < 0;
  const absVal = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: Number.isInteger(absVal) ? 0 : 2,
    minimumFractionDigits: 0,
  }).format(absVal);
  return `${isNegative ? '-' : ''}₹${formatted}`;
}

export function createDefaultMembers(startDateISO: string = getTodayISO()): Member[] {
  return DEFAULT_MEMBER_NAMES.map((name, idx) => ({
    id: `member-${idx + 1}`,
    name,
    joinedDate: startDateISO,
    nameHistory: [],
  }));
}

export function renameMember(
  state: AppDatabaseState,
  memberId: string,
  newName: string,
  changedAtISO: string = state.settings.currentReferenceDate
): AppDatabaseState {
  const trimmed = newName.trim();
  if (!trimmed) {
    throw new Error('Member name cannot be empty.');
  }
  const memberExists = state.members.some((m) => m.id === memberId);
  if (!memberExists) {
    throw new Error(`Member with ID ${memberId} not found.`);
  }
  return {
    ...state,
    members: state.members.map((m) => {
      if (m.id !== memberId) return m;
      if (m.name === trimmed) return m;
      return {
        ...m,
        name: trimmed,
        nameHistory: [
          ...(m.nameHistory || []),
          {
            oldName: m.name,
            newName: trimmed,
            changedAt: changedAtISO,
          },
        ],
      };
    }),
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Generates weekly instalments for an interest-free loan (default 10 weeks).
 * Distributes any rounding remainder across the earliest weeks so total equals exact principal.
 */
export function generateWeeklyInstalments(
  principalAmount: number,
  firstInstalmentDateISO: string,
  referenceDateISO: string,
  durationWeeks = 10
): LoanInstalment[] {
  if (!Number.isFinite(principalAmount) || principalAmount <= 0) {
    throw new Error('Principal amount must be greater than ₹0.');
  }
  const weeks = Math.max(1, Math.round(durationWeeks));
  const roundedPrincipal = Math.round(principalAmount);
  const baseInstalment = Math.floor(roundedPrincipal / weeks);
  const remainder = roundedPrincipal - baseInstalment * weeks;

  const instalments: LoanInstalment[] = [];
  for (let i = 1; i <= weeks; i++) {
    const expectedAmount = i <= remainder ? baseInstalment + 1 : baseInstalment;
    const dueDate = addDaysISO(firstInstalmentDateISO, (i - 1) * 7);
    const isOverdue = dueDate < referenceDateISO;
    instalments.push({
      instalmentNumber: i,
      dueDate,
      expectedAmount,
      amountPaid: 0,
      actualPaymentDate: null,
      remainingBalance: expectedAmount,
      status: isOverdue ? 'Overdue' : 'Upcoming',
      isOverdue,
      payments: [],
    });
  }
  return instalments;
}

export function generateTenWeeklyInstalments(
  principalAmount: number,
  firstInstalmentDateISO: string,
  referenceDateISO: string
): LoanInstalment[] {
  return generateWeeklyInstalments(
    principalAmount,
    firstInstalmentDateISO,
    referenceDateISO,
    10
  );
}

/**
 * Recomputes a loan's weekly repayment schedule from actual Loan Repayment transactions.
 * Automatically allocates repayments sequentially against outstanding principal from Week 1..N.
 */
export function recomputeLoanState(
  loan: EmergencyLoan,
  transactions: FinancialTransaction[],
  referenceDateISO: string
): EmergencyLoan {
  const weeks = loan.repaymentDurationWeeks || loan.numberOfInstalments || 10;
  const baseInstalments = generateWeeklyInstalments(
    loan.principalAmount,
    loan.firstInstalmentDate,
    referenceDateISO,
    weeks
  );

  // Find all Loan Repayment transactions for this loan sorted chronologically
  const repaymentTxns = transactions
    .filter(
      (t) =>
        t.category === 'Loan Repayment' &&
        (t.loanId === loan.id ||
          (t.instalmentAllocations &&
            t.instalmentAllocations.some((a) => a.loanId === loan.id)))
    )
    .sort((a, b) => {
      const dateCmp = a.transactionDate.localeCompare(b.transactionDate);
      if (dateCmp !== 0) return dateCmp;
      return a.createdAt.localeCompare(b.createdAt);
    });

  for (const txn of repaymentTxns) {
    if (txn.instalmentAllocations && txn.instalmentAllocations.length > 0) {
      for (const alloc of txn.instalmentAllocations) {
        if (alloc.loanId !== loan.id || alloc.amount <= 0) continue;
        const inst = baseInstalments.find(
          (item) => item.instalmentNumber === alloc.instalmentNumber
        );
        if (inst) {
          inst.amountPaid += alloc.amount;
          inst.actualPaymentDate = txn.transactionDate;
          inst.payments.push({
            transactionId: txn.id,
            amount: alloc.amount,
            paymentDate: txn.transactionDate,
            notes: txn.notes || txn.description,
          });
        }
      }
    } else {
      // Automatic sequential allocation against earliest unpaid weeks
      let remToAllocate = txn.amount;
      for (const inst of baseInstalments) {
        if (remToAllocate <= 0) break;
        const stillNeeded = Math.max(0, inst.expectedAmount - inst.amountPaid);
        if (stillNeeded <= 0) continue;
        const take = Math.min(remToAllocate, stillNeeded);
        inst.amountPaid += take;
        inst.actualPaymentDate = txn.transactionDate;
        inst.payments.push({
          transactionId: txn.id,
          amount: take,
          paymentDate: txn.transactionDate,
          notes: txn.notes || txn.description,
        });
        remToAllocate -= take;
      }
    }
  }

  for (const inst of baseInstalments) {
    inst.remainingBalance = Math.max(0, inst.expectedAmount - inst.amountPaid);
    const pastDue = inst.dueDate < referenceDateISO;
    inst.isOverdue = inst.remainingBalance > 0 && pastDue;
    if (inst.amountPaid >= inst.expectedAmount) {
      inst.status = 'Paid';
    } else if (inst.amountPaid > 0) {
      inst.status = 'Partially Paid';
    } else if (pastDue) {
      inst.status = 'Overdue';
    } else {
      inst.status = 'Upcoming';
    }
  }

  return {
    ...loan,
    repaymentDurationWeeks: weeks,
    numberOfInstalments: weeks,
    instalments: baseInstalments,
  };
}

export function proposeLoanRepaymentAllocations(
  loan: EmergencyLoan,
  paymentAmount: number,
  startingInstalmentNumber?: number
): InstalmentAllocation[] {
  if (paymentAmount <= 0) return [];
  let remainingToAllocate = paymentAmount;
  const allocations: InstalmentAllocation[] = [];

  const orderedInstalments = [...loan.instalments].sort((a, b) => {
    if (startingInstalmentNumber) {
      const aPriority = a.instalmentNumber >= startingInstalmentNumber ? 0 : 1;
      const bPriority = b.instalmentNumber >= startingInstalmentNumber ? 0 : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;
    }
    return a.instalmentNumber - b.instalmentNumber;
  });

  for (const inst of orderedInstalments) {
    if (remainingToAllocate <= 0) break;
    if (inst.remainingBalance <= 0) continue;
    const allocAmount = Math.min(remainingToAllocate, inst.remainingBalance);
    if (allocAmount > 0) {
      allocations.push({
        loanId: loan.id,
        instalmentNumber: inst.instalmentNumber,
        amount: allocAmount,
      });
      remainingToAllocate -= allocAmount;
    }
  }

  return allocations;
}

export interface MemberDateSavingsSummary {
  memberId: string;
  memberName: string;
  date: string;
  expectedAmount: number;
  allocatedAmount: number;
  cashPaidOnDate: number;
  pendingAmount: number;
  status: PaymentStatus;
  paidViaAdvanceOrCarryover: boolean;
  primaryTransactionId?: string;
  coveringTransactions: Array<{
    transactionId: string;
    paymentDate: string;
    allocatedAmount: number;
    totalTransactionAmount: number;
  }>;
}

export function getMemberSavingsForDate(
  state: AppDatabaseState,
  memberId: string,
  targetDateISO: string
): MemberDateSavingsSummary {
  const member = state.members.find((m) => m.id === memberId);
  const expectedAmount = state.settings.dailyContributionAmount;

  let allocatedAmount = 0;
  let cashPaidOnDate = 0;
  let hasEarlyOrFutureAdvance = false;
  let primaryTransactionId: string | undefined;
  const coveringTransactions: MemberDateSavingsSummary['coveringTransactions'] = [];

  for (const txn of state.transactions) {
    if (txn.memberId !== memberId) continue;

    if (txn.category === 'Daily Savings' || txn.category === 'Savings Correction') {
      const allocs = txn.savingsAllocations || [
        { targetDate: txn.transactionDate, amount: txn.amount },
      ];
      if (txn.transactionDate === targetDateISO) {
        cashPaidOnDate += txn.amount;
        if (!primaryTransactionId) {
          primaryTransactionId = txn.id;
        }
        if (allocs.some((a) => a.targetDate > targetDateISO && a.amount > 0)) {
          hasEarlyOrFutureAdvance = true;
        }
      }
      for (const alloc of allocs) {
        if (alloc.targetDate === targetDateISO && alloc.amount !== 0) {
          allocatedAmount += alloc.amount;
          if (!primaryTransactionId) {
            primaryTransactionId = txn.id;
          }
          if (txn.transactionDate < targetDateISO) {
            hasEarlyOrFutureAdvance = true;
          }
          coveringTransactions.push({
            transactionId: txn.id,
            paymentDate: txn.transactionDate,
            allocatedAmount: alloc.amount,
            totalTransactionAmount: txn.amount,
          });
        }
      }
    } else if (txn.category === 'Refund or Reversal') {
      if (txn.transactionDate === targetDateISO) {
        cashPaidOnDate -= txn.amount;
      }
      const allocs = txn.savingsAllocations || [
        { targetDate: txn.transactionDate, amount: -Math.abs(txn.amount) },
      ];
      for (const alloc of allocs) {
        if (alloc.targetDate === targetDateISO) {
          allocatedAmount += alloc.amount;
        }
      }
    }
  }

  allocatedAmount = Math.max(0, allocatedAmount);
  const pendingAmount = Math.max(0, expectedAmount - allocatedAmount);

  let status: PaymentStatus;
  if (
    allocatedAmount > expectedAmount ||
    (allocatedAmount >= expectedAmount && hasEarlyOrFutureAdvance)
  ) {
    status = 'Advance';
  } else if (allocatedAmount === expectedAmount && expectedAmount > 0) {
    status = 'Paid';
  } else if (allocatedAmount > 0 && allocatedAmount < expectedAmount) {
    status = 'Partially Paid';
  } else {
    status = 'Missed';
  }

  return {
    memberId,
    memberName: member ? member.name : 'Unknown Member',
    date: targetDateISO,
    expectedAmount,
    allocatedAmount,
    cashPaidOnDate: Math.max(0, cashPaidOnDate),
    pendingAmount,
    status,
    paidViaAdvanceOrCarryover: hasEarlyOrFutureAdvance,
    primaryTransactionId,
    coveringTransactions,
  };
}

export interface DailyCollectionDashboardSummary {
  date: string;
  expectedCollection: number;
  totalAllocatedForDate: number;
  totalCashCollectedOnDate: number;
  totalPendingCollection: number;
  paidCount: number;
  missedCount: number;
  partiallyPaidCount: number;
  advanceCount: number;
  memberStatuses: MemberDateSavingsSummary[];
}

export function getDailyCollectionDashboard(
  state: AppDatabaseState,
  dateISO: string
): DailyCollectionDashboardSummary {
  const memberStatuses = state.members.map((m) =>
    getMemberSavingsForDate(state, m.id, dateISO)
  );
  const expectedCollection =
    state.members.length * state.settings.dailyContributionAmount;
  const totalAllocatedForDate = memberStatuses.reduce(
    (sum, item) => sum + item.allocatedAmount,
    0
  );
  const totalCashCollectedOnDate = memberStatuses.reduce(
    (sum, item) => sum + item.cashPaidOnDate,
    0
  );
  const totalPendingCollection = memberStatuses.reduce(
    (sum, item) => sum + item.pendingAmount,
    0
  );

  // In the simplified collection register, any member who contributed > ₹0 for the date is counted as having paid
  const paidCount = memberStatuses.filter(
    (m) => m.allocatedAmount > 0 || m.cashPaidOnDate > 0
  ).length;
  const missedCount = state.members.length - paidCount;
  const partiallyPaidCount = memberStatuses.filter(
    (m) => m.status === 'Partially Paid'
  ).length;
  const advanceCount = memberStatuses.filter(
    (m) => m.status === 'Advance'
  ).length;

  return {
    date: dateISO,
    expectedCollection,
    totalAllocatedForDate,
    totalCashCollectedOnDate,
    totalPendingCollection,
    paidCount,
    missedCount,
    partiallyPaidCount,
    advanceCount,
    memberStatuses,
  };
}

export function getMemberPendingDates(
  state: AppDatabaseState,
  memberId: string,
  upToDateISO: string = state.settings.currentReferenceDate
): MemberDateSavingsSummary[] {
  const dates = getDatesInRange(state.settings.groupStartDate, upToDateISO);
  const pendingList: MemberDateSavingsSummary[] = [];
  for (const d of dates) {
    const summary = getMemberSavingsForDate(state, memberId, d);
    if (summary.pendingAmount > 0) {
      pendingList.push(summary);
    }
  }
  return pendingList;
}

export function buildSavingsAllocations(
  state: AppDatabaseState,
  memberId: string,
  paymentAmount: number,
  paymentDateISO: string,
  mode: 'single-date' | 'cover-missed-then-current' | 'advance-future',
  specificTargetDates?: string[]
): SavingsAllocation[] {
  if (paymentAmount <= 0) return [];

  if (mode === 'single-date') {
    return [{ targetDate: paymentDateISO, amount: paymentAmount }];
  }

  let remaining = paymentAmount;
  const allocations: SavingsAllocation[] = [];
  const dailyTarget = state.settings.dailyContributionAmount;

  if (specificTargetDates && specificTargetDates.length > 0) {
    for (const targetDate of specificTargetDates) {
      if (remaining <= 0) break;
      const existing = getMemberSavingsForDate(state, memberId, targetDate);
      const needed =
        existing.pendingAmount > 0 ? existing.pendingAmount : dailyTarget;
      const allocateNow = Math.min(remaining, needed);
      if (allocateNow > 0) {
        allocations.push({ targetDate, amount: allocateNow });
        remaining -= allocateNow;
      }
    }
    if (remaining > 0) {
      const fallbackDate =
        specificTargetDates[specificTargetDates.length - 1] || paymentDateISO;
      const existingAlloc = allocations.find((a) => a.targetDate === fallbackDate);
      if (existingAlloc) {
        existingAlloc.amount += remaining;
      } else {
        allocations.push({ targetDate: fallbackDate, amount: remaining });
      }
    }
    return allocations;
  }

  if (mode === 'cover-missed-then-current') {
    const pendingDates = getMemberPendingDates(state, memberId, paymentDateISO);
    for (const daySummary of pendingDates) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, daySummary.pendingAmount);
      if (take > 0) {
        allocations.push({ targetDate: daySummary.date, amount: take });
        remaining -= take;
      }
    }
  }

  if (remaining > 0) {
    let futureCursor =
      mode === 'advance-future'
        ? paymentDateISO
        : addDaysISO(paymentDateISO, 1);
    let safety = 0;
    while (remaining > 0 && safety < 365) {
      const existing = getMemberSavingsForDate(state, memberId, futureCursor);
      if (existing.pendingAmount > 0) {
        const take = Math.min(remaining, existing.pendingAmount);
        allocations.push({ targetDate: futureCursor, amount: take });
        remaining -= take;
      }
      futureCursor = addDaysISO(futureCursor, 1);
      safety++;
    }
  }

  return allocations;
}

export interface GroupFinancialSummary {
  totalSavingsCollected: number;
  totalLoansIssued: number;
  totalLoanPrincipalRepaid: number;
  totalOutstandingLoanPrincipal: number;
  availableGroupCash: number;
  activeLoansCount: number;
  completedLoansCount: number;
  overdueInstalmentsCount: number;
  memberSavingsBalances: Array<{
    memberId: string;
    memberName: string;
    totalSaved: number;
    missedDaysCount: number;
    outstandingSavingsAmount: number;
    totalLoansTaken: number;
    totalLoanRepaid: number;
    remainingLoanBalance: number;
  }>;
}

export function calculateGroupFinancialSummary(
  state: AppDatabaseState
): GroupFinancialSummary {
  let totalSavingsCollected = 0;
  let totalLoansIssued = 0;
  let totalLoanPrincipalRepaid = 0;

  for (const txn of state.transactions) {
    if (txn.category === 'Daily Savings' || txn.category === 'Savings Correction') {
      totalSavingsCollected += txn.amount;
    } else if (txn.category === 'Refund or Reversal') {
      totalSavingsCollected -= Math.abs(txn.amount);
    } else if (txn.category === 'Loan Disbursement') {
      totalLoansIssued += txn.amount;
    } else if (txn.category === 'Loan Repayment') {
      totalLoanPrincipalRepaid += txn.amount;
    }
  }

  const totalOutstandingLoanPrincipal = Math.max(
    0,
    totalLoansIssued - totalLoanPrincipalRepaid
  );

  // Available cash = Actual savings collected + Loan repayments received - Loans issued
  const availableGroupCash =
    totalSavingsCollected + totalLoanPrincipalRepaid - totalLoansIssued;

  const allTrackingDates = getDatesInRange(
    state.settings.groupStartDate,
    state.settings.currentReferenceDate
  );

  let activeLoansCount = 0;
  let completedLoansCount = 0;
  let overdueInstalmentsCount = 0;

  for (const loan of state.loans) {
    const recomputed = recomputeLoanState(
      loan,
      state.transactions,
      state.settings.currentReferenceDate
    );
    const totalPaid = recomputed.instalments.reduce(
      (sum, i) => sum + i.amountPaid,
      0
    );
    if (totalPaid >= recomputed.principalAmount) {
      completedLoansCount++;
    } else {
      activeLoansCount++;
    }
    for (const inst of recomputed.instalments) {
      if (inst.isOverdue) {
        overdueInstalmentsCount++;
      }
    }
  }

  const memberSavingsBalances = state.members.map((member) => {
    let totalSaved = 0;
    for (const txn of state.transactions) {
      if (txn.memberId !== member.id) continue;
      if (txn.category === 'Daily Savings' || txn.category === 'Savings Correction') {
        totalSaved += txn.amount;
      } else if (txn.category === 'Refund or Reversal') {
        totalSaved -= Math.abs(txn.amount);
      }
    }

    let missedDaysCount = 0;
    let outstandingSavingsAmount = 0;
    for (const d of allTrackingDates) {
      const dayStat = getMemberSavingsForDate(state, member.id, d);
      if (dayStat.status === 'Missed') {
        missedDaysCount++;
      }
      outstandingSavingsAmount += dayStat.pendingAmount;
    }

    let totalLoansTaken = 0;
    let totalLoanRepaid = 0;
    for (const txn of state.transactions) {
      if (txn.memberId !== member.id) continue;
      if (txn.category === 'Loan Disbursement') {
        totalLoansTaken += txn.amount;
      } else if (txn.category === 'Loan Repayment') {
        totalLoanRepaid += txn.amount;
      }
    }

    return {
      memberId: member.id,
      memberName: member.name,
      totalSaved,
      missedDaysCount,
      outstandingSavingsAmount,
      totalLoansTaken,
      totalLoanRepaid,
      remainingLoanBalance: Math.max(0, totalLoansTaken - totalLoanRepaid),
    };
  });

  return {
    totalSavingsCollected,
    totalLoansIssued,
    totalLoanPrincipalRepaid,
    totalOutstandingLoanPrincipal,
    availableGroupCash,
    activeLoansCount,
    completedLoansCount,
    overdueInstalmentsCount,
    memberSavingsBalances,
  };
}

export function recordDailySavingsTransaction(
  state: AppDatabaseState,
  params: {
    memberId: string;
    amount: number;
    transactionDate: string; // ISO YYYY-MM-DD
    allocations?: SavingsAllocation[];
    description?: string;
    notes?: string;
    nowTimestamp?: string;
  }
): AppDatabaseState {
  const {
    memberId,
    amount,
    transactionDate,
    allocations,
    description,
    notes,
    nowTimestamp = new Date().toISOString(),
  } = params;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Savings contribution amount must be greater than ₹0.');
  }
  const member = state.members.find((m) => m.id === memberId);
  if (!member) {
    throw new Error('Selected member does not exist.');
  }

  const recentDuplicate = state.transactions.find((t) => {
    if (
      t.memberId !== memberId ||
      t.category !== 'Daily Savings' ||
      t.amount !== amount ||
      t.transactionDate !== transactionDate
    ) {
      return false;
    }
    const diffMs = Math.abs(
      new Date(nowTimestamp).getTime() - new Date(t.createdAt).getTime()
    );
    return diffMs < 2500;
  });

  if (recentDuplicate) {
    throw new Error(
      'Duplicate payment prevented: an identical savings entry was just recorded.'
    );
  }

  const finalAllocations: SavingsAllocation[] =
    allocations && allocations.length > 0
      ? allocations
      : [{ targetDate: transactionDate, amount }];

  const allocSum = finalAllocations.reduce((s, a) => s + a.amount, 0);
  if (Math.round(allocSum) !== Math.round(amount)) {
    throw new Error(
      `Allocated amounts (${formatINR(allocSum)}) must equal the total payment amount (${formatINR(amount)}).`
    );
  }

  const newTxn: FinancialTransaction = {
    id: `TXN-SAV-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    memberId,
    category: 'Daily Savings',
    amount,
    transactionDate,
    createdAt: nowTimestamp,
    description:
      description ||
      `Daily savings contribution (${formatDateDDMMYYYY(transactionDate)}: ${formatINR(amount)})`,
    notes: notes || '',
    savingsAllocations: finalAllocations,
    auditTrail: [],
  };

  return {
    ...state,
    transactions: [newTxn, ...state.transactions],
    lastUpdated: nowTimestamp,
  };
}

/**
 * Batch saves the simplified Daily Collection Register for a selected payment date.
 * - Saves transactions only for selected (checked) members.
 * - Never creates duplicate daily payment records for a member who already paid on that date.
 * - If an already-paid member's amount is edited, records a proper AuditEntry on the existing transaction.
 */
export interface DailyRegisterEntryInput {
  memberId: string;
  paid: boolean;
  amount: number;
  correctionReason?: string;
}

export function saveDailyCollectionBatch(
  state: AppDatabaseState,
  params: {
    paymentDateISO: string;
    entries: DailyRegisterEntryInput[];
    nowTimestamp?: string;
  }
): { nextState: AppDatabaseState; savedCount: number; updatedCount: number } {
  const {
    paymentDateISO,
    entries,
    nowTimestamp = new Date().toISOString(),
  } = params;

  if (!paymentDateISO) {
    throw new Error('Please select a valid payment date.');
  }

  let updatedTransactions = [...state.transactions];
  let savedCount = 0;
  let updatedCount = 0;

  for (const entry of entries) {
    const member = state.members.find((m) => m.id === entry.memberId);
    if (!member) continue;

    // Check if member already has a Daily Savings transaction for this date
    const existingTxnsForDate = updatedTransactions.filter(
      (t) =>
        t.memberId === entry.memberId &&
        (t.category === 'Daily Savings' || t.category === 'Savings Correction') &&
        (t.transactionDate === paymentDateISO ||
          (t.savingsAllocations &&
            t.savingsAllocations.length === 1 &&
            t.savingsAllocations[0].targetDate === paymentDateISO))
    );

    const existingTotal = existingTxnsForDate.reduce((s, t) => s + t.amount, 0);

    if (!entry.paid) {
      // If member was previously paid on this date and treasurer unchecked them (corrected to ₹0):
      if (existingTxnsForDate.length > 0 && existingTotal > 0) {
        const primaryTxn = existingTxnsForDate[0];
        const reason =
          entry.correctionReason?.trim() ||
          `Marked unpaid on ${formatDateDDMMYYYY(paymentDateISO)} via Daily Collection Register`;
        const auditEntry: AuditEntry = {
          id: `AUD-${Date.now()}-${member.id}`,
          originalAmount: primaryTxn.amount,
          correctedAmount: 0,
          correctionDate: state.settings.currentReferenceDate,
          reason,
          previousAllocations: primaryTxn.savingsAllocations,
          correctedAllocations: [{ targetDate: paymentDateISO, amount: 0 }],
        };
        updatedTransactions = updatedTransactions.map((t) =>
          t.id === primaryTxn.id
            ? {
                ...t,
                amount: 0,
                savingsAllocations: [{ targetDate: paymentDateISO, amount: 0 }],
                description: `Daily savings corrected to ₹0 (${reason})`,
                auditTrail: [...t.auditTrail, auditEntry],
              }
            : t
        );
        updatedCount++;
      }
      continue;
    }

    // Member is marked as [x] Paid: validate actual amount received
    if (!Number.isFinite(entry.amount) || entry.amount <= 0) {
      throw new Error(
        `Please enter the actual payment amount received for ${member.name}.`
      );
    }

    const roundedAmt = Math.round(entry.amount);

    if (existingTxnsForDate.length > 0) {
      // Never create duplicate daily payment records!
      if (Math.round(existingTotal) === roundedAmt) {
        // Unchanged existing payment — skip
        continue;
      }
      // Amount was edited by the treasurer: update primary transaction with audit trail
      const primaryTxn = existingTxnsForDate[0];
      const reason =
        entry.correctionReason?.trim() ||
        `Amount updated from ${formatINR(primaryTxn.amount)} to ${formatINR(
          roundedAmt
        )} in Daily Collection Register`;
      const auditEntry: AuditEntry = {
        id: `AUD-${Date.now()}-${member.id}`,
        originalAmount: primaryTxn.amount,
        correctedAmount: roundedAmt,
        correctionDate: state.settings.currentReferenceDate,
        reason,
        previousAllocations: primaryTxn.savingsAllocations,
        correctedAllocations: [
          { targetDate: paymentDateISO, amount: roundedAmt },
        ],
      };

      updatedTransactions = updatedTransactions.map((t) =>
        t.id === primaryTxn.id
          ? {
              ...t,
              amount: roundedAmt,
              savingsAllocations: [
                { targetDate: paymentDateISO, amount: roundedAmt },
              ],
              description: `Daily savings contribution (${formatDateDDMMYYYY(
                paymentDateISO
              )}: ${formatINR(roundedAmt)})`,
              auditTrail: [...t.auditTrail, auditEntry],
            }
          : t
      );
      updatedCount++;
    } else {
      // Create new Daily Savings transaction for this member and date
      const newTxn: FinancialTransaction = {
        id: `TXN-SAV-${Date.now()}-${member.id.toUpperCase()}-${Math.random()
          .toString(36)
          .slice(2, 5)
          .toUpperCase()}`,
        memberId: member.id,
        category: 'Daily Savings',
        amount: roundedAmt,
        transactionDate: paymentDateISO,
        createdAt: nowTimestamp,
        description: `Daily savings contribution (${formatDateDDMMYYYY(
          paymentDateISO
        )}: ${formatINR(roundedAmt)})`,
        notes: '',
        savingsAllocations: [{ targetDate: paymentDateISO, amount: roundedAmt }],
        auditTrail: [],
      };
      updatedTransactions = [newTxn, ...updatedTransactions];
      savedCount++;
    }
  }

  return {
    nextState: {
      ...state,
      transactions: updatedTransactions,
      lastUpdated: nowTimestamp,
    },
    savedCount,
    updatedCount,
  };
}

export function editSavingsTransactionWithAudit(
  state: AppDatabaseState,
  params: {
    transactionId: string;
    correctedAmount: number;
    correctedAllocations: SavingsAllocation[];
    reason: string;
    correctionDateISO?: string;
  }
): AppDatabaseState {
  const {
    transactionId,
    correctedAmount,
    correctedAllocations,
    reason,
    correctionDateISO = state.settings.currentReferenceDate,
  } = params;

  if (!reason.trim()) {
    throw new Error('A correction reason is required for the audit trail.');
  }
  if (!Number.isFinite(correctedAmount) || correctedAmount < 0) {
    throw new Error('Corrected amount cannot be negative.');
  }
  const allocSum = correctedAllocations.reduce((s, a) => s + a.amount, 0);
  if (Math.round(allocSum) !== Math.round(correctedAmount)) {
    throw new Error('Corrected allocations must sum to the corrected amount.');
  }

  const target = state.transactions.find((t) => t.id === transactionId);
  if (!target) {
    throw new Error('Transaction not found.');
  }

  const auditEntry: AuditEntry = {
    id: `AUD-${Date.now()}`,
    originalAmount: target.amount,
    correctedAmount,
    correctionDate: correctionDateISO,
    reason: reason.trim(),
    previousAllocations: target.savingsAllocations,
    correctedAllocations,
  };

  const updatedTransactions = state.transactions.map((t) => {
    if (t.id !== transactionId) return t;
    return {
      ...t,
      amount: correctedAmount,
      savingsAllocations: correctedAllocations,
      description: `${t.description || 'Daily savings'} (Corrected on ${formatDateDDMMYYYY(correctionDateISO)})`,
      auditTrail: [...t.auditTrail, auditEntry],
    };
  });

  return {
    ...state,
    transactions: updatedTransactions,
    lastUpdated: new Date().toISOString(),
  };
}

export function issueEmergencyLoan(
  state: AppDatabaseState,
  params: {
    borrowerId: string;
    principalAmount: number;
    issueDateISO: string;
    firstInstalmentDateISO?: string;
    repaymentDurationWeeks?: number;
    purpose?: string;
    notes?: string;
    allowExceedAvailableCash?: boolean;
    nowTimestamp?: string;
  }
): AppDatabaseState {
  const {
    borrowerId,
    principalAmount,
    issueDateISO,
    firstInstalmentDateISO = addDaysISO(issueDateISO, 7),
    repaymentDurationWeeks = 10,
    purpose,
    notes,
    allowExceedAvailableCash = false,
    nowTimestamp = new Date().toISOString(),
  } = params;

  if (!Number.isFinite(principalAmount) || principalAmount <= 0) {
    throw new Error('Loan principal amount must be greater than ₹0.');
  }
  const weeks = Math.max(1, Math.round(repaymentDurationWeeks));
  const borrower = state.members.find((m) => m.id === borrowerId);
  if (!borrower) {
    throw new Error('Borrower member not found.');
  }

  const summary = calculateGroupFinancialSummary(state);
  if (!allowExceedAvailableCash && principalAmount > summary.availableGroupCash) {
    throw new Error(
      `Insufficient available group cash (${formatINR(
        summary.availableGroupCash
      )}) to disburse ${formatINR(principalAmount)} loan.`
    );
  }

  const instalments = generateWeeklyInstalments(
    principalAmount,
    firstInstalmentDateISO,
    state.settings.currentReferenceDate,
    weeks
  );

  const loanId = `LOAN-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const newLoan: EmergencyLoan = {
    id: loanId,
    borrowerId,
    principalAmount: Math.round(principalAmount),
    issueDate: issueDateISO,
    firstInstalmentDate: firstInstalmentDateISO,
    repaymentDurationWeeks: weeks,
    numberOfInstalments: weeks,
    interestRate: 0,
    totalRepayment: Math.round(principalAmount),
    weeklyInstalmentAmount: Number((principalAmount / weeks).toFixed(2)),
    purpose: purpose?.trim() || '',
    notes: notes || '',
    instalments,
  };

  const disbursementTxn: FinancialTransaction = {
    id: `TXN-LOAN-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
    memberId: borrowerId,
    category: 'Loan Disbursement',
    amount: Math.round(principalAmount),
    transactionDate: issueDateISO,
    createdAt: nowTimestamp,
    loanId,
    description: `Interest-Free Loan Issued (${weeks} weeks)`,
    notes: purpose?.trim() || notes || '',
    auditTrail: [],
  };

  return {
    ...state,
    loans: [newLoan, ...state.loans],
    transactions: [disbursementTxn, ...state.transactions],
    lastUpdated: nowTimestamp,
  };
}

export function recordLoanRepayment(
  state: AppDatabaseState,
  params: {
    loanId: string;
    paymentAmount: number;
    paymentDateISO: string;
    instalmentAllocations?: InstalmentAllocation[];
    notes?: string;
    nowTimestamp?: string;
  }
): AppDatabaseState {
  const {
    loanId,
    paymentAmount,
    paymentDateISO,
    instalmentAllocations,
    notes,
    nowTimestamp = new Date().toISOString(),
  } = params;

  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    throw new Error('Repayment amount must be greater than ₹0.');
  }

  const existingLoan = state.loans.find((l) => l.id === loanId);
  if (!existingLoan) {
    throw new Error('Loan record not found.');
  }

  const currentLoan = recomputeLoanState(
    existingLoan,
    state.transactions,
    state.settings.currentReferenceDate
  );

  const totalRemaining = currentLoan.instalments.reduce(
    (sum, inst) => sum + inst.remainingBalance,
    0
  );

  if (paymentAmount > totalRemaining) {
    throw new Error(
      `Repayment amount (${formatINR(
        paymentAmount
      )}) exceeds remaining loan principal (${formatINR(
        totalRemaining
      )}). Loans are 0% interest.`
    );
  }

  const finalAllocations =
    instalmentAllocations && instalmentAllocations.length > 0
      ? instalmentAllocations
      : proposeLoanRepaymentAllocations(currentLoan, paymentAmount);

  const repaymentTxn: FinancialTransaction = {
    id: `TXN-REP-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    memberId: currentLoan.borrowerId,
    category: 'Loan Repayment',
    amount: Math.round(paymentAmount),
    transactionDate: paymentDateISO,
    createdAt: nowTimestamp,
    loanId,
    instalmentAllocations: finalAllocations,
    description: `Loan repayment (${formatINR(paymentAmount)})`,
    notes: notes || '',
    auditTrail: [],
  };

  const nextTransactions = [repaymentTxn, ...state.transactions];
  const nextLoans = state.loans.map((l) =>
    l.id === loanId
      ? recomputeLoanState(l, nextTransactions, state.settings.currentReferenceDate)
      : l
  );

  return {
    ...state,
    transactions: nextTransactions,
    loans: nextLoans,
    lastUpdated: nowTimestamp,
  };
}
