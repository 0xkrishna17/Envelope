import { LedgerState } from '../../store/types';
import { LedgerEvent, ProjectionSeed } from './types';
import { projectLedger } from './projectLedger';

export function projectEvents(params: {
  seed: ProjectionSeed;
  events: LedgerEvent[];
}): LedgerState {
  return projectLedger(params.events, params.seed);
}
