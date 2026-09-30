// OKX API 类型定义

export interface OkxConfig {
  apiKey: string;
  secretKey: string;
  passphrase: string;
  simulated: boolean; // true=模拟盘, false=正式盘
}

export interface Instrument {
  instId: string;       // e.g. "BTC-USDT-SWAP"
  baseCcy: string;      // e.g. "BTC"
  quoteCcy: string;     // e.g. "USDT"
  ctVal: string;        // 合约面值
  lever: string;        // 杠杆
  state: string;        // live 等
  ctType: string;       // linear/inverse
}

export interface Ticker {
  instId: string;
  last: string;         // 最新价
  lastSz?: string;
  bidPx?: string;
  askPx?: string;
  open24h: string;      // 24h开盘价
  high24h: string;
  low24h: string;
  vol24h: string;       // 24h成交量(以基础币计)
  volCcy24h: string;    // 24h成交量(以计价币计)
  ts: string;
}

export interface Candle {
  ts: string;       // 时间戳
  o: string;        // 开
  h: string;        // 高
  l: string;        // 低
  c: string;        // 收
  vol: string;      // 成交量(基础币)
  volCcy: string;   // 成交量(计价币)
  volCcyQuote: string; // 成交量(U)
  confirm: string;  // 0=未完成, 1=完成
}

// 异动信号
export interface Signal {
  instId: string;
  baseCcy: string;
  price: number;
  changePct: number;        // 涨跌幅 %
  volumeSpikeRatio: number; // 成交量放大倍数
  direction: 'long' | 'short'; // 建议方向
  score: number;            // 综合评分
  reason: string;           // 触发原因
  ts: number;
}

// 持仓
export interface Position {
  instId: string;
  posId?: string;
  posSide: 'long' | 'short' | 'net';
  pos: string;          // 持仓数量(合约)
  posCcy?: string;
  avgPx: string;        // 开仓均价
  markPx?: string;      // 标记价
  upl: string;          // 未实现盈亏(USDT)
  uplRatio: string;     // 收益率
  lever: string;
  margin: string;       // 保证金
  liqPx?: string;       // 强平价
  mgnMode: string;      // crossed / isolated
  ts: number;
}

// 下单结果
export interface OrderResult {
  ordId: string;
  instId: string;
  side: 'buy' | 'sell';
  posSide?: 'long' | 'short';
  sz: string;
  px?: string;
  state: string;
  msg?: string;
}

// 交易日志
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

// 配置参数
export interface TradeConfig {
  marginPerOrder: number;     // 每单保证金 USDT
  takeProfitUSDT: number;     // 止盈金额 USDT (10U)
  leverage: number;           // 杠杆
  maxPositions: number;       // 最大同时持仓数
  scanInterval: number;       // 扫描间隔 ms
  volumeSpikeThreshold: number; // 成交量放大倍数阈值
  changePctThreshold: number;   // 涨跌幅阈值 %
  mgnMode: 'crossed' | 'isolated'; // 保证金模式
  excludeStables: boolean;    // 排除稳定币
  autoTrade: boolean;         // 是否自动交易
}