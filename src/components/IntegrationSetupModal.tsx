import React, { useState, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Shield,
  Key,
  Layers,
  Code,
  Sparkles,
  Smartphone,
  Zap,
} from 'lucide-react';
import { BackendStatus } from '../types/transaction';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  status: BackendStatus | null;
  onRefreshStatus: () => Promise<void>;
}

export const IntegrationSetupModal: React.FC<Props> = ({
  isOpen,
  onClose,
  status,
  onRefreshStatus,
}) => {
  const [copied, setCopied] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
  } | null>(null);

  const [scriptCode, setScriptCode] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      fetch('/api/apps-script-code')
        .then((res) => res.json())
        .then((data) => {
          if (data.code) setScriptCode(data.code);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyCode = async () => {
    if (!scriptCode) return;
    try {
      await navigator.clipboard.writeText(scriptCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/test-connection', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: `${data.message || 'Connection verified!'} Sheet "${data.sheetName}" currently has ${data.rowCount ?? 0} transactions.`,
        });
      } else {
        setTestResult({
          success: false,
          error: data.error || 'Failed to establish connection to Apps Script web app.',
        });
      }
      await onRefreshStatus();
    } catch (err: unknown) {
      const error = err as Error;
      setTestResult({
        success: false,
        error: error.message || 'Network error during connection test.',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const isFullyConnected = status?.configured && status?.connected;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#0B111E] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Google Sheets Integration
              </h2>
              <p className="text-xs text-slate-400">
                Database: <span className="text-emerald-400 font-mono">Expense Tracker DB</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-sm text-slate-300">
          {/* Status Banner */}
          <div
            className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              isFullyConnected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}
          >
            <div className="flex items-start gap-3">
              {isFullyConnected ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
              )}
              <div>
                <p className="font-semibold text-white">
                  {isFullyConnected
                    ? 'Connected to Google Sheet Database'
                    : status?.needsScriptUpdate
                    ? 'Web App Reachable — Action: Paste Code into Apps Script'
                    : status?.configured
                    ? 'Secrets Set — Connection Verification Needed'
                    : 'Backend Setup Required'}
                </p>
                <p className="text-xs opacity-90 mt-0.5">
                  {isFullyConnected
                    ? `Live sync active. Transactions are read and saved directly to "Expense Tracker DB".`
                    : status?.needsScriptUpdate
                    ? 'Your Web App is live! Copy the script in Step 2 below, paste it into Extensions > Apps Script, and click Save to finish connection.'
                    : status?.configured
                    ? status.error || 'Server secrets configured. Testing communication with Google Apps Script.'
                    : 'Provide APPS_SCRIPT_URL and APPS_SCRIPT_TOKEN in environment secrets to persist data.'}
                </p>
              </div>
            </div>

            <button
              onClick={handleTestConnection}
              disabled={testingConnection}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                testingConnection
                  ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md'
              }`}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`}
              />
              <span>{testingConnection ? 'Testing...' : 'Test Connection'}</span>
            </button>
          </div>

          {/* Test Result Alert */}
          {testResult && (
            <div
              className={`p-3.5 rounded-xl text-xs border flex items-start gap-2.5 animate-in fade-in ${
                testResult.success
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
              )}
              <div>
                <span className="font-bold">
                  {testResult.success ? 'Test Passed: ' : 'Test Failed: '}
                </span>
                {testResult.message || testResult.error}
              </div>
            </div>
          )}

          {/* Secrets Checklist Card */}
          <div className="glass-card rounded-2xl p-4 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              Server Secrets Status
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-mono text-slate-300 font-medium">APPS_SCRIPT_URL</span>
                  <p className="text-[10px] text-slate-500">Google Apps Script Web App</p>
                </div>
                {status?.hasUrl ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                    Configured
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                    Missing
                  </span>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-mono text-slate-300 font-medium">APPS_SCRIPT_TOKEN</span>
                  <p className="text-[10px] text-slate-500">Apps Script secret token</p>
                </div>
                {status?.hasToken ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                    Configured
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                    Missing
                  </span>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-mono text-slate-300 font-medium">SHORTCUT_API_TOKEN</span>
                  <p className="text-[10px] text-slate-500">iPhone Shortcuts Bearer secret</p>
                </div>
                {status?.hasShortcutToken ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                    Configured
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400 text-[10px] font-medium">
                    Optional
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Setup Guide Steps */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              Quick Setup Steps
            </h3>

            <div className="space-y-3 text-xs">
              {/* Step 1 */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center text-[11px] border border-slate-700">
                    1
                  </span>
                  <span className="font-semibold text-white">
                    Confirm Google Sheet Headers
                  </span>
                </div>
                <p className="text-slate-400 pl-7 text-[11px]">
                  Open your sheet named <strong className="text-slate-200">"Expense Tracker DB"</strong>.
                  Verify that Row 1 has the exact headers:
                </p>
                <div className="pl-7 pt-1">
                  <div className="p-2 rounded-lg bg-black/40 border border-slate-800 font-mono text-[11px] text-emerald-300 flex flex-wrap gap-2">
                    <span>Date</span> | <span>Type</span> | <span>Amount</span> | <span>Description</span> | <span>Category</span> | <span>Payment Mode</span>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center text-[11px] border border-slate-700">
                      2
                    </span>
                    <span className="font-semibold text-white">
                      Copy Google Apps Script Code
                    </span>
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[11px] font-medium transition border border-emerald-500/30"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-slate-400 pl-7 text-[11px]">
                  In Google Sheets, navigate to <strong className="text-slate-200">Extensions &gt; Apps Script</strong>.
                  Paste the code below into <code className="text-emerald-400">Code.gs</code>:
                </p>
                <div className="pl-7">
                  <pre className="p-3 rounded-xl bg-black/60 border border-slate-800/90 font-mono text-[10px] text-slate-300 max-h-40 overflow-y-auto leading-relaxed scrollbar-thin">
                    {scriptCode || '// Loading Apps Script code template...'}
                  </pre>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center text-[11px] border border-slate-700">
                    3
                  </span>
                  <span className="font-semibold text-white">
                    Deploy Web App
                  </span>
                </div>
                <p className="text-slate-400 pl-7 text-[11px] leading-relaxed">
                  Click <strong className="text-slate-200">Deploy &gt; New deployment</strong>. Select type <strong className="text-slate-200">Web App</strong>. Set <strong className="text-slate-200">Execute as: Me</strong> and <strong className="text-emerald-400">Who has access: Anyone</strong>. Deploy and copy the Web App URL (ends in <code className="text-emerald-300">/exec</code>).
                </p>
              </div>

              {/* Step 4 */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center text-[11px] border border-slate-700">
                    4
                  </span>
                  <span className="font-semibold text-white">
                    Set Environment Secrets
                  </span>
                </div>
                <p className="text-slate-400 pl-7 text-[11px] leading-relaxed">
                  Add <code className="text-emerald-400">APPS_SCRIPT_URL</code> and <code className="text-emerald-400">APPS_SCRIPT_TOKEN</code> in your environment or <code className="text-slate-300">.env</code>. The Node.js server acts as an encrypted proxy and securely communicates with your sheet.
                </p>
              </div>
            </div>
          </div>

          {/* iPhone Shortcuts Automation Card */}
          <div className="glass-card rounded-2xl p-4 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                iPhone Shortcuts Automation
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-bold">
                POST /api/shortcut-import
              </span>
            </div>

            <p className="text-slate-400 text-xs leading-relaxed">
              Automate expense logging from bank SMS or iOS Shortcuts using the dedicated automation endpoint:
            </p>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 font-mono text-[11px] text-slate-300 flex items-center justify-between">
                <span className="text-slate-400 font-sans text-xs">Endpoint:</span>
                <span className="text-sky-300 select-all font-mono">/api/shortcut-import</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 font-mono text-[11px] text-slate-300 flex items-center justify-between">
                <span className="text-slate-400 font-sans text-xs">Header:</span>
                <span className="text-emerald-400 font-mono text-[10px]">Authorization: Bearer &lt;SHORTCUT_API_TOKEN&gt;</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-slate-800">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                Shortcuts "Get Contents of URL" Body (JSON)
              </span>
              <pre className="text-[11px] text-slate-300 font-mono overflow-x-auto">{`{
  "rawMessage": "Shortcut Input"
}`}</pre>
              <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                In iOS Shortcuts automation: Trigger on <strong className="text-slate-200">Message contains &quot;Kotak Bank&quot;</strong> &rarr; Action: <strong className="text-slate-200">Get Contents of URL</strong> &rarr; POST to <code className="text-sky-300">/api/shortcut-import</code> with Header <code className="text-emerald-400">Authorization: Bearer &lt;SHORTCUT_API_TOKEN&gt;</code> and JSON Body <code className="text-slate-200">&#123; &quot;rawMessage&quot;: Shortcut Input &#125;</code>.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800/80 bg-slate-900/40 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs sm:text-sm font-semibold text-white transition border border-slate-700"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
