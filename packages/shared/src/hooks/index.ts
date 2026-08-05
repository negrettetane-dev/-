import { useCallback, useEffect, useRef, useState } from 'react';

/** 防抖 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** 防抖函数 */
export function useDebounceFn<T extends (...args: unknown[]) => unknown>(fn: T, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  return useCallback((...args: Parameters<T>) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

/** 节流函数 */
export function useThrottle<T extends (...args: unknown[]) => unknown>(fn: T, delay: number) {
  const last = useRef(0);
  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - last.current < delay) return;
    last.current = now;
    fn(...args);
  }, [fn, delay]);
}

/** localStorage 封装 */
export function useLocalStorage<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch { return initial; }
  });
  const set = useCallback((v: T) => {
    setValue(v);
    localStorage.setItem(key, JSON.stringify(v));
  }, [key]);
  return [value, set];
}

/** 媒体查询 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

/** 轮询 Hook */
export function usePolling(fn: () => void, interval: number, enabled = true) {
  const savedFn = useRef(fn);
  savedFn.current = fn;

  useEffect(() => {
    if (!enabled) return;
    savedFn.current();
    const id = setInterval(() => savedFn.current(), interval);
    return () => clearInterval(id);
  }, [interval, enabled]);
}
