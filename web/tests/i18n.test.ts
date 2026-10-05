import {expect,it} from 'vitest';
import {translate} from '../src/i18n';

it('translates the requested stop and rotation labels',()=>{
  expect(translate('tr','Durdurma koşulu')).toBe('Durdurma koşulu');
  expect(translate('en','Durdurma koşulu')).toBe('Stop condition');
  expect(translate('ar','Durdurma koşulu')).toBe('شرط الإيقاف');
  expect(translate('fa','Durdurma koşulu')).toBe('شرط توقف');

  expect(translate('tr','Döndürme açısı, derece')).toBe('Döndürme açısı, derece');
  expect(translate('en','Döndürme açısı, derece')).toBe('Rotate by, degrees');
  expect(translate('ar','Döndürme açısı, derece')).toBe('زاوية الدوران، درجة');
  expect(translate('fa','Döndürme açısı, derece')).toBe('زاویه چرخش، درجه');
});

it('translates dynamic duration labels in all four languages',()=>{
  expect(translate('en','En fazla 30 saniye')).toBe('Up to 30 seconds');
  expect(translate('ar','En fazla 2 dakika')).toBe('حتى 2 دقيقة');
  expect(translate('fa','En fazla 5 dakika')).toBe('حداکثر 5 دقیقه');
});

it('translates user and license UI labels',()=>{
  expect(translate('en','Varsayılan dil')).toBe('Default language');
  expect(translate('ar','Lisans')).toBe('الترخيص');
  expect(translate('fa','Yönetici')).toBe('مدیر');
});
