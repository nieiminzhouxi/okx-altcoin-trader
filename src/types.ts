// 前端类型定义

export interface OkxConfig {
  apiKey: string;
  secretKey: string;
  passphrase: string;
  simulated: boolean;
}

export interface Signal {
  instId: string;
  baseCcy: string;
  price: number;
  changePct: number;
  volumeSpikeRatio: number;
  direction: 'long' | 'short';
  score: number;
  reason: string;
  ts: number;
}

export interface Position {
  instId: string;
  posSide: 'long' | 'short' | 'net';
  pos: string;
  avgPx: string;
  markPx?: string;
  upl: string;
  uplRatio: string;
  lever: string;
  margin: string;
  liqPx?: string;
  mgnMode: string;
  ts: number;
}

export interface TradeLog {
  id: string;
  ts: number;
  type: 'signal' | 'open' | 'close' | 'tp' | 'sl' | 'error' | 'info';
  instId?: string;
  side?: 'buy' | 'sell';
  posSide?: 'long' | 'short';
  price?: number;
  qty?: number;
  pnl?: number;
  message: string;
}

export interface TradeConfig {
  marginPerOrder: number;
  takeProfitUSDT: number;
  leverage: number;
  maxPositions: number;
  scanInterval: number;
  volumeSpikeThreshold: number;
  changePctThreshold: number;
  mgnMode: 'crossed' | 'isolated';
  excludeStables: boolean;
  autoTrade: boolean;
}

export interface DashboardData {
  success: boolean;
  status: {
    running: boolean;
    autoTrade: boolean;
    connected: boolean;
  };
  config: TradeConfig;
  signals: Signal[];
  logs: TradeLog[];
  positions: Position[];
}