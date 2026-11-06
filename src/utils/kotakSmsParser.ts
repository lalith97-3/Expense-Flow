/**
 * Kotak Bank SMS Parser for automated iPhone Shortcuts ingestion
 * 
 * Accurately parses standard Kotak Bank UPI transaction SMS formats:
 * - DEBIT: "Sent Rs.10.00 from Kotak Bank A/c X0175 to ADITYA GENERAL AND B on 21-10-26. UPI Ref 629498873979."
 * - CREDIT: "Received Rs.1900.00 in your Kotak Bank AC 0175 from JASWANIYANTHI VEEPU on 17-10-26. UPI Ref:655555090323"
 * 
 * Rejects non-transaction messages (OTPs, failed transactions, balance inquiries, promotional messages).
 */

export interface ParsedKotakTransaction {
  type: 'Credit' | 'Debit';
  amount: number;
  description: string;
  date: string; // YYYY-MM-DD
  paymentMode: 'UPI';
  category: string; // 'Other' by default
  upiRef?: string;
}

/**
 * Converts date from DD-MM-YY (or DD-MM-YYYY) into standardized YYYY-MM-DD
 */
export function parseDateDDMMYY(rawDate: string): string | null {
  if (!rawDate) return null;
  const parts = rawDate.trim().split('-');
  if (parts.length !== 3) return null;

  const day = parts[0].padStart(2, '0');
  const month = parts[1].padStart(2, '0');
  let year = parts[2];

  if (year.length === 2) {
    const num = parseInt(year, 10);
    year = String(num < 50 ? 2000 + num : 1900 + num);
  }

  // Basic calendar range check
  const dNum = parseInt(day, 10);
  const mNum = parseInt(month, 10);
  const yNum = parseInt(year, 10);
  if (dNum < 1 || dNum > 31 || mNum < 1 || mNum > 12 || yNum < 2000 || yNum > 2100) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

/**
 * Parses raw Kotak Bank SMS into validated transaction details.
 * Returns null if the SMS does not match a supported successful transaction format.
 */
export function parseKotakBankSms(text: string): ParsedKotakTransaction | null {
  if (!text || typeof text !== 'string') return null;
  const cleaned = text.trim().replace(/\s+/g, ' ');

  // Immediate filter: reject non-transaction messages (OTPs, failure alerts, balance checks, marketing)
  const lower = cleaned.toLowerCase();
  if (
    lower.includes('otp') ||
    lower.includes('failed') ||
    lower.includes('declined') ||
    lower.includes('unsuccessful') ||
    lower.includes('available bal') ||
    lower.includes('avail bal') ||
    lower.includes('clear bal') ||
    lower.includes('statement') ||
    lower.includes('loan') ||
    lower.includes('reward') ||
    lower.includes('offer')
  ) {
    return null;
  }

  // 1. DEBIT FORMAT
  // "Sent Rs.10.00 from Kotak Bank A/c X0175 to ADITYA GENERAL AND B on 21-10-26. UPI Ref 629498873979."
  const debitRegex = /^Sent\s+(?:Rs\.?|INR)\s*([\d,]+(?:\.\d+)?)\s+from\s+Kotak\s+Bank\s+(?:A\/c|AC|Account)\s+[\w*]+\s+to\s+(.+?)\s+on\s+(\d{1,2}-\d{1,2}-\d{2,4})\.?(?:\s+UPI\s+Ref[:\s]+(\w+))?/i;
  const debitMatch = cleaned.match(debitRegex);

  if (debitMatch) {
    const rawAmount = debitMatch[1].replace(/,/g, '');
    const amount = Number(rawAmount);
    const description = debitMatch[2].trim();
    const date = parseDateDDMMYY(debitMatch[3]);
    const upiRef = debitMatch[4] ? debitMatch[4].trim() : undefined;

    if (!amount || isNaN(amount) || amount <= 0 || !date || !description) {
      return null;
    }

    return {
      type: 'Debit',
      amount,
      description,
      date,
      paymentMode: 'UPI',
      category: 'Other',
      upiRef,
    };
  }

  // 2. CREDIT FORMAT
  // "Received Rs.1900.00 in your Kotak Bank AC 0175 from JASWANIYANTHI VEEPU on 17-10-26. UPI Ref:655555090323"
  const creditRegex = /^Received\s+(?:Rs\.?|INR)\s*([\d,]+(?:\.\d+)?)\s+in\s+your\s+Kotak\s+Bank\s+(?:A\/c|AC|Account)\s+[\w*]+\s+from\s+(.+?)\s+on\s+(\d{1,2}-\d{1,2}-\d{2,4})\.?(?:\s+UPI\s+Ref[:\s]+(\w+))?/i;
  const creditMatch = cleaned.match(creditRegex);

  if (creditMatch) {
    const rawAmount = creditMatch[1].replace(/,/g, '');
    const amount = Number(rawAmount);
    const description = creditMatch[2].trim();
    const date = parseDateDDMMYY(creditMatch[3]);
    const upiRef = creditMatch[4] ? creditMatch[4].trim() : undefined;

    if (!amount || isNaN(amount) || amount <= 0 || !date || !description) {
      return null;
    }

    return {
      type: 'Credit',
      amount,
      description,
      date,
      paymentMode: 'UPI',
      category: 'Other',
      upiRef,
    };
  }

  return null;
}
