import {expect,test} from 'vitest';
import {filterHistory,historyCsv,parseCredits,validAdminSettings,type AdminHistoryRow} from '../src/adminControls';

const row:AdminHistoryRow={id:1,userId:1,email:'test@example.com',name:'Test',projectName:'=HYPERLINK("https://example.test")',sourceFileName:'-cmd',usedCredit:1,createdAt:'2026-11-04 10:00:00'};

test('blank, negative, noninteger and malformed credit edits are rejected',()=>{
  for(const value of ['','  ','-1','1.5','NaN','Infinity','100001','0100000'])
    expect(parseCredits(value)).toBeNull();
  expect(parseCredits('0')).toBe(0);
  expect(parseCredits('200')).toBe(200);
});

test('invalid admin settings cannot claim successful saves',()=>{
  const valid={materialWidthMm:1400,clearanceMm:0,marginMm:0,rotation:'half',materialType:'roll',solverPreset:'standard'};
  expect(validAdminSettings(valid)).toBe(true);
  expect(validAdminSettings({...valid,materialWidthMm:NaN})).toBe(false);
  expect(validAdminSettings({...valid,materialWidthMm:0})).toBe(false);
  expect(validAdminSettings({...valid,clearanceMm:-1})).toBe(false);
  expect(validAdminSettings({...valid,rotation:'wrong'})).toBe(false);
});

test('history search filters users and project data',()=>{
  expect(filterHistory([row],'TEST@EXAMPLE')).toHaveLength(1);
  expect(filterHistory([row],'hyperlink')).toHaveLength(1);
  expect(filterHistory([row],'missing')).toHaveLength(0);
});

test('CSV export escapes spreadsheet formulas and quotes',()=>{
  const csv=historyCsv([row]);
  expect(csv.charCodeAt(0)).toBe(0xFEFF);
  expect(csv).toContain('"\'=HYPERLINK(""https://example.test"")"');
  expect(csv).toContain('"\'-cmd"');
  expect(csv).toContain('Kullanılan hak');
});
