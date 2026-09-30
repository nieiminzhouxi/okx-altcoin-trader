import type { OkxConfig, Signal, TradeConfig, Position, TradeLog } from './types.js';
import {
  setLeverage,
  placeOrder,
  getPositions,
  getSwapInstruments,
  closePosition,
  getTicker,
  getAccountBalance,
} from './okx-api.js';

// ========== 下单与平仓逻辑说明 ==========
//
// 1. 开仓逻辑:
//    - 每3-5分钟扫描一次异动币种
//    - 当出现信号时，按方向开仓(做多/做空)
//    - 每单保证金固定(如10U)，杠杆默认10x，实际仓位=保证金×杠杆=100U
//    - 市价单开仓，确保成交
//    - 开仓后设置止盈: 目标盈利10U
//      止盈价 = 开仓价 × (1 ± 止盈比例)
//      止盈比例 = 目标盈利U / 仓位U = 10U / (保证金×杠杆)
//      对10x杠杆: 10U/(10U×10)=10%，即10%止盈
//    - 同步设置止损: 亏损5U止损(止损比例5%)
//    - 设置止盈止损单为reduceOnly，仅平仓不开新仓
//
// 2. 平仓逻辑:
//    - 止盈: 止盈价触发后自动平仓(okx内置止盈止损单)
//    - 止损: 止损价触发后自动平仓
//    - 超时平仓: 持仓超过4小时自动平仓(避免长时间持仓风险)
//    - 手动平仓: 用户可在界面上手动一键平仓
//
// 3. 仓位管理:
//    - 最大同时持仓数控制(避免过度交易)
//    - 同一币种只允许一个方向的持仓
//    - 开仓前检查当前持仓数
//
// 4. 风控:
//    - 保证金余额检查
//    - 每单固定10U风险
//    - 杠杆固定(默认10x)
// ================================

/** 获取 U本位合约的合约面值 */
export async function getCtVal(config: OkxConfig, instId: string): Promise<number> {
  const instruments = await getSwapInstruments(config);
  const inst = instruments.find((i) => i.instId === instId);
  if (!inst) throw new Error(`Instrument not found: ${instId}`);
  return parseFloat(inst.ctVal) || 1;
}

/**
 * 计算下单张数
 * 合约面值: 1张合约 = ctVal 个币
 * 仓位价值 = 张数 × ctVal × 价格
 * 应该 = 保证金 × 杠杆
 * 所以 张数 = (保证金 × 杠杆) / (ctVal × 价格)
 */
export function calcOrderSize(
  margin: number,
  leverage: number,
  ctVal: number,
  price: number
): number {
  const positionValue = margin * leverage;
  const size = positionValue / (ctVal * price);
  return Math.floor(size);  // OKX 张数为正整数
}

/**
 * 根据信号开仓
 * 返回下单结果
 */
export async function openPosition(
  config: OkxConfig,
  tradeConfig: TradeConfig,
  signal: Signal,
  logs: TradeLog[],
  activePositions: Set<string>
): Promise<{ success: boolean; message: string; ordId?: string }> {
  const log = (type: TradeLog['type'], message: string, extra?: Partial<TradeLog>) => {
    const entry: TradeLog = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      type,
      instId: signal.instId,
      message,
      ...extra,
    };
    logs.push(entry);
    if (logs.length > 500) logs.shift();
  };

  // 检查是否已有该币种持仓
  if (activePositions.has(signal.instId)) {
    log('info', `${signal.baseCcy} 已有持仓，跳过`);
    return { success: false, message: `${signal.instId} 已有持仓` };
  }

  // 检查持仓数量限制
  if (activePositions.size >= tradeConfig.maxPositions) {
    log('info', `已达最大持仓数 ${tradeConfig.maxPositions}，跳过`);
    return { success: false, message: '已达最大持仓数' };
  }

  try {
    // 1. 获取合约面值
    const ctVal = await getCtVal(config, signal.instId);

    // 2. 获取最新价格(确保价格准确)
    const tickerData = await getTicker(config, signal.instId);
    const lastPrice = parseFloat(tickerData[0].last);

    // 3. 计算下单张数
    const orderSize = calcOrderSize(
      tradeConfig.marginPerOrder,
      tradeConfig.leverage,
      ctVal,
      lastPrice
    );

    if (orderSize < 1) {
      log('error', `${signal.baseCcy} 计算张数不足: ${orderSize}`);
      return { success: false, message: '张数不足，保证金可能不够' };
    }

    // 4. 检查可用USDT余额(仅作记录，不阻止下单；由OKX API返回实际余额不足错误)
    try {
      const balances = await getAccountBalance(config);
      const usdt = balances.find((b: any) => b.ccy === 'USDT');
      const availEq = usdt ? parseFloat(usdt.availEq || usdt.availBal || '0') : 0;
      if (availEq < tradeConfig.marginPerOrder * 1.2) {
        log('info', `${signal.baseCcy} 提醒: 可用USDT余额${availEq.toFixed(2)}U偏低，继续尝试下单`);
      }
    } catch {
      // 忽略余额查询失败
    }

    // 5. 设置杠杆
    const mgnMode = tradeConfig.mgnMode === 'crossed' ? 'cross' : 'isolated';
    try {
      await setLeverage(config, signal.instId, tradeConfig.leverage, mgnMode, signal.direction);
      log('info', `设置杠杆 ${tradeConfig.leverage}x (${mgnMode}) for ${signal.baseCcy}`);
    } catch (e: any) {
      log('error', `设置杠杆失败: ${e.message}`);
      // 继续尝试下单
    }

    // 6. 计算止盈止损价格
    // 止盈比例 = 止盈U / 仓位U = 10U / (保证金×杠杆)
    const tpRatio = tradeConfig.takeProfitUSDT / (tradeConfig.marginPerOrder * tradeConfig.leverage);
    // 止损固定亏损50%保证金(5U)
    const slRatio = (tradeConfig.marginPerOrder * 0.5) / (tradeConfig.marginPerOrder * tradeConfig.leverage);

    let tpTriggerPx: number;
    let slTriggerPx: number;
    let side: 'buy' | 'sell';
    let posSide: 'long' | 'short';

    if (signal.direction === 'long') {
      // 做多: 买入开多
      side = 'buy';
      posSide = 'long';
      // 止盈价 = 开仓价 × (1 + tpRatio)
      tpTriggerPx = lastPrice * (1 + tpRatio);
      // 止损价 = 开仓价 × (1 - slRatio)
      slTriggerPx = lastPrice * (1 - slRatio);
    } else {
      // 做空: 卖出开空
      side = 'sell';
      posSide = 'short';
      // 止盈价 = 开仓价 × (1 - tpRatio)
      tpTriggerPx = lastPrice * (1 - tpRatio);
      // 止损价 = 开仓价 × (1 + slRatio)
      slTriggerPx = lastPrice * (1 + slRatio);
    }

    // 7. 市价开仓 + 附带止盈止损算法单
    log('info', `下单参数 ${signal.baseCcy}: instId=${signal.instId}, tdMode=${mgnMode}, side=${side}, posSide=${posSide}, sz=${orderSize}, px=${lastPrice}`);
    const orderResult = await placeOrder(config, {
      instId: signal.instId,
      tdMode: mgnMode,
      side,
      posSide,
      ordType: 'market',
      sz: String(orderSize),
      attachAlgoOrds: [
        {
          tpTriggerPx: tpTriggerPx.toFixed(6),
          tpOrdPx: '-1',  // -1 市价止盈
          slTriggerPx: slTriggerPx.toFixed(6),
          slOrdPx: '-1',  // -1 市价止损
        },
      ],
    });

    const ordId = orderResult[0]?.ordId;
    log('open', `开${signal.direction === 'long' ? '多' : '空'} ${signal.baseCcy} ${orderSize}张 @${lastPrice} | 止盈:${tpTriggerPx.toFixed(6)} 止损:${slTriggerPx.toFixed(6)}`, {
      side,
      posSide,
      price: lastPrice,
      qty: orderSize,
    });

    activePositions.add(signal.instId);
    return { success: true, message: `开${signal.direction === 'long' ? '多' : '空'} ${signal.baseCcy} 成功`, ordId };
  } catch (e: any) {
    log('error', `开仓失败 ${signal.baseCcy}: ${e.message}`);
    return { success: false, message: e.message };
  }
}

/**
 * 检查持仓并执行超时平仓
 */
export async function checkAndCloseTimeout(
  config: OkxConfig,
  tradeConfig: TradeConfig,
  logs: TradeLog[],
  openTimeMap: Map<string, number>,
  activePositions: Set<string>
): Promise<void> {
  try {
    const positions = await getPositions(config, 'SWAP');
    const now = Date.now();
    const timeoutMs = 4 * 60 * 60 * 1000; // 4小时

    for (const pos of positions) {
      if (parseFloat(pos.pos) === 0) continue;

      const instId = pos.instId;
      const openTs = openTimeMap.get(instId) || 0;

      // 超时平仓
      if (openTs > 0 && now - openTs > timeoutMs) {
        try {
          await closePosition(config, instId, pos.mgnMode, pos.posSide);
          const pnl = parseFloat(pos.upl);
          const log: TradeLog = {
            id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
            ts: now,
            type: 'close',
            instId,
            message: `超时平仓 ${instId} (持仓${Math.round((now - openTs) / 60000)}分钟) | PnL: ${pnl.toFixed(2)}U`,
            pnl,
          };
          logs.push(log);
          activePositions.delete(instId);
          openTimeMap.delete(instId);
        } catch (e: any) {
          // 忽略
        }
      }
    }

    // 清理已平仓的记录
    const currentInstIds = new Set(positions.filter(p => parseFloat(p.pos) > 0).map(p => p.instId));
    for (const instId of Array.from(activePositions)) {
      if (!currentInstIds.has(instId)) {
        activePositions.delete(instId);
        openTimeMap.delete(instId);
      }
    }
  } catch {
    // 忽略
  }
}

/**
 * 获取当前持仓信息并格式化
 */
export async function getCurrentPositions(config: OkxConfig): Promise<Position[]> {
  const rawPositions = await getPositions(config, 'SWAP');
  const positions: Position[] = [];
  for (const p of rawPositions) {
    if (parseFloat(p.pos) === 0) continue;
    positions.push({
      instId: p.instId,
      posId: p.posId,
      posSide: p.posSide === 'net' ? 'net' : p.posSide,
      pos: p.pos,
      posCcy: p.posCcy,
      avgPx: p.avgPx,
      markPx: p.markPx,
      upl: p.upl,
      uplRatio: p.uplRatio,
      lever: p.lever,
      margin: p.margin,
      liqPx: p.liqPx,
      mgnMode: p.mgnMode,
      ts: Date.now(),
    });
  }
  return positions;
}