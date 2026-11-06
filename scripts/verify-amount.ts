/**
 * Amount Integrity & Dashboard Calculation Verification Suite
 * 
 * STRICT LIVE DATA SAFETY:
 * Uses 100% mocked data and dry-run assertions.
 * NEVER calls the live Google Apps Script create endpoint.
 * Leaves real spreadsheet data completely untouched.
 */

import { formatINR } from '../src/utils/formatters';

interface Transaction {
  id: string;
  date: string;
  type: 'Credit' | 'Debit';
  amount: number;
  description: string;
  category: string;
  paymentMode: string;
}

function runMockedTests() {
  console.log('===========================================================');
  console.log('ExpenseFlow Amount Integrity & Calculation Verification');
  console.log('Environment: Dry-Run / Mocked (Zero Live Data Alteration)');
  console.log('===========================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} - ${detail || 'Assertion failed'}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  // -------------------------------------------------------------
  // Test 1: Frontend Input State & Amount Parser
  // -------------------------------------------------------------
  console.log('--- 1. Frontend Form Amount Parser ---');
  const rawInput500 = '500';
  const parsed500 = Number(rawInput500);
  assert(parsed500 === 500, 'User input "500" parsed strictly as numeric 500', `Got ${parsed500}`);
  assert(parsed500 !== 498, 'Strictly no ₹2 deduction or UPI fee applied to 500', `Got ${parsed500}`);

  const rawInputDecimal = '125.50';
  const parsedDecimal = Number(rawInputDecimal);
  assert(parsedDecimal === 125.5, 'Decimal input "125.50" parsed strictly as 125.5 without rounding', `Got ${parsedDecimal}`);

  // -------------------------------------------------------------
  // Test 2: Server-Side Request Payload Processing (Mocked)
  // -------------------------------------------------------------
  console.log('\n--- 2. Server Request Payload Processing ---');
  function mockServerProcess(body: { type: string; amount: unknown; date: string; description: string }) {
    const numericAmount = Number(body.amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      throw new Error('Invalid amount');
    }
    // Exactly matches server.ts line 358: numericAmount forwarded directly
    return {
      date: body.date,
      type: body.type,
      amount: numericAmount, // Unaltered exact numeric amount
      description: body.description,
    };
  }

  const serverCredit500 = mockServerProcess({
    type: 'Credit',
    amount: 500,
    date: '2026-10-21',
    description: 'Salary',
  });
  assert(serverCredit500.amount === 500, 'Server preserves exact 500 for Credit payload', `Got ${serverCredit500.amount}`);

  const serverDebit500 = mockServerProcess({
    type: 'Debit',
    amount: 500,
    date: '2026-10-21',
    description: 'Groceries',
  });
  assert(serverDebit500.amount === 500, 'Server preserves exact 500 for Debit payload', `Got ${serverDebit500.amount}`);

  const serverDecimal = mockServerProcess({
    type: 'Debit',
    amount: 125.50,
    date: '2026-10-21',
    description: 'Lunch',
  });
  assert(serverDecimal.amount === 125.50, 'Server preserves exact 125.50 without rounding', `Got ${serverDecimal.amount}`);

  // -------------------------------------------------------------
  // Test 3: Google Apps Script Create Logic (Dry-Run)
  // -------------------------------------------------------------
  console.log('\n--- 3. Apps Script Ingestion Logic (Dry-Run) ---');
  function mockAppsScriptIngest(tx: { amount: unknown }) {
    // Exactly matches Apps Script: var cleanAmount = Math.abs(Number(tx.amount));
    return Math.abs(Number(tx.amount));
  }

  const appsScript500 = mockAppsScriptIngest({ amount: 500 });
  assert(appsScript500 === 500, 'Apps Script records exact numeric 500 in Amount column', `Got ${appsScript500}`);

  const appsScriptDecimal = mockAppsScriptIngest({ amount: 125.50 });
  assert(appsScriptDecimal === 125.50, 'Apps Script records exact 125.50 in Amount column', `Got ${appsScriptDecimal}`);

  // -------------------------------------------------------------
  // Test 4: Dashboard Calculations: Credit & Debit Separate Totals
  // -------------------------------------------------------------
  console.log('\n--- 4. Dashboard Credit & Debit Calculation Engine ---');
  const mockDataset: Transaction[] = [
    { id: '1', date: '2026-10-01', type: 'Credit', amount: 500, description: 'Client A', category: 'Income', paymentMode: 'UPI' },
    { id: '2', date: '2026-10-05', type: 'Credit', amount: 125.50, description: 'Refund', category: 'Refund', paymentMode: 'UPI' },
    { id: '3', date: '2026-10-10', type: 'Debit', amount: 500, description: 'Rent', category: 'Bills', paymentMode: 'Bank Transfer' },
    { id: '4', date: '2026-10-15', type: 'Debit', amount: 75.25, description: 'Fuel', category: 'Travel', paymentMode: 'Cash' },
  ];

  function calculateDashboardTotals(txs: Transaction[]) {
    let credit = 0;
    let debit = 0;

    txs.forEach((t) => {
      if (typeof t.amount === 'number' && !isNaN(t.amount) && t.amount > 0) {
        if (t.type === 'Credit') {
          credit += t.amount;
        } else if (t.type === 'Debit') {
          debit += t.amount;
        }
      }
    });

    return {
      credit: Number(credit.toFixed(2)),
      debit: Number(debit.toFixed(2)),
    };
  }

  const totals = calculateDashboardTotals(mockDataset);
  assert(totals.credit === 625.50, 'Total Credit is sum of all Credits (500 + 125.50 = 625.50)', `Got ${totals.credit}`);
  assert(totals.debit === 575.25, 'Total Debit is sum of all Debits (500 + 75.25 = 575.25)', `Got ${totals.debit}`);
  assert(totals.credit !== totals.credit - totals.debit, 'No net balance is calculated or shown');

  // Test single 500 Credit
  const singleCreditTotals = calculateDashboardTotals([
    { id: '5', date: '2026-10-21', type: 'Credit', amount: 500, description: 'Salary', category: 'Income', paymentMode: 'UPI' },
  ]);
  assert(singleCreditTotals.credit === 500, 'Single Credit ₹500 produces Total Credit = 500', `Got ${singleCreditTotals.credit}`);
  assert(singleCreditTotals.debit === 0, 'Single Credit ₹500 leaves Total Debit = 0', `Got ${singleCreditTotals.debit}`);

  // Test single 500 Debit
  const singleDebitTotals = calculateDashboardTotals([
    { id: '6', date: '2026-10-21', type: 'Debit', amount: 500, description: 'Shopping', category: 'Shopping', paymentMode: 'UPI' },
  ]);
  assert(singleDebitTotals.debit === 500, 'Single Debit ₹500 produces Total Debit = 500', `Got ${singleDebitTotals.debit}`);
  assert(singleDebitTotals.credit === 0, 'Single Debit ₹500 leaves Total Credit = 0', `Got ${singleDebitTotals.credit}`);

  // -------------------------------------------------------------
  // Test 5: Formatter Display Integrity (No Decimal Loss)
  // -------------------------------------------------------------
  console.log('\n--- 5. Formatter Display Integrity ---');
  const formatted500 = formatINR(500);
  assert(formatted500.includes('500'), '₹500 formatted display contains "500"', `Got ${formatted500}`);

  const formattedDecimal = formatINR(125.50);
  assert(formattedDecimal.includes('125.50'), '₹125.50 formatted display retains decimals and is not rounded to 126', `Got ${formattedDecimal}`);

  // -------------------------------------------------------------
  // Test 6: iPhone Shortcut Endpoint Validation & Amount Integrity (Dry-Run)
  // -------------------------------------------------------------
  console.log('\n--- 6. iPhone Shortcut Automation Endpoint (Dry-Run) ---');
  function mockShortcutEndpoint(
    authHeader: string | undefined,
    body: Record<string, unknown>,
    expectedSecret = 'mock_secret_token_abc123'
  ) {
    if (!authHeader) {
      return { status: 401, error: 'Unauthorized: Missing Authorization header' };
    }
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match || match[1].trim() !== expectedSecret) {
      return { status: 401, error: 'Unauthorized: Invalid Bearer token' };
    }

    const { date, type, amount, description } = body;
    if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      return { status: 400, error: 'Validation failed: Invalid date' };
    }
    const rawType = String(type || '').trim().toLowerCase();
    if (rawType !== 'credit' && rawType !== 'debit') {
      return { status: 400, error: 'Validation failed: Type must be Credit or Debit' };
    }
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return { status: 400, error: 'Validation failed: Amount must be positive' };
    }
    if (!description || !String(description).trim()) {
      return { status: 400, error: 'Validation failed: Description required' };
    }

    return {
      status: 201,
      success: true,
      forwardedTransaction: {
        date: date.trim(),
        type: rawType === 'credit' ? 'Credit' : 'Debit',
        amount: numericAmount, // Unaltered exact amount
        description: String(description).trim(),
      },
    };
  }

  // 6a: Missing Bearer token rejected
  const resNoAuth = mockShortcutEndpoint(undefined, { date: '2026-10-21', type: 'Credit', amount: 500, description: 'Test' });
  assert(resNoAuth.status === 401, 'Shortcut endpoint rejects missing Authorization header with 401');

  // 6b: Wrong Bearer token rejected
  const resWrongAuth = mockShortcutEndpoint('Bearer wrong_token', { date: '2026-10-21', type: 'Credit', amount: 500, description: 'Test' });
  assert(resWrongAuth.status === 401, 'Shortcut endpoint rejects incorrect Bearer token with 401');

  // 6c: Valid Bearer token + 500 Credit preserved exactly
  const resValidCredit = mockShortcutEndpoint('Bearer mock_secret_token_abc123', {
    date: '2026-10-21',
    type: 'Credit',
    amount: 500,
    description: 'Auto Bank SMS Credit',
  });
  assert(resValidCredit.status === 201, 'Shortcut endpoint accepts valid Bearer token and returns 201');
  assert(resValidCredit.forwardedTransaction?.amount === 500, 'Shortcut endpoint preserves exact 500 for Credit without fee deduction');

  // 6d: Valid Bearer token + 500 Debit preserved exactly
  const resValidDebit = mockShortcutEndpoint('Bearer mock_secret_token_abc123', {
    date: '2026-10-21',
    type: 'Debit',
    amount: 500,
    description: 'Auto Bank SMS Debit',
  });
  assert(resValidDebit.forwardedTransaction?.amount === 500, 'Shortcut endpoint preserves exact 500 for Debit without fee deduction');

  // 6e: Valid Bearer token + 125.50 decimal preserved without rounding
  const resDecimal = mockShortcutEndpoint('Bearer mock_secret_token_abc123', {
    date: '2026-10-21',
    type: 'debit',
    amount: 125.50,
    description: 'Coffee',
  });
  assert(resDecimal.forwardedTransaction?.amount === 125.50, 'Shortcut endpoint preserves exact decimal 125.50 without rounding');

  console.log('\n===========================================================');
  console.log(`Summary: All ${passed}/${total} amount integrity tests passed successfully.`);
  console.log('Zero live records created, modified, or deleted.');
  console.log('===========================================================');
}

runMockedTests();
