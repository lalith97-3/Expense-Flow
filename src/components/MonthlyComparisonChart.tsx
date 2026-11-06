import React, { useState } from 'react';
import { formatINR } from '../utils/formatters';

interface MonthlyComparisonData {
  monthKey: string; // YYYY-MM
  label: string; // e.g. "Oct '26"
  credit: number;
  debit: number;
}

interface Props {
  data: MonthlyComparisonData[];
  selectedMonth: string;
  onSelectMonth?: (monthKey: string) => void;
}

export const MonthlyComparisonChart: React.FC<Props> = ({
  data,
  selectedMonth,
  onSelectMonth,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-sm">
        <p>No historical transaction records available yet</p>
      </div>
    );
  }

  // Find max value for scaling
  const maxVal = Math.max(
    1000,
    ...data.flatMap((d) => [d.credit, d.debit])
  );

  return (
    <div className="w-full">
      {/* Legend & Active inspection info */}
      <div className="flex items-center justify-between mb-4 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
            <span className="text-slate-300 font-medium">Credit</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
            <span className="text-slate-300 font-medium">Debit</span>
          </div>
        </div>
        <span className="text-[11px] text-slate-400">
          Tap any month to filter
        </span>
      </div>

      {/* Chart Canvas */}
      <div className="relative pt-6 pb-2">
        {/* Tooltip on hover/active */}
        {hoveredIdx !== null && data[hoveredIdx] && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 bg-slate-900/95 border border-slate-700/80 px-3 py-1.5 rounded-lg shadow-xl text-xs flex items-center gap-3 backdrop-blur-md">
            <span className="font-semibold text-slate-200">{data[hoveredIdx].label}:</span>
            <span className="text-emerald-400 font-mono-numeric">+{formatINR(data[hoveredIdx].credit)}</span>
            <span className="text-slate-600">|</span>
            <span className="text-rose-400 font-mono-numeric">−{formatINR(data[hoveredIdx].debit)}</span>
          </div>
        )}

        {/* Bar columns */}
        <div className="grid grid-flow-col auto-cols-fr gap-2 sm:gap-4 items-end h-44 sm:h-52 border-b border-slate-800/80 px-1">
          {data.map((item, idx) => {
            const creditHeightPercent = Math.max(3, (item.credit / maxVal) * 100);
            const debitHeightPercent = Math.max(3, (item.debit / maxVal) * 100);
            const isSelected = item.monthKey === selectedMonth;

            return (
              <div
                key={item.monthKey}
                onClick={() => onSelectMonth && onSelectMonth(item.monthKey)}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`group flex flex-col items-center justify-end h-full cursor-pointer transition-all duration-150 p-1 rounded-xl ${
                  isSelected ? 'bg-slate-800/50 ring-1 ring-emerald-500/30' : 'hover:bg-slate-800/25'
                }`}
              >
                {/* Dual Bars Container */}
                <div className="w-full flex items-end justify-center gap-1 sm:gap-2 h-full max-w-[50px]">
                  {/* Credit Bar */}
                  <div className="relative w-1/2 flex flex-col items-center justify-end h-full">
                    <div
                      style={{ height: `${creditHeightPercent}%` }}
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        isSelected
                          ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                          : 'bg-emerald-500/80 group-hover:bg-emerald-400'
                      }`}
                    />
                  </div>

                  {/* Debit Bar */}
                  <div className="relative w-1/2 flex flex-col items-center justify-end h-full">
                    <div
                      style={{ height: `${debitHeightPercent}%` }}
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        isSelected
                          ? 'bg-gradient-to-t from-rose-600 to-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.35)]'
                          : 'bg-rose-500/80 group-hover:bg-rose-400'
                      }`}
                    />
                  </div>
                </div>

                {/* Month Label */}
                <span
                  className={`mt-2 text-[10px] sm:text-xs font-medium truncate ${
                    isSelected ? 'text-emerald-400 font-semibold' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
