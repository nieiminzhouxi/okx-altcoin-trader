import React, { useState, useEffect, useCallback } from 'react';
import type { DashboardData, Signal, TradeConfig } from '../types.js';
import {
  getDashboard,
  startEngine,
  stopEngine,
  toggleAutoTrade,
  manualScan,
  manualOpen,
  manualClose,
} from '../api.js';
import SignalList from './SignalList.js';
import PositionList from './PositionList.js';
import LogList from './LogList.js';
import ConfigPanel from './ConfigPanel.js';

interface Props {
  onLogout: () => void;
}

export default function Dashboard({ onLogout }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [activeTab, setActiveTab] = useState<'signals' | 'positions' | 'logs' | 'config'>('signals');
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async () => {
    try {
      const d = await getDashboard();
      if (d.success) setData(d);
    } catch {}
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleStart = async () => {
    setActionLoading(true);
    const res = await startEngine();
    showToast(res.message, res.success ? 'success' : 'error');
    setActionLoading(false);
    fetchData();
  };

  const handleStop = async () => {
    setActionLoading(true);
    const res = await stopEngine();
    showToast(res.message, res.success ? 'success' : 'error');
    setActionLoading(false);
    fetchData();
  };

  const handleAutoTrade = async (enabled: boolean) => {
    await toggleAutoTrade(enabled);
    fetchData();
  };

  const handleScan = async () => {
    setActionLoading(true);
    const res = await manualScan();
    showToast(`${res.message} (${res.count} 个信号)`, res.success ? 'success' : 'error');
    setActionLoading(false);
    fetchData();
  };

  const handleOpen = async (signal: Signal) => {
    setActionLoading(true);
    const res = await manualOpen(signal);
    showToast(res.message, res.success ? 'success' : 'error');
    setActionLoading(false);
    fetchData();
  };

  const handleClose = async (instId: string) => {
    setActionLoading(true);
    const res = await manualClose(instId);
    showToast(res.message, res.success ? 'success' : 'error');
    setActionLoading(false);
    fetchData();
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-500 text-sm">加载中...</div>
      </div>
    );
  }

  const { status, config, signals, logs, positions } = data;
  const totalPnl = positions.reduce((s, p) => s + parseFloat(p.upl || '0'), 0);

  const tabs = [
    { key: 'signals' as const, label: '异动信号', count: signals.length },
    { key: 'positions' as const, label: '持仓监控', count: positions.length },
    { key: 'logs' as const, label: '交易日志', count: logs.length },
    { key: 'config' as const, label: '策略配置', count: 0 },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* 顶栏 */}
      <header className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold">📊 OKB 异动交易系统</h1>
            <div className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full ${status.connected ? 'bg-emerald-500 pulse-green' : 'bg-slate-600'}`}></span>
              <span className={status.connected ? 'text-emerald-400' : 'text-slate-500'}>
                {status.connected ? '已连接' : '未连接'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full ${status.running ? 'bg-blue-500 pulse-green' : 'bg-slate-600'}`}></span>
              <span className={status.running ? 'text-blue-400' : 'text-slate-500'}>
                引擎{status.running ? '运行中' : '已停止'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {totalPnl !== 0 && (
              <div className={`text-sm font-bold px-3 py-1 rounded-lg ${totalPnl >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                总盈亏: {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)} U
              </div>
            )}
            <button
              onClick={onLogout}
              className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      {/* 控制栏 */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* 引擎开关 */}
            {status.running ? (
              <button
                onClick={handleStop}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-300 rounded-lg text-sm font-medium transition-colors"
              >
                停止引擎
              </button>
            ) : (
              <button
                onClick={handleStart}
                disabled={actionLoading}
                className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 rounded-lg text-sm font-medium transition-colors"
              >
                启动引擎
              </button>
            )}

            {/* 手动扫描 */}
            <button
              onClick={handleScan}
              disabled={actionLoading}
              className="px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/50 text-indigo-300 rounded-lg text-sm font-medium transition-colors"
            >
              手动扫描
            </button>
          </div>

          <div className="flex items-center gap-4 text-sm">
            {/* 自动交易开关 */}
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-slate-400">自动交易</span>
              <div
                onClick={() => handleAutoTrade(!status.autoTrade)}
                className={`relative w-12 h-6 rounded-full transition-colors ${status.autoTrade ? 'bg-emerald-500' : 'bg-slate-600'}`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${status.autoTrade ? 'translate-x-6' : 'translate-x-0.5'}`}
                ></div>
              </div>
            </label>

            <div className="text-xs text-slate-500">
              杠杆 {config.leverage}x · 保证金 {config.marginPerOrder}U · 最大{config.maxPositions}仓
            </div>
          </div>
        </div>

        {/* Tab导航 */}
        <div className="flex gap-1 mb-4 border-b border-slate-700/50">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.key
                  ? 'border-indigo-500 text-indigo-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${activeTab === tab.key ? 'bg-indigo-500/30' : 'bg-slate-700/50'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div className="bg-slate-800/20 border border-slate-700/50 rounded-xl p-4">
          {activeTab === 'signals' && (
            <SignalList signals={signals} autoTrade={status.autoTrade} onOpen={handleOpen} />
          )}
          {activeTab === 'positions' && (
            <PositionList positions={positions} onClose={handleClose} />
          )}
          {activeTab === 'logs' && <LogList logs={logs} />}
          {activeTab === 'config' && <ConfigPanel config={config} onUpdated={fetchData} />}
        </div>

        {/* 策略说明 */}
        {activeTab === 'signals' && (
          <div className="mt-4 bg-slate-800/20 border border-slate-700/50 rounded-xl p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-2">策略说明</h3>
            <div className="grid grid-cols-2 gap-4 text-xs text-slate-500">
              <div>
                <p className="font-medium text-slate-400 mb-1">异动检测</p>
                <p>扫描所有U本位永续合约，筛选24h涨跌幅超过{config.changePctThreshold}%且成交量放大{config.volumeSpikeThreshold}倍的山寨币</p>
              </div>
              <div>
                <p className="font-medium text-slate-400 mb-1">开仓方向</p>
                <p>涨幅+放量+短期上涨 → 做多；跌幅+放量+短期下跌 → 做空；背离信号 → 反转入场</p>
              </div>
              <div>
                <p className="font-medium text-slate-400 mb-1">止盈</p>
                <p>盈利达到 {config.takeProfitUSDT}U 自动平仓（{((config.takeProfitUSDT / (config.marginPerOrder * config.leverage)) * 100).toFixed(1)}%价格变动）</p>
              </div>
              <div>
                <p className="font-medium text-slate-400 mb-1">止损/平仓</p>
                <p>亏损达保证金50%止损；持仓超4小时超时平仓；可手动平仓</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg text-sm font-medium fade-in z-50 ${
          toast.type === 'success'
            ? 'bg-emerald-500/90 text-white'
            : 'bg-red-500/90 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}