import type {Document,Result} from '../model';

/** Each optimized layout is one series; production totals repeat it without expanding solver copies. */
export function productionTotals(document:Document,result?:Result):{
  piecesPerSeries:string;totalPieces:string;material?:{amount:string;unit:'plaka'|'mm'};
} {
  const raw=String(document.seriesMultiplier??1);
  if(!/^[1-9][0-9]*$/.test(raw))throw Error('Seri adedi 1 veya daha büyük bir tam sayı olmalıdır.');
  const series=BigInt(raw);
  const piecesPerSeries=document.parts.reduce((sum,part)=>{
    const copies=Number.isSafeInteger(part.quantity)&&part.quantity>=0?BigInt(part.quantity):0n;
    const entities=part.source.dxfSourceEntityCount??1;
    return sum+copies*BigInt(Number.isSafeInteger(entities)&&entities>0?entities:1);
  },0n);
  let material: {amount:string;unit:'plaka'|'mm'}|undefined;
  if(result) {
    if(document.settings.materialType==='sheet') {
      material={amount:(BigInt(result.sheetCount??1)*series).toString(),unit:'plaka'};
    } else if(Number.isFinite(result.usedLengthMm)&&result.usedLengthMm>=0) {
      // Store the displayed roll estimate to 0.001 mm before repeating it.
      const totalThousandths=BigInt(Math.round(result.usedLengthMm*1000))*series;
      const whole=totalThousandths/1000n;
      const fraction=(totalThousandths%1000n).toString().padStart(3,'0').replace(/0+$/,'');
      material={amount:whole.toString()+(fraction?'.'+fraction:''),unit:'mm'};
    }
  }
  return {piecesPerSeries:piecesPerSeries.toString(),totalPieces:(piecesPerSeries*series).toString(),material};
}
