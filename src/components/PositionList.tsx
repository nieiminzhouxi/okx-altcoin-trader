import React from 'react';
import type { Position } from '../types.js';

interface Props {
  positions: Position[];
  onClose: (instId: string) => void;
}

export default function PositionList({ positions, onClose }: Props) {
  if (positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <svg className="w-12 h-12 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <p className="text-sm">暂无持仓</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {positions.map((pos) => {
        const upl = parseFloat(pos.upl);
        const uplRatio = parseFloat(pos.uplRatio) * 100;
        const isLong = pos.posSide === 'long';
        const margin = parseFloat(pos.margin);
        const tpTarget = 10; // 10U止盈
        const tpProgress = Math.max(0, Math.min(100, (upl / tpTarget) * 100));

        return (
          <div
            key={pos.instId + pos.posSide}
            className={`fade-in border rounded-lg p-3 ${
              isLong
                ? 'bg-emerald-500/5 border-emerald-700/30'
                : 'bg-red-500/5 border-red-700/30'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold ${
                    isLong ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                  }`}
                >
                  {isLong ? '多' : '空'} {pos.lever}x
                </span>
                <span className="font-semibold text-white text-sm">{pos.instId.replace('-USDT-SWAP', '')}</span>
                <span className="text-xs text-slate-500">{pos.mgnMode === 'cross' ? '全仓' : '逐仓'}</span>
              </div>
              <button
                onClick={() => onClose(pos.instId)}
                className="px-3 py-1 rounded text-xs bg-slate-700 hover:bg-slate-600 text-white transition-colors"
              >
                平仓
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 text-xs">
              <div>
                <div className="text-slate-500">开仓价</div>
                <div className="text-slate-300">{parseFloat(pos.avgPx).toFixed(4)}</div>
              </div>
              <div>
                <div className="text-slate-500">标记价</div>
                <div className="text-slate-300">{pos.markPx ? parseFloat(pos.markPx).toFixed(4) : '-'}</div>
              </div>
              <div>
                <div className="text-slate-500">保证金</div>
                <div className="text-slate-300">{margin.toFixed(2)} U</div>
              </div>
              <div>
                <div className="text-slate-500">数量</div>
                <div className="text-slate-300">{pos.pos}</div>
              </div>
            </div>

            {/* 止盈进度条 */}
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-500">止盈进度 (目标: {tpTarget}U)</span>
                <span className={upl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {upl >= 0 ? '+' : ''}{upl.toFixed(2)} U ({uplRatio.toFixed(2)}%)
                </span>
              </div>
              <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    upl >= 0
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                      : 'bg-gradient-to-r from-red-500 to-red-400'
                  }`}
                  style={{ width: `${tpProgress}%` }}
                />
              </div>
            </div>

            {pos.liqPx && (
              <div className="mt-2 text-xs text-red-400/60">
                强平价: {parseFloat(pos.liqPx).toFixed(4)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}