import React from 'react';
import {
  Utensils,
  Car,
  ShoppingBag,
  Receipt,
  Zap,
  HeartPulse,
  GraduationCap,
  Coins,
  RotateCcw,
  CircleDot,
  CreditCard,
  Banknote,
  Building2,
  HelpCircle,
} from 'lucide-react';

export function getCategoryIcon(category: string, className = 'w-4 h-4') {
  switch (category) {
    case 'Food':
      return <Utensils className={className} />;
    case 'Travel':
      return <Car className={className} />;
    case 'Shopping':
      return <ShoppingBag className={className} />;
    case 'Bills':
      return <Receipt className={className} />;
    case 'Recharge':
      return <Zap className={className} />;
    case 'Health':
      return <HeartPulse className={className} />;
    case 'Education':
      return <GraduationCap className={className} />;
    case 'Income':
      return <Coins className={className} />;
    case 'Refund':
      return <RotateCcw className={className} />;
    default:
      return <CircleDot className={className} />;
  }
}

export function getPaymentModeIcon(mode: string, className = 'w-3.5 h-3.5') {
  switch (mode) {
    case 'UPI':
      return <Zap className={className} />;
    case 'Cash':
      return <Banknote className={className} />;
    case 'Debit Card':
    case 'Credit Card':
      return <CreditCard className={className} />;
    case 'Bank Transfer':
      return <Building2 className={className} />;
    default:
      return <HelpCircle className={className} />;
  }
}
