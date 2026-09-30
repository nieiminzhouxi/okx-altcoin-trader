import React, { useState } from 'react';
import type { OkxConfig } from '../types.js';
import { login } from '../api.js';

interface Props {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [simulated, setSimulated] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !secretKey || !passphrase) {
      setError('请填写完整');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await login({ apiKey, secretKey, passphrase, simulated });
      if (result.success) {
        onLoginSuccess();
      } else {
        setError(result.message);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">OKB 异动交易系统</h1>
          <p className="text-slate-400 text-sm">山寨币异动监控 · 自动多空交易 · 10U止盈</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-800/50 backdrop-blur-lg rounded-2xl p-8 border border-slate-700/50 shadow-2xl">
          {/* 环境选择 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-3">交易环境</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSimulated(true)}
                className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  simulated
                    ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-300'
                    : 'bg-slate-700/50 border-2 border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                模拟盘
              </button>
              <button
                type="button"
                onClick={() => setSimulated(false)}
                className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  !simulated
                    ? 'bg-red-500/20 border-2 border-red-500 text-red-300'
                    : 'bg-slate-700/50 border-2 border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                正式盘
              </button>
            </div>
            {!simulated && (
              <p className="mt-2 text-xs text-red-400/80">⚠ 正式盘将使用真实资金交易</p>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">API Key</label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="输入你的 API Key"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Secret Key</label>
              <input
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="输入你的 Secret Key"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Passphrase</label>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="输入你的 Passphrase"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white font-medium py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
          >
            {loading ? '验证中...' : '登录连接'}
          </button>

          <div className="mt-6 pt-6 border-t border-slate-700/50">
            <p className="text-xs text-slate-500 text-center">
              请确保API Key已开启合约交易权限<br />
              登录信息仅存于当前会话，不会持久化
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}