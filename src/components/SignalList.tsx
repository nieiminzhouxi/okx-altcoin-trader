import React from 'react';
import type { Signal } from '../types.js';

interface Props {
  signals: Signal[];
  autoTrade: boolean;
  onOpen: (signal: Signal) => void;
}

export default function SignalList({ signals, autoTrade, onOpen }: Props) {
  if (signals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <svg className="w-12 h-12 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm">等待扫描信号...</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {signals.map((sig) => (
        <div
          key={`${sig.instId}-${sig.ts}`}
          className="fade-in bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className={`px-2 py-1 rounded text-xs font-bold ${
                  sig.direction === 'long'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-red-500/20 text-red-300'
                }`}
              >
                {sig.direction === 'long' ? '多' : '空'}
              </span>
              <div>
                <div className="font-semibold text-white text-sm">{sig.baseCcy}</div>
                <div className="text-xs text-slate-500">${sig.price.toFixed(4)}</div>
              </div>
            </div>

            <div className="text-right">
              <div className={`text-sm font-bold ${sig.changePct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {sig.changePct >= 0 ? '+' : ''}{sig.changePct.toFixed(2)}%
              </div>
              <div className="text-xs text-amber-400">
                Vol x{sig.volumeSpikeRatio.toFixed(1)}
              </div>
            </div>

            <div className="text-center min-w-[60px]">
              <div className="text-xs text-slate-500">评分</div>
              <div className="text-lg font-bold text-indigo-300">{sig.score}</div>
            </div>

            {!autoTrade && (
              <button
                onClick={() => onOpen(sig)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  sig.direction === 'long'
                    ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/20 hover:bg-red-500/30 text-red-300'
                }`}
              >
                开{sig.direction === 'long' ? '多' : '空'}
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-2 pl-1">{sig.reason}</p>
        </div>
      ))}
    </div>
  );
}