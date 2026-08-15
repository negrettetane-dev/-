import axios from 'axios';
import { apiGet, apiPost } from './apiClient';

export interface CreateCustomBusReservationRequest {
  routeId: string;
  scheduleId: string;
  boardingPointId: string;
  passengerCount: number;
}

export interface CustomBusReservation {
  id: string;
  reservationNo: string;
  routeId: string;
  routeName: string;
  scheduleId: string;
  departureTime: string;
  boardingPoint: string;
  destination: string;
  price: number;
  status: 'pending' | 'completed' | 'cancelled' | 'expired';
}

export type ReservationErrorCode =
  | 'UNAUTHORIZED'
  | 'SERVICE_UNAVAILABLE'
  | 'RESERVATION_UNAVAILABLE'
  | 'SOLD_OUT'
  | 'DUPLICATE'
  | 'SCHEDULE_NOT_FOUND'
  | 'SCHEDULE_EXPIRED'
  | 'UNKNOWN';

export class ReservationServiceError extends Error {
  constructor(public readonly code: ReservationErrorCode, message: string) {
    super(message);
    this.name = 'ReservationServiceError';
  }
}

function normalizeError(error: unknown): never {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const body = error.response?.data as { code?: string; message?: string; msg?: string } | undefined;
    const code = String(body?.code ?? '').toUpperCase();
    const message = String(body?.message ?? body?.msg ?? error.message ?? '');
    // 统一后端错误码映射（错误码优先，其次 HTTP 状态）
    if (status === 401 || code === 'TOKEN_EXPIRED') throw new ReservationServiceError('UNAUTHORIZED', '登录状态已过期，请重新登录');
    if (code === 'SCHEDULE_SOLD_OUT' || /满|sold.?out|seat/i.test(message)) throw new ReservationServiceError('SOLD_OUT', '该班次刚刚已满，请选择其他班次。');
    if (code === 'DUPLICATE_RESERVATION' || code === 'DUPLICATE') throw new ReservationServiceError('DUPLICATE', '你已预约该班次，请勿重复预约。');
    if (status === 409) throw new ReservationServiceError('DUPLICATE', '你已预约该班次，请勿重复预约。');
    if (code === 'SCHEDULE_NOT_FOUND') throw new ReservationServiceError('SCHEDULE_NOT_FOUND', '该班次已不存在');
    if (status === 404) throw new ReservationServiceError('SERVICE_UNAVAILABLE', '预约服务暂未接入');
    if (code === 'SCHEDULE_EXPIRED' || status === 410) throw new ReservationServiceError('SCHEDULE_EXPIRED', '该班次已停止预约');
    if (code === 'RESERVATION_UNAVAILABLE' || status === 503) throw new ReservationServiceError('RESERVATION_UNAVAILABLE', '预约服务暂不可用');
    if (status === 501) throw new ReservationServiceError('SERVICE_UNAVAILABLE', '预约服务暂未接入');
  }
  throw new ReservationServiceError('UNKNOWN', error instanceof Error ? error.message : '预约提交失败，请稍后重试');
}

export const customBusReservationService = {
  async createReservation(request: CreateCustomBusReservationRequest): Promise<CustomBusReservation> {
    try {
      // Authorization 由 apiClient 从当前登录 Token 注入；请求中不接受 userId。
      const result = await apiPost<CustomBusReservation>('/custom-bus/reservations', request);
      // 当前 Mock 对未知接口会返回 null。缺少真实编号时绝不能伪装预约成功。
      if (!result?.id || !result?.reservationNo) {
        throw new ReservationServiceError('SERVICE_UNAVAILABLE', '预约服务暂未接入');
      }
      return result;
    } catch (error) {
      if (error instanceof ReservationServiceError) throw error;
      return normalizeError(error);
    }
  },

  async getMyReservations(): Promise<CustomBusReservation[]> {
    try {
      const result = await apiGet<CustomBusReservation[]>('/custom-bus/reservations');
      if (!Array.isArray(result)) {
        throw new ReservationServiceError('SERVICE_UNAVAILABLE', '预约服务暂未接入');
      }
      return result;
    } catch (error) {
      if (error instanceof ReservationServiceError) throw error;
      return normalizeError(error);
    }
  },
};
