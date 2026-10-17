import {expect,test} from '@playwright/test';
import {validate} from '../src/geometry/validate';
import type {Document,Result} from '../src/model';
import type {Candidate} from '../src/workers/protocol';

const source='<svg xmlns="http://www.w3.org/2000/svg" width="14mm" height="7mm" viewBox="0 0 14 7"><path d="M0 0H6V2H2V6H0Z"/><rect x="8" width="4" height="4"/></svg>';
type Evidence={document?:Document;exported?:Result;candidates:Candidate[]};

for(const threads of [1,2])test(`finite plate fills the L contour notch with ${threads} solver threads`,async({browser})=>{
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4173',serviceWorkers:threads===2?'allow':'block'});
  try{
    await context.addInitScript(()=>{
      const state:Evidence={candidates:[]};
      (window as unknown as {packingEvidence:Evidence}).packingEvidence=state;
      const Original=Worker;
      window.Worker=class extends Original{
        constructor(url:string|URL,options?:WorkerOptions){
          super(url,options);
          this.addEventListener('message',event=>{
            if(event.data.type==='candidate')state.candidates.push(event.data);
          });
        }
        postMessage(message:unknown,options?:StructuredSerializeOptions){
          const data=message as {type:string;document?:Document;result?:Result};
          if(data.type==='start'){
            state.document=structuredClone(data.document);state.exported=undefined;state.candidates=[];
          }
          if(data.type==='export'&&data.result)state.exported=structuredClone(data.result);
          super.postMessage(message,options);
        }
      };
    });
    const page=await context.newPage();
    await page.goto('/');
    await expect(page.getByRole('button',{name:'Şekil çiz',exact:true})).toBeVisible();
    await page.locator('input[type=file]').first().setInputFiles({name:'notch.svg',mimeType:'image/svg+xml',buffer:Buffer.from(source)});
    await expect(page.locator('.part-row')).toHaveCount(2);
    await page.getByLabel(/^Malzeme tipi/).selectOption('sheet');
    await page.getByLabel(/^Malzeme genişliği/).fill('6.1');
    await page.getByLabel(/^Plaka uzunluğu/).fill('6.1');
    await page.getByLabel(/^Durdurma koşulu/).selectOption('10');
    await page.locator('.solver-options>summary').click();
    await page.getByLabel(/^İşlemci iş parçacıkları/).selectOption(String(threads));
    for(let attempt=0;attempt<2;attempt++){
      await page.getByRole('button',{name:attempt?'Yeniden yerleştir':'Parçaları yerleştir',exact:true}).click();
      const best=page.getByRole('button',{name:'En iyi geçerli yerleşim',exact:true});
      await expect(best).toBeEnabled({timeout:20_000});
      await best.click();
      const stop=page.getByRole('button',{name:'Durdur',exact:true});
      if(await stop.isVisible())await stop.click();
      await expect(page.getByRole('img',{name:'Geçerli nesting sonucu',exact:true})).toBeVisible();
      await expect(page.locator('[data-worker-count]')).toHaveAttribute('data-worker-count',String(threads));
      await expect.poll(()=>page.evaluate(()=>(window as unknown as {packingEvidence:Evidence}).packingEvidence.exported?.sheetCount)).toBe(1);
      const evidence=await page.evaluate(()=>(window as unknown as {packingEvidence:Evidence}).packingEvidence);
      expect(evidence.candidates.some(candidate=>candidate.sheetResult?.sheetCount===1)).toBe(true);
      expect(evidence.exported!.placements).toHaveLength(2);
      expect(validate(evidence.document!,evidence.exported!)).toMatchObject({status:'passed',errors:[]});
      await expect(page.getByRole('alert')).toHaveCount(0);
    }
  }finally{await context.close();}
});
