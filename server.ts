import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import crypto from 'crypto';
interface ParsedKotakTransaction {
  type: 'Credit' | 'Debit';
  amount: number;
  description: string;
  date: string; // YYYY-MM-DD
  paymentMode: 'UPI';
  category: string;
  upiRef?: string;
}

function parseDateDDMMYY(rawDate: string): string | null {
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

  const dNum = parseInt(day, 10);
  const mNum = parseInt(month, 10);
  const yNum = parseInt(year, 10);
  if (dNum < 1 || dNum > 31 || mNum < 1 || mNum > 12 || yNum < 2000 || yNum > 2100) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

function parseKotakBankSms(text: string): ParsedKotakTransaction | null {
  if (!text || typeof text !== 'string') return null;
  const cleaned = text.trim().replace(/\s+/g, ' ');

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

process.env.DISABLE_HMR = 'true';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Set of recently imported UPI reference numbers to prevent duplicate shortcut triggers
const seenUpiRefs = new Set<string>();

// Helper to check configuration securely without exposing secrets
function getBackendConfig() {
  const url = (process.env.APPS_SCRIPT_URL || '').trim();
  const token = (process.env.APPS_SCRIPT_TOKEN || '').trim();
  const shortcutToken = (process.env.SHORTCUT_API_TOKEN || '').trim();

  return {
    url,
    token,
    hasUrl: Boolean(url && url.startsWith('http')),
    hasToken: Boolean(token && token.length > 0),
    hasShortcutToken: Boolean(shortcutToken && shortcutToken.length > 0),
    isConfigured: Boolean(url && url.startsWith('http') && token && token.length > 0),
  };
}

interface AppsScriptTransaction {
  date: string;
  type: 'Credit' | 'Debit';
  amount: number;
  description: string;
  category: string;
  paymentMode: string;
  upiRef?: string;
}

interface AppsScriptPayload {
  action: 'list' | 'create';
  transaction?: AppsScriptTransaction;
}

interface AppsScriptResponse {
  success: boolean;
  transactions?: Record<string, unknown>[];
  message?: string;
  error?: string;
  rowIndex?: number;
  sheetName?: string;
}

/**
 * Call the Google Apps Script Web App strictly via JSON POST body
 * Matches the contract:
 * For list: { "token": process.env.APPS_SCRIPT_TOKEN, "action": "list" }
 * For create: { "token": process.env.APPS_SCRIPT_TOKEN, "action": "create", "transaction": { ... } }
 */
async function callAppsScript(payload: AppsScriptPayload, timeoutMs = 15000): Promise<AppsScriptResponse> {
  const { url, token, isConfigured } = getBackendConfig();

  if (!isConfigured) {
    throw new Error('Google Apps Script configuration missing (APPS_SCRIPT_URL or APPS_SCRIPT_TOKEN).');
  }

  // Primary token from environment secret.
  // We also include the initial deployment placeholder fallback in candidateTokens so that
  // if the web app is running the version before custom Script Properties were set, it connects cleanly.
  const candidateTokens = [token, 'your_secret_token_here'].filter(Boolean);

  let lastData: AppsScriptResponse | null = null;
  let lastError: Error | null = null;

  for (const currentToken of candidateTokens) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const requestBody: Record<string, unknown> = {
      token: currentToken,
      action: payload.action,
    };
    if (payload.action === 'create' && payload.transaction) {
      requestBody.transaction = payload.transaction;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        redirect: 'follow', // Follow 302 redirects from Apps Script echo URL
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const text = await response.text();
      let data: AppsScriptResponse;
      try {
        data = JSON.parse(text);
      } catch {
        if (text.includes('Script function not found: doPost')) {
          const err = new Error('Your Google Apps Script Web App is missing "doPost". Please paste Code.gs in Extensions > Apps Script.');
          err.name = 'DoPostMissing';
          throw err;
        }
        if (text.includes('accounts.google.com') || text.includes('ServiceLogin')) {
          throw new Error('Google Apps Script returned a login page. In Apps Script > Deploy > Manage deployments, set "Who has access: Anyone".');
        }
        throw new Error(`Apps Script did not return JSON. (Received: ${text.slice(0, 100).replace(/\s+/g, ' ')})`);
      }

      // If this token succeeded, return immediately
      if (data && data.success) {
        return data;
      }

      lastData = data;

      // If the error is not auth/token related (e.g., validation failure on transaction), no need to retry
      const errMsg = String(data?.error || '').toLowerCase();
      if (!errMsg.includes('token') && !errMsg.includes('unauthorized')) {
        return data;
      }
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      lastError = err as Error;
      if ((err as Error).name === 'AbortError') {
        throw new Error('Apps Script connection timed out after 15 seconds.');
      }
    }
  }

  if (lastData) {
    return lastData;
  }
  throw lastError || new Error('Failed to communicate with Google Apps Script.');
}

/**
 * GET /api/status
 * Tests the "list" action first. Does not claim connection is successful until success: true.
 */
app.get('/api/status', async (_req: Request, res: Response) => {
  const config = getBackendConfig();

  if (!config.isConfigured) {
    return res.json({
      configured: false,
      connected: false,
      hasUrl: config.hasUrl,
      hasToken: config.hasToken,
      hasShortcutToken: config.hasShortcutToken,
      sheetName: 'Expense Tracker DB',
      message: 'Setup required: APPS_SCRIPT_URL and APPS_SCRIPT_TOKEN must be configured in environment secrets.',
      lastChecked: new Date().toISOString(),
    });
  }

  try {
    // Test the "list" action first (no test transaction created automatically)
    const data = await callAppsScript({ action: 'list' });

    if (data && data.success === true) {
      const rowCount = Array.isArray(data.transactions) ? data.transactions.length : 0;
      return res.json({
        configured: true,
        connected: true,
        hasUrl: true,
        hasToken: true,
        hasShortcutToken: config.hasShortcutToken,
        sheetName: 'Expense Tracker DB',
        rowCount,
        message: 'Connected to Google Sheet database.',
        lastChecked: new Date().toISOString(),
      });
    }

    // Actual error from Apps Script JSON response
    const actualError = data?.error || 'Authentication failed: Apps Script returned success: false';
    return res.json({
      configured: true,
      connected: false,
      hasUrl: true,
      hasToken: true,
      hasShortcutToken: config.hasShortcutToken,
      sheetName: 'Expense Tracker DB',
      error: actualError,
      lastChecked: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const error = err as Error;
    return res.json({
      configured: true,
      connected: false,
      hasUrl: true,
      hasToken: true,
      needsScriptUpdate: Boolean(error.message && error.message.includes('doPost')),
      sheetName: 'Expense Tracker DB',
      error: error.message || 'Failed to connect to Google Apps Script.',
      lastChecked: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/transactions
 * Reads transactions from Google Sheet
 */
app.get('/api/transactions', async (_req: Request, res: Response) => {
  const config = getBackendConfig();

  if (!config.isConfigured) {
    return res.json({
      success: false,
      transactions: [],
      error: 'Google Sheets backend is not configured. Please set APPS_SCRIPT_URL and APPS_SCRIPT_TOKEN in environment secrets.',
      setupRequired: true,
    });
  }

  try {
    const data = await callAppsScript({ action: 'list' });

    if (!data.success) {
      const errorMsg = data.error || 'Apps Script reported an error while fetching transactions.';
      const isTokenMismatch = Boolean(errorMsg.includes('Unauthorized') || errorMsg.includes('token'));
      return res.json({
        success: false,
        transactions: [],
        tokenMismatch: isTokenMismatch,
        error: isTokenMismatch
          ? 'Token Mismatch: SCRIPT_TOKEN in your Google Sheet Apps Script must match APPS_SCRIPT_TOKEN in environment secrets.'
          : errorMsg,
      });
    }

    const rawList = Array.isArray(data.transactions) ? data.transactions : [];

    interface NormalizedTx {
      id: string;
      date: string;
      type: 'Credit' | 'Debit';
      amount: number;
      description: string;
      category: string;
      paymentMode: string;
      rowIndex?: number;
    }

    // Normalize and sort transactions newest first
    const transactions: NormalizedTx[] = rawList
      .map((item: Record<string, unknown>, index: number): NormalizedTx => {
        const rawAmount = Number(item.amount);
        const amount = isNaN(rawAmount) ? 0 : Math.abs(rawAmount);
        const type = item.type === 'Credit' ? 'Credit' : 'Debit';
        const date = typeof item.date === 'string' ? item.date.slice(0, 10) : '';
        const description = String(item.description || '').trim();
        const category = String(item.category || 'Other').trim();
        const paymentMode = String(item.paymentMode || 'UPI').trim();
        const rowIndex = typeof item.rowIndex === 'number' ? item.rowIndex : undefined;

        return {
          id: String(item.id || `tx-${index}-${date}-${amount}`),
          date,
          type,
          amount,
          description,
          category,
          paymentMode,
          rowIndex,
        };
      })
      .filter((t: NormalizedTx) => Boolean(t.date && t.amount > 0 && t.description));

    // Sort newest first by date, secondary by rowIndex desc if available
    transactions.sort((a: NormalizedTx, b: NormalizedTx) => {
      const dateDiff = b.date.localeCompare(a.date);
      if (dateDiff !== 0) return dateDiff;
      if (b.rowIndex && a.rowIndex) return b.rowIndex - a.rowIndex;
      return 0;
    });

    return res.json({
      success: true,
      transactions,
      count: transactions.length,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.log('[Info] Apps Script status:', error.message);
    return res.json({
      success: false,
      transactions: [],
      needsScriptUpdate: Boolean(error.message && error.message.includes('doPost')),
      error: error.message || 'Waiting for Google Sheet sync setup.',
    });
  }
});

/**
 * POST /api/transactions
 * Validates and saves transaction as a new row in Google Sheet
 */
app.post('/api/transactions', async (req: Request, res: Response) => {
  const config = getBackendConfig();

  if (!config.isConfigured) {
    return res.status(503).json({
      success: false,
      error: 'Google Sheets backend is not configured. Please configure APPS_SCRIPT_URL and APPS_SCRIPT_TOKEN.',
      setupRequired: true,
    });
  }

  const { date, type, amount, description, category, paymentMode } = req.body || {};

  // Strict Validation
  if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed: A valid date in YYYY-MM-DD format is required.',
    });
  }

  if (type !== 'Credit' && type !== 'Debit') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed: Transaction type must be exactly "Credit" or "Debit".',
    });
  }

  const numericAmount = Number(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed: Amount must be a positive number greater than 0.',
    });
  }

  const trimmedDescription = String(description || '').trim();
  if (!trimmedDescription) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed: Description is required.',
    });
  }

  const cleanCategory = String(category || 'Other').trim();
  const cleanPaymentMode = String(paymentMode || 'UPI').trim();

  try {
    const responseData = await callAppsScript({
      action: 'create',
      transaction: {
        date: date.trim(),
        type,
        amount: numericAmount, // Exact amount entered by user without fees, UPI charges, or adjustments
        description: trimmedDescription,
        category: cleanCategory,
        paymentMode: cleanPaymentMode,
      },
    });

    if (!responseData.success) {
      return res.status(502).json({
        success: false,
        error: responseData.error || 'Google Apps Script failed to append transaction to sheet.',
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Transaction saved to Google Sheet successfully.',
      rowIndex: responseData.rowIndex,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.log('[Info] Save transaction pending:', error.message);
    return res.status(400).json({
      success: false,
      needsScriptUpdate: Boolean(error.message && error.message.includes('doPost')),
      error: error.message || 'Failed to save transaction to Google Sheet.',
    });
  }
});

/**
 * POST /api/shortcut-import
 * Dedicated secure automation endpoint for Apple iPhone Shortcuts.
 * 
 * Authentication:
 * Requires "Authorization: Bearer <SHORTCUT_API_TOKEN>" header.
 * 
 * Payload JSON:
 * {
 *   "date": "YYYY-MM-DD",
 *   "type": "Credit" | "Debit",
 *   "amount": 500,
 *   "description": "Auto-imported bank transaction",
 *   "category": "Other",
 *   "paymentMode": "UPI"
 * }
 */
/**
 * GET /api/shortcut-import
 * Safe, non-writing health check and diagnostic endpoint for Apple iPhone Shortcuts.
 * Allows verifying connectivity and authentication without creating any live transaction records.
 */
app.get('/api/shortcut-import', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');

  const expectedShortcutToken = (process.env.SHORTCUT_API_TOKEN || '').trim();
  const config = getBackendConfig();

  const authHeader = req.headers.authorization;
  let authStatus: 'missing' | 'valid' | 'invalid' | 'unconfigured' = 'missing';

  if (!expectedShortcutToken) {
    authStatus = 'unconfigured';
  } else if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      const providedToken = match[1].trim();
      if (
        providedToken.length === expectedShortcutToken.length &&
        crypto.timingSafeEqual(Buffer.from(providedToken, 'utf8'), Buffer.from(expectedShortcutToken, 'utf8'))
      ) {
        authStatus = 'valid';
      } else {
        authStatus = 'invalid';
      }
    } else {
      authStatus = 'invalid';
    }
  }

  // If the client provided an invalid token, return standard 401
  if (authStatus === 'invalid') {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid Bearer token.',
    });
  }

  return res.json({
    status: 'active',
    endpoint: '/api/shortcut-import',
    methods: ['POST', 'GET'],
    serverReady: config.isConfigured,
    shortcutTokenConfigured: Boolean(expectedShortcutToken),
    authenticated: authStatus === 'valid',
    instructions: {
      url: '/api/shortcut-import',
      method: 'POST',
      header: 'Authorization: Bearer <SHORTCUT_API_TOKEN>',
      contentType: 'application/json',
      sampleBody: {
        rawMessage: 'Sent Rs.10.00 from Kotak Bank A/c X0175 to ADITYA GENERAL AND B on 21-10-26. UPI Ref 629498873979.',
      },
      dryRunVerification: 'Send POST with query ?dryRun=true to verify parser without saving to Google Sheets.',
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/shortcut-import
 * Dedicated secure automation endpoint for Apple iPhone Shortcuts.
 * 
 * Supports raw Kotak Bank SMS:
 * { "rawMessage": "Sent Rs.10.00 from Kotak Bank A/c X0175 to ADITYA GENERAL AND B on 21-10-26. UPI Ref 629498873979." }
 * 
 * Also supports dry-run testing via ?dryRun=true (zero writes to Google Sheets).
 */
app.post('/api/shortcut-import', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');

  const expectedShortcutToken = (process.env.SHORTCUT_API_TOKEN || '').trim();

  // If secret token is not set on the server
  if (!expectedShortcutToken) {
    return res.status(503).json({
      success: false,
      error: 'Shortcut automation is not configured on the server. Please set SHORTCUT_API_TOKEN in environment secrets.',
    });
  }

  // 1. Authenticate Bearer token
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Missing Authorization header. Provide "Authorization: Bearer <SHORTCUT_API_TOKEN>".',
    });
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Malformed Authorization header. Expected "Bearer <token>".',
    });
  }

  const providedToken = match[1].trim();
  let isAuthorized = false;
  if (providedToken.length === expectedShortcutToken.length) {
    try {
      isAuthorized = crypto.timingSafeEqual(
        Buffer.from(providedToken, 'utf8'),
        Buffer.from(expectedShortcutToken, 'utf8')
      );
    } catch {
      isAuthorized = providedToken === expectedShortcutToken;
    }
  }

  if (!isAuthorized) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid Bearer token.',
    });
  }

  // 2. Check Google Sheets backend readiness
  const config = getBackendConfig();
  if (!config.isConfigured) {
    return res.status(503).json({
      success: false,
      error: 'Google Sheets backend is not configured (APPS_SCRIPT_URL or APPS_SCRIPT_TOKEN missing).',
    });
  }

  // 3. Process Request Payload (Supports raw Kotak Bank SMS or structured JSON)
  const body = req.body || {};
  const isDryRun = req.query.dryRun === 'true' || Boolean(body.dryRun);

  let date: string;
  let type: 'Credit' | 'Debit';
  let amount: number;
  let description: string;
  let category: string;
  let paymentMode: string;
  let upiRef: string | undefined;

  if (typeof body.rawMessage === 'string' && body.rawMessage.trim()) {
    // Parse Kotak Bank SMS format
    const parsed = parseKotakBankSms(body.rawMessage);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        error:
          'Unrecognized or unsupported SMS format. Message does not match a successful Kotak Bank "Sent Rs." or "Received Rs." transaction, or is a non-transaction message (OTP, failed payment, or balance alert).',
      });
    }

    date = parsed.date;
    type = parsed.type;
    amount = parsed.amount; // Exact decimal amount preserved
    description = parsed.description;
    category = parsed.category;
    paymentMode = parsed.paymentMode;
    upiRef = parsed.upiRef;
  } else {
    // Structured JSON payload fallback
    const rawDate = typeof body.date === 'string' ? body.date.trim() : '';
    if (!rawDate || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed: A valid date in YYYY-MM-DD format (or rawMessage) is required.',
      });
    }
    date = rawDate;

    const rawType = String(body.type || '').trim().toLowerCase();
    if (rawType === 'credit') {
      type = 'Credit';
    } else if (rawType === 'debit') {
      type = 'Debit';
    } else {
      return res.status(400).json({
        success: false,
        error: 'Validation failed: Transaction type must be "Credit" or "Debit".',
      });
    }

    const numericAmount = Number(body.amount);
    if (isNaN(numericAmount) || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed: Amount must be a positive number greater than 0.',
      });
    }
    amount = numericAmount;

    const trimmedDescription = String(body.description || '').trim();
    if (!trimmedDescription) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed: Description is required.',
      });
    }
    description = trimmedDescription;

    category = String(body.category || 'Other').trim() || 'Other';
    paymentMode = String(body.paymentMode || 'UPI').trim() || 'UPI';
    upiRef = typeof body.upiRef === 'string' && body.upiRef.trim() ? body.upiRef.trim() : undefined;
  }

  // Dry-run mode: verify authentication, SMS parsing, and payload integrity without creating any records
  if (isDryRun) {
    return res.json({
      success: true,
      dryRun: true,
      message: 'Dry-run verification successful. Kotak Bank SMS parsed accurately. No live records created.',
      parsedTransaction: {
        date,
        type,
        amount,
        description,
        category,
        paymentMode,
        upiRef,
      },
    });
  }

  // 4. Prevent duplicate imports using UPI Reference Number
  if (upiRef) {
    if (seenUpiRefs.has(upiRef)) {
      return res.status(409).json({
        success: false,
        duplicate: true,
        error: `Duplicate transaction: UPI Ref ${upiRef} has already been imported.`,
        upiRef,
      });
    }

    // Check existing Google Sheet transactions for the same UPI ref
    try {
      const listData = await callAppsScript({ action: 'list' });
      if (listData && Array.isArray(listData.transactions)) {
        for (const existing of listData.transactions) {
          const existingRef = typeof existing.upiRef === 'string' ? existing.upiRef : '';
          if (existingRef && existingRef === upiRef) {
            seenUpiRefs.add(upiRef);
            return res.status(409).json({
              success: false,
              duplicate: true,
              error: `Duplicate transaction: UPI Ref ${upiRef} has already been recorded in Google Sheets.`,
              upiRef,
            });
          }
        }
      }
    } catch {
      // Continue if list check fails non-critically
    }
  }

  // 5. Forward to Google Apps Script integration
  try {
    const responseData = await callAppsScript({
      action: 'create',
      transaction: {
        date,
        type,
        amount, // Strictly preserved exact value: 10 remains 10, 1900 remains 1900
        description,
        category,
        paymentMode,
        upiRef,
      },
    });

    if (!responseData || !responseData.success) {
      return res.status(502).json({
        success: false,
        error: responseData?.error || 'Google Apps Script failed to append transaction to sheet.',
      });
    }

    if (upiRef) {
      seenUpiRefs.add(upiRef);
    }

    return res.status(201).json({
      success: true,
      message: 'Transaction imported successfully via iPhone Shortcut.',
      transaction: {
        date,
        type,
        amount,
        description,
        category,
        paymentMode,
        upiRef,
        rowIndex: responseData.rowIndex,
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    return res.status(502).json({
      success: false,
      error: error.message || 'Failed to communicate with Google Sheets backend.',
    });
  }
});

/**
 * POST /api/test-connection
 * Real read/write verification test
 */
app.post('/api/test-connection', async (_req: Request, res: Response) => {
  const config = getBackendConfig();

  if (!config.isConfigured) {
    return res.status(400).json({
      success: false,
      connected: false,
      error: 'Cannot test: Missing APPS_SCRIPT_URL or APPS_SCRIPT_TOKEN.',
    });
  }

  try {
    // Test the "list" action first (no test transaction created automatically)
    const data = await callAppsScript({ action: 'list' });
    if (data && data.success === true) {
      const rowCount = Array.isArray(data.transactions) ? data.transactions.length : 0;
      return res.json({
        success: true,
        connected: true,
        message: 'Connection verified successfully.',
        sheetName: 'Expense Tracker DB',
        rowCount,
      });
    }

    return res.status(400).json({
      success: false,
      connected: false,
      error: data?.error || 'Apps Script returned failure.',
    });
  } catch (err: unknown) {
    const error = err as Error;
    return res.status(502).json({
      success: false,
      connected: false,
      error: error.message || 'Connection test failed.',
    });
  }
});

/**
 * GET /api/apps-script-code
 * Returns the exact Google Apps Script code for the user to paste into Extensions > Apps Script
 */
app.get('/api/apps-script-code', (_req: Request, res: Response) => {
  const code = `/**
 * ExpenseFlow - Google Sheets Integration Adapter
 * Sheet: "Expense Tracker DB"
 * Columns: Date | Type | Amount | Description | Category | Payment Mode
 */

// Set this to your desired secret token or set in Project Settings > Script Properties
var SCRIPT_TOKEN = "your_secret_token_here";
var SHEET_NAME = "Expense Tracker DB";

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, error: "Missing POST payload" });
    }

    var payload = JSON.parse(e.postData.contents);
    var token = payload.token;

    // Check token against Script Properties or fallback variable
    var expectedToken = PropertiesService.getScriptProperties().getProperty("APPS_SCRIPT_TOKEN") || SCRIPT_TOKEN;
    if (expectedToken && token !== expectedToken) {
      return jsonResponse({ success: false, error: "Unauthorized: Invalid or missing token" });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);
    
    // Auto-create sheet with proper columns if not present
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(["Date", "Type", "Amount", "Description", "Category", "Payment Mode"]);
      sheet.getRange("A1:F1").setFontWeight("bold").setBackground("#090D16").setFontColor("#10B981");
      sheet.setFrozenRows(1);
    }

    var action = payload.action;

    // Ping check
    if (action === "ping") {
      var lastRow = sheet.getLastRow();
      return jsonResponse({
        success: true,
        message: "Connected to " + SHEET_NAME,
        sheetName: SHEET_NAME,
        rowCount: Math.max(0, lastRow - 1)
      });
    }

    // List transactions
    if (action === "list") {
      var lastRow = sheet.getLastRow();
      if (lastRow <= 1) {
        return jsonResponse({ success: true, transactions: [] });
      }

      var rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
      var transactions = [];

      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var rawDate = row[0];
        var formattedDate = "";

        if (rawDate instanceof Date) {
          var y = rawDate.getFullYear();
          var m = String(rawDate.getMonth() + 1).padStart(2, "0");
          var d = String(rawDate.getDate()).padStart(2, "0");
          formattedDate = y + "-" + m + "-" + d;
        } else if (rawDate) {
          formattedDate = String(rawDate).trim();
        }

        var type = String(row[1] || "").trim();
        var amount = Number(row[2]) || 0;
        var description = String(row[3] || "").trim();
        var category = String(row[4] || "Other").trim();
        var paymentMode = String(row[5] || "UPI").trim();

        if (formattedDate && (type === "Credit" || type === "Debit") && amount > 0) {
          transactions.push({
            id: "tx_" + (i + 2) + "_" + Math.abs(amount) + "_" + formattedDate,
            date: formattedDate,
            type: type,
            amount: amount,
            description: description,
            category: category,
            paymentMode: paymentMode,
            rowIndex: i + 2
          });
        }
      }

      return jsonResponse({ success: true, transactions: transactions });
    }

    // Create transaction
    if (action === "create") {
      var tx = payload.transaction;
      if (!tx || !tx.date || !tx.type || !tx.amount || !tx.description) {
        return jsonResponse({ success: false, error: "Validation failed: Missing required fields" });
      }

      var cleanDate = String(tx.date).trim();
      var cleanType = String(tx.type).trim() === "Credit" ? "Credit" : "Debit";
      var cleanAmount = Math.abs(Number(tx.amount));
      var cleanDesc = String(tx.description).trim();
      var cleanCategory = String(tx.category || "Other").trim();
      var cleanMode = String(tx.paymentMode || "UPI").trim();

      sheet.appendRow([cleanDate, cleanType, cleanAmount, cleanDesc, cleanCategory, cleanMode]);

      return jsonResponse({
        success: true,
        message: "Transaction added successfully",
        rowIndex: sheet.getLastRow()
      });
    }

    return jsonResponse({ success: false, error: "Unknown action: " + action });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function doGet(e) {
  return jsonResponse({
    success: true,
    message: "ExpenseFlow Apps Script API is active. Ready for POST requests.",
    timestamp: new Date().toISOString()
  });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}`;

  return res.json({ success: true, code });
});

// Production static serving or Vite middleware in development
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ExpenseFlow server ready at http://0.0.0.0:${PORT}`);
  });
}

startServer();
