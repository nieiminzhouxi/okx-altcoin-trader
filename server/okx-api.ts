import crypto from 'crypto';
import { ProxyAgent, fetch as undiciFetch } from 'undici';
import type { OkxConfig } from './types.js';

const BASE_URL = 'https://www.okx.com';

// 系统代理设置（支持科学上网软件如Clash/v2ray）
const PROXY_URL = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || 'http://127.0.0.1:12334';
const proxyAgent = new ProxyAgent({ uri: PROXY_URL, connectTls: { rejectUnauthorized: false } });

/**
 * 生成OKX API签名
 * 签名算法: HMAC-SHA256(timestamp + METHOD + requestPath + body, secretKey) -> Base64
 * 注意: 各部分之间没有换行符分隔
 */
export function getSignature(
  timestamp: string,
  method: string,
  requestPath: string,
  body: string,
  secretKey: string
): string {
  const prehash = timestamp + method.toUpperCase() + requestPath + body;
  return crypto.createHmac('sha256', secretKey).update(prehash).digest('base64');
}

/**
 * 获取ISO8601格式时间戳(毫秒级，不带+00:00)
 * e.g. 2026-09-24T06:12:20.856Z
 */
export function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * 发送OKX API请求
 */
export async function okxRequest<T = any>(
  config: OkxConfig,
  method: 'GET' | 'POST' | 'DELETE',
  requestPath: string,
  params?: Record<string, any>
): Promise<T> {
  const timestamp = getTimestamp();
  let fullPath = requestPath;
  let body = '';

  if (method === 'GET' && params) {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) query.append(k, String(v));
    }
    const qs = query.toString();
    if (qs) fullPath += `?${qs}`;
  } else if (method === 'POST' || method === 'DELETE') {
    body = params ? JSON.stringify(params) : '';
  }

  const signature = getSignature(timestamp, method, fullPath, body, config.secretKey);

  const headers: Record<string, string> = {
    'OK-ACCESS-KEY': config.apiKey,
    'OK-ACCESS-SIGN': signature,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': config.passphrase,
    'Content-Type': 'application/json',
  };

  // 模拟盘需要设置 x-simulated-trading: 1
  if (config.simulated) {
    headers['x-simulated-trading'] = '1';
  }

  const url = BASE_URL + fullPath;
  const res = await undiciFetch(url, {
    method,
    headers,
    body: body || undefined,
    dispatcher: proxyAgent,
  });

  const data = await res.json() as any;

  if (data.code !== '0') {
    const detail = Array.isArray(data.data) && data.data[0]
      ? `${data.msg} | sCode=${data.data[0].sCode}, sMsg=${data.data[0].sMsg}`
      : data.msg || JSON.stringify(data);
    throw new Error(`OKX API Error [${data.code}]: ${detail}`);
  }

  return data.data as T;
}

// ===================== 行情接口 =====================

/** 获取U本位合约 instrument 列表 */
export async function getSwapInstruments(config: OkxConfig): Promise<any[]> {
  return okxRequest(config, 'GET', '/api/v5/public/instruments', {
    instType: 'SWAP',
  });
}

/** 获取所有 U本位永续合约 ticker */
export async function getSwapTickers(config: OkxConfig): Promise<any[]> {
  return okxRequest(config, 'GET', '/api/v5/market/tickers', {
    instType: 'SWAP',
  });
}

/** 获取单个 ticker */
export async function getTicker(config: OkxConfig, instId: string): Promise<any[]> {
  return okxRequest(config, 'GET', '/api/v5/market/ticker', { instId });
}

/** 获取K线数据
 * bar: 1m/5m/15m/1H/4H/1D 等
 * limit: 最大300
 */
export async function getCandles(
  config: OkxConfig,
  instId: string,
  bar: string = '5m',
  limit: number = 100
): Promise<string[][]> {
  return okxRequest(config, 'GET', '/api/v5/market/candles', {
    instId,
    bar,
    limit,
  });
}

// ===================== 账户/交易接口 =====================

/** 设置杠杆 */
export async function setLeverage(
  config: OkxConfig,
  instId: string,
  lever: number,
  mgnMode: string,
  posSide?: 'long' | 'short'
): Promise<any[]> {
  const params: any = {
    instId,
    lever: String(lever),
    mgnMode,
  };
  if (posSide) params.posSide = posSide;
  return okxRequest(config, 'POST', '/api/v5/account/set-leverage', params);
}

/** 设置保证金模式 */
export async function setMarginMode(
  config: OkxConfig,
  mgnMode: string
): Promise<any[]> {
  return okxRequest(config, 'POST', '/api/v5/account/set-margin-mode', { mgnMode });
}

/** 下单 */
export async function placeOrder(
  config: OkxConfig,
  params: {
    instId: string;
    tdMode: string;       // cross / isolated / cash
    side: 'buy' | 'sell';
    posSide?: 'long' | 'short' | 'net';
    ordType: string;      // market / limit / post_only 等
    sz: string;           // 合约张数
    px?: string;          // 限价单价格
    tpTriggerPx?: string; // 止盈触发价
    tpOrdPx?: string;     // 止盈委托价
    slTriggerPx?: string; // 止损触发价
    slOrdPx?: string;     // 止损委托价
    reduceOnly?: boolean;
    clOrdId?: string;     // 客户自定义订单ID
    tag?: string;
    attachAlgoOrds?: Array<{
      attachAlgoId?: string;
      tpTriggerPx?: string;
      tpOrdPx?: string;
      slTriggerPx?: string;
      slOrdPx?: string;
    }>;                  // 附带止盈止损算法单
  }
): Promise<any[]> {
  return okxRequest(config, 'POST', '/api/v5/trade/order', params);
}

/** 撤单 */
export async function cancelOrder(
  config: OkxConfig,
  instId: string,
  ordId: string
): Promise<any[]> {
  return okxRequest(config, 'POST', '/api/v5/trade/cancel-order', { instId, ordId });
}

/** 获取持仓信息 */
export async function getPositions(config: OkxConfig, instType?: string): Promise<any[]> {
  const params: any = {};
  if (instType) params.instType = instType;
  return okxRequest(config, 'GET', '/api/v5/account/positions', params);
}

/** 获取账户余额 */
export async function getAccountBalance(config: OkxConfig): Promise<any[]> {
  return okxRequest(config, 'GET', '/api/v5/account/balance');
}

/** 查看委托中的订单 */
export async function getPendingOrders(
  config: OkxConfig,
  instId?: string
): Promise<any[]> {
  const params: any = { instType: 'SWAP' };
  if (instId) params.instId = instId;
  return okxRequest(config, 'GET', '/api/v5/trade/orders-pending', params);
}

/** 一键平仓 (close position) */
export async function closePosition(
  config: OkxConfig,
  instId: string,
  mgnMode: string,
  posSide: string
): Promise<any[]> {
  return okxRequest(config, 'POST', '/api/v5/trade/close-position', {
    instId,
    mgnMode,
    posSide,
  });
}