import type { GeometryReply, SolverMessage } from '../../workers/protocol';
import type { ValidatedCandidateMessage } from './workerMessages';

export type WorkerEventHandlers = {
  onSolverMessage: (event: MessageEvent<SolverMessage>) => void;
  onSolverError: (event: ErrorEvent) => void;
  onPreviewMessage: (event: MessageEvent<GeometryReply>) => void;
  onPreviewError: (event: ErrorEvent) => void;
  onValidationMessage: (event: MessageEvent<ValidatedCandidateMessage>) => void;
  onValidationError: (event: ErrorEvent) => void;
};

type WorkerReceiver<T> = Pick<Worker, 'onerror'> & { onmessage: ((event: MessageEvent<T>) => void) | null };

/**
 * The Worker transport owns event subscription; presentation provides callbacks
 * while the existing stateful controller is being incrementally extracted.
 */
export function bindNestingWorkerEvents(
  workers: {
    solver: WorkerReceiver<SolverMessage>;
    preview: WorkerReceiver<GeometryReply>;
    validator: WorkerReceiver<ValidatedCandidateMessage>;
  },
  events: WorkerEventHandlers,
): void {
  workers.solver.onmessage = events.onSolverMessage;
  workers.solver.onerror = events.onSolverError;
  workers.preview.onmessage = events.onPreviewMessage;
  workers.preview.onerror = events.onPreviewError;
  workers.validator.onmessage = events.onValidationMessage;
  workers.validator.onerror = events.onValidationError;
}
