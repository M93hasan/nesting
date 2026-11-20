import { expect, test, vi } from 'vitest';
import { bindNestingWorkerEvents } from '../src/infrastructure/nesting/workerEvents';

test('worker gateway binds all three message and error channels', () => {
  const worker = () => ({ onmessage: null as ((event: MessageEvent<never>) => void) | null, onerror: null as ((event: ErrorEvent) => void) | null });
  const solver = worker(), preview = worker(), validator = worker();
  const events = {
    onSolverMessage: vi.fn(), onSolverError: vi.fn(),
    onPreviewMessage: vi.fn(), onPreviewError: vi.fn(),
    onValidationMessage: vi.fn(), onValidationError: vi.fn(),
  };
  bindNestingWorkerEvents({ solver, preview, validator }, events);
  expect(solver.onmessage).toBe(events.onSolverMessage);
  expect(solver.onerror).toBe(events.onSolverError);
  expect(preview.onmessage).toBe(events.onPreviewMessage);
  expect(preview.onerror).toBe(events.onPreviewError);
  expect(validator.onmessage).toBe(events.onValidationMessage);
  expect(validator.onerror).toBe(events.onValidationError);
});
