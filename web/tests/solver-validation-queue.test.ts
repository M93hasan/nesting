import { describe, expect, it } from 'vitest';
import { enqueueValidationCandidate } from '../src/application/nesting/validationQueue';

const item = (sequence: number, width: number) => ({
  candidate: { sequence, solution: { strip_width: width } },
});

describe('bounded candidate validation queue', () => {
  it('appends candidates in arrival order before reaching capacity', () => {
    const pending = [item(1, 50)];
    expect(enqueueValidationCandidate(pending, item(2, 40), 3)).toEqual({ accepted: true });
    expect(pending.map(x => x.candidate.sequence)).toEqual([1, 2]);
  });

  it('rejects a worse or equally costly candidate without mutating the queue', () => {
    const pending = [item(1, 30), item(2, 50)];
    const before = [...pending];
    expect(enqueueValidationCandidate(pending, item(3, 50), 2)).toEqual({ accepted: false });
    expect(pending).toEqual(before);
    expect(enqueueValidationCandidate(pending, item(4, 60), 2)).toEqual({ accepted: false });
    expect(pending).toEqual(before);
  });

  it('replaces the earliest worst candidate and preserves other ordering', () => {
    const pending = [item(1, 50), item(2, 20), item(3, 50)];
    const result = enqueueValidationCandidate(pending, item(4, 10), 3);
    expect(result).toEqual({ accepted: true, dropped: item(1, 50) });
    expect(pending.map(x => x.candidate.sequence)).toEqual([2, 3, 4]);
  });

  it('never grows beyond six queued candidates during a burst', () => {
    const pending: ReturnType<typeof item>[] = [];
    for (let sequence = 1; sequence <= 100; sequence++) {
      enqueueValidationCandidate(pending, item(sequence, 101 - sequence));
      expect(pending.length).toBeLessThanOrEqual(6);
    }
    expect(pending.map(x => x.candidate.solution.strip_width).sort((a,b)=>a-b)).toEqual([1,2,3,4,5,6]);
  });

  it('rejects invalid queue limits', () => {
    expect(() => enqueueValidationCandidate([], item(1, 1), 0)).toThrow(RangeError);
  });
});
