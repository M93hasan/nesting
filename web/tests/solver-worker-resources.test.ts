import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSolverWorkers, releaseSolverWorkers } from '../src/infrastructure/nesting/solverWorkers';

afterEach(() => vi.unstubAllGlobals());

describe('solver worker resources', () => {
  it('creates three isolated module workers in the original order', () => {
    const created: Array<{ url: string; type?: string }> = [];
    class WorkerStub {
      constructor(url: URL, options: WorkerOptions) {
        created.push({ url: url.toString(), type: options.type });
      }
      terminate() {}
      postMessage(_message: unknown) {}
    }
    vi.stubGlobal('Worker', WorkerStub);
    createSolverWorkers();
    expect(created.map(x => new URL(x.url).pathname.split('/').at(-1))).toEqual([
      'solver.worker.ts', 'geometry.worker.ts', 'candidate-validator.worker.ts',
    ]);
    expect(created.every(x => x.type === 'module')).toBe(true);
  });

  it('stops the solver but only terminates preview and validator workers', () => {
    const solver = { postMessage: vi.fn() };
    const preview = { terminate: vi.fn() };
    const validator = { terminate: vi.fn() };
    releaseSolverWorkers({ solver, preview, validator });
    expect(solver.postMessage).toHaveBeenCalledTimes(1);
    expect(solver.postMessage).toHaveBeenCalledWith({ type: 'stop' });
    expect(preview.terminate).toHaveBeenCalledOnce();
    expect(validator.terminate).toHaveBeenCalledOnce();
  });

  it('terminates auxiliary workers even when solver has already ended', () => {
    const preview = { terminate: vi.fn() };
    const validator = { terminate: vi.fn() };
    releaseSolverWorkers({ preview, validator });
    expect(preview.terminate).toHaveBeenCalledOnce();
    expect(validator.terminate).toHaveBeenCalledOnce();
  });

  it('terminates already created workers if later construction fails', () => {
    const terminated: number[] = [];
    let next = 0;
    class WorkerStub {
      private readonly id: number;
      constructor() {
        this.id = ++next;
        if (this.id === 3) throw new Error('validator creation failed');
      }
      terminate() { terminated.push(this.id); }
      postMessage(_message: unknown) {}
    }
    vi.stubGlobal('Worker', WorkerStub);
    expect(() => createSolverWorkers()).toThrow('validator creation failed');
    expect(terminated).toEqual([2, 1]);
  });
});
