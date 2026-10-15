import type { LongDistancePurchase } from '@zhitu/shared';

const PURCHASES_KEY = 'zhitu_long_distance_purchases';
const SOLD_KEY = 'zhitu_long_distance_sold';

export interface DemoPurchaseInput {
  scheduleId: string;
  date: string;
  passengerCount: number;
  price: number;
  baseTickets: number;
  provider: string;
  originStation: string;
  destinationStation: string;
  departureTime: string;
}

export class LongDistanceDemoStoreError extends Error {
  constructor(public readonly code: 'INVALID_PASSENGER_COUNT' | 'INSUFFICIENT_INVENTORY') {
    super(code === 'INSUFFICIENT_INVENTORY' ? '余票不足，请刷新后重试' : '购票人数不正确');
    this.name = 'LongDistanceDemoStoreError';
  }
}

function scopeId(): string {
  try {
    const raw = localStorage.getItem('zhitu_user');
    const user = raw ? JSON.parse(raw) as { id?: string } : null;
    if (user?.id) return user.id;
  } catch {
    // Use the device scope when demo user data is unavailable.
  }
  return localStorage.getItem('zhitu_token') || 'guest';
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

interface StoredPurchase extends LongDistancePurchase {
  scopeId: string;
}

type SoldLedger = Record<string, number>;

function inventoryKey(scheduleId: string, date: string): string {
  return `${scheduleId}:${date}`;
}

export function getDemoSoldTickets(scheduleId: string, date: string): number {
  const ledger = read<SoldLedger>(SOLD_KEY, {});
  return Math.max(0, Number(ledger[inventoryKey(scheduleId, date)] || 0));
}

export function listDemoPurchases(): LongDistancePurchase[] {
  return read<StoredPurchase[]>(PURCHASES_KEY, [])
    .filter(item => item.scopeId === scopeId())
    .map(({ scopeId: _scopeId, ...purchase }) => purchase)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function cacheDemoPurchase(purchase: LongDistancePurchase, soldTickets = 0): void {
  const purchases = read<StoredPurchase[]>(PURCHASES_KEY, []);
  const alreadyCached = purchases.some(item => item.id === purchase.id);
  if (!alreadyCached) {
    write(PURCHASES_KEY, [{ ...purchase, scopeId: scopeId() }, ...purchases]);
  }
  if (alreadyCached || soldTickets <= 0) return;

  const soldLedger = read<SoldLedger>(SOLD_KEY, {});
  const key = inventoryKey(purchase.scheduleId, purchase.date);
  soldLedger[key] = Math.max(0, Number(soldLedger[key] || 0)) + soldTickets;
  write(SOLD_KEY, soldLedger);
}

export function createDemoPurchase(input: DemoPurchaseInput): LongDistancePurchase {
  if (!Number.isInteger(input.passengerCount) || input.passengerCount < 1) {
    throw new LongDistanceDemoStoreError('INVALID_PASSENGER_COUNT');
  }

  const soldLedger = read<SoldLedger>(SOLD_KEY, {});
  const key = inventoryKey(input.scheduleId, input.date);
  const sold = Math.max(0, Number(soldLedger[key] || 0));
  const remaining = Math.max(0, input.baseTickets - sold);
  if (input.passengerCount > remaining) {
    throw new LongDistanceDemoStoreError('INSUFFICIENT_INVENTORY');
  }

  const now = Date.now();
  const purchase: LongDistancePurchase = {
    id: `ldp_${now.toString(36)}`,
    purchaseNo: `LD${now.toString(36).toUpperCase()}`,
    kind: 'purchase',
    scheduleId: input.scheduleId,
    routeName: `${input.originStation} → ${input.destinationStation}`,
    provider: input.provider,
    date: input.date,
    departureTime: input.departureTime,
    originStation: input.originStation,
    destinationStation: input.destinationStation,
    price: input.price,
    passengerCount: input.passengerCount,
    status: 'pending',
    createdAt: now,
  };
  const purchases = read<StoredPurchase[]>(PURCHASES_KEY, []);
  soldLedger[key] = sold + input.passengerCount;
  write(SOLD_KEY, soldLedger);
  write(PURCHASES_KEY, [{ ...purchase, scopeId: scopeId() }, ...purchases]);
  return purchase;
}
