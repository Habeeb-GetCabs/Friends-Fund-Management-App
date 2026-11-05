import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MEMBER_NAMES,
  DEFAULT_DAILY_CONTRIBUTION,
  createDefaultMembers,
  renameMember,
  generateTenWeeklyInstalments,
  getDailyCollectionDashboard,
  getMemberSavingsForDate,
  buildSavingsAllocations,
  recordDailySavingsTransaction,
  editSavingsTransactionWithAudit,
  issueEmergencyLoan,
  recordLoanRepayment,
  calculateGroupFinancialSummary,
  formatDateDDMMYYYY,
  AppDatabaseState,
} from './ledgerEngine';

function createCleanTestState(): AppDatabaseState {
  return {
    version: 1,
    settings: {
      groupName: 'Seven Friends Mutual Fund',
      dailyContributionAmount: DEFAULT_DAILY_CONTRIBUTION,
      groupStartDate: '2026-11-01',
      currentReferenceDate: '2026-11-05',
      autoAllocateExtraPayments: false,
    },
    members: createDefaultMembers('2026-11-01'),
    transactions: [],
    loans: [],
    lastUpdated: '2026-11-05T10:00:00.000Z',
  };
}

test('1-3. All seven default members appear, daily contribution defaults to ₹100, expected daily collection is ₹700', () => {
  const state = createCleanTestState();
  assert.equal(state.members.length, 7);
  assert.deepEqual(
    state.members.map((m) => m.name),
    [
      'Sathish',
      'Kumar',
      'Santhosh',
      'Prakash',
      'Ranjth',
      'Basheer',
      'Mahalakshmi',
    ]
  );
  assert.equal(state.settings.dailyContributionAmount, 100);

  const dashboard = getDailyCollectionDashboard(state, '2026-11-01');
  assert.equal(dashboard.expectedCollection, 700);
  assert.equal(dashboard.totalPendingCollection, 700);
  assert.equal(dashboard.missedCount, 7);
});

test('4-5. Missed payments are recorded, and a ₹200 payment on Day 3 compensates for missed Day 2 + covers Day 3', () => {
  let state = createCleanTestState();
  const sathishId = state.members[0].id;

  // Day 1 (2026-11-01): Member pays ₹100
  state = recordDailySavingsTransaction(state, {
    memberId: sathishId,
    amount: 100,
    transactionDate: '2026-11-01',
    nowTimestamp: '2026-11-01T09:00:00.000Z',
  });

  // Day 2 (2026-11-02): Member misses payment -> verify Day 2 is Missed
  const day2Before = getMemberSavingsForDate(state, sathishId, '2026-11-02');
  assert.equal(day2Before.status, 'Missed');
  assert.equal(day2Before.pendingAmount, 100);

  // Day 3 (2026-11-03): Member pays ₹200, allocated ₹100 to Day 2 and ₹100 to Day 3
  const allocations = buildSavingsAllocations(
    state,
    sathishId,
    200,
    '2026-11-03',
    'cover-missed-then-current'
  );
  assert.deepEqual(allocations, [
    { targetDate: '2026-11-02', amount: 100 },
    { targetDate: '2026-11-03', amount: 100 },
  ]);

  state = recordDailySavingsTransaction(state, {
    memberId: sathishId,
    amount: 200,
    transactionDate: '2026-11-03',
    allocations,
    nowTimestamp: '2026-11-03T09:00:00.000Z',
  });

  const day1After = getMemberSavingsForDate(state, sathishId, '2026-11-01');
  const day2After = getMemberSavingsForDate(state, sathishId, '2026-11-02');
  const day3After = getMemberSavingsForDate(state, sathishId, '2026-11-03');

  assert.equal(day1After.status, 'Paid');
  assert.equal(day2After.status, 'Paid');
  assert.equal(day2After.allocatedAmount, 100);
  assert.equal(day3After.status, 'Paid');
  assert.equal(day3After.allocatedAmount, 100);
});

test('6-7. Loan calculations: ₹5,000 -> 10x₹500, ₹10,000 -> 10x₹1,000, ₹15,000 -> 10x₹1,500, ₹7,500 -> 10x₹750, and uneven remainder distribution', () => {
  const inst5k = generateTenWeeklyInstalments(5000, '2026-11-08', '2026-11-05');
  assert.equal(inst5k.length, 10);
  assert.ok(inst5k.every((i) => i.expectedAmount === 500));
  assert.equal(
    inst5k.reduce((s, i) => s + i.expectedAmount, 0),
    5000
  );

  const inst10k = generateTenWeeklyInstalments(10000, '2026-11-08', '2026-11-05');
  assert.equal(inst10k.length, 10);
  assert.ok(inst10k.every((i) => i.expectedAmount === 1000));

  const inst15k = generateTenWeeklyInstalments(15000, '2026-11-08', '2026-11-05');
  assert.equal(inst15k.length, 10);
  assert.ok(inst15k.every((i) => i.expectedAmount === 1500));

  const inst7500 = generateTenWeeklyInstalments(7500, '2026-11-08', '2026-11-05');
  assert.equal(inst7500.length, 10);
  assert.ok(inst7500.every((i) => i.expectedAmount === 750));

  // Uneven amount test: ₹5,003 -> first 3 instalments ₹501, remaining 7 instalments ₹500 = ₹5,003 exact
  const instUneven = generateTenWeeklyInstalments(5003, '2026-11-08', '2026-11-05');
  assert.equal(
    instUneven.reduce((s, i) => s + i.expectedAmount, 0),
    5003
  );
  assert.equal(instUneven[0].expectedAmount, 501);
  assert.equal(instUneven[2].expectedAmount, 501);
  assert.equal(instUneven[3].expectedAmount, 500);
});

test('8-11. Partial repayments, advance multi-instalment allocation, overdue detection, outstanding principal & available group cash formula', () => {
  let state = createCleanTestState();

  // Collect ₹12,000 in savings so group has cash
  state = recordDailySavingsTransaction(state, {
    memberId: state.members[0].id,
    amount: 6000,
    transactionDate: '2026-11-01',
    nowTimestamp: '2026-11-01T10:00:00.000Z',
  });
  state = recordDailySavingsTransaction(state, {
    memberId: state.members[1].id,
    amount: 6000,
    transactionDate: '2026-11-01',
    nowTimestamp: '2026-11-01T10:05:00.000Z',
  });

  // Issue ₹5,000 loan to Kumar (member-2), with first instalment on 2026-11-02 (so by 2026-11-05 Inst #1 is overdue!)
  state = issueEmergencyLoan(state, {
    borrowerId: state.members[1].id,
    principalAmount: 5000,
    issueDateISO: '2026-10-26',
    firstInstalmentDateISO: '2026-11-02',
    nowTimestamp: '2026-10-26T12:00:00.000Z',
  });

  const loanId = state.loans[0].id;
  // Before repayment: Inst #1 (due 2026-11-02 < ref 2026-11-05) should be Overdue
  assert.equal(state.loans[0].instalments[0].status, 'Overdue');
  assert.equal(state.loans[0].instalments[1].status, 'Upcoming');

  // Check Available Group Cash = 12,000 savings + 0 repaid - 5,000 loan issued = 7,000
  let summary = calculateGroupFinancialSummary(state);
  assert.equal(summary.totalSavingsCollected, 12000);
  assert.equal(summary.totalLoansIssued, 5000);
  assert.equal(summary.totalLoanPrincipalRepaid, 0);
  assert.equal(summary.totalOutstandingLoanPrincipal, 5000);
  assert.equal(summary.availableGroupCash, 7000);

  // Borrower pays ₹1,000 (covers Inst #1 of ₹500 and Inst #2 of ₹500)
  state = recordLoanRepayment(state, {
    loanId,
    paymentAmount: 1000,
    paymentDateISO: '2026-11-05',
    nowTimestamp: '2026-11-05T11:00:00.000Z',
  });

  assert.equal(state.loans[0].instalments[0].status, 'Paid');
  assert.equal(state.loans[0].instalments[1].status, 'Paid');

  // Borrower makes a partial payment of ₹200 toward Inst #3
  state = recordLoanRepayment(state, {
    loanId,
    paymentAmount: 200,
    paymentDateISO: '2026-11-05',
    nowTimestamp: '2026-11-05T11:10:00.000Z',
  });

  assert.equal(state.loans[0].instalments[2].status, 'Partially Paid');
  assert.equal(state.loans[0].instalments[2].amountPaid, 200);
  assert.equal(state.loans[0].instalments[2].remainingBalance, 300);

  // Check updated Group Financial Summary:
  // Savings = 12,000; Repaid = 1,200; Loans Issued = 5,000; Outstanding = 3,800; Available Cash = 12,000 + 1,200 - 5,000 = 8,200
  summary = calculateGroupFinancialSummary(state);
  assert.equal(summary.totalSavingsCollected, 12000);
  assert.equal(summary.totalLoanPrincipalRepaid, 1200);
  assert.equal(summary.totalOutstandingLoanPrincipal, 3800);
  assert.equal(summary.availableGroupCash, 8200);
});

test('12. Editing member name never deletes historical financial transactions, and corrections keep audit trail', () => {
  let state = createCleanTestState();
  const ranjthId = state.members[4].id; // Ranjth

  state = recordDailySavingsTransaction(state, {
    memberId: ranjthId,
    amount: 100,
    transactionDate: '2026-11-01',
    nowTimestamp: '2026-11-01T08:00:00.000Z',
  });

  const txnId = state.transactions[0].id;

  // Rename Ranjth -> Ranjith Kumar
  state = renameMember(state, ranjthId, 'Ranjith Kumar', '2026-11-05');
  assert.equal(state.members[4].name, 'Ranjith Kumar');
  assert.equal(state.transactions.length, 1);
  assert.equal(state.transactions[0].memberId, ranjthId);

  const dayStat = getMemberSavingsForDate(state, ranjthId, '2026-11-01');
  assert.equal(dayStat.memberName, 'Ranjith Kumar');
  assert.equal(dayStat.allocatedAmount, 100);

  // Edit transaction with audit trail
  state = editSavingsTransactionWithAudit(state, {
    transactionId: txnId,
    correctedAmount: 200,
    correctedAllocations: [
      { targetDate: '2026-11-01', amount: 100 },
      { targetDate: '2026-11-02', amount: 100 },
    ],
    reason: 'Member actually gave ₹200 covering 01-11-2026 and 02-11-2026',
    correctionDateISO: '2026-11-05',
  });

  assert.equal(state.transactions[0].amount, 200);
  assert.equal(state.transactions[0].auditTrail.length, 1);
  assert.equal(state.transactions[0].auditTrail[0].originalAmount, 100);
  assert.equal(state.transactions[0].auditTrail[0].correctedAmount, 200);
  assert.equal(formatDateDDMMYYYY('2026-11-05'), '05-11-2026');
});
