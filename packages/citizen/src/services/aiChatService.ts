// ===== 智途云枢 · AI 大模型对话服务 =====
// 调后端 /api/ai/chat 代理接口，后端转发到阿里云百炼（DashScope，OpenAI 兼容）。
// API Key 只存在于后端，前端不接触，避免泄露。

import { apiPost } from './apiClient';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/** 调用大模型，返回回复文本。失败时向上抛错，由调用方回退到规则兜底。 */
export async function aiChat(messages: ChatMessage[]): Promise<string> {
  const data = await apiPost<{ content: string }>('/ai/chat', { messages });
  if (!data?.content) throw new Error('AI 返回为空');
  return data.content;
}
