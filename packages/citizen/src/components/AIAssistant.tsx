import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { respond, thinkingLabel } from '../services/aiAssistant/assistantService';
import { useAuthStore } from '../stores/authStore';
import { useTravelLocationStore } from '../stores/travelLocationStore';
import type {
  AssistantCard,
  AssistantCardAction,
  AssistantDataSource,
  AssistantMessage,
} from '../types/aiAssistant';
import styles from './AIAssistant.module.css';

const SOURCE_META: Record<AssistantDataSource, { label: string; color: string; bg: string }> = {
  real: { label: '实时数据', color: '#389e0d', bg: '#f6ffed' },
  demo: { label: '演示数据', color: '#d46b08', bg: '#fff7e6' },
  simulated: { label: '模拟预测', color: '#c41d7f', bg: '#fff0f6' },
  fallback: { label: '备用数据', color: '#08979c', bg: '#e6fffb' },
  unknown: { label: '来源待确认', color: '#8c8c8c', bg: '#fafafa' },
};

function greeting(): AssistantMessage {
  return {
    id: 'greeting',
    role: 'ai',
    text: '👋 你好，我是小枢。你可以直接说出出行需求，比如「去北京南站怎么走」「附近哪里有停车场」「我的积分还有多少」。',
    createdAt: Date.now(),
  };
}

const AIAssistant: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn } = useAuthStore();
  const { origin } = useTravelLocationStore();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([greeting()]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || thinking) return;
    setMessages(prev => [...prev, { id: `u_${Date.now()}`, role: 'user', text: t, createdAt: Date.now() }]);
    setInput('');
    setThinking(thinkingLabel(t));
    try {
      const ctx = {
        isLoggedIn,
        originName: origin.lng != null ? origin.address || origin.name : undefined,
        currentPage: location.pathname,
      };
      const reply = await respond(t, ctx);
      setMessages(prev => [...prev, reply]);
    } catch {
      setMessages(prev => [...prev, {
        id: `e_${Date.now()}`,
        role: 'ai',
        text: '抱歉，处理你的请求时出了点问题，请稍后重试。',
        createdAt: Date.now(),
      }]);
    } finally {
      setThinking('');
    }
  };

  const runAction = (action: AssistantCardAction) => {
    if (action.path) navigate(action.path, { state: action.state });
  };

  const quickQuestions = isLoggedIn
    ? ['我的积分还有多少？', '去北京南站怎么走？', '附近哪里有停车场？', '我的上报处理了吗？']
    : ['去北京南站怎么走？', '附近哪里有停车场？', '现在路况怎么样？', '有哪些公交线路？'];

  return (
    <>
      {/* 悬浮按钮 */}
      <button
        className={`${styles.fab} ${open ? styles.fabOpen : ''}`}
        onClick={() => setOpen(!open)}
        title="小枢出行助手"
        aria-label="小枢出行助手"
      >
        {open ? '✕' : '🤖'}
      </button>

      {/* 聊天面板 */}
      {open && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <span>🤖 小枢出行助手</span>
            <span className={styles.subtitle}>可信数据 · 结果可执行</span>
          </div>

          <div className={styles.body}>
            {messages.map((m) => (
              <div key={m.id} className={`${styles.msg} ${m.role === 'user' ? styles.userMsg : styles.aiMsg}`}>
                <div className={styles.msgContent}>
                  {m.role === 'user' ? (
                    <div className={styles.bubble}>{m.text}</div>
                  ) : (
                    <>
                      <div className={styles.bubble}>{m.text}</div>
                      {m.cards?.map(card => <AssistantCardView key={card.id} card={card} onAction={runAction} />)}
                    </>
                  )}
                </div>
              </div>
            ))}
            {thinking && (
              <div className={`${styles.msg} ${styles.aiMsg}`}>
                <div className={styles.msgContent}>
                  <div className={styles.bubble}>
                    <span className={styles.thinkingText}>{thinking}</span>
                    <span className={styles.typing}>●</span>
                    <span className={styles.typing} style={{ animationDelay: '0.2s' }}>●</span>
                    <span className={styles.typing} style={{ animationDelay: '0.4s' }}>●</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 动态快捷问题 */}
          {messages.length <= 1 && !thinking && (
            <div className={styles.quickQuestions}>
              {quickQuestions.map(q => (
                <div key={q} className={styles.quickQ} onClick={() => send(q)}>
                  {q}
                </div>
              ))}
            </div>
          )}

          <div className={styles.inputRow}>
            <input
              className={styles.input}
              placeholder="说出你的出行需求，如「去高铁站哪条路靠谱」"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            />
            <button
              className={styles.sendBtn}
              onClick={() => send(input)}
              disabled={!input.trim() || !!thinking}
            >
              发送
            </button>
          </div>
        </div>
      )}
    </>
  );
};

const AssistantCardView: React.FC<{ card: AssistantCard; onAction: (a: AssistantCardAction) => void }> = ({ card, onAction }) => {
  const meta = SOURCE_META[card.source] || SOURCE_META.unknown;
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>{card.title}</span>
        <span className={styles.sourceTag} style={{ color: meta.color, background: meta.bg }}>
          {card.sourceLabel || meta.label}
        </span>
      </div>
      {card.subtitle && <div className={styles.cardSub}>{card.subtitle}</div>}
      {card.rows && card.rows.length > 0 && (
        <div className={styles.cardRows}>
          {card.rows.map((r, i) => (
            <div key={i} className={styles.cardRow}>
              <span className={styles.cardRowLabel}>{r.label}</span>
              <span className={styles.cardRowValue} style={r.valueColor ? { color: r.valueColor } : undefined}>{r.value}</span>
            </div>
          ))}
        </div>
      )}
      {card.actions && card.actions.length > 0 && (
        <div className={styles.cardActions}>
          {card.actions.map((a, i) => (
            <button
              key={i}
              className={a.primary ? styles.cardActionPrimary : styles.cardAction}
              onClick={() => onAction(a)}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AIAssistant;
