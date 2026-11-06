/**
 * Formats a numeric value into Indian Rupee format (e.g., ₹1,23,456.00 or ₹1,500)
 * Automatically preserves decimal paise if present (e.g. 125.50 -> ₹125.50),
 * preventing unintended rounding of decimal amounts.
 */
export function formatINR(amount: number, forceDecimals = false): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '₹0';
  }

  const absAmount = Math.abs(amount);
  // Show 2 decimals if amount has a fractional part (e.g. 125.50) or if forceDecimals is true
  const hasFractions = forceDecimals || absAmount % 1 !== 0;
  const digits = hasFractions ? 2 : 0;

  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });

  return formatter.format(absAmount);
}

/**
 * Formats date into readable string: e.g. "20 Oct 2026" or "Today, 20 Oct"
 */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);

      const today = new Date();
      const isToday =
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();

      if (isToday) {
        return `Today, ${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
      }

      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      const isYesterday =
        date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear();

      if (isYesterday) {
        return `Yesterday, ${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
      }

      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

/**
 * Returns month label from "YYYY-MM" (e.g. "2026-10" -> "October 2026")
 */
export function getMonthLabel(monthKey: string): string {
  if (!monthKey) return '';
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const date = new Date(year, month, 1);
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

/**
 * Category color mappings matching a refined fintech palette
 */
export const CATEGORY_COLORS: Record<string, { bg: string; text: string; hex: string }> = {
  Food: { bg: 'bg-amber-500/15', text: 'text-amber-400', hex: '#F59E0B' },
  Travel: { bg: 'bg-sky-500/15', text: 'text-sky-400', hex: '#0EA5E9' },
  Shopping: { bg: 'bg-violet-500/15', text: 'text-violet-400', hex: '#8B5CF6' },
  Bills: { bg: 'bg-rose-500/15', text: 'text-rose-400', hex: '#F43F5E' },
  Recharge: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', hex: '#6366F1' },
  Health: { bg: 'bg-teal-500/15', text: 'text-teal-400', hex: '#14B8A6' },
  Education: { bg: 'bg-blue-500/15', text: 'text-blue-400', hex: '#3B82F6' },
  Income: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', hex: '#10B981' },
  Refund: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', hex: '#06B6D4' },
  Other: { bg: 'bg-slate-500/15', text: 'text-slate-400', hex: '#94A3B8' },
};

export function getCategoryStyle(category: string) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.Other;
}
