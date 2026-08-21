'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  RefreshCw,
  Terminal as TerminalIcon,
  CheckCircle,
  AlertTriangle,
  Activity,
  ShieldAlert,
  Zap,
  Database,
  Search,
  Filter,
  Eye,
  Sliders
} from 'lucide-react';
import {
  BenchmarkRecord,
  BenchmarkSummary,
  FALLBACK_BENCHMARK_DATA
} from '@/lib/fallback_data';

export default function LiveBenchmarkStream() {
  // Modes & Statuses
  const [useStatic, setUseStatic] = useState(false);
  const [status, setStatus] = useState<'idle' | 'streaming' | 'completed' | 'error'>('idle');

  // Streaming Data States
  const [records, setRecords] = useState<BenchmarkRecord[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [summary, setSummary] = useState<BenchmarkSummary>({
    totalRecords: 50,
    processedRecords: 0,
    recoveryRatePct: 0,
    netRecoveredGTV: 0,
    policyBreachRatePct: 0,
    avgLatencyMs: 0,
    throughputRps: 0
  });

  // UI Filtering & Scrolling
  const [logFilter, setLogFilter] = useState<'ALL' | 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR'>('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Refs for SSE and scroll management
  const eventSourceRef = useRef<EventSource | null>(null);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  // Helper: Format Rupee Currency
  const formatRupee = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  // Helper: Clear active state
  const clearState = useCallback(() => {
    setRecords([]);
    setLogs([]);
    setSummary({
      totalRecords: 50,
      processedRecords: 0,
      recoveryRatePct: 0,
      netRecoveredGTV: 0,
      policyBreachRatePct: 0,
      avgLatencyMs: 0,
      throughputRps: 0
    });
    setStatus('idle');
  }, []);

  // Cleanup EventSource connection
  const closeConnection = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  // Effect: Cleanup on unmount
  useEffect(() => {
    return () => {
      closeConnection();
    };
  }, [closeConnection]);

  // Effect: Handle Static Mode Switching
  useEffect(() => {
    if (useStatic) {
      closeConnection();
      setRecords(FALLBACK_BENCHMARK_DATA.records);
      setLogs(FALLBACK_BENCHMARK_DATA.logs);
      setSummary(FALLBACK_BENCHMARK_DATA.summary);
      setStatus('completed');
    } else {
      clearState();
    }
  }, [useStatic, closeConnection, clearState]);

  // Effect: Auto-scroll to bottom of logs
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Trigger SSE stream
  const startStream = () => {
    if (useStatic) return;

    clearState();
    setStatus('streaming');

    // Create new EventSource connection
    const eventSource = new EventSource('/api/benchmark/stream');
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        if (payload.event === 'START') {
          setLogs([{
            timestamp: new Date().toISOString(),
            level: 'INFO',
            message: `[System] SSE stream started. Preparing to ingest ${payload.total} failed transactions...`
          }]);
        } else if (payload.event === 'RECORD_PROCESSED') {
          // Add processed record
          setRecords((prev) => [...prev, payload.record]);

          // Add corresponding logs
          if (payload.logs && Array.isArray(payload.logs)) {
            setLogs((prev) => [...prev, ...payload.logs]);
          }

          // Update Summary Statistics
          setSummary(payload.runningSummary);
        } else if (payload.event === 'COMPLETE') {
          setSummary(payload.finalSummary);
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date().toISOString(),
              level: 'SUCCESS',
              message: `[System] SSE stream successfully processed all ${payload.finalSummary.totalRecords} records! Benchmark complete.`
            }
          ]);
          setStatus('completed');
          closeConnection();
        }
      } catch (err) {
        console.error('Failed to parse SSE data:', err);
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            message: `[System] Processing error occurred during stream parsing.`
          }
        ]);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err);
      setStatus('error');
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          level: 'ERROR',
          message: `[Connection] EventSource handshake failed or connection interrupted.`
        }
      ]);
      closeConnection();
    };
  };

  // Log level color map
  const getLevelStyles = (level: string) => {
    switch (level) {
      case 'SUCCESS':
        return 'text-emerald-400 font-bold';
      case 'WARN':
        return 'text-amber-400 font-bold';
      case 'ERROR':
        return 'text-rose-400 font-bold';
      case 'INFO':
      default:
        return 'text-sky-400';
    }
  };

  // Filter logs by query & level
  const filteredLogs = logs.filter((log) => {
    const matchesLevel = logFilter === 'ALL' || log.level === logFilter;
    const matchesSearch =
      searchQuery === '' ||
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.payload && JSON.stringify(log.payload).toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesLevel && matchesSearch;
  });

  // Calculate percentages for progress indicator
  const progressPct = summary.totalRecords
    ? Math.round((summary.processedRecords / summary.totalRecords) * 100)
    : 0;

  // Recovery rate status color configuration
  const getRecoveryRateColor = (rate: number) => {
    if (rate >= 80) return 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10';
    if (rate >= 50) return 'text-amber-500 border-amber-500/20 bg-amber-500/10';
    return 'text-rose-500 border-rose-500/20 bg-rose-500/10';
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 md:px-0">
      
      {/* Control Bar Card */}
      <div className="relative group overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl transition-all duration-300">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <Sliders className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white tracking-wide">Benchmark Settings & Execution</h2>
              <p className="text-sm text-slate-400">Manage real-time execution flow and data ingestion backup modes.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Toggle Static Backup Mode */}
            <label className="flex items-center gap-3 cursor-pointer bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors">
              <span className="text-xs font-semibold text-slate-300">Static Backup Mode</span>
              <input
                type="checkbox"
                className="sr-only peer"
                checked={useStatic}
                onChange={(e) => setUseStatic(e.target.checked)}
                disabled={status === 'streaming'}
              />
              <div className="relative w-11 h-6 bg-slate-800 rounded-full peer peer-focus:ring-2 peer-focus:ring-indigo-500/20 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
            </label>

            {/* Run Button */}
            <button
              onClick={startStream}
              disabled={status === 'streaming' || useStatic}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold tracking-wide shadow-lg transition-all duration-200 ${
                status === 'streaming' || useStatic
                  ? 'bg-indigo-900/40 text-indigo-300 cursor-not-allowed border border-indigo-900/30'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500 hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {status === 'streaming' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  Streaming {progressPct}%...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 text-white fill-current" />
                  Run 50-Record Benchmark
                </>
              )}
            </button>

            {/* Reset Button */}
            <button
              onClick={clearState}
              disabled={status === 'streaming'}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-200 ${
                status === 'streaming'
                  ? 'border-slate-800 text-slate-600 cursor-not-allowed'
                  : 'border-slate-700 hover:border-slate-600 text-slate-300 bg-slate-800/30 hover:bg-slate-800/60'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              Reset State
            </button>
          </div>
        </div>
      </div>

      {/* Progress & Live Info Display */}
      {status !== 'idle' && (
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 relative overflow-hidden">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold text-slate-400 tracking-wider uppercase flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              Ingestion Progress
            </span>
            <span className="text-sm font-mono font-bold text-white">
              {summary.processedRecords} / {summary.totalRecords} Records Evaluated ({progressPct}%)
            </span>
          </div>

          <div className="w-full bg-slate-950 h-3.5 rounded-full overflow-hidden border border-slate-800/80 p-0.5">
            <motion.div
              className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 h-full rounded-full relative"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ ease: 'easeOut', duration: 0.2 }}
            >
              <div className="absolute top-0 right-0 w-2 h-full bg-white opacity-40 blur-[1px]" />
            </motion.div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 text-center">
              <span className="text-xs text-slate-400 block mb-1">Queue Throughput</span>
              <span className="text-lg font-bold font-mono text-indigo-400">{summary.throughputRps} RPS</span>
            </div>
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 text-center">
              <span className="text-xs text-slate-400 block mb-1">Bypass Processing</span>
              <span className="text-lg font-bold font-mono text-cyan-400">
                {records.filter(r => r.status === 'RECOVERED').length} Active Retries
              </span>
            </div>
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 text-center">
              <span className="text-xs text-slate-400 block mb-1">Soft Failures</span>
              <span className="text-lg font-bold font-mono text-amber-400">
                {records.filter(r => r.status === 'FAILED').length} Rejected
              </span>
            </div>
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 text-center">
              <span className="text-xs text-slate-400 block mb-1">Banned Breaches</span>
              <span className="text-lg font-bold font-mono text-rose-400">
                {records.filter(r => r.status === 'POLICY_BREACH').length} Blocked
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Metrics Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Recovery Rate Card */}
        <div className={`rounded-2xl border p-6 transition-all duration-300 shadow-xl ${getRecoveryRateColor(summary.recoveryRatePct)}`}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-2">Automated Recovery Rate</p>
              <h3 className="text-4xl font-extrabold font-mono tracking-tight">{summary.recoveryRatePct}%</h3>
            </div>
            <div className="p-2.5 rounded-lg border border-current/10 bg-white/5">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-current/10 text-xs opacity-75">
            Target benchmark threshold of 80%+ recovery rate.
          </div>
        </div>

        {/* Net Recovered GTV Card */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 transition-all duration-300 shadow-xl hover:border-slate-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Net Recovered GTV (INR)</p>
              <h3 className="text-3xl font-extrabold font-mono text-white tracking-tight">
                {formatRupee(summary.netRecoveredGTV)}
              </h3>
            </div>
            <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Database className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-400">
            Recovered value automatically routed around failures.
          </div>
        </div>

        {/* Policy Breach Rate Card */}
        <div className={`rounded-2xl border p-6 transition-all duration-300 shadow-xl ${
          summary.policyBreachRatePct > 5
            ? 'text-rose-500 border-rose-500/20 bg-rose-500/10'
            : 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10'
        }`}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-2">Policy Breach Rate</p>
              <h3 className="text-4xl font-extrabold font-mono tracking-tight">{summary.policyBreachRatePct}%</h3>
            </div>
            <div className="p-2.5 rounded-lg border border-current/10 bg-white/5">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-current/10 text-xs opacity-75">
            Strict risk engine cutoff at 5%+ fraud breaches.
          </div>
        </div>

        {/* Average Latency Card */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 transition-all duration-300 shadow-xl hover:border-slate-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Avg Agent Routing Latency</p>
              <h3 className="text-4xl font-extrabold font-mono text-white tracking-tight">
                {summary.avgLatencyMs} <span className="text-lg font-medium text-slate-400">ms</span>
              </h3>
            </div>
            <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-400">
            Average decision & routing verification speed.
          </div>
        </div>
      </div>

      {/* Ingested Records Table & Terminal Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Ingested Records Ledger Table */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col h-[550px]">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
            <div>
              <h3 className="text-md font-semibold text-white tracking-wide">Processed Transaction Log Ledger</h3>
              <p className="text-xs text-slate-400 mt-0.5">Summary ledger of the currently evaluated records.</p>
            </div>
            <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono text-indigo-400">
              Total: {records.length} Records
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 relative rounded-lg border border-slate-800/80 bg-slate-950/40">
            {records.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                <Database className="w-8 h-8 mb-2 animate-bounce" />
                <p className="text-sm font-medium">No record ingestion logs parsed yet.</p>
                <p className="text-xs text-slate-600 mt-1">Run a benchmark to stream transaction logs.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 border-b border-slate-800 font-semibold">Transaction ID</th>
                    <th className="px-4 py-3 border-b border-slate-800 font-semibold">GTV Amount</th>
                    <th className="px-4 py-3 border-b border-slate-800 font-semibold">Trigger Fail</th>
                    <th className="px-4 py-3 border-b border-slate-800 font-semibold">Latency</th>
                    <th className="px-4 py-3 border-b border-slate-800 font-semibold text-right">Routing Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300 text-xs font-mono">
                  {records.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-900/30 transition-colors">
                      <td className="px-4 py-3.5 text-white font-medium">{rec.transactionId}</td>
                      <td className="px-4 py-3.5 text-indigo-300">{formatRupee(rec.amountGTV)}</td>
                      <td className="px-4 py-3.5 text-slate-400 truncate max-w-[120px]" title={rec.failureReason}>
                        {rec.failureReason.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3.5 text-slate-400">{rec.latencyMs}ms</td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          rec.status === 'RECOVERED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : rec.status === 'POLICY_BREACH'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse'
                            : rec.status === 'FAILED'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                        }`}>
                          {rec.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Dark Streaming Log Terminal */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col h-[550px]">
          
          {/* Terminal Title */}
          <div className="pb-4 border-b border-slate-800 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <TerminalIcon className="w-5 h-5 text-indigo-400 animate-pulse" />
              <div>
                <h3 className="text-md font-semibold text-white tracking-wide">Intelligent routing logs</h3>
                <p className="text-xs text-slate-400 mt-0.5">Real-time log trail from the fallback decision engine.</p>
              </div>
            </div>
            
            {/* Auto Scroll Checkbox */}
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800/80">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded border-slate-800 text-indigo-600 bg-slate-950 focus:ring-indigo-500/20 w-3.5 h-3.5"
              />
              <span>Auto Scroll</span>
            </label>
          </div>

          {/* Terminal Log Utilities Filters */}
          <div className="flex flex-col gap-3 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search log messages, traces..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 outline-none rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 transition-colors font-mono"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800/80">
              {(['ALL', 'INFO', 'SUCCESS', 'WARN', 'ERROR'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setLogFilter(filter)}
                  className={`flex-1 px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold tracking-wide transition-colors uppercase ${
                    logFilter === filter
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Actual Log Stream Window */}
          <div className="flex-1 bg-slate-950 border border-slate-850 rounded-xl p-4 overflow-y-auto text-xs font-mono scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
            {filteredLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center">
                <TerminalIcon className="w-8 h-8 mb-2 opacity-50" />
                <p>Terminal output buffer empty.</p>
                <p className="text-[10px] text-slate-700 mt-0.5">Stream logs by executing the benchmark run.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredLogs.map((log, index) => (
                  <div key={index} className="border-l-2 border-slate-850 pl-3 py-0.5 space-y-1 hover:bg-slate-900/10 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-[10px] text-slate-500 shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={`uppercase text-[9px] px-1.5 py-0.5 rounded border border-current/10 bg-white/5 shrink-0 ${getLevelStyles(log.level)}`}>
                        {log.level}
                      </span>
                    </div>
                    
                    <p className="text-slate-300 break-words leading-relaxed whitespace-pre-wrap">
                      {log.message}
                    </p>

                    {log.payload && Object.keys(log.payload).length > 0 && (
                      <details className="mt-1 group">
                        <summary className="text-[10px] text-indigo-400 hover:text-indigo-300 cursor-pointer select-none outline-none flex items-center gap-1">
                          <Eye className="w-3 h-3 group-open:rotate-180 transition-transform" />
                          <span>Metadata Trace</span>
                        </summary>
                        <pre className="mt-1 p-2 bg-slate-900/80 border border-slate-850 rounded text-[10px] text-slate-400 overflow-x-auto select-text font-mono max-w-full leading-normal">
                          {JSON.stringify(log.payload, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
                <div ref={terminalEndRef} />
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
