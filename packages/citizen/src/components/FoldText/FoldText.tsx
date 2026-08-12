import { type CSSProperties, useEffect, useMemo, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './FoldText.css';

gsap.registerPlugin(ScrollTrigger);

type FoldSplit = 'char' | 'word' | 'line';
type FoldHinge = 'top' | 'bottom' | 'left' | 'right';
type FoldTrigger = 'mount' | 'hover' | 'scroll' | 'loop';

interface FoldTextProps {
  text?: string;
  splitBy?: FoldSplit;
  hinge?: FoldHinge;
  duration?: number;
  stagger?: number;
  ease?: string;
  perspective?: number;
  creaseShading?: number;
  trigger?: FoldTrigger;
  fontSize?: string | number;
  fontWeight?: string | number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}

const HINGE_CONFIG: Record<FoldHinge, { origin: string; rotateX: number; rotateY: number }> = {
  top: { origin: '50% 0%', rotateX: -92, rotateY: 0 },
  bottom: { origin: '50% 100%', rotateX: 92, rotateY: 0 },
  left: { origin: '0% 50%', rotateX: 0, rotateY: 92 },
  right: { origin: '100% 50%', rotateX: 0, rotateY: -92 },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const FoldText = ({
  text = 'Design unfolds',
  splitBy = 'char',
  hinge = 'top',
  duration = 0.65,
  stagger = 0.045,
  ease = 'power3.out',
  perspective = 700,
  creaseShading = 0.55,
  trigger = 'mount',
  fontSize = 80,
  fontWeight = 800,
  color = '#f7f2e8',
  className = '',
  style = {},
}: FoldTextProps) => {
  const rootRef = useRef<HTMLSpanElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const hingeConfig = HINGE_CONFIG[hinge];
  const safeCrease = clamp(creaseShading, 0, 1);
  const safePerspective = Math.max(120, perspective);

  const segments = useMemo(() => {
    const renderSegment = (content: string, key: string, split: FoldSplit = splitBy) => (
      <span className="fold-text-segment" data-fold-split={split} key={key} style={{ '--fold-perspective': `${safePerspective}px` } as CSSProperties}>
        <span className="fold-text-piece" data-fold-hinge={hinge} style={{ transformOrigin: hingeConfig.origin, '--fold-crease': 0 } as CSSProperties}>
          {content || '\u00A0'}
        </span>
      </span>
    );

    if (splitBy === 'line') {
      return text.split('\n').map((line, index) => (
        <span className="fold-text-line" key={`line-${index}`}>{renderSegment(line || '\u00A0', `segment-line-${index}`, 'line')}</span>
      ));
    }

    if (splitBy === 'word') {
      return text.split(/(\s+)/).map((part, index) => /^\s+$/.test(part)
        ? <span className="fold-text-whitespace" key={`space-${index}`}>{part.replace(/ /g, '\u00A0')}</span>
        : renderSegment(part, `segment-word-${index}`, 'word'));
    }

    return Array.from(text).map((char, index) => char === '\n'
      ? <br key={`br-${index}`} />
      : renderSegment(char === ' ' ? '\u00A0' : char, `segment-char-${index}`, 'char'));
  }, [text, splitBy, hinge, hingeConfig.origin, safePerspective]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const pieces = Array.from(root.querySelectorAll<HTMLElement>('.fold-text-piece'));
    if (!pieces.length) return undefined;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const fromVars = {
      opacity: 0,
      rotateX: reduceMotion ? 0 : hingeConfig.rotateX,
      rotateY: reduceMotion ? 0 : hingeConfig.rotateY,
      '--fold-crease': reduceMotion ? 0 : safeCrease,
      transformOrigin: hingeConfig.origin,
      force3D: true,
    };
    const toVars = {
      opacity: 1,
      rotateX: 0,
      rotateY: 0,
      '--fold-crease': 0,
      duration: reduceMotion ? Math.min(duration, 0.22) : duration,
      ease: reduceMotion ? 'power1.out' : ease,
      stagger: reduceMotion ? Math.min(stagger, 0.02) : stagger,
      clearProps: 'willChange',
    };
    const killTimeline = () => {
      timelineRef.current?.kill();
      timelineRef.current = null;
      gsap.killTweensOf(pieces);
    };
    const play = (repeat: boolean) => {
      killTimeline();
      timelineRef.current = gsap.timeline({ repeat: repeat ? -1 : 0, repeatDelay: repeat ? 0.75 : 0 });
      timelineRef.current.fromTo(pieces, fromVars, toVars);
    };

    let scrollTrigger: ScrollTrigger | undefined;
    let hoverHandler: (() => void) | undefined;
    if (trigger === 'hover') {
      gsap.set(pieces, { opacity: 1, rotateX: 0, rotateY: 0, '--fold-crease': 0, transformOrigin: hingeConfig.origin });
      hoverHandler = () => play(false);
      root.addEventListener('mouseenter', hoverHandler);
    } else if (trigger === 'scroll') {
      gsap.set(pieces, fromVars);
      scrollTrigger = ScrollTrigger.create({ trigger: root, start: 'top 82%', once: true, onEnter: () => play(false) });
    } else {
      play(trigger === 'loop');
    }

    return () => {
      if (hoverHandler) root.removeEventListener('mouseenter', hoverHandler);
      scrollTrigger?.kill();
      killTimeline();
    };
  }, [text, splitBy, hinge, duration, stagger, ease, perspective, safeCrease, trigger, hingeConfig]);

  const rootStyle = {
    '--fold-text-font-size': typeof fontSize === 'number' ? `${fontSize}px` : fontSize,
    '--fold-text-font-weight': fontWeight,
    '--fold-text-color': color,
    ...style,
  } as CSSProperties;

  return (
    <span ref={rootRef} className={`fold-text ${className}`.trim()} style={rootStyle}>
      <span className="fold-text-sr-only">{text}</span>
      <span className="fold-text-visual" aria-hidden="true">{segments}</span>
    </span>
  );
};

export default FoldText;
