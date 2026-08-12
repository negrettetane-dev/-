import { apiGet, apiPut } from './apiClient';
import type { MockIntersection } from '../mocks/mockData';

export interface SignalPhase {
  id: string;
  intersectionId: string;
  phaseNo: number;
  direction: string;
  greenTime: number;
  yellowTime: number;
  redTime: number;
  minGreen: number;
  maxGreen: number;
}

export interface IntersectionDetail extends MockIntersection {
  phases: SignalPhase[];
}

export const signalService = {
  getList: async () => {
    const data = await apiGet<Array<{ id:string; name:string; phaseCount:number; currentPhase:number; cycleLength:number; status:string; coordinates:[number,number] }>>('/signals');
    return data.map((item): MockIntersection => ({
      id:item.id, name:item.name, position:item.coordinates, phaseCount:item.phaseCount,
      currentPhase:item.currentPhase, cycleTime:item.cycleLength,
      optimizationStatus:item.status === 'optimized' ? 'auto' : item.status === 'manual' ? 'manual' : 'optimizing',
    }));
  },
  getById: async (id: string): Promise<IntersectionDetail> => {
    const item = await apiGet<{ id:string; name:string; phaseCount:number; currentPhase:number; cycleLength:number; status:string; coordinates:[number,number]; phases:Array<{id:string;name:string;greenTime:number;yellowTime:number;redTime:number}> }>(`/signals/${id}`);
    return {
      id:item.id, name:item.name, position:item.coordinates, phaseCount:item.phaseCount,
      currentPhase:item.currentPhase, cycleTime:item.cycleLength,
      optimizationStatus:item.status === 'optimized' ? 'auto' : item.status === 'manual' ? 'manual' : 'optimizing',
      phases:(item.phases || []).map((phase, index) => ({
        id:phase.id, intersectionId:item.id, phaseNo:index + 1, direction:phase.name,
        greenTime:phase.greenTime, yellowTime:phase.yellowTime, redTime:phase.redTime,
        minGreen:0, maxGreen:phase.greenTime,
      })),
    };
  },
  updatePhases: (id: string, phases: SignalPhase[]) =>
    apiPut<{ success: boolean }>(`/signals/${id}`, { phases }),
};
