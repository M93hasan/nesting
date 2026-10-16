import {inflateSync} from 'node:zlib';
import {expect,it} from 'vitest';
import {importDXF} from '../src/import/dxf';

// Four additional real CAD contour patterns taken from 105-457 daban.dxf:
// studio-7, -8, -10 and -11. The geometry is translated so the large source
// offset cannot affect the test, and knot parameters are affinely normalized.
// Text is compressed only to avoid bloating this test fixture with duplicate
// Bezier control points. Native DXF source preservation is covered separately.
const cases=[{"tag":"studio-7","count":68,"b64":"eNqVlEmOYzEMQy8kCJoH-P73ajpZ1U-Aql4-K6Ylij-WwZZKIxyjcSyTs_ay1A64eKaolwvn4GETv2zhf-GGXlIXi0n9P5ewK_VwjuuvWGz3anvlsTaWRTV4diCFn4kutbNW5leOKoLIyO6LV53wRmTc-rLnEhx7l39iLa8PRXNLvBuvBCur9DVS4YiRB-r1hd1gdJMZmw1ek-TeIKwjsQcd51gydul-UjVXBcnRNFYcb4Qd9WQ3dIA2sz7Q0Jj1Sx8-q8C6WYLtknvWOHUGVcmMJ3az6ig579op5Wh3PNs-cQJCIhcxkj7RhyEUpLxVdmy4Bi6h7WikT6-i4Z0ZzSc6d0eSoseIPkKx16sbGrYOzIIFGjp6si9Pp1FBIcJPIszd2OxdwfrpO5fm3fRExAfv3UnPZV_zo4rVX_3mlX47nd1UGENlPhmhcGDeoOE6-vL1G8xIw_UabrX7zY1945tvWDgIZtXNQsK1pRVsUI8uwmC0GEYw3ANNYaIE4RRxAnvB67xi6q8P-scfwD-m8tEM"},{"tag":"studio-8","count":76,"b64":"eNqVlEmO5TAMQy8kCJoH-P73ajqo1U-hUX_5EFsSKToWy6pKPWzudewXtrio6_otDlcYdbJW7_ecyqZL3Zzt-QduXpl7P7rAFZyD787e4sda2VFeOcTiN-wsqmQTwfRtkGGUw7s9D5cNpXFvxpvLOdwpijMT9zPQtikEhja6B2TNkDtPS77Zmq2TTLnWoF6Ex5MgxnKO9rLUkrGl6QvRvGC9HIWJgWuGqm5H3XAOU-Cc9AsVa4Zj6KG1R8W5rySeUjsrbLOBw3uj8IFw2XIxP89ivlzYZGhbDTOhTaYVqD0vdCitMVJeOAAncTUKX2WzDwyIMscU7TufCJ3XFU2uHD1C0Ctx9xdclU0IgZj6ix171Agqu5L95E34ou5yt8dBSiwe9B77RIgXyXjS4Ne4QsaUEstW3cdXVyrh0rAXBkxCULGkXERDEY3sopugRHFFUAsG4OFMR725sS8xmrijgucGP2hgXGyAB9FdGmRCql5sgmmx9YWVcx-W7fMwUM-REYtm_WmHh_MHvhF_3unETfrX_N9_zj9jP-vL"},{"tag":"studio-10","count":96,"b64":"eNqdlEmu40AMQy9UEDQP8P3v1ZSXcdD48Sp5iS2VSKrUkrz9lJOpxaVfOERvFp8XHNRtp4TELF9wUwzqGWWavuLkvDnmVyyaQi0mj_Tf2ZlqizFr_EicenKoavQFKzWjnpK5yh-4qLz33DWB_qGUI1tPU1EvCmL6ycJrnV-4iatPCo203-zwIJJY224eyBoMT1u-ML6UH3dSEejuQlF24AbP_m84r9fBh2TUkwWZsTzKcE8uGcyhKE8SWpdgLA78u82eGEHWffgSqDiYSvEyhhINcj1ObFmfJEoYYju46zWIHOcAI1OvDqjpg4ezwz4RwfaSPojYTF3QCJHZrmE11zojVUBOnO4DsRs2eFiodX3BqnUEcIaBjEmgOsLH80EGQ1qOOKEMHw9KdTiD35GGEw6t5MlYZgSiTgwMLr1WLK5ZZyux3UhIRMay9eSDMbtXoF5gSoaoshbh_d3OilvWDDkIVKTZk_c2QbAwy0BocfSd3GAyC5zePjF72Qx7PTnR3_w0r0EN7yHkgI1C72gg4Xi-HZxfePbcfTqpc7AYgkXpLYfKezc6Oazcdjn2BzYc_77bWrhf8H_v6n9p2ipO"},{"tag":"studio-11","count":64,"b64":"eNptk1mOxDAIRC9kIfZFvv-9psj8tDr95Tw5QFFgVWITP4JzXK8Ezo4jTpqqt0na5EiSp8QVUh7cNgWzfiNTc9pRxFoZ0Fnz6NAUUvOxoBKxj68N9Dwu5G1-UaYbarzIrfVqkDX3CSOV9BcjbnzypCOe_SZkcvqpodCS20lh06cV8rVeLAzJkNhO4dFX0HZXnBboaLliTCxgphR_oStB9VPNwuBdkmovizo4mzJmeVp_MGREbjY4D5ykbFtxXDZXBQbWYhj_wKJiXS50qoraT2OJ4KumZKpbSi3zzd5UWafQUOoaqyQF45mEq5BuyCDVYATv_TdjUlJztIgxQGhvMvadtUbCSDjq_7PHFtmbYcWonDUUcbAS9w5W0jLkw4-bvtHyyAsFDnscrEOpoBqDdw-LzLruDMYHb0QouvPNQuyYI3qw3XFMPxzNIYnXraKolKO7Y_2NKVQBJ3iXTxOaEy9mnl3VYNsi3L8Zq5b70sZ8lqPM9qVlJCaIs92XxyzfbLAg0CTyiiDfM-o6Ylifpc93_AdbRsTw"}];
const options={scale:1,tolerance:.01,enclosed:'holes' as const};
function sourceSpline(encoded:string,expectedPoints:number):string{
  const coords=inflateSync(Buffer.from(encoded,'base64url')).toString('utf8')
    .split(';').map(pair=>pair.split(',').map(Number));
  if(coords.length!==expectedPoints||coords.some(x=>x.length!==2||!x.every(Number.isFinite)))
    throw Error('Invalid footwear CAD regression fixture.');
  const cubicSegments=coords.length/4;
  const knots=Array.from({length:cubicSegments+1},(_,i)=>Array.from({length:4},()=>i)).flat();
  const header=`0\nSPLINE\n8\nLayer 1\n70\n11\n71\n3\n72\n${knots.length}\n73\n${coords.length}\n74\n0\n`;
  return header+knots.map(k=>`40\n${k}\n`).join('')+
    coords.map(([x,y])=>`10\n${x}\n20\n${y}\n30\n0\n`).join('');
}
const file=(entity:string)=>`0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${entity}0\nENDSEC\n0\nEOF\n`;
for(const item of cases){
  it(`imports original connected Bezier knot layout from ${item.tag}`,()=>{
    const review=importDXF(file(sourceSpline(item.b64,item.count)),`${item.tag}.dxf`,options);
    expect(review.issues).toEqual([]);
    expect(review.document.parts).toHaveLength(1);
    expect(review.document.parts[0].source.dxfSpline?.controlPoints).toHaveLength(item.count);
  });
}
