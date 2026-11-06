import React, { useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  ChevronDown,
  ArrowRight,
  PlusCircle,
  Receipt,
  FileSpreadsheet,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Transaction } from '../types/transaction';
import { MonthlyComparisonChart } from './MonthlyComparisonChart';
import { CategoryDebitChart } from './CategoryDebitChart';
import { formatINR, formatDisplayDate, getMonthLabel, getCategoryStyle } from '../utils/formatters';
import { getCategoryIcon, getPaymentModeIcon } from '../utils/categoryIcons';

interface Props {
  transactions: Transaction[];
  selectedMonth: string; // YYYY-MM
  onSelectMonth: (monthKey: string) => void;
  availableMonths: { monthKey: string; label: string }[];
  onNavigateToTab: (tab: 'dashboard' | 'history' | 'add' | 'setup') => void;
  isBackendConfigured: boolean;
  needsScriptUpdate?: boolean;
  onOpenSetup: () => void;
}

export const DashboardView: React.FC<Props> = ({
  transactions,
  selectedMonth,
  onSelectMonth,
  availableMonths,
  onNavigateToTab,
  isBackendConfigured,
  needsScriptUpdate,
  onOpenSetup,
}) => {
  // Current month's transactions
  const monthTransactions = useMemo(() => {
    if (!selectedMonth || selectedMonth === 'ALL') {
      return transactions;
    }
    return transactions.filter((t) => t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  // Current month Total Credit & Debit (Calculated separately; absolutely no balance or net balance)
  const currentMonthTotals = useMemo(() => {
    let credit = 0;
    let debit = 0;

    monthTransactions.forEach((t) => {
      if (typeof t.amount === 'number' && !isNaN(t.amount) && t.amount > 0) {
        if (t.type === 'Credit') {
          credit += t.amount;
        } else if (t.type === 'Debit') {
          debit += t.amount;
        }
      }
    });

    // Preserve exact decimals and prevent IEEE 754 floating-point drift
    return {
      credit: Number(credit.toFixed(2)),
      debit: Number(debit.toFixed(2)),
    };
  }, [monthTransactions]);

  // Historical Monthly Comparison Data (grouped by month for the chart)
  const monthlyComparisonData = useMemo(() => {
    const map = new Map<string, { credit: number; debit: number }>();

    transactions.forEach((t) => {
      const monthKey = t.date.slice(0, 7); // YYYY-MM
      if (!monthKey || monthKey.length !== 7) return;

      const current = map.get(monthKey) || { credit: 0, debit: 0 };
      if (t.type === 'Credit') {
        current.credit += t.amount;
      } else {
        current.debit += t.amount;
      }
      map.set(monthKey, current);
    });

    // Sort chronologically (oldest to newest for bar chart flow)
    const sortedKeys = Array.from(map.keys()).sort();
    // Keep up to 6 months
    const sliceKeys = sortedKeys.slice(-6);

    return sliceKeys.map((k) => {
      const val = map.get(k)!;
      const [year, month] = k.split('-');
      const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      const label = d.toLocaleDateString('en-IN', { month: 'short' });

      return {
        monthKey: k,
        label,
        credit: val.credit,
        debit: val.debit,
      };
    });
  }, [transactions]);

  // Category-wise Debit Breakdown for the selected month
  const categoryDebitBreakdown = useMemo(() => {
    const map = new Map<string, { amount: number; count: number }>();
    let totalDebit = 0;

    monthTransactions.forEach((t) => {
      if (t.type === 'Debit') {
        totalDebit += t.amount;
        const cat = t.category || 'Other';
        const curr = map.get(cat) || { amount: 0, count: 0 };
        curr.amount += t.amount;
        curr.count += 1;
        map.set(cat, curr);
      }
    });

    const list = Array.from(map.entries()).map(([category, val]) => {
      const percentage = totalDebit > 0 ? (val.amount / totalDebit) * 100 : 0;
      const style = getCategoryStyle(category);
      return {
        category,
        amount: val.amount,
        percentage,
        count: val.count,
        color: style.hex,
      };
    });

    return { list, totalDebit };
  }, [monthTransactions]);

  // Recent transactions (newest 5 of current selection)
  const recentTransactions = useMemo(() => {
    return monthTransactions.slice(0, 5);
  }, [monthTransactions]);

  const monthDisplayTitle = selectedMonth === 'ALL' ? 'All Time' : getMonthLabel(selectedMonth);

  return (
    <div className="space-y-6">
      {/* Setup Warning if backend secrets are not configured or script needs update */}
      {!isBackendConfigured ? (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start justify-between gap-3 text-amber-300">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs sm:text-sm">
              <p className="font-semibold text-amber-200">Google Sheet Setup Required</p>
              <p className="text-amber-300/80 mt-0.5">
                ExpenseFlow connects to your existing "Expense Tracker DB" sheet via Apps Script. Click Configure to view the 2-minute setup guide.
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
      ) : needsScriptUpdate ? (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start justify-between gap-3 text-emerald-300">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs sm:text-sm">
              <p className="font-semibold text-emerald-200">Google Apps Script Web App Reached!</p>
              <p className="text-emerald-300/80 mt-0.5">
                Almost connected! Your Apps Script is live, but needs the ExpenseFlow API code snippet pasted into <strong className="text-white">Extensions &gt; Apps Script</strong> in your sheet.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenSetup}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 transition shadow-sm"
          >
            Copy Script
          </button>
        </div>
      ) : null}

      {/* Top Banner: Month Selector & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-emerald-400 tracking-wider uppercase">
            Monthly Overview
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            {monthDisplayTitle}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Month Dropdown */}
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => onSelectMonth(e.target.value)}
              className="appearance-none bg-slate-900/90 border border-slate-800 rounded-xl pl-3 pr-8 py-2 text-xs font-medium text-slate-200 hover:border-slate-700 focus:outline-none focus:border-emerald-500 transition cursor-pointer"
            >
              {availableMonths.map((m) => (
                <option key={m.monthKey} value={m.monthKey}>
                  {m.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Quick Record Button */}
          <button
            onClick={() => onNavigateToTab('add')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition shadow-md shadow-emerald-950/40"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Cards: Current Month Total Credit & Total Debit */}
      {/* Note: NO account balance, available balance, savings, or net worth is displayed */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Total Credit Card */}
        <div className="glass-card rounded-2xl p-5 border border-slate-800/80 shadow-lg relative overflow-hidden group">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-emerald-500/5 group-hover:bg-emerald-500/10 transition-all pointer-events-none" />

          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Credit
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>

          <div className="text-2xl sm:text-3xl font-extrabold font-mono-numeric text-emerald-400 tracking-tight">
            +{formatINR(currentMonthTotals.credit)}
          </div>

          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
            <span>Income & deposits recorded for {monthDisplayTitle}</span>
          </div>
        </div>

        {/* Total Debit Card */}
        <div className="glass-card rounded-2xl p-5 border border-slate-800/80 shadow-lg relative overflow-hidden group">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-rose-500/5 group-hover:bg-rose-500/10 transition-all pointer-events-none" />

          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Debit
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>

          <div className="text-2xl sm:text-3xl font-extrabold font-mono-numeric text-rose-400 tracking-tight">
            −{formatINR(currentMonthTotals.debit)}
          </div>

          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
            <span>Expenses & payouts recorded for {monthDisplayTitle}</span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Credit & Debit Comparison Chart */}
        <div className="glass-card rounded-2xl p-5 border border-slate-800/80 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Monthly Comparison
              </h3>
              <span className="text-[11px] text-slate-400 font-mono-numeric">Credit vs Debit</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Historical inflow and outflow by month
            </p>
          </div>

          <MonthlyComparisonChart
            data={monthlyComparisonData}
            selectedMonth={selectedMonth}
            onSelectMonth={onSelectMonth}
          />
        </div>

        {/* Category-wise Debit Breakdown Chart */}
        <div className="glass-card rounded-2xl p-5 border border-slate-800/80 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Category Expenses
              </h3>
              <span className="text-[11px] text-slate-400 font-mono-numeric">
                Total: {formatINR(categoryDebitBreakdown.totalDebit)}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Debit distribution across categories in {monthDisplayTitle}
            </p>
          </div>

          <CategoryDebitChart
            categories={categoryDebitBreakdown.list}
            totalDebit={categoryDebitBreakdown.totalDebit}
          />
        </div>
      </div>

      {/* Recent Transactions Section */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800/80 shadow-lg space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-400" />
              Recent Transactions
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Latest records in {monthDisplayTitle}
            </p>
          </div>

          <button
            onClick={() => onNavigateToTab('history')}
            className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            <p>No transactions found for {monthDisplayTitle}.</p>
            <button
              onClick={() => onNavigateToTab('add')}
              className="mt-3 px-3 py-1.5 rounded-xl bg-slate-800 text-emerald-400 hover:bg-slate-700 text-xs font-semibold transition"
            >
              + Record First Transaction
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {recentTransactions.map((tx) => {
              const isCredit = tx.type === 'Credit';
              const catStyle = getCategoryStyle(tx.category);

              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800/60 hover:border-slate-700/60 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${catStyle.bg} ${catStyle.text}`}
                    >
                      {getCategoryIcon(tx.category, 'w-4 h-4')}
                    </div>
                    <div className="min-w-0 truncate">
                      <div className="text-xs sm:text-sm font-semibold text-slate-100 truncate">
                        {tx.description}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2">
                        <span>{formatDisplayDate(tx.date)}</span>
                        <span>•</span>
                        <span className="text-slate-300">{tx.category}</span>
                        <span>•</span>
                        <span className="font-mono-numeric">{tx.paymentMode}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 pl-2">
                    <div
                      className={`text-xs sm:text-sm font-bold font-mono-numeric ${
                        isCredit ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isCredit ? '+₹' : '−₹'}
                      {formatINR(tx.amount).replace('₹', '')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
