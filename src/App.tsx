import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LayoutDashboard,
  History,
  PlusCircle,
  FileSpreadsheet,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  WifiOff,
  Settings,
  Sparkles,
} from 'lucide-react';

import { Transaction, BackendStatus } from './types/transaction';
import { DashboardView } from './components/DashboardView';
import { TransactionHistoryView } from './components/TransactionHistoryView';
import { AddTransactionView } from './components/AddTransactionView';
import { IntegrationSetupModal } from './components/IntegrationSetupModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { getMonthLabel } from './utils/formatters';

type ActiveTab = 'dashboard' | 'history' | 'add' | 'setup';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Month Selection (defaults to current month YYYY-MM)
  const currentMonthKey = useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);

  const isOnline = useOnlineStatus();

  // Load backend status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setBackendStatus(data);
      }
    } catch {
      // Offline or network error
    }
  }, []);

  // Load transactions from server proxy -> Google Sheet
  const fetchTransactions = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoadingTransactions(true);
    setFetchError(null);

    try {
      const res = await fetch('/api/transactions');
      const data = await res.json();

      if (data && data.success) {
        setTransactions(data.transactions || []);
      } else {
        setTransactions([]);
        if (data?.needsScriptUpdate) {
          setFetchError(
            'Your Google Apps Script Web App was reached, but needs the Code.gs endpoints added. Click Configure to copy the script.'
          );
        } else if (data?.setupRequired) {
          setFetchError('Google Sheets backend setup is required.');
        } else if (data?.error) {
          setFetchError(data.error);
        }
      }
    } catch {
      setTransactions([]);
      setFetchError('Waiting to sync with Google Sheet.');
    } finally {
      setIsLoadingTransactions(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchStatus();
    fetchTransactions();
  }, [fetchStatus, fetchTransactions]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchStatus(), fetchTransactions(true)]);
  };

  // Derive unique months available in transactions + current month
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    monthSet.add(currentMonthKey);

    transactions.forEach((t) => {
      if (t.date && t.date.length >= 7) {
        monthSet.add(t.date.slice(0, 7));
      }
    });

    const sorted = Array.from(monthSet).sort().reverse();
    return sorted.map((key) => ({
      monthKey: key,
      label: getMonthLabel(key),
    }));
  }, [transactions, currentMonthKey]);

  // When a new transaction is successfully recorded
  const handleTransactionSuccess = (_newTx: Partial<Transaction>) => {
    fetchTransactions(true);
    fetchStatus();
    // Switch to history tab to show the recorded transaction
    setActiveTab('history');
  };

  const isBackendConfigured = Boolean(backendStatus?.configured);
  const isFullyConnected = Boolean(backendStatus?.configured && backendStatus?.connected);

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Offline Toast */}
      {!isOnline && (
        <div className="bg-amber-600 text-slate-950 font-semibold px-4 py-1.5 text-xs text-center flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline mode — Internet connection lost.</span>
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#090D16]/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 p-0.5 shadow-md shadow-emerald-950/40 flex items-center justify-center">
              <div className="w-full h-full bg-[#090D16] rounded-[10px] flex items-center justify-center">
                <span className="text-emerald-400 font-extrabold text-base leading-none">₹</span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-white">
                  Expense<span className="text-emerald-400">Flow</span>
                </span>
                <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60">
                  Sheets DB
                </span>
              </div>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/80 p-1 rounded-2xl border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition ${
                activeTab === 'dashboard'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition ${
                activeTab === 'history'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
            </button>

            <button
              onClick={() => setActiveTab('add')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition ${
                activeTab === 'add'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-emerald-400 hover:text-emerald-300'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Record</span>
            </button>
          </nav>

          {/* Right Header Actions: Status Badge, Refresh, PWA Install, Settings */}
          <div className="flex items-center gap-2">
            {/* Sheets Status Badge */}
            <button
              onClick={() => setIsSetupModalOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition ${
                isFullyConnected
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                  : backendStatus?.needsScriptUpdate
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                  : isBackendConfigured
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
              }`}
              title="Google Sheet connection status"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isFullyConnected
                    ? 'bg-emerald-400 animate-pulse'
                    : backendStatus?.needsScriptUpdate
                    ? 'bg-amber-400'
                    : isBackendConfigured
                    ? 'bg-blue-400'
                    : 'bg-amber-400 animate-ping'
                }`}
              />
              <span className="hidden sm:inline">
                {isFullyConnected
                  ? 'Sheets Connected'
                  : backendStatus?.needsScriptUpdate
                  ? 'Add Script to Sheet'
                  : isBackendConfigured
                  ? 'Verifying Sync'
                  : 'Setup Required'}
              </span>
              <FileSpreadsheet className="w-3.5 h-3.5 sm:hidden" />
            </button>

            {/* Refresh Button */}
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Refresh from Google Sheet"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>

            {/* PWA In-App Install Button */}
            <PWAInstallButton compact />

            {/* Setup Guide Icon (Mobile / Desktop) */}
            <button
              onClick={() => setIsSetupModalOpen(true)}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Google Sheets & Apps Script Setup"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 pb-24 md:pb-8">
        {activeTab === 'dashboard' && (
          <DashboardView
            transactions={transactions}
            selectedMonth={selectedMonth}
            onSelectMonth={setSelectedMonth}
            availableMonths={availableMonths}
            onNavigateToTab={(tab) => {
              if (tab === 'setup') {
                setIsSetupModalOpen(true);
              } else {
                setActiveTab(tab);
              }
            }}
            isBackendConfigured={isBackendConfigured}
            needsScriptUpdate={Boolean(backendStatus?.needsScriptUpdate)}
            onOpenSetup={() => setIsSetupModalOpen(true)}
          />
        )}

        {activeTab === 'history' && (
          <TransactionHistoryView
            transactions={transactions}
            isLoading={isLoadingTransactions}
            selectedMonth={selectedMonth}
            onSelectMonth={setSelectedMonth}
            availableMonths={availableMonths}
          />
        )}

        {activeTab === 'add' && (
          <AddTransactionView
            onSuccess={handleTransactionSuccess}
            isBackendConfigured={isBackendConfigured}
            onOpenSetup={() => setIsSetupModalOpen(true)}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation (iPhone safe-area friendly) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#090D16]/95 backdrop-blur-lg border-t border-slate-800/80 pb-safe px-3 pt-2">
        <div className="grid grid-cols-3 items-center max-w-md mx-auto">
          {/* Dashboard */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center py-1 transition ${
              activeTab === 'dashboard' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-medium">Dashboard</span>
          </button>

          {/* Add Floating Action Button in Center */}
          <button
            onClick={() => setActiveTab('add')}
            className="flex flex-col items-center justify-center group"
          >
            <div
              className={`w-12 h-12 -mt-5 rounded-2xl flex items-center justify-center shadow-lg transition-transform active:scale-95 ${
                activeTab === 'add'
                  ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 ring-2 ring-emerald-400 shadow-emerald-950/60'
                  : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-950/50'
              }`}
            >
              <PlusCircle className="w-6 h-6 stroke-[2.2]" />
            </div>
            <span className="text-[10px] font-medium text-slate-300 mt-1">Record</span>
          </button>

          {/* History */}
          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center justify-center py-1 transition ${
              activeTab === 'history' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-medium">History</span>
          </button>
        </div>
      </nav>

      {/* Integration Setup Modal */}
      <IntegrationSetupModal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
        status={backendStatus}
        onRefreshStatus={fetchStatus}
      />
    </div>
  );
}
