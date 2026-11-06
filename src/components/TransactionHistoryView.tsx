import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  Calendar,
  X,
  TrendingUp,
  TrendingDown,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { Transaction, TransactionType } from '../types/transaction';
import { getCategoryIcon, getPaymentModeIcon } from '../utils/categoryIcons';
import { formatINR, formatDisplayDate, getCategoryStyle } from '../utils/formatters';

interface Props {
  transactions: Transaction[];
  isLoading: boolean;
  selectedMonth: string;
  onSelectMonth: (monthKey: string) => void;
  availableMonths: { monthKey: string; label: string }[];
}

export const TransactionHistoryView: React.FC<Props> = ({
  transactions,
  isLoading,
  selectedMonth,
  onSelectMonth,
  availableMonths,
}) => {
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | TransactionType>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  // Available unique categories in the dataset
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    transactions.forEach((t) => {
      if (t.category) cats.add(t.category);
    });
    return Array.from(cats).sort();
  }, [transactions]);

  // Filtering transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Month filter (if set to something other than 'ALL')
      if (selectedMonth && selectedMonth !== 'ALL') {
        if (!tx.date.startsWith(selectedMonth)) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesDesc = tx.description.toLowerCase().includes(query);
        const matchesCat = tx.category.toLowerCase().includes(query);
        const matchesMode = tx.paymentMode.toLowerCase().includes(query);
        if (!matchesDesc && !matchesCat && !matchesMode) return false;
      }

      // Type filter
      if (typeFilter !== 'ALL' && tx.type !== typeFilter) {
        return false;
      }

      // Category filter
      if (categoryFilter !== 'ALL' && tx.category !== categoryFilter) {
        return false;
      }

      // Date range filter
      if (startDate && tx.date < startDate) return false;
      if (endDate && tx.date > endDate) return false;

      return true;
    });
  }, [
    transactions,
    selectedMonth,
    searchQuery,
    typeFilter,
    categoryFilter,
    startDate,
    endDate,
  ]);

  // Totals for filtered view
  const summary = useMemo(() => {
    let credit = 0;
    let debit = 0;
    filteredTransactions.forEach((t) => {
      if (t.type === 'Credit') credit += t.amount;
      else debit += t.amount;
    });
    return { credit, debit, count: filteredTransactions.length };
  }, [filteredTransactions]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    typeFilter !== 'ALL' ||
    categoryFilter !== 'ALL' ||
    startDate !== '' ||
    endDate !== '' ||
    selectedMonth !== 'ALL';

  const resetFilters = () => {
    setSearchQuery('');
    setTypeFilter('ALL');
    setCategoryFilter('ALL');
    setStartDate('');
    setEndDate('');
    onSelectMonth('ALL');
  };

  return (
    <div className="space-y-4">
      {/* Header & Controls Card */}
      <div className="glass-card rounded-2xl p-4 sm:p-5 border border-slate-800/80 shadow-lg space-y-4">
        {/* Search Bar + Month Dropdown + Filter Toggle */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search description, category, or mode..."
              className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-9 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Month Filter */}
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => onSelectMonth(e.target.value)}
                className="appearance-none bg-slate-900/90 border border-slate-800 rounded-xl pl-3 pr-8 py-2.5 text-xs font-medium text-slate-200 focus:outline-none focus:border-emerald-500 transition cursor-pointer"
              >
                <option value="ALL">All Months</option>
                {availableMonths.map((m) => (
                  <option key={m.monthKey} value={m.monthKey}>
                    {m.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Toggle Advanced Filters */}
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-medium transition ${
                showAdvancedFilters || (hasActiveFilters && selectedMonth === 'ALL')
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filters</span>
            </button>
          </div>
        </div>

        {/* Quick Type Tabs (All / Debit / Credit) */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
            <button
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                typeFilter === 'ALL'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setTypeFilter('Debit')}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 transition ${
                typeFilter === 'Debit'
                  ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40'
                  : 'text-slate-400 hover:text-rose-300'
              }`}
            >
              <TrendingDown className="w-3 h-3" />
              Debit
            </button>
            <button
              onClick={() => setTypeFilter('Credit')}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 transition ${
                typeFilter === 'Credit'
                  ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                  : 'text-slate-400 hover:text-emerald-300'
              }`}
            >
              <TrendingUp className="w-3 h-3" />
              Credit
            </button>
          </div>

          {/* Reset Filters button */}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition"
            >
              <X className="w-3 h-3" />
              Clear Filters
            </button>
          )}
        </div>

        {/* Advanced Filters Drawer */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in">
            {/* Category Filter */}
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">All Categories</option>
                {availableCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
                From Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
                To Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Filter Stats Bar */}
      <div className="flex items-center justify-between px-2 text-xs text-slate-400">
        <div>
          Showing <span className="font-semibold text-slate-200">{filteredTransactions.length}</span>{' '}
          {filteredTransactions.length === 1 ? 'transaction' : 'transactions'}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-emerald-400 font-mono-numeric">
            +₹{formatINR(summary.credit).replace('₹', '')}
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-rose-400 font-mono-numeric">
            −₹{formatINR(summary.debit).replace('₹', '')}
          </span>
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="space-y-2.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 animate-pulse flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800" />
                <div className="space-y-2">
                  <div className="w-32 h-3.5 bg-slate-800 rounded" />
                  <div className="w-20 h-2.5 bg-slate-800/70 rounded" />
                </div>
              </div>
              <div className="w-20 h-4 bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      ) : filteredTransactions.length === 0 ? (
        /* Empty State */
        <div className="glass-card rounded-2xl p-10 text-center border border-slate-800/80 shadow-md">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-200">No Transactions Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {hasActiveFilters
              ? 'No transactions matched the selected filters. Try clearing filters to see all entries.'
              : 'No transactions recorded yet in your Google Sheet database.'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="mt-4 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-emerald-400 transition"
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        /* Transaction List */
        <div className="space-y-2.5">
          {filteredTransactions.map((tx) => {
            const isCredit = tx.type === 'Credit';
            const catStyle = getCategoryStyle(tx.category);

            return (
              <div
                key={tx.id}
                className="glass-card glass-card-hover rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-md border border-slate-800/80"
              >
                {/* Left: Icon & Meta */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${catStyle.bg} ${catStyle.text}`}
                  >
                    {getCategoryIcon(tx.category, 'w-5 h-5')}
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-100 truncate">
                      {tx.description}
                    </div>

                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 flex-wrap">
                      <span>{formatDisplayDate(tx.date)}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-700" />
                      <span className="text-slate-300 font-medium">{tx.category}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-700" />
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-800/80 text-[10px] text-slate-300 border border-slate-700/60 font-mono-numeric">
                        {getPaymentModeIcon(tx.paymentMode, 'w-2.5 h-2.5 text-slate-400')}
                        {tx.paymentMode}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Amount & Type */}
                <div className="text-right flex-shrink-0 pl-2">
                  <div
                    className={`text-sm sm:text-base font-bold font-mono-numeric ${
                      isCredit ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isCredit ? '+₹' : '−₹'}
                    {formatINR(tx.amount).replace('₹', '')}
                  </div>
                  <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 mt-0.5">
                    {tx.type}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
