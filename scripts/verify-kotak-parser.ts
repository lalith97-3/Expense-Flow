/**
 * Kotak Bank SMS Parser & Shortcut Import Verification Suite
 * 
 * STRICT LIVE DATA SAFETY:
 * Uses 100% mocked SMS samples and mock requests.
 * Zero live calls to Google Sheets or Apps Script.
 */

import { parseKotakBankSms, parseDateDDMMYY } from '../src/utils/kotakSmsParser';

function runKotakParserTests() {
  console.log('===========================================================');
  console.log('Kotak Bank SMS Parser & iPhone Shortcut Import Verification');
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
  // Test 1: Kotak Bank DEBIT SMS Format
  // -------------------------------------------------------------
  console.log('--- 1. Kotak Bank DEBIT Format Verification ---');
  const debitSms = 'Sent Rs.10.00 from Kotak Bank A/c X0175 to ADITYA GENERAL AND B on 21-10-26. UPI Ref 629498873979.';
  const debitParsed = parseKotakBankSms(debitSms);

  assert(debitParsed !== null, 'Debit SMS recognized and parsed successfully');
  if (debitParsed) {
    assert(debitParsed.type === 'Debit', 'Debit type is strictly "Debit"', `Got ${debitParsed.type}`);
    assert(debitParsed.amount === 10, 'Amount is exactly numeric 10 (no fee deducted)', `Got ${debitParsed.amount}`);
    assert(debitParsed.description === 'ADITYA GENERAL AND B', 'Description extracted as "ADITYA GENERAL AND B"', `Got "${debitParsed.description}"`);
    assert(debitParsed.date === '2026-10-21', 'Date converted from 21-10-26 to "2026-10-21"', `Got ${debitParsed.date}`);
    assert(debitParsed.paymentMode === 'UPI', 'Payment mode is "UPI"', `Got ${debitParsed.paymentMode}`);
    assert(debitParsed.category === 'Other', 'Default category is "Other"', `Got ${debitParsed.category}`);
    assert(debitParsed.upiRef === '629498873979', 'UPI reference extracted as "629498873979"', `Got ${debitParsed.upiRef}`);
  }

  // -------------------------------------------------------------
  // Test 2: Kotak Bank CREDIT SMS Format
  // -------------------------------------------------------------
  console.log('\n--- 2. Kotak Bank CREDIT Format Verification ---');
  const creditSms = 'Received Rs.1900.00 in your Kotak Bank AC 0175 from JASWANIYANTHI VEEPU on 17-10-26. UPI Ref:655555090323';
  const creditParsed = parseKotakBankSms(creditSms);

  assert(creditParsed !== null, 'Credit SMS recognized and parsed successfully');
  if (creditParsed) {
    assert(creditParsed.type === 'Credit', 'Credit type is strictly "Credit"', `Got ${creditParsed.type}`);
    assert(creditParsed.amount === 1900, 'Amount is exactly numeric 1900 (no fee deducted)', `Got ${creditParsed.amount}`);
    assert(creditParsed.description === 'JASWANIYANTHI VEEPU', 'Description extracted as "JASWANIYANTHI VEEPU"', `Got "${creditParsed.description}"`);
    assert(creditParsed.date === '2026-10-17', 'Date converted from 17-10-26 to "2026-10-17"', `Got ${creditParsed.date}`);
    assert(creditParsed.paymentMode === 'UPI', 'Payment mode is "UPI"', `Got ${creditParsed.paymentMode}`);
    assert(creditParsed.category === 'Other', 'Default category is "Other"', `Got ${creditParsed.category}`);
    assert(creditParsed.upiRef === '655555090323', 'UPI reference extracted as "655555090323"', `Got ${creditParsed.upiRef}`);
  }

  // -------------------------------------------------------------
  // Test 3: Decimal Amount Preservation
  // -------------------------------------------------------------
  console.log('\n--- 3. Decimal Amount Precision ---');
  const decimalSms = 'Sent Rs.125.50 from Kotak Bank A/c X0175 to BLUE TOKAI COFFEE on 21-10-26. UPI Ref 778899001122.';
  const decimalParsed = parseKotakBankSms(decimalSms);
  assert(decimalParsed !== null, 'Decimal SMS parsed');
  assert(decimalParsed?.amount === 125.50, 'Decimal amount 125.50 preserved without truncation or rounding', `Got ${decimalParsed?.amount}`);

  // -------------------------------------------------------------
  // Test 4: Rejection of Non-Transaction Messages
  // -------------------------------------------------------------
  console.log('\n--- 4. Rejection of Non-Transaction Messages ---');
  const otpMessage = '582910 is your OTP for Kotak Net Banking login. Do not share it with anyone.';
  assert(parseKotakBankSms(otpMessage) === null, 'OTP messages are rejected');

  const failedPaymentMessage = 'Sent Rs.500.00 from Kotak Bank A/c X0175 failed due to technical decline at beneficiary bank.';
  assert(parseKotakBankSms(failedPaymentMessage) === null, 'Failed payment alerts are rejected');

  const balanceAlertMessage = 'Available balance in your Kotak Bank A/c X0175 is Rs.24,500.75 as on 21-10-26.';
  assert(parseKotakBankSms(balanceAlertMessage) === null, 'Balance alerts are rejected');

  const promoMessage = 'Get a pre-approved Kotak Personal Loan up to 5 Lakhs at special interest rates. Apply now!';
  assert(parseKotakBankSms(promoMessage) === null, 'Promotional messages are rejected');

  const randomText = 'Hey, are you free for dinner tonight?';
  assert(parseKotakBankSms(randomText) === null, 'Unrelated random SMS rejected');

  // -------------------------------------------------------------
  // Test 5: Date Conversion Edge Cases
  // -------------------------------------------------------------
  console.log('\n--- 5. Date Conversion (DD-MM-YY to YYYY-MM-DD) ---');
  assert(parseDateDDMMYY('21-10-26') === '2026-10-21', '21-10-26 converts to 2026-10-21');
  assert(parseDateDDMMYY('17-10-26') === '2026-10-17', '17-10-26 converts to 2026-10-17');
  assert(parseDateDDMMYY('05-01-26') === '2026-01-05', '05-01-26 converts to 2026-01-05');
  assert(parseDateDDMMYY('invalid-date') === null, 'Malformed date returns null');

  // -------------------------------------------------------------
  // Test 6: Duplicate UPI Reference Detection Logic (Mocked)
  // -------------------------------------------------------------
  console.log('\n--- 6. Duplicate Prevention Verification (Mocked) ---');
  const testSeenRefs = new Set<string>();
  function checkAndRegister(ref: string | undefined): { duplicate: boolean } {
    if (!ref) return { duplicate: false };
    if (testSeenRefs.has(ref)) return { duplicate: true };
    testSeenRefs.add(ref);
    return { duplicate: false };
  }

  const firstImport = checkAndRegister('629498873979');
  assert(firstImport.duplicate === false, 'First import with UPI Ref 629498873979 is accepted');

  const secondImport = checkAndRegister('629498873979');
  assert(secondImport.duplicate === true, 'Duplicate import with identical UPI Ref 629498873979 is blocked');

  const differentImport = checkAndRegister('655555090323');
  assert(differentImport.duplicate === false, 'Import with distinct UPI Ref 655555090323 is accepted');

  console.log('\n===========================================================');
  console.log(`Summary: All ${passed}/${total} Kotak Bank parser tests passed successfully.`);
  console.log('Zero live records created, modified, or deleted.');
  console.log('===========================================================');
}

runKotakParserTests();
