import type { OkxConfig, Signal, TradeConfig, TradeLog, Position } from './types.js';
import { getSwapInstruments } from './okx-api.js';
import { scanAnomalies } from './scanner.js';
import { openPosition, checkAndCloseTimeout, getCurrentPositions } from './trader.js';

/**
 * 交易引擎 - 主调度器
 */
export class TradingEngine {
  private config: OkxConfig | null = null;
  private tradeConfig: TradeConfig;
  private signals: Signal[] = [];
  private logs: TradeLog[] = [];
  private positions: Position[] = [];
  private activePositions = new Set<string>();
  private openTimeMap = new Map<string, number>();
  private scanTimer: NodeJS.Timeout | null = null;
  private positionTimer: NodeJS.Timeout | null = null;
  private running = false;
  private lastScanTime = 0;
  private connected = false;
  // 不可交易币种黑名单（因合规限制51155等），value=过期时间戳
  private blockedInstruments = new Map<string, number>();

  constructor() {
    this.tradeConfig = {
      marginPerOrder: 10,
      takeProfitUSDT: 10,
      leverage: 10,
      maxPositions: 5,
      scanInterval: 3 * 60 * 1000, // 3分钟
      volumeSpikeThreshold: 3,      // 成交量放大3倍
      changePctThreshold: 5,        // 涨跌幅5%
      mgnMode: 'isolated',
      excludeStables: true,
      autoTrade: false,            // 默认不自动交易
    };
  }

  setConfig(config: OkxConfig) {
    this.config = config;
  }

  getTradeConfig(): TradeConfig {
    return this.tradeConfig;
  }

  updateTradeConfig(partial: Partial<TradeConfig>) {
    this.tradeConfig = { ...this.tradeConfig, ...partial };
  }

  getSignals(): Signal[] {
    return this.signals.slice(0, 50);
  }

  getLogs(): TradeLog[] {
    return this.logs.slice(-200).reverse();
  }

  getPositions(): Position[] {
    return this.positions;
  }

  isRunning(): boolean {
    return this.running;
  }

  isAutoTrade(): boolean {
    return this.tradeConfig.autoTrade;
  }

  isConnected(): boolean {
    return this.connected;
  }

  /** 验证API Key是否有效 */
  async testConnection(config: OkxConfig): Promise<{ success: boolean; message: string }> {
    try {
      const instruments = await getSwapInstruments(config);
      if (instruments && instruments.length > 0) {
        this.connected = true;
        return { success: true, message: `连接成功，获取到 ${instruments.length} 个合约` };
      }
      return { success: false, message: '未获取到合约数据' };
    } catch (e: any) {
      this.connected = false;
      return { success: false, message: e.message };
    }
  }

  /** 启动引擎 */
  async start(): Promise<{ success: boolean; message: string }> {
    if (!this.config) {
      return { success: false, message: '未配置API' };
    }
    if (this.running) {
      return { success: false, message: '引擎已运行' };
    }

    this.running = true;
    this.addLog('info', '交易引擎启动');

    // 立即执行一次扫描
    await this.doScan();

    // 设置定时扫描
    this.scanTimer = setInterval(() => {
      this.doScan().catch(() => {});
    }, this.tradeConfig.scanInterval);

    // 设置定时检查持仓(每30秒)
    this.positionTimer = setInterval(() => {
      this.doPositionCheck().catch(() => {});
    }, 30 * 1000);

    return { success: true, message: '引擎启动成功' };
  }

  /** 停止引擎 */
  stop() {
    this.running = false;
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    if (this.positionTimer) {
      clearInterval(this.positionTimer);
      this.positionTimer = null;
    }
    this.addLog('info', '交易引擎停止');
  }

  /** 执行扫描 */
  private async doScan() {
    if (!this.config || !this.running) return;

    try {
      const blockedSet = new Set<string>(Array.from(this.blockedInstruments.keys()));
      const newSignals = await scanAnomalies(this.config, this.tradeConfig, blockedSet);
      this.signals = newSignals;
      this.lastScanTime = Date.now();
      this.addLog('signal', `扫描完成，发现 ${newSignals.length} 个异动信号`);

      // 自动交易
      if (this.tradeConfig.autoTrade && newSignals.length > 0) {
        for (const signal of newSignals.slice(0, 8)) { // 每次最多尝试前8个信号（部分可能因合规限制被跳过）
          if (this.activePositions.size >= this.tradeConfig.maxPositions) break;
          if (this.activePositions.has(signal.instId)) continue;

          // 跳过被黑名单的币种（合规限制）
          if (this.isBlocked(signal.instId)) {
            this.addLog('info', `${signal.baseCcy} 因合规限制被跳过`);
            continue;
          }

          const result = await openPosition(
            this.config,
            this.tradeConfig,
            signal,
            this.logs,
            this.activePositions
          );

          if (result.success) {
            this.openTimeMap.set(signal.instId, Date.now());
          } else if (result.message.includes('51155') || result.message.includes('compliance restrictions')) {
            // 合规限制，加入黑名单，1小时后过期重试
            this.blockedInstruments.set(signal.instId, Date.now() + 3600 * 1000);
            this.addLog('error', `${signal.baseCcy} 因合规限制不可交易，已加入黑名单，1小时后重试`);
            // 继续尝试下一个信号
            continue;
          }
        }
      }
    } catch (e: any) {
      this.addLog('error', `扫描失败: ${e.message}`);
    }

    // 同时更新持仓
    await this.doPositionCheck();
  }

  /** 检查持仓状态 */
  private async doPositionCheck() {
    if (!this.config) return;

    try {
      // 超时平仓检查
      await checkAndCloseTimeout(
        this.config,
        this.tradeConfig,
        this.logs,
        this.openTimeMap,
        this.activePositions
      );

      // 更新持仓信息
      this.positions = await getCurrentPositions(this.config);
    } catch {
      // 忽略
    }
  }

  /** 检查币种是否被黑名单（合规限制） */
  private isBlocked(instId: string): boolean {
    const expiry = this.blockedInstruments.get(instId);
    if (!expiry) return false;
    if (Date.now() > expiry) {
      this.blockedInstruments.delete(instId);
      return false;
    }
    return true;
  }

  /** 手动根据信号开仓 */
  async manualOpen(signal: Signal): Promise<{ success: boolean; message: string }> {
    if (!this.config) {
      return { success: false, message: '未配置API' };
    }
    if (this.isBlocked(signal.instId)) {
      return { success: false, message: `${signal.baseCcy} 因合规限制不可交易` };
    }
    const result = await openPosition(
      this.config,
      this.tradeConfig,
      signal,
      this.logs,
      this.activePositions
    );
    if (result.success) {
      this.openTimeMap.set(signal.instId, Date.now());
    } else if (result.message.includes('51155') || result.message.includes('compliance restrictions')) {
      this.blockedInstruments.set(signal.instId, Date.now() + 3600 * 1000);
      this.addLog('error', `${signal.baseCcy} 因合规限制不可交易，已加入黑名单`);
    }
    return result;
  }

  /** 手动平仓 */
  async manualClose(instId: string): Promise<{ success: boolean; message: string }> {
    if (!this.config) {
      return { success: false, message: '未配置API' };
    }
    try {
      const pos = this.positions.find(p => p.instId === instId);
      if (!pos) return { success: false, message: '持仓不存在' };

      const { closePosition } = await import('./okx-api.js');
      await closePosition(this.config, instId, pos.mgnMode, pos.posSide);

      const pnl = parseFloat(pos.upl);
      this.addLog('close', `手动平仓 ${instId} | PnL: ${pnl.toFixed(2)}U`, { instId, pnl });

      this.activePositions.delete(instId);
      this.openTimeMap.delete(instId);
      return { success: true, message: '平仓成功' };
    } catch (e: any) {
      this.addLog('error', `平仓失败 ${instId}: ${e.message}`);
      return { success: false, message: e.message };
    }
  }

  /** 手动触发扫描 */
  async manualScan(): Promise<{ success: boolean; message: string; count: number }> {
    if (!this.config) {
      return { success: false, message: '未配置API', count: 0 };
    }
    await this.doScan();
    return { success: true, message: '扫描完成', count: this.signals.length };
  }

  private addLog(type: TradeLog['type'], message: string, extra?: Partial<TradeLog>) {
    const entry: TradeLog = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      type,
      message,
      ...extra,
    };
    this.logs.push(entry);
    if (this.logs.length > 500) this.logs.shift();
  }
}