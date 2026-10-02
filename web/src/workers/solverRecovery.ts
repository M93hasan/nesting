const U64_MASK=(1n<<64n)-1n;
const GOLDEN_STEP=0x9E3779B97F4A7C15n;

export const MAX_WASM_RECOVERY_ATTEMPTS=2;

export function isRecoverableWasmTrap(message:string):boolean {
  const text=message.toLowerCase();
  return text.includes('unreachable')
    || text.includes('out of bounds memory access')
    || text.includes('memory access out of bounds');
}

export function isRecoverableInitialPlacement(message:string):boolean {
  return /No valid initial placement could be constructed for item\s+\d+/i.test(message);
}

export function recoverySeed(seed:string,attempt:number):string {
  if(!Number.isInteger(attempt)||attempt<1)throw Error('Recovery attempt must be a positive integer.');
  const base=BigInt(seed);
  return ((base+GOLDEN_STEP*BigInt(attempt))&U64_MASK).toString();
}
