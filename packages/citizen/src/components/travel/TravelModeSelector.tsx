import React, { useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform, type MotionValue } from 'motion/react';
import styles from './TravelModeSelector.module.css';
import type { LegacyRouteMode } from '../../types/travelMode';

export type TravelModeOption = 'ev' | 'driving' | 'transit' | 'riding' | 'walking' | 'accessible';
export type RouteTravelMode = LegacyRouteMode;

export const TRAVEL_MODE_OPTIONS: Array<{
  key: TravelModeOption;
  label: string;
  icon: string;
}> = [
  { key: 'ev', label: '新能源', icon: '⚡' },
  { key: 'driving', label: '驾车', icon: '🚗' },
  { key: 'transit', label: '公交地铁', icon: '🚌' },
  { key: 'riding', label: '骑行', icon: '🚲' },
  { key: 'walking', label: '步行', icon: '🚶' },
  { key: 'accessible', label: '无障碍出行', icon: '♿' },
];

export function normalizeTravelMode(mode: TravelModeOption): RouteTravelMode {
  if (mode === 'transit' || mode === 'accessible') return 'bus';
  if (mode === 'riding') return 'bike';
  if (mode === 'walking') return 'walk';
  return 'drive';
}

interface TravelModeSelectorProps {
  value: TravelModeOption;
  onChange: (mode: TravelModeOption) => void;
  className?: string;
}

interface TravelModeItemProps {
  mode: TravelModeOption;
  label: string;
  icon: string;
  active: boolean;
  mouseX: MotionValue<number>;
  onSelect: (mode: TravelModeOption) => void;
}

const TravelModeItem: React.FC<TravelModeItemProps> = ({ mode, label, icon, active, mouseX, onSelect }) => {
  const itemRef = useRef<HTMLButtonElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const mouseDistance = useTransform(mouseX, currentX => {
    const bounds = itemRef.current?.getBoundingClientRect();
    return bounds ? currentX - bounds.left - bounds.width / 2 : Number.POSITIVE_INFINITY;
  });
  const targetSize = useTransform(mouseDistance, [-160, 0, 160], [56, 70, 56]);
  const size = useSpring(targetSize, { mass: 0.1, stiffness: 150, damping: 12 });

  return (
    <motion.button
      ref={itemRef}
      type="button"
      className={`${styles.option} ${active ? styles.active : ''}`}
      style={{ width: size, height: size }}
      onClick={() => onSelect(mode)}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      aria-pressed={active}
      aria-label={label}
      whileTap={{ scale: 0.96 }}
    >
      <AnimatePresence>
        {isHovered && (
          <motion.span
            className={styles.tooltip}
            role="tooltip"
            initial={{ opacity: 0, y: 0, x: '-50%' }}
            animate={{ opacity: 1, y: -10, x: '-50%' }}
            exit={{ opacity: 0, y: 0, x: '-50%' }}
            transition={{ duration: 0.2 }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
      <span className={styles.icon} aria-hidden="true">{icon}</span>
    </motion.button>
  );
};

const TravelModeSelector: React.FC<TravelModeSelectorProps> = ({ value, onChange, className = '' }) => (
  <TravelModeDock value={value} onChange={onChange} className={className} />
);

const TravelModeDock: React.FC<TravelModeSelectorProps> = ({ value, onChange, className = '' }) => {
  const mouseX = useMotionValue(Number.POSITIVE_INFINITY);

  return (
    <motion.div
      className={`${styles.selector} ${className}`}
      role="group"
      aria-label="选择出行方式"
      onMouseMove={event => mouseX.set(event.pageX)}
      onMouseLeave={() => mouseX.set(Number.POSITIVE_INFINITY)}
      style={{ viewTransitionName: 'travel-mode-selector' }}
    >
      {TRAVEL_MODE_OPTIONS.map(({ key, label, icon }) => (
        <TravelModeItem
          key={key}
          mode={key}
          label={label}
          icon={icon}
          active={value === key}
          mouseX={mouseX}
          onSelect={onChange}
        />
      ))}
    </motion.div>
  );
};

export default TravelModeSelector;
