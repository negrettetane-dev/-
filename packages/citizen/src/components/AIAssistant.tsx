import React, { useState, useRef, useEffect } from 'react';
import styles from './AIAssistant.module.css';

interface Message { role: 'user' | 'ai'; text: string; }

const QUICK_QUESTIONS = [
  '现在去天安门堵不堵？',
  '早高峰走二环还是三环？',
  '明天8点去北京南站怎么走？',
  '附近哪里有便宜停车场？',
  '这段路为什么收费？',
];

const MOCK_ANSWERS: Record<string, { text: string; delay: number }> = {
  '现在去天安门堵不堵？': {
    text: '当前长安街东段（东单→天安门方向）轻微拥堵，预计通行时间约25分钟。建议绕行前门大街，虽然多1.2公里但可节省约8分钟。',
    delay: 1200,
  },
  '早高峰走二环还是三环？': {
    text: '根据近30天数据，工作日早高峰（7:30-8:30），二环内环平均车速仅18km/h，三环外环约28km/h。强烈建议走三环——多绕2公里但快15分钟以上。',
    delay: 1500,
  },
  '明天8点去北京南站怎么走？': {
    text: '明天周三早高峰8:00-8:30二环高架拥堵概率78%。建议7:30前出发（全程畅通约18分钟），或走三环辅路（约22分钟）。明早有小雨概率，请预留5分钟冗余。🚄',
    delay: 1800,
  },
  '附近哪里有便宜停车场？': {
    text: '您当前位置1km内有3个停车场：①西单大悦城地下（¥8/h，空闲82位）；②宣武门路侧（¥5/h，空闲12位）；③金融街地库（¥15/h，空闲156位）。推荐②，性价比最高。',
    delay: 1000,
  },
  '这段路为什么收费？': {
    text: '您查询的路段属于京通快速路（五环至四环段），为北京市经营性收费公路，小车¥5/次。ETC享95折。该路段收费标准经市发改委批准（京发改[2020]128号）。',
    delay: 900,
  },
};

const AIAssistant: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: '👋 你好！我是智途出行助手小枢。我可以帮你规划路线、推荐最佳出发时间、分析路况，试试问我吧～' },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  const sendMessage = (text: string) => {
    if (!text.trim() || thinking) return;
    setMessages(prev => [...prev, { role: 'user', text }]);
    setInput('');
    setThinking(true);

    // Find matching answer or generate generic response
    const match = MOCK_ANSWERS[text];
    const delay = match?.delay || 1000 + Math.random() * 1500;
    const answer = match?.text || generateGenericAnswer(text);

    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'ai', text: answer }]);
      setThinking(false);
    }, delay);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        className={`${styles.fab} ${open ? styles.fabOpen : ''}`}
        onClick={() => setOpen(!open)}
        title="AI出行助手"
      >
        {open ? '✕' : '🤖'}
      </button>

      {/* Chat panel */}
      {open && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <span>🤖 AI出行助手 · 小枢</span>
            <span className={styles.subtitle}>可解释AI · 数据驱动决策</span>
          </div>

          <div className={styles.body}>
            {messages.map((m, i) => (
              <div key={i} className={`${styles.msg} ${m.role === 'user' ? styles.userMsg : styles.aiMsg}`}>
                <div className={styles.bubble}>{m.text}</div>
              </div>
            ))}
            {thinking && (
              <div className={`${styles.msg} ${styles.aiMsg}`}>
                <div className={styles.bubble}>
                  <span className={styles.typing}>●</span>
                  <span className={styles.typing} style={{ animationDelay: '0.2s' }}>●</span>
                  <span className={styles.typing} style={{ animationDelay: '0.4s' }}>●</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick questions */}
          {messages.length <= 1 && (
            <div className={styles.quickQuestions}>
              {QUICK_QUESTIONS.map(q => (
                <div key={q} className={styles.quickQ} onClick={() => sendMessage(q)}>
                  {q}
                </div>
              ))}
            </div>
          )}

          <div className={styles.inputRow}>
            <input
              className={styles.input}
              placeholder="输入出行问题，如「去高铁站哪条路靠谱」"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              className={styles.sendBtn}
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || thinking}
            >
              发送
            </button>
          </div>
        </div>
      )}
    </>
  );
};

/** Generate a generic AI answer when no canned response matches */
function generateGenericAnswer(question: string): string {
  const responses = [
    `根据实时数据分析，「${question.slice(0, 12)}...」这个问题建议您选择绿色出行方式。当前公交1路和52路均有空位，到站时间约3-5分钟。`,
    `我分析了最近7天的交通数据，针对您的问题，建议避开早高峰7:30-8:30出行，该时段拥堵指数高达7.8（严重拥堵）。建议推迟至9:00后出发。`,
    `综合路况、天气和历史数据，目前您查询的路线整体通畅。但从安全性考虑，今天有小雨预警，请减速慢行，保持安全车距。`,
    `根据高德交通大数据，您关心的路段今天下午16:00-18:00将进入晚高峰。建议提前规划或改用公共交通。需要我帮您查公交路线吗？`,
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

export default AIAssistant;
