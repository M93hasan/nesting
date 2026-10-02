import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';

test('construction recovery keeps every copy inside Sparrow optimization via warm start',()=>{
  const rust=readFileSync(new URL('../wasm/src/lib.rs',import.meta.url),'utf8');
  const runtime=readFileSync(new URL('../src/workers/solver-runtime.worker.ts',import.meta.url),'utf8');
  expect(rust).toContain('safe_warm_start(&external, clearance)');
  expect(rust).toContain('Some(&warm_solution)');
  expect(rust).toContain('all copies remain in Sparrow optimization');
  expect(runtime).not.toContain('SafeAppendFeas');
  expect(runtime).not.toContain('appendFallbackItems');
});
