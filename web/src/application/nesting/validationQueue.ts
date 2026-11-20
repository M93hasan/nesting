/**
 * Keep pending solver validation bounded while retaining the most promising
 * improvements. This is pure application policy; Worker messaging remains in
 * the infrastructure-facing solver hook until a later adapter migration.
 *
 * Mutates the supplied queue just like the legacy useSolver implementation.
 * Equal-cost candidates do not replace the oldest equal-cost pending entry.
 */
export function enqueueValidationCandidate<T extends { candidate: { solution: { strip_width: number } } }>(
  pending: T[],
  next: T,
  limit = 6,
): { accepted: boolean; dropped?: T } {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('Validation queue limit must be positive.');
  if (pending.length < limit) {
    pending.push(next);
    return { accepted: true };
  }

  const worst = pending.reduce(
    (index, item, i) => item.candidate.solution.strip_width
      > pending[index].candidate.solution.strip_width ? i : index,
    0,
  );
  if (next.candidate.solution.strip_width >= pending[worst].candidate.solution.strip_width) {
    return { accepted: false };
  }
  const [dropped] = pending.splice(worst, 1);
  pending.push(next);
  return { accepted: true, dropped };
}
