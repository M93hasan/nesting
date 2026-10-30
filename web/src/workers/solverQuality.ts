export type QualityAttempt={seed:string;seconds:number|null};

function qualitySeed(seed:string,index:number):string {
  if(index===0)return seed;
  const mask=(1n<<64n)-1n;
  let x=(BigInt(seed)+0x9E3779B97F4A7C15n*BigInt(index))&mask;
  x=(x^(x>>30n))*0xBF58476D1CE4E5B9n&mask;
  x=(x^(x>>27n))*0x94D049BB133111EBn&mask;
  return ((x^(x>>31n))&mask).toString();
}

export function qualityAttempts(seed:string,seconds:number|null,preset:string):QualityAttempt[] {
  if(preset==='fast'||seconds===null||seconds<=10)return [{seed,seconds}];
  const budgets=seconds<120
    ? [Math.max(5,Math.ceil(seconds*2/3)),Math.max(5,seconds-Math.ceil(seconds*2/3))]
    : [Math.max(5,Math.floor(seconds/2)),Math.max(5,Math.floor(seconds/3)),Math.max(5,seconds-Math.floor(seconds/2)-Math.floor(seconds/3))];
  const total=budgets.reduce((sum,value)=>sum+value,0);
  if(total!==seconds)budgets[0]+=seconds-total;
  return budgets.map((budget,index)=>({seed:qualitySeed(seed,index),seconds:budget}));
}
