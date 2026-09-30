import express from 'express';
import cors from 'cors';
import type { OkxConfig, TradeConfig } from './types.js';
import { TradingEngine } from './engine.js';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// 全局交易引擎实例
const engine = new TradingEngine();

// ============= 认证/配置接口 =============

/** 登录 - 验证API Key */
app.post('/api/login', async (req, res) => {
  try {
    const { apiKey, secretKey, passphrase, simulated } = req.body as Partial<OkxConfig>;

    if (!apiKey || !secretKey || !passphrase) {
      return res.json({ success: false, message: '请填写完整的API信息' });
    }

    const config: OkxConfig = {
      apiKey,
      secretKey,
      passphrase,
      simulated: !!simulated,
    };

    const result = await engine.testConnection(config);
    if (result.success) {
      engine.setConfig(config);
    }
    res.json(result);
  } catch (e: any) {
    res.json({ success: false, message: e.message });
  }
});

/** 获取交易配置 */
app.get('/api/config', (req, res) => {
  res.json({ success: true, config: engine.getTradeConfig() });
});

/** 更新交易配置 */
app.post('/api/config', (req, res) => {
  engine.updateTradeConfig(req.body as Partial<TradeConfig>);
  res.json({ success: true, config: engine.getTradeConfig() });
});

// ============= 引擎控制 =============

/** 启动引擎 */
app.post('/api/engine/start', async (req, res) => {
  const result = await engine.start();
  res.json(result);
});

/** 停止引擎 */
app.post('/api/engine/stop', (req, res) => {
  engine.stop();
  res.json({ success: true, message: '引擎已停止' });
});

/** 获取引擎状态 */
app.get('/api/engine/status', (req, res) => {
  res.json({
    success: true,
    running: engine.isRunning(),
    autoTrade: engine.isAutoTrade(),
    connected: engine.isConnected(),
  });
});

/** 切换自动交易 */
app.post('/api/engine/auto-trade', (req, res) => {
  const { enabled } = req.body as { enabled: boolean };
  engine.updateTradeConfig({ autoTrade: enabled });
  res.json({ success: true, autoTrade: enabled });
});

// ============= 数据接口 =============

/** 获取异动信号列表 */
app.get('/api/signals', (req, res) => {
  res.json({ success: true, signals: engine.getSignals() });
});

/** 获取交易日志 */
app.get('/api/logs', (req, res) => {
  res.json({ success: true, logs: engine.getLogs() });
});

/** 获取持仓信息 */
app.get('/api/positions', (req, res) => {
  res.json({ success: true, positions: engine.getPositions() });
});

/** 手动扫描 */
app.post('/api/scan', async (req, res) => {
  const result = await engine.manualScan();
  res.json(result);
});

/** 手动开仓 */
app.post('/api/trade/open', async (req, res) => {
  const signal = req.body;
  const result = await engine.manualOpen(signal);
  res.json(result);
});

/** 手动平仓 */
app.post('/api/trade/close', async (req, res) => {
  const { instId } = req.body as { instId: string };
  const result = await engine.manualClose(instId);
  res.json(result);
});

// ============= 轮询聚合接口 =============

/** 获取所有状态 (前端轮询) */
app.get('/api/dashboard', (req, res) => {
  res.json({
    success: true,
    status: {
      running: engine.isRunning(),
      autoTrade: engine.isAutoTrade(),
      connected: engine.isConnected(),
    },
    config: engine.getTradeConfig(),
    signals: engine.getSignals(),
    logs: engine.getLogs(),
    positions: engine.getPositions(),
  });
});

app.listen(PORT, () => {
  console.log(`[OKX Trader] Server running on http://localhost:${PORT}`);
});