import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DAILY_CONTRIBUTION,
  createDefaultMembers,
  renameMember,
  generateTenWeeklyInstalments,
  getDailyCollectionDashboard,
  getMemberSavingsForDate,
  buildSavingsAllocations,
  recordDailySavingsTransaction,
  saveDailyCollectionBatch,
  editSavingsTransactionWithAudit,
  issueEmergencyLoan,
  recordLoanRepayment,
  calculateGroupFinancialSummary,
  formatDateDDMMYYYY,
  AppDatabaseState,
} from './ledgerEngine';

function createCleanTestState(): AppDatabaseState {
  return {
    version: 2,
    settings: {
      groupName: 'Friends Savings & Loan Manager',
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

test('4-5. Simplified Daily Collection Register saves only selected members, prevents duplicates, and audits edits', () => {
  let state = createCleanTestState();

  // Save collection for 2026-11-05: Sathish pays ₹100, Kumar pays ₹50 (partial), Santhosh pays ₹250 (advance/custom), others unpaid
  const batch1 = saveDailyCollectionBatch(state, {
    paymentDateISO: '2026-11-05',
    entries: [
      { memberId: 'member-1', paid: true, amount: 100 },
      { memberId: 'member-2', paid: true, amount: 50 },
      { memberId: 'member-3', paid: true, amount: 250 },
      { memberId: 'member-4', paid: false, amount: 0 },
      { memberId: 'member-5', paid: false, amount: 0 },
      { memberId: 'member-6', paid: false, amount: 0 },
      { memberId: 'member-7', paid: false, amount: 0 },
    ],
  });

  state = batch1.nextState;
  assert.equal(batch1.savedCount, 3);
  assert.equal(state.transactions.length, 3);

  const dash = getDailyCollectionDashboard(state, '2026-11-05');
  assert.equal(dash.paidCount, 3);
  assert.equal(dash.missedCount, 4);
  assert.equal(dash.totalCashCollectedOnDate, 400);

  // Re-submitting the exact same values for 2026-11-05 must NOT create duplicate records
  const batchDuplicateCheck = saveDailyCollectionBatch(state, {
    paymentDateISO: '2026-11-05',
    entries: [
      { memberId: 'member-1', paid: true, amount: 100 },
      { memberId: 'member-2', paid: true, amount: 50 },
      { memberId: 'member-3', paid: true, amount: 250 },
      { memberId: 'member-4', paid: false, amount: 0 },
      { memberId: 'member-5', paid: false, amount: 0 },
      { memberId: 'member-6', paid: false, amount: 0 },
      { memberId: 'member-7', paid: false, amount: 0 },
    ],
  });
  assert.equal(batchDuplicateCheck.savedCount, 0);
  assert.equal(batchDuplicateCheck.updatedCount, 0);
  assert.equal(batchDuplicateCheck.nextState.transactions.length, 3);

  // Editing Kumar's amount from ₹50 to ₹100 updates existing transaction with audit trail
  const batchEdit = saveDailyCollectionBatch(state, {
    paymentDateISO: '2026-11-05',
    entries: [
      { memberId: 'member-1', paid: true, amount: 100 },
      {
        memberId: 'member-2',
        paid: true,
        amount: 100,
        correctionReason: 'Received remaining ₹50',
      },
      { memberId: 'member-3', paid: true, amount: 250 },
    ],
  });
  state = batchEdit.nextState;
  assert.equal(batchEdit.updatedCount, 1);
  assert.equal(state.transactions.length, 3);
  const kumarTxn = state.transactions.find((t) => t.memberId === 'member-2');
  assert.equal(kumarTxn?.amount, 100);
  assert.equal(kumarTxn?.auditTrail.length, 1);
  assert.equal(kumarTxn?.auditTrail[0].originalAmount, 50);
  assert.equal(kumarTxn?.auditTrail[0].correctedAmount, 100);
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

  const instUneven = generateTenWeeklyInstalments(5003, '2026-11-08', '2026-11-05');
  assert.equal(
    instUneven.reduce((s, i) => s + i.expectedAmount, 0),
    5003
  );
  assert.equal(instUneven[0].expectedAmount, 501);
  assert.equal(instUneven[2].expectedAmount, 501);
  assert.equal(instUneven[3].expectedAmount, 500);
});

test('8-11. Automatic loan repayment allocation, partial repayments, overdue detection, outstanding principal & available group cash formula', () => {
  let state = createCleanTestState();

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

  state = issueEmergencyLoan(state, {
    borrowerId: state.members[1].id,
    principalAmount: 5000,
    issueDateISO: '2026-10-26',
    firstInstalmentDateISO: '2026-11-02',
    repaymentDurationWeeks: 10,
    nowTimestamp: '2026-10-26T12:00:00.000Z',
  });

  const loanId = state.loans[0].id;
  assert.equal(state.loans[0].instalments[0].status, 'Overdue');
  assert.equal(state.loans[0].instalments[1].status, 'Upcoming');

  let summary = calculateGroupFinancialSummary(state);
  assert.equal(summary.totalSavingsCollected, 12000);
  assert.equal(summary.totalLoansIssued, 5000);
  assert.equal(summary.totalLoanPrincipalRepaid, 0);
  assert.equal(summary.totalOutstandingLoanPrincipal, 5000);
  assert.equal(summary.availableGroupCash, 7000);

  // Borrower pays ₹1,250 -> automatically allocates ₹500 to Week 1 (Paid), ₹500 to Week 2 (Paid), ₹250 to Week 3 (Partially Paid)
  state = recordLoanRepayment(state, {
    loanId,
    paymentAmount: 1250,
    paymentDateISO: '2026-11-05',
    nowTimestamp: '2026-11-05T11:00:00.000Z',
  });

  assert.equal(state.loans[0].instalments[0].status, 'Paid');
  assert.equal(state.loans[0].instalments[1].status, 'Paid');
  assert.equal(state.loans[0].instalments[2].status, 'Partially Paid');
  assert.equal(state.loans[0].instalments[2].amountPaid, 250);
  assert.equal(state.loans[0].instalments[2].remainingBalance, 250);

  summary = calculateGroupFinancialSummary(state);
  assert.equal(summary.totalSavingsCollected, 12000);
  assert.equal(summary.totalLoanPrincipalRepaid, 1250);
  assert.equal(summary.totalOutstandingLoanPrincipal, 3750);
  assert.equal(summary.availableGroupCash, 8250);
});

test('12. Editing member name never deletes historical financial transactions, and corrections keep audit trail', () => {
  let state = createCleanTestState();
  const ranjthId = state.members[4].id;

  state = recordDailySavingsTransaction(state, {
    memberId: ranjthId,
    amount: 100,
    transactionDate: '2026-11-01',
    nowTimestamp: '2026-11-01T08:00:00.000Z',
  });

  const txnId = state.transactions[0].id;

  state = renameMember(state, ranjthId, 'Ranjith Kumar', '2026-11-05');
  assert.equal(state.members[4].name, 'Ranjith Kumar');
  assert.equal(state.transactions.length, 1);
  assert.equal(state.transactions[0].memberId, ranjthId);

  const dayStat = getMemberSavingsForDate(state, ranjthId, '2026-11-01');
  assert.equal(dayStat.memberName, 'Ranjith Kumar');
  assert.equal(dayStat.allocatedAmount, 100);

  const allocations = buildSavingsAllocations(
    state,
    ranjthId,
    200,
    '2026-11-03',
    'cover-missed-then-current'
  );
  assert.equal(allocations.length, 2);

  state = editSavingsTransactionWithAudit(state, {
    transactionId: txnId,
    correctedAmount: 200,
    correctedAllocations: [
      { targetDate: '2026-11-01', amount: 100 },
      { targetDate: '2026-11-02', amount: 100 },
    ],
    reason: 'Member actually gave ₹200',
    correctionDateISO: '2026-11-05',
  });

  assert.equal(state.transactions[0].amount, 200);
  assert.equal(state.transactions[0].auditTrail.length, 1);
  assert.equal(formatDateDDMMYYYY('2026-11-05'), '05-11-2026');
});
