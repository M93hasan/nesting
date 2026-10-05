import {test,expect} from 'vitest';
import {rotationSummary} from '../src/model';

test('rotation summaries describe unique orientations including equivalent and offset angles',()=>{
  expect(rotationSummary({kind:'continuous'})).toBe('Serbest dönüş');
  for(const [degrees,label] of [
    [[0,360,-360],'Sabit'],[[30,210],'Yarım dönüşler'],
    [[315,45,135,225],'Dört yön'],[[0,45,90],'3 açı'],
  ] as const) expect(rotationSummary({kind:'discrete',degrees:[...degrees]})).toBe(label);
});
