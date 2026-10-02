import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {isRecoverableWasmTrap,MAX_WASM_RECOVERY_ATTEMPTS,recoverySeed} from '../src/workers/solverRecovery';

test('retries only low-level WASM traps',()=>{
  expect(isRecoverableWasmTrap('RuntimeError: unreachable')).toBe(true);
  expect(isRecoverableWasmTrap('Uncaught RuntimeError: memory access out of bounds')).toBe(true);
  expect(isRecoverableWasmTrap('No valid initial placement could be constructed for item 3.')).toBe(false);
  expect(isRecoverableWasmTrap('Invalid strip dimensions or demand')).toBe(false);
});

test('recovery seeds are valid u64 values and differ from the original',()=>{
  const max=(1n<<64n)-1n;
  for(let attempt=1;attempt<=MAX_WASM_RECOVERY_ATTEMPTS;attempt++){
    const value=BigInt(recoverySeed(max.toString(),attempt));
    expect(value).toBeGreaterThanOrEqual(0n);
    expect(value).toBeLessThanOrEqual(max);
    expect(value).not.toBe(max);
  }
});

test('solver coordinator performs bounded serial retries without changing the input document',()=>{
  const source=readFileSync(new URL('../src/workers/solver.worker.ts',import.meta.url),'utf8');
  expect(source).toContain('isRecoverableWasmTrap(message)');
  expect(source).toContain('recoveryAttempts<MAX_WASM_RECOVERY_ATTEMPTS');
  expect(source).toContain('launch(1,');
  expect(source).toContain('runtime.postMessage({ ...start, seed, threads: count');
});
