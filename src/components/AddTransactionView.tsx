import React, { useState } from 'react';
import {
  PlusCircle,
  TrendingUp,
  TrendingDown,
  Calendar,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import {
  TransactionType,
  TransactionCategory,
  PaymentMode,
  Transaction,
} from '../types/transaction';
import { getCategoryIcon, getPaymentModeIcon } from '../utils/categoryIcons';
import { formatINR } from '../utils/formatters';

interface Props {
  onSuccess: (newTx: Partial<Transaction>) => void;
  isBackendConfigured: boolean;
  onOpenSetup: () => void;
}

const CATEGORIES: TransactionCategory[] = [
  'Food',
  'Travel',
  'Shopping',
  'Bills',
  'Recharge',
  'Health',
  'Education',
  'Income',
  'Refund',
  'Other',
];

const PAYMENT_MODES: PaymentMode[] = [
  'UPI',
  'Cash',
  'Debit Card',
  'Credit Card',
  'Bank Transfer',
  'Other',
];

const PRESET_AMOUNTS = [100, 250, 500, 1000, 2000, 5000];

export const AddTransactionView: React.FC<Props> = ({
  onSuccess,
  isBackendConfigured,
  onOpenSetup,
}) => {
  // Form State
  const [type, setType] = useState<TransactionType>('Debit');
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [description, setDescription] = useState<string>('');
  const [category, setCategory] = useState<TransactionCategory>('Food');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('UPI');

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Automatically adjust default category when type flips
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    if (newType === 'Credit' && category === 'Food') {
      setCategory('Income');
    } else if (newType === 'Debit' && category === 'Income') {
      setCategory('Food');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isBackendConfigured) {
      setErrorMessage(
        'Google Sheets backend is not configured yet. Please configure APPS_SCRIPT_URL and APPS_SCRIPT_TOKEN.'
      );
      return;
    }

    // Validation - preserve exact amount entered by user without fees or deductions
    const cleanAmount = Number(amount);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      setErrorMessage('Please enter an amount greater than ₹0.');
      return;
    }

    if (!date.trim()) {
      setErrorMessage('Please select a valid date.');
      return;
    }

    if (!description.trim()) {
      setErrorMessage('Please enter a description for the transaction.');
      return;
    }

    if (type !== 'Credit' && type !== 'Debit') {
      setErrorMessage('Transaction type must be Credit or Debit.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: date.trim(),
          type,
          amount: cleanAmount, // Exact amount preserved: no UPI charges or fee deductions
          description: description.trim(),
          category,
          paymentMode,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save transaction to Google Sheet.');
      }

      // Success
      setSuccessMessage(
        `Successfully recorded ${type === 'Credit' ? '+₹' : '−₹'}${formatINR(cleanAmount)} to Google Sheet!`
      );

      // Trigger parent update
      onSuccess({
        date: date.trim(),
        type,
        amount: cleanAmount,
        description: description.trim(),
        category,
        paymentMode,
      });

      // Reset form
      setAmount('');
      setDescription('');
      // Keep selected category and date for convenience, or reset
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Backend alert if missing */}
      {!isBackendConfigured && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start justify-between gap-3 text-amber-300">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs sm:text-sm">
              <p className="font-semibold text-amber-200">Google Sheet Connection Required</p>
              <p className="text-amber-300/80 mt-0.5">
                ExpenseFlow saves directly to your "Expense Tracker DB" sheet. Please add your Apps Script URL and Token in Setup.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenSetup}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-semibold hover:bg-amber-400 transition"
          >
            Configure
          </button>
        </div>
      )}

      {/* Main Form Card */}
      <div className="glass-card rounded-2xl p-5 sm:p-7 shadow-xl border border-slate-800/80">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-emerald-400" />
              Record Transaction
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Appends a new row directly to your Google Sheet database
            </p>
          </div>

          <span className="text-[11px] font-mono-numeric px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            INR (₹)
          </span>
        </div>

        {/* Feedback Alerts */}
        {errorMessage && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-semibold">Error:</span> {errorMessage}
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-semibold">Success:</span> {successMessage}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Type Selector (Credit vs Debit) */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Transaction Type
            </label>
            <div className="grid grid-cols-2 gap-3 p-1 rounded-2xl bg-slate-900/90 border border-slate-800">
              <button
                type="button"
                onClick={() => handleTypeChange('Debit')}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
                  type === 'Debit'
                    ? 'bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-950/40 ring-1 ring-rose-400/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <TrendingDown className="w-4 h-4 text-white" />
                <span>Debit (Expense)</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('Credit')}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
                  type === 'Credit'
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-400/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <TrendingUp className="w-4 h-4 text-white" />
                <span>Credit (Income)</span>
              </button>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Amount (₹)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400">
                ₹
              </span>
              <input
                type="number"
                step="any"
                inputMode="decimal"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl pl-11 pr-4 py-3.5 text-2xl font-bold font-mono-numeric text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              />
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-2 mt-2.5 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-[11px] text-slate-500 flex-shrink-0">Quick:</span>
              {PRESET_AMOUNTS.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmount(String(val))}
                  className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-medium text-slate-300 transition flex-shrink-0 font-mono-numeric"
                >
                  +{val}
                </button>
              ))}
            </div>
          </div>

          {/* Description & Date Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Description <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Grocery store, Uber ride..."
                  className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                />
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Date <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                />
              </div>
            </div>
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition text-left ${
                      isSelected
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 ring-1 ring-emerald-500/40'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {getCategoryIcon(cat, 'w-3.5 h-3.5')}
                    </div>
                    <span className="truncate">{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment Mode Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Payment Mode
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PAYMENT_MODES.map((mode) => {
                const isSelected = paymentMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPaymentMode(mode)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition ${
                      isSelected
                        ? 'bg-slate-800 border-emerald-500/50 text-emerald-300 ring-1 ring-emerald-500/40'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {getPaymentModeIcon(mode, 'w-3.5 h-3.5')}
                    </div>
                    <span className="truncate">{mode}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl font-semibold text-sm transition-all shadow-lg ${
                isSubmitting
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : type === 'Credit'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-bold shadow-emerald-950/40 hover:shadow-emerald-900/60'
                  : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-slate-950 font-bold shadow-emerald-950/40 hover:shadow-emerald-900/60'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  <span>Syncing to Google Sheet...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Save {type === 'Credit' ? 'Credit' : 'Debit'} to Sheet</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
