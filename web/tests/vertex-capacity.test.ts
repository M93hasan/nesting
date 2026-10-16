import { describe, expect, it } from 'vitest';
import { normalizeDocument } from '../src/geometry/normalize';
import { LIMITS, newPart, type Document, type Ring } from '../src/model';

// Exercise the *demanded* vertex count, including copies, not just raw DXF input.
const polygon = (vertices: number): Ring =>
  Array.from({ length: vertices }, (_, i) => {
    const angle = (i * 2 * Math.PI) / vertices;
    return [200 + 100 * Math.cos(angle), 200 + 100 * Math.sin(angle)] as [number, number];
  });

const project = (vertices: number, copies: number): Document => ({
  name: 'DXF vertex capacity regression',
  settings: { materialWidthMm: 1400, clearanceMm: 0, timeLimitSeconds: null },
  parts: [{ ...newPart(polygon(vertices), 'Detailed pattern'), quantity: copies }]
});

describe('large DXF geometry budget', () => {
  it('accepts more than 100,000 demanded vertices without reducing precision', () => {
    const doc = normalizeDocument(project(401, 300));
    expect(doc.parts[0].outer).toHaveLength(401);
    expect(doc.parts[0].quantity * doc.parts[0].outer.length).toBe(120300);
    expect(LIMITS.verticesTotal).toBe(500000);
  });

  it('keeps a finite capacity guard above 500,000 demanded vertices', () => {
    expect(() => normalizeDocument(project(1100, 500))).toThrow(/500,000 demanded vertices/);
  });
});
