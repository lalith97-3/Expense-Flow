import React from 'react';
import { formatINR } from '../utils/formatters';
import { getCategoryIcon } from '../utils/categoryIcons';
import { CategorySummary } from '../types/transaction';

interface Props {
  categories: CategorySummary[];
  totalDebit: number;
}

export const CategoryDebitChart: React.FC<Props> = ({ categories, totalDebit }) => {
  if (!categories || categories.length === 0 || totalDebit === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-slate-500 text-sm">
        <p>No debit transactions recorded for this month</p>
      </div>
    );
  }

  // Top categories
  const sorted = [...categories].sort((a, b) => b.amount - a.amount);

  return (
    <div className="space-y-4">
      {/* Visual Multi-segment Bar */}
      <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex p-0.5 gap-0.5">
        {sorted.map((cat) => {
          if (cat.percentage <= 0) return null;
          return (
            <div
              key={cat.category}
              style={{
                width: `${cat.percentage}%`,
                backgroundColor: cat.color,
              }}
              title={`${cat.category}: ${formatINR(cat.amount)} (${cat.percentage.toFixed(1)}%)`}
              className="h-full rounded-sm transition-all duration-300 hover:opacity-85"
            />
          );
        })}
      </div>

      {/* Category List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
        {sorted.map((cat) => {
          return (
            <div
              key={cat.category}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                  style={{ backgroundColor: `${cat.color}25`, color: cat.color }}
                >
                  {getCategoryIcon(cat.category, 'w-4 h-4')}
                </div>
                <div className="truncate">
                  <div className="text-xs font-semibold text-slate-200 truncate">{cat.category}</div>
                  <div className="text-[10px] text-slate-400">
                    {cat.count} {cat.count === 1 ? 'transaction' : 'transactions'}
                  </div>
                </div>
              </div>

              <div className="text-right flex-shrink-0 pl-2">
                <div className="text-xs font-semibold text-slate-100 font-mono-numeric">
                  {formatINR(cat.amount)}
                </div>
                <div className="text-[10px] text-slate-400 font-mono-numeric">
                  {cat.percentage.toFixed(1)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
