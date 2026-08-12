import React, { useCallback, useEffect, useRef } from 'react';
import './ClickSpark.css';

export interface ClickSparkProps {
  sparkColor?: string;
  sparkColors?: string[];
  sparkSize?: number;
  sparkRadius?: number;
  sparkCount?: number;
  duration?: number;
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  extraScale?: number;
  children: React.ReactNode;
  className?: string;
}

interface Spark {
  x: number;
  y: number;
  angle: number;
  color: string;
  startedAt: number;
}

const easeValue = (value: number, easing: ClickSparkProps['easing']) => {
  if (easing === 'linear') return value;
  if (easing === 'ease-in') return value * value;
  if (easing === 'ease-in-out') return value < 0.5 ? 2 * value * value : 1 - ((-2 * value + 2) ** 2) / 2;
  return 1 - (1 - value) ** 3;
};

const ClickSpark: React.FC<ClickSparkProps> = ({
  sparkColor = '#4dabf7', sparkColors, sparkSize = 10, sparkRadius = 24,
  sparkCount = 10, duration = 500, easing = 'ease-out', extraScale = 1.1,
  children, className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparksRef = useRef<Spark[]>([]);
  const frameRef = useRef<number>();
  const colors = sparkColors?.length ? sparkColors : [sparkColor];

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    const context = canvas.getContext('2d');
    context?.setTransform(ratio, 0, 0, ratio, 0, 0);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => { observer.disconnect(); if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [resize]);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const now = performance.now();
    sparksRef.current.push(...Array.from({ length: sparkCount }, (_, index) => ({
      x: event.clientX - rect.left, y: event.clientY - rect.top,
      angle: (Math.PI * 2 * index) / sparkCount, color: colors[index % colors.length], startedAt: now,
    })));
    if (frameRef.current) return;
    const draw = (time: number) => {
      const context = canvas.getContext('2d');
      if (!context) return;
      const width = rect.width; const height = rect.height;
      context.clearRect(0, 0, width, height);
      sparksRef.current = sparksRef.current.filter(spark => {
        const progress = Math.min(1, (time - spark.startedAt) / duration);
        const eased = easeValue(progress, easing);
        const distance = eased * sparkRadius * extraScale;
        const length = sparkSize * (1 - eased);
        const startX = spark.x + Math.cos(spark.angle) * distance;
        const startY = spark.y + Math.sin(spark.angle) * distance;
        context.beginPath(); context.moveTo(startX, startY);
        context.lineTo(startX + Math.cos(spark.angle) * length, startY + Math.sin(spark.angle) * length);
        context.strokeStyle = spark.color; context.lineWidth = 2; context.lineCap = 'round'; context.stroke();
        return progress < 1;
      });
      frameRef.current = sparksRef.current.length ? requestAnimationFrame(draw) : undefined;
    };
    frameRef.current = requestAnimationFrame(draw);
  };

  return <div className={`click-spark ${className}`.trim()} onClick={handleClick}>
    <canvas ref={canvasRef} className="click-spark__canvas" aria-hidden="true" />
    {children}
  </div>;
};

export default ClickSpark;
