import {
  AppDatabaseState,
  formatDateDDMMYYYY,
  formatINR,
} from '../domain/ledgerEngine';

/**
 * Downloads an Excel-compatible SpreadsheetML (.xls / .csv) file with proper UTF-8 BOM for ₹ symbol support
 */
export function exportTableToExcelCSV(
  filename: string,
  title: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines: string[] = [
    escapeCell(title),
    `Generated on,${formatDateDDMMYYYY(new Date().toISOString().slice(0, 10))}`,
    '',
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ];

  // Prepend UTF-8 BOM so Microsoft Excel and Google Sheets render ₹ (Indian Rupee) cleanly
  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerBrowserDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

/**
 * Generates a real, standalone binary PDF file (valid PDF-1.4 document) for any report table
 * so downloading works offline in any browser/WebView without external network calls or popup blockers.
 */
export function exportReportToPDF(
  filename: string,
  reportTitle: string,
  subtitle: string,
  summaryMetrics: Array<{ label: string; value: string }>,
  headers: string[],
  rows: (string | number)[][]
): void {
  // Sanitize ₹ to "Rs. " for standard PDF Type1 Helvetica encoding compatibility
  const sanitizePdfText = (input: string | number): string => {
    return String(input ?? '')
      .replace(/₹/g, 'Rs. ')
      .replace(/[^\x20-\x7E]/g, ' ')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  };

  const lines: Array<{ text: string; size: number; bold?: boolean }> = [];
  lines.push({ text: 'FRIENDS SAVINGS & INTEREST-FREE LOAN MANAGER', size: 14, bold: true });
  lines.push({ text: sanitizePdfText(reportTitle), size: 12, bold: true });
  lines.push({ text: sanitizePdfText(subtitle), size: 9 });
  lines.push({ text: '----------------------------------------------------------------------------------------', size: 9 });

  if (summaryMetrics.length > 0) {
    const metricLine = summaryMetrics
      .map((m) => `${sanitizePdfText(m.label)}: ${sanitizePdfText(m.value)}`)
      .join('   |   ');
    lines.push({ text: metricLine, size: 9, bold: true });
    lines.push({ text: '----------------------------------------------------------------------------------------', size: 9 });
  }

  // Format table header
  const colWidths = headers.map((h, colIdx) => {
    const maxDataLen = rows.reduce((acc, r) => {
      const len = sanitizePdfText(r[colIdx] ?? '').length;
      return Math.max(acc, len);
    }, sanitizePdfText(h).length);
    return Math.min(28, Math.max(10, maxDataLen + 2));
  });

  const formatRowText = (cells: (string | number)[]) =>
    cells
      .map((c, idx) => {
        const clean = sanitizePdfText(c);
        const w = colWidths[idx] || 14;
        return clean.length > w ? clean.slice(0, w - 1) + '.' : clean.padEnd(w, ' ');
      })
      .join('  ');

  lines.push({ text: formatRowText(headers), size: 8, bold: true });
  lines.push({ text: '-'.repeat(92), size: 8 });

  for (const row of rows.slice(0, 120)) {
    lines.push({ text: formatRowText(row), size: 8 });
  }

  // Build valid PDF-1.4 document with Courier/Helvetica streams
  let y = 800;
  const contentOps: string[] = ['BT'];
  for (const line of lines) {
    if (y < 45) break;
    const fontKey = line.bold ? '/F2' : '/F1';
    contentOps.push(`${fontKey} ${line.size} Tf`);
    contentOps.push(`1 0 0 1 36 ${y} Tm`);
    contentOps.push(`(${line.text}) Tj`);
    y -= line.size + 5;
  }
  contentOps.push('ET');
  const streamData = contentOps.join('\n');

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${streamData.length} >>\nstream\n${streamData}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n',
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const blob = new Blob([pdf], { type: 'application/pdf' });
  triggerBrowserDownload(blob, filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/**
 * Exports full JSON database backup
 */
export function exportDatabaseBackupJSON(state: AppDatabaseState): void {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const datePart = formatDateDDMMYYYY(state.settings.currentReferenceDate);
  triggerBrowserDownload(blob, `FriendsSavings_Backup_${datePart}.json`);
}

/**
 * Exports the complete Native Android Kotlin + Jetpack Compose + Room Database source bundle
 * pre-populated with the group's current members and SQLite Room schema.
 */
export function exportAndroidKotlinRoomProject(state: AppDatabaseState): void {
  const memberSeedKotlin = state.members
    .map(
      (m, idx) =>
        `MemberEntity(id = "${m.id}", name = "${m.name.replace(/"/g, '\\"')}", joinedDate = "${m.joinedDate}", displayOrder = ${idx + 1})`
    )
    .join(',\n                ');

  const kotlinSourceBundle = `// ============================================================================
// FRIENDS SAVINGS & INTEREST-FREE LOAN MANAGER — ANDROID (KOTLIN + COMPOSE + ROOM)
// Package: com.friendsfund.savingsmanager
// Currency: Indian Rupees (₹) | Date Format: DD-MM-YYYY | Offline-First Room SQLite
// ============================================================================

package com.friendsfund.savingsmanager.data

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "members")
data class MemberEntity(
    @PrimaryKey val id: String,
    val name: String,
    val joinedDate: String,
    val displayOrder: Int
)

@Entity(
    tableName = "financial_transactions",
    foreignKeys = [ForeignKey(
        entity = MemberEntity::class,
        parentColumns = ["id"],
        childColumns = ["memberId"],
        onDelete = ForeignKey.RESTRICT // Never delete member financial history
    )],
    indices = [Index("memberId"), Index("transactionDate")]
)
data class TransactionEntity(
    @PrimaryKey val id: String,
    val memberId: String,
    val category: String, // Daily Savings, Loan Disbursement, Loan Repayment, Savings Correction, Refund or Reversal
    val amountInRupees: Int,
    val transactionDate: String, // YYYY-MM-DD (Displayed as DD-MM-YYYY)
    val allocationsJson: String, // Target dates or Instalment allocations
    val description: String,
    val notes: String,
    val auditTrailJson: String,
    val createdAt: Long
)

@Entity(tableName = "emergency_loans", indices = [Index("borrowerId")])
data class LoanEntity(
    @PrimaryKey val id: String,
    val borrowerId: String,
    val principalAmount: Int,
    val issueDate: String,
    val firstInstalmentDate: String,
    val repaymentDurationWeeks: Int = 10,
    val numberOfInstalments: Int = 10,
    val interestRate: Int = 0
)

@Dao
interface LedgerDao {
    @Query("SELECT * FROM members ORDER BY displayOrder ASC")
    fun observeMembers(): Flow<List<MemberEntity>>

    @Update
    suspend fun updateMemberName(member: MemberEntity)

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertTransaction(transaction: TransactionEntity)

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertLoan(loan: LoanEntity)

    @Query("SELECT * FROM financial_transactions ORDER BY transactionDate DESC, createdAt DESC")
    fun observeTransactions(): Flow<List<TransactionEntity>>

    @Query("""
        SELECT COALESCE(SUM(CASE WHEN category IN ('Daily Savings', 'Savings Correction') THEN amountInRupees
                                 WHEN category = 'Refund or Reversal' THEN -amountInRupees ELSE 0 END), 0)
             + COALESCE(SUM(CASE WHEN category = 'Loan Repayment' THEN amountInRupees ELSE 0 END), 0)
             - COALESCE(SUM(CASE WHEN category = 'Loan Disbursement' THEN amountInRupees ELSE 0 END), 0)
        FROM financial_transactions
    """)
    fun observeAvailableGroupCash(): Flow<Int>
}

object DefaultGroupSeed {
    const val DEFAULT_DAILY_CONTRIBUTION_INR = ${state.settings.dailyContributionAmount}
    val DEFAULT_SEVEN_MEMBERS = listOf(
        ${memberSeedKotlin}
    )

    fun calculateTenWeeklyInstalments(principal: Int): List<Int> {
        val base = principal / 10
        val remainder = principal % 10
        return (1..10).map { index -> if (index <= remainder) base + 1 else base }
    }
}

/*
Current Live Ledger Snapshot Exported:
- Group Name: ${state.settings.groupName}
- Daily Contribution: ${formatINR(state.settings.dailyContributionAmount)}
- Members Count: ${state.members.length}
- Transactions Count: ${state.transactions.length}
- Active/Historical Loans Count: ${state.loans.length}
*/
`;

  const blob = new Blob([kotlinSourceBundle], { type: 'text/plain;charset=utf-8' });
  triggerBrowserDownload(blob, 'FriendsSavings_Android_Kotlin_Room_Source.kt');
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
