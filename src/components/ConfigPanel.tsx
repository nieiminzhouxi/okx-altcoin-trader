import React, { useState } from 'react';
import type { TradeConfig } from '../types.js';
import { updateConfig } from '../api.js';

interface Props {
  config: TradeConfig;
  onUpdated: () => void;
}

export default function ConfigPanel({ config, onUpdated }: Props) {
  const [local, setLocal] = useState<TradeConfig>(config);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    setLocal(config);
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    await updateConfig({
      marginPerOrder: local.marginPerOrder,
      takeProfitUSDT: local.takeProfitUSDT,
      leverage: local.leverage,
      maxPositions: local.maxPositions,
      scanInterval: local.scanInterval,
      volumeSpikeThreshold: local.volumeSpikeThreshold,
      changePctThreshold: local.changePctThreshold,
      mgnMode: local.mgnMode,
    });
    setSaving(false);
    onUpdated();
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">每单保证金 (U)</label>
          <input
            type="number"
            value={local.marginPerOrder}
            onChange={(e) => setLocal({ ...local, marginPerOrder: Number(e.target.value) })}
            className="w-full bg-slate-900/50 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">止盈金额 (U)</label>
          <input
            type="number"
            value={local.takeProfitUSDT}
            onChange={(e) => setLocal({ ...local, takeProfitUSDT: Number(e.target.value) })}
            className="w-full bg-slate-900/50 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">杠杆倍数</label>
          <input
            type="number"
            value={local.leverage}
            onChange={(e) => setLocal({ ...local, leverage: Number(e.target.value) })}
            className="w-full bg-slate-900/50 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">最大持仓数</label>
          <input
            type="number"
            value={local.maxPositions}
            onChange={(e) => setLocal({ ...local, maxPositions: Number(e.target.value) })}
            className="w-full bg-slate-900/50 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">扫描间隔 (分钟)</label>
          <input
            type="number"
            value={Math.floor(local.scanInterval / 60000)}
            onChange={(e) => setLocal({ ...local, scanInterval: Number(e.target.value) * 60000 })}
            className="w-full bg-slate-900/50 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">成交量放大阈值</label>
          <input
            type="number"
            step="0.5"
            value={local.volumeSpikeThreshold}
            onChange={(e) => setLocal({ ...local, volumeSpikeThreshold: Number(e.target.value) })}
            className="w-full bg-slate-900/50 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">涨跌幅阈值 (%)</label>
          <input
            type="number"
            step="0.5"
            value={local.changePctThreshold}
            onChange={(e) => setLocal({ ...local, changePctThreshold: Number(e.target.value) })}
            className="w-full bg-slate-900/50 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">保证金模式</label>
          <select
            value={local.mgnMode}
            onChange={(e) => setLocal({ ...local, mgnMode: e.target.value as 'crossed' | 'isolated' })}
            className="w-full bg-slate-900/50 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
          >
            <option value="isolated">逐仓</option>
            <option value="crossed">全仓</option>
          </select>
        </div>
      </div>

      <div className="bg-slate-900/30 rounded-lg p-3 text-xs text-slate-400 space-y-1">
        <div className="flex justify-between">
          <span>实际仓位 = 保证金 × 杠杆</span>
          <span className="text-indigo-300">{(local.marginPerOrder * local.leverage).toFixed(0)} U</span>
        </div>
        <div className="flex justify-between">
          <span>止盈比例 = 止盈U / 仓位U</span>
          <span className="text-emerald-300">
            {((local.takeProfitUSDT / (local.marginPerOrder * local.leverage)) * 100).toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span>止损金额 (50%保证金)</span>
          <span className="text-red-300">{(local.marginPerOrder * 0.5).toFixed(1)} U</span>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/50 text-indigo-300 text-sm py-2 rounded-lg transition-colors disabled:opacity-50"
      >
        {saving ? '保存中...' : '保存配置'}
      </button>
    </div>
  );
}