// ===== 智途云枢 · 小枢出行助手 类型定义 =====
// 小枢是首页的自然语言出行操作入口：识别意图 → 调用真实业务能力 → 返回可信结果。
// 所有结果必须显式标注数据来源（real / demo / simulated / fallback / unknown）。

export type AssistantIntent =
  | 'route_plan'      // 路线规划
  | 'traffic_query'   // 实时路况
  | 'route_compare'   // 多方式比较
  | 'transit_query'   // 公交地铁查询
  | 'parking_query'   // 停车场查询
  | 'charging_query'  // 充电站查询
  | 'account_query'   // 积分 / 账户 / 出行记录（需登录）
  | 'report_help'     // 上报 / 上报进度（个人进度需登录）
  | 'route_forecast'  // 未来拥堵趋势（必须标注预测性质）
  | 'platform_help'   // 平台功能帮助
  | 'unknown';

export type AssistantDataSource = 'real' | 'demo' | 'simulated' | 'fallback' | 'unknown';

export interface AssistantCardAction {
  label: string;
  path?: string;                        // 跳转路由
  state?: Record<string, unknown>;      // 路由 state
  primary?: boolean;                    // 主按钮样式
}

export interface AssistantCardRow {
  label: string;
  value: string;
  valueColor?: string;
}

export interface AssistantCard {
  id: string;
  kind: 'route' | 'transit' | 'parking' | 'charging' | 'account' | 'forecast' | 'info' | 'error';
  title: string;
  subtitle?: string;
  rows?: AssistantCardRow[];
  source: AssistantDataSource;
  sourceLabel?: string;
  actions?: AssistantCardAction[];
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  cards?: AssistantCard[];
  createdAt: number;
}

/** 页面上下文：AI 只读取当前页面/登录态/起点，不暴露 Token 等敏感信息 */
export interface AssistantContext {
  isLoggedIn: boolean;
  originName?: string;
  currentPage?: string;
}

export interface IntentParseResult {
  intent: AssistantIntent;
  destination?: string;
  origin?: string;
  mode?: 'drive' | 'bus' | 'bike' | 'walk';
  targetTime?: string;
}
