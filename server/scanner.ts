import type { OkxConfig, Signal, TradeConfig } from './types.js';
import { getSwapTickers, getCandles, getSwapInstruments } from './okx-api.js';

// 稳定币列表 - 排除
const STABLE_COINS = new Set([
  'USDT', 'USDC', 'TUSD', 'DAI', 'FDUSD', 'USDP', 'PYUSD', 'USDD',
  'PAX', 'GUSD', 'USTC', 'EURT', 'USDK',
]);

/**
 * 获取U本位永续合约 instrument 映射
 * 返回 instId -> { baseCcy, ctVal, state }
 */
export async function getSwapInstrumentMap(config: OkxConfig) {
  const instruments = await getSwapInstruments(config);
  const map = new Map<string, { baseCcy: string; ctVal: number; state: string; settleCcy: string }>();
  for (const inst of instruments) {
    // 只取 U本位(以USDT计价和结算的永续合约)
    if (inst.settleCcy === 'USDT' && inst.state === 'live') {
      map.set(inst.instId, {
        baseCcy: inst.baseCcy,
        ctVal: parseFloat(inst.ctVal) || 1,
        state: inst.state,
        settleCcy: inst.settleCcy,
      });
    }
  }
  return map;
}

/**
 * 扫描异常波动的山寨币
 * 策略:
 * 1. 从所有U本位合约 ticker 中筛选24h涨跌幅超过阈值的
 * 2. 对候选币种获取最近K线，判断成交量是否放大
 * 3. 综合评分，生成做多/做空信号
 * @param blockedInstruments 不可交易的instId集合（合规限制等），扫描时跳过
 */
export async function scanAnomalies(
  config: OkxConfig,
  tradeConfig: TradeConfig,
  blockedInstruments?: Set<string>
): Promise<Signal[]> {
  const tickers = await getSwapTickers(config);
  const instMap = await getSwapInstrumentMap(config);

  const signals: Signal[] = [];

  // 过滤: 只看USDT结算的活跃合约
  const candidates = tickers.filter((t) => {
    const inst = instMap.get(t.instId);
    if (!inst) return false;
    if (tradeConfig.excludeStables && STABLE_COINS.has(inst.baseCcy)) return false;
    // 排除主流币 BTC, ETH
    if (inst.baseCcy === 'BTC' || inst.baseCcy === 'ETH') return false;
    // 排除成交量为0的
    if (!t.volCcy24h || parseFloat(t.volCcy24h) < 100000) return false;
    // 排除黑名单中的不可交易币种（合规限制）
    if (blockedInstruments && blockedInstruments.has(t.instId)) return false;
    return true;
  });

  // 计算每个候选的24h涨跌幅
  const scored = candidates.map((t) => {
    const open24h = parseFloat(t.open24h);
    const last = parseFloat(t.last);
    const changePct = open24h > 0 ? ((last - open24h) / open24h) * 100 : 0;
    return { ticker: t, changePct };
  });

  // 按绝对涨跌幅排序取前50名候选来进一步检查K线
  scored.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  const topN = scored.slice(0, 50);

  // 并发获取K线数据 (限制并发数)
  const batchSize = 5;
  for (let i = 0; i < topN.length; i += batchSize) {
    const batch = topN.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async ({ ticker, changePct }) => {
        try {
          // 获取最近5m K线，用于判断短期成交量异动
          const candles = await getCandles(config, ticker.instId, '5m', 50);
          if (!candles || candles.length < 20) return null;

          // OKX K线: [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]
          // 时间从新到旧排列
          const recentCandles = candles.slice(0, 10).map((c) => ({
            ts: parseInt(c[0]),
            o: parseFloat(c[1]),
            h: parseFloat(c[2]),
            l: parseFloat(c[3]),
            c: parseFloat(c[4]),
            vol: parseFloat(c[5]),
            volCcy: parseFloat(c[6]),
            volQuote: parseFloat(c[7] || '0'),
          }));

          const olderCandles = candles.slice(10, 50).map((c) => ({
            volQuote: parseFloat(c[7] || '0'),
          }));

          // 计算最近10根K线平均成交量 vs 之前40根平均成交量
          const recentAvgVol = recentCandles.reduce((s, c) => s + c.volQuote, 0) / recentCandles.length;
          const olderAvgVol = olderCandles.length > 0
            ? olderCandles.reduce((s, c) => s + c.volQuote, 0) / olderCandles.length
            : recentAvgVol;

          const volumeSpikeRatio = olderAvgVol > 0 ? recentAvgVol / olderAvgVol : 1;

          // 判断短期K线趋势 (最近5根)
          const recent5 = recentCandles.slice(0, 5);
          const shortChange = recent5.length > 0
            ? ((recent5[0].c - recent5[recent5.length - 1].c) / recent5[recent5.length - 1].c) * 100
            : 0;

          const inst = instMap.get(ticker.instId);
          if (!inst) return null;

          // 综合评分
          let score = 0;
          // 涨跌幅得分 (绝对值越大分越高，上限40)
          score += Math.min(Math.abs(changePct) * 2, 40);
          // 成交量放大得分 (放大倍数越高分越高，上限40)
          score += Math.min(volumeSpikeRatio * 10, 40);
          // 短期动量得分 (上限20)
          score += Math.min(Math.abs(shortChange) * 4, 20);

          // 判断是否达到阈值
          const absChange = Math.abs(changePct);
          if (absChange < tradeConfig.changePctThreshold && volumeSpikeRatio < tradeConfig.volumeSpikeThreshold) {
            return null; // 不满足阈值
          }

          // 方向判断:
          // 涨幅大 + 放量 + 短期上涨 -> 做多 (追涨)
          // 跌幅大 + 放量 + 短期下跌 -> 做空 (杀跌)
          // 放量但价格横盘 -> 不确定，跳过
          let direction: 'long' | 'short';
          let reason: string;

          if (changePct > 0 && shortChange > 0) {
            direction = 'long';
            reason = `24h涨幅${changePct.toFixed(2)}%，短期上涨${shortChange.toFixed(2)}%，成交量放大${volumeSpikeRatio.toFixed(1)}倍`;
          } else if (changePct < 0 && shortChange < 0) {
            direction = 'short';
            reason = `24h跌幅${Math.abs(changePct).toFixed(2)}%，短期下跌${Math.abs(shortChange).toFixed(2)}%，成交量放大${volumeSpikeRatio.toFixed(1)}倍`;
          } else if (changePct > 0 && shortChange < 0) {
            // 24h涨但短期跌 -> 可能回调，观望
            direction = 'short';
            reason = `24h涨幅${changePct.toFixed(2)}%但短期回调${shortChange.toFixed(2)}%，可能反转做空`;
          } else {
            // 24h跌但短期涨 -> 可能反弹，做多
            direction = 'long';
            reason = `24h跌幅${Math.abs(changePct).toFixed(2)}%但短期反弹${shortChange.toFixed(2)}%，可能反转做多`;
          }

          const signal: Signal = {
            instId: ticker.instId,
            baseCcy: inst.baseCcy,
            price: parseFloat(ticker.last),
            changePct,
            volumeSpikeRatio,
            direction,
            score: Math.round(score),
            reason,
            ts: Date.now(),
          };
          return signal;
        } catch {
          return null;
        }
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        signals.push(r.value);
      }
    }
  }

  // 按评分排序
  signals.sort((a, b) => b.score - a.score);
  return signals;
}