import type { OkxConfig, TradeConfig, DashboardData } from './types.js';

const BASE = '/api';

export async function login(config: OkxConfig): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return res.json();
}

export async function getDashboard(): Promise<DashboardData> {
  const res = await fetch(`${BASE}/dashboard`);
  return res.json();
}

export async function startEngine(): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/engine/start`, { method: 'POST' });
  return res.json();
}

export async function stopEngine(): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/engine/stop`, { method: 'POST' });
  return res.json();
}

export async function toggleAutoTrade(enabled: boolean): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE}/engine/auto-trade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  return res.json();
}

export async function manualScan(): Promise<{ success: boolean; message: string; count: number }> {
  const res = await fetch(`${BASE}/scan`, { method: 'POST' });
  return res.json();
}

export async function manualOpen(signal: any): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/trade/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(signal),
  });
  return res.json();
}

export async function manualClose(instId: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/trade/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instId }),
  });
  return res.json();
}

export async function updateConfig(config: Partial<TradeConfig>): Promise<{ success: boolean; config: TradeConfig }> {
  const res = await fetch(`${BASE}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return res.json();
}