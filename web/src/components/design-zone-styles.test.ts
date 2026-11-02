import {describe,it,expect} from 'vitest';
import {cleanZoneStyles,renderZoneCss} from './design-zone-styles';
describe('safe real component styles',()=>{
  it('keeps only valid allowlisted properties',()=>{
    const result=cleanZoneStyles({header:{background:'#123456',fontSize:16,shadow:12,script:'alert(1)'},evil:{background:'#000000'}});
    expect(result).toEqual({header:{background:'#123456',fontSize:16,shadow:12}});
    const css=renderZoneCss(result);
    expect(css).toContain('data-design-zone="header"');
    expect(css).not.toContain('evil');
    expect(css).not.toContain('script');
  });
  it('accepts ordinary uppercase action labels and rejects HTML controls',()=>{
    expect(cleanZoneStyles({downloadButton:{text:'DXF KAYDET'}})).toEqual({downloadButton:{text:'DXF KAYDET'}});
    expect(cleanZoneStyles({downloadButton:{text:'<script>'}})).toEqual({});
  });
  it('renders only bounded button movement and ignores panel translation',()=>{
    const css=renderZoneCss({downloadButton:{offsetX:48,offsetY:-30},canvas:{offsetX:50,offsetY:50}});
    expect(css).toContain('transform:translate(48px,-30px) !important');
    expect(css).not.toContain('transform:translate(50px,50px)');
    expect(cleanZoneStyles({corelButton:{offsetX:81,offsetY:-81}})).toEqual({});
  });
  it('drops malformed colors, unsafe numbers and arbitrary selectors',()=>{
    expect(cleanZoneStyles({canvas:{background:'url(javascript:evil)',spacing:-2,shadow:1000},body:{color:'#ffffff'}})).toEqual({});
  });
});
