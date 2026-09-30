import React from 'react';
import type { TradeLog } from '../types.js';

interface Props {
  logs: TradeLog[];
}

const typeColors: Record<string, string> = {
  signal: 'text-indigo-400',
  open: 'text-blue-400',
  close: 'text-slate-300',
  tp: 'text-emerald-400',
  sl: 'text-red-400',
  error: 'text-red-500',
  info: 'text-slate-500',
};

const typeLabels: Record<string, string> = {
  signal: '信号',
  open: '开仓',
  close: '平仓',
  tp: '止盈',
  sl: '止损',
  error: '错误',
  info: '信息',
};

export default function LogList({ logs }: Props) {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <svg className="w-12 h-12 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="text-sm">暂无日志</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 max-h-[calc(100vh-200px)] overflow-y-auto">
      {logs.map((log) => {
        const time = new Date(log.ts);
        const timeStr = time.toLocaleTimeString('zh-CN', { hour12: false });
        return (
          <div
            key={log.id}
            className="fade-in flex items-start gap-2 text-xs py-1.5 px-2 rounded hover:bg-slate-800/30"
          >
            <span className="text-slate-600 font-mono shrink-0">{timeStr}</span>
            <span className={`shrink-0 font-medium ${typeColors[log.type] || 'text-slate-400'}`}>
              [{typeLabels[log.type] || log.type}]
            </span>
            <span className="text-slate-300 break-all">{log.message}</span>
          </div>
        );
      })}
    </div>
  );
}