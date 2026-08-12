import React, { useMemo } from 'react';

// ===== 演示二维码纯展示组件 =====
// 只负责根据 content 生成 SVG 图案，不涉及 Timer / 刷新 / 业务模式。

function makePattern(seed: string): number[][] {
  const hash = (s: string) => {
    let x = 0;
    for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) % 100000;
    return x;
  };
  const base = hash(seed);
  return Array.from({ length: 21 }, (_, y) =>
    Array.from({ length: 21 }, (_, x) => {
      if (x < 7 && y < 7) return 1;
      if (x > 13 && y < 7) return 1;
      if (x < 7 && y > 13) return 1;
      const h = (Math.sin(x * 7 + y * 13 + base) * 10000) % 1;
      return h > 0.35 ? 1 : 0;
    }),
  );
}

interface DemoQrCodeProps {
  content: string;
  className?: string;
}

const DemoQrCode: React.FC<DemoQrCodeProps> = ({ content, className }) => {
  const pattern = useMemo(() => makePattern(content), [content]);
  return (
    <svg viewBox="0 0 21 21" className={className}>
      {pattern.map((row, y) =>
        row.map((cell, x) =>
          cell ? <rect key={`${y}-${x}`} x={x} y={y} width="1" height="1" fill="#000" /> : null,
        ),
      )}
    </svg>
  );
};

export default DemoQrCode;
