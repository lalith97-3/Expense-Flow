export type TransactionType = 'Credit' | 'Debit';

export type TransactionCategory =
  | 'Food'
  | 'Travel'
  | 'Shopping'
  | 'Bills'
  | 'Recharge'
  | 'Health'
  | 'Education'
  | 'Income'
  | 'Refund'
  | 'Other';

export type PaymentMode =
  | 'UPI'
  | 'Cash'
  | 'Debit Card'
  | 'Credit Card'
  | 'Bank Transfer'
  | 'Other';

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  type: TransactionType;
  amount: number;
  description: string;
  category: string;
  paymentMode: string;
  rowIndex?: number;
}

export interface BackendStatus {
  configured: boolean;
  connected: boolean;
  hasUrl: boolean;
  hasToken: boolean;
  hasShortcutToken?: boolean;
  tokenMismatch?: boolean;
  message?: string;
  error?: string;
  needsScriptUpdate?: boolean;
  sheetName?: string;
  rowCount?: number;
  lastChecked?: string;
}

export interface MonthlySummary {
  monthKey: string; // YYYY-MM
  monthLabel: string; // e.g. "October 2026"
  totalCredit: number;
  totalDebit: number;
  netFlow: number;
  transactionCount: number;
}

export interface CategorySummary {
  category: string;
  amount: number;
  percentage: number;
  count: number;
  color: string;
}
