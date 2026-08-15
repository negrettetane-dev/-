// ===== 智途云枢 · 小枢出行助手 意图识别 =====
// 当前后端未提供 AI/大模型接口，意图识别在前端用关键词规则完成，
// 只负责「判断用户想问什么 + 抽取关键参数」，不产出任何事实数据。
// 事实数据全部由 assistantService 调用真实 Service/API 获取。

import type { AssistantIntent, IntentParseResult } from '../../types/aiAssistant';

// 规则按优先级排列：更具体的意图在前，宽泛的「路线规划」靠后。
const INTENT_RULES: { intent: AssistantIntent; re: RegExp }[] = [
  { intent: 'account_query', re: /积分|碳积分|我的出行|出行记录|里程|奖励|兑换|余额/ },
  { intent: 'report_help', re: /上报|举报|工单|反馈|进度|处理(结果|了吗|到哪|到哪一步)|修复/ },
  { intent: 'parking_query', re: /停车|车位|停车场|泊车/ },
  { intent: 'charging_query', re: /充电|充电桩|充电站|找桩|新能源车/ },
  { intent: 'route_compare', re: /(开车|驾车|地铁|公交|骑行|步行|哪种|哪个).{0,8}(还是|更快|合适|划算|方便|比较)|还是(开车|驾车|地铁|公交|骑行|步行)/ },
  { intent: 'transit_query', re: /几路|几号线|首末班|末班车|到站|换乘|坐什么车|公交线路|地铁线路/ },
  { intent: 'route_forecast', re: /预测|趋势|以后|未来|错峰|会不会更堵|会堵吗|半小时后|一小时后|稍后/ },
  { intent: 'traffic_query', re: /堵|路况|拥堵|畅通|缓行|实时交通|早高峰|晚高峰|高峰|车多|车少/ },
  { intent: 'route_plan', re: /去|到|前往|怎么走|怎么去|路线|规划|导航|出发/ },
  { intent: 'platform_help', re: /怎么用|能做什么|能干什么|帮助|有哪些功能|什么功能|介绍一下|能干嘛/ },
];

/** 需要从「目的地」里剔除的疑问/动作词 */
const DEST_STOP = /(怎么走|怎么去|怎么坐|的路线|路线|堵不堵|远不远|多少钱|附近|哪里|哪|现在|今天|明天|后天|几点|多久|吗|呢|啊|吧|停车|充电|怎么|多远|路线)/g;

/** 抽取目的地："去X" / "到X" / "前往X" / "从A到B" */
function extractDestination(text: string): string | undefined {
  const cleaned = text.replace(/[？?。.,，!！～~]/g, ' ').trim();
  // "从A到B" 优先取 B
  let m = cleaned.match(/从[一-龥A-Za-z0-9]{1,12}?到\s*([一-龥A-Za-z0-9]{2,20})/);
  if (m?.[1]) return m[1].replace(DEST_STOP, '').trim() || undefined;
  // "去X" / "到X" / "前往X"
  m = cleaned.match(/(?:去|到|前往|至)\s*([一-龥A-Za-z0-9]{2,20})/);
  if (m?.[1]) {
    const dest = m[1].replace(DEST_STOP, '').trim();
    if (dest.length >= 2) return dest;
  }
  // "X怎么走" / "X的路线"
  m = cleaned.match(/([一-龥A-Za-z0-9]{2,20}?)(?:怎么走|怎么去|的路线|路线怎么)/);
  if (m?.[1] && !/(现在|今天|明天|哪里|哪|几点|多久|怎么|什么)/.test(m[1])) return m[1];
  return undefined;
}

/** 抽取起点："从A到B" 中的 A */
function extractOrigin(text: string): string | undefined {
  const m = text.match(/从([一-龥A-Za-z0-9]{2,20}?)(?:到|去|出发|前往)/);
  return m?.[1];
}

/** 抽取出行方式 */
function extractMode(text: string): IntentParseResult['mode'] {
  if (/骑行|单车|自行车|骑车/.test(text)) return 'bike';
  if (/步行|走路|走过去/.test(text)) return 'walk';
  if (/地铁|公交|坐车|公共交通/.test(text)) return 'bus';
  if (/开车|驾车|自驾|新能源|充电/.test(text)) return 'drive';
  return undefined;
}

/** 抽取目标时间（仅用于提示，不改变真实数据） */
function extractTargetTime(text: string): string | undefined {
  const m = text.match(/(明天|后天|今晚|明早|明晚|\d{1,2}点|\d{1,2}:\d{2}|半小时后|一小时后|稍后|晚高峰|早高峰)/);
  return m?.[1];
}

export function recognizeIntent(input: string): IntentParseResult {
  const text = input.trim();
  for (const rule of INTENT_RULES) {
    if (rule.re.test(text)) {
      return {
        intent: rule.intent,
        destination: extractDestination(text),
        origin: extractOrigin(text),
        mode: extractMode(text),
        targetTime: extractTargetTime(text),
      };
    }
  }
  return { intent: 'unknown' };
}
