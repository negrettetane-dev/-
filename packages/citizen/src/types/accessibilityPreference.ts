export type AccessibilityPreference = 'elderly' | 'wheelchair' | 'visual';

export const ACCESSIBILITY_PREFERENCES: ReadonlyArray<{
  value: AccessibilityPreference;
  label: string;
  icon: string;
  description: string;
}> = [
  { value: 'elderly', label: '省力出行', icon: '🧓', description: '优先步行距离短、少换乘的路线' },
  { value: 'wheelchair', label: '轮椅用户', icon: '♿', description: '优先电梯、坡道，避开已知楼梯风险' },
  { value: 'visual', label: '视障用户', icon: '🦯', description: '优先少换乘，并强化分段和语音提示' },
];

const VALID_PREFERENCES = new Set<AccessibilityPreference>(ACCESSIBILITY_PREFERENCES.map(item => item.value));

export function normalizeAccessibilityPreferences(value: unknown): AccessibilityPreference[] {
  if (!Array.isArray(value)) return [];
  const normalized = value.flatMap(item => {
    return VALID_PREFERENCES.has(item as AccessibilityPreference) ? [item as AccessibilityPreference] : [];
  });
  const unique = Array.from(new Set(normalized));
  return unique.length ? [unique[0]] : [];
}
