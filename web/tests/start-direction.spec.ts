import {expect,test} from '@playwright/test';
import type {Document,Result} from '../src/model';
import {bounds} from '../src/geometry/normalize';
import {collisionWorldRings,validate} from '../src/geometry/validate';

test('wide finite plates fill physical rows right to left from either selected corner',async({page})=>{
  test.setTimeout(45_000);
  await page.addInitScript(()=>{
    const evidence:{document?:Document;result?:Result}={};
    (window as unknown as {directionEvidence:typeof evidence}).directionEvidence=evidence;
    const Original=Worker;
    window.Worker=class extends Original{
      postMessage(message:unknown,options?:StructuredSerializeOptions){
        const data=message as {type:string;document?:Document;result?:Result};
        if(data.type==='start'){evidence.document=structuredClone(data.document);evidence.result=undefined;}
        if(data.type==='export'&&data.result)evidence.result=structuredClone(data.result);
        super.postMessage(message,options);
      }
    };
  });
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Şekil çiz',exact:true})).toBeVisible();
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="2mm" height="2mm" viewBox="0 0 2 2"><rect width="2" height="2"/></svg>';
  await page.locator('input[type=file]').first().setInputFiles({name:'row.svg',mimeType:'image/svg+xml',buffer:Buffer.from(svg)});
  await expect(page.locator('.part-row')).toHaveCount(1);
  await page.locator('.part-row').getByLabel(/adedi$/).fill('5');
  await page.getByLabel(/^Malzeme tipi/).selectOption('sheet');
  await page.getByLabel(/^Malzeme genişliği/).fill('6.1');
  await page.getByLabel(/^Plaka uzunluğu/).fill('4.1');
  await page.getByLabel(/^Durdurma koşulu/).selectOption('10');
  for(const startCorner of ['right-bottom','right-top'] as const){
    await page.getByLabel(/^Başlangıç yönü/).selectOption(startCorner);
    await expect(page.getByRole('img',{name:'Geçerli nesting sonucu',exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:'Parçaları yerleştir',exact:true}).click();
    const best=page.getByRole('button',{name:'En iyi geçerli yerleşim',exact:true});
    await expect(best).toBeEnabled();
    await expect(page.getByRole('button',{name:'Durdur',exact:true})).toHaveCount(0,{timeout:15_000});
    await best.click();
    await expect.poll(()=>page.evaluate(()=>(window as unknown as {directionEvidence:{result?:Result}}).directionEvidence.result?.validation.status)).toBe('passed');
    const {document:doc,result}=await page.evaluate(()=>(window as unknown as {directionEvidence:{document:Document;result:Result}}).directionEvidence);
    expect(result.sheetCount).toBe(1);expect(result.placements).toHaveLength(5);
    expect(doc.settings.startCorner).toBe(startCorner);
    expect(validate(doc,result)).toMatchObject({status:'passed',errors:[]});
    const boxes=collisionWorldRings(doc,result).map(bounds),byCopy=new Map(result.placements.map((p,i)=>[p.copyIndex,boxes[i]]));
    const partBox=bounds(doc.parts[0].outer),width=partBox[2]-partBox[0],height=partBox[3]-partBox[1];
    for(let copy=0;copy<5;copy++){
      const box=byCopy.get(copy)!;
      expect(box[2]).toBeCloseTo(6.1-(copy%3)*width,5);
      if(startCorner==='right-bottom')expect(box[1]).toBeCloseTo(Math.floor(copy/3)*height,5);
      else expect(box[3]).toBeCloseTo(4.1-Math.floor(copy/3)*height,5);
    }
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
});
