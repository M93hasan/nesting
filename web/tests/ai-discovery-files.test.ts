import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
describe('public AI discovery static files',()=>{
  it('llms.txt starts with a site H1 and offers real absolute links',()=>{
    const txt=read('../public/llms.txt');
    expect(txt.startsWith('# Serula Nesting Pro\n')).toBe(true);
    expect(txt).toContain('> Serula');
    const links=[...txt.matchAll(/- \[[^\]]+\]\((https:\/\/[^)]+)\)/g)].map(x=>x[1]);
    expect(links.length).toBeGreaterThanOrEqual(2);
    for(const link of links)expect(new URL(link).protocol).toBe('https:');
  });
  it('returns the same parseable ARD 1.0 manifest from well-known and legacy paths',()=>{
    const legacy=JSON.parse(read('../public/ai-catalog.json'));
    const wellKnown=JSON.parse(read('../public/.well-known/ai-catalog.json'));
    expect(wellKnown).toEqual(legacy);
    expect(wellKnown).toMatchObject({
      specVersion:'1.0',
      host:{displayName:'Serula Nesting Pro',documentationUrl:'https://serula.site/'},
      entries:[],
    });
    expect(Object.keys(wellKnown).sort()).toEqual(['entries','host','specVersion']);
    expect(Object.keys(wellKnown.host).sort()).toEqual(['displayName','documentationUrl','logoUrl']);
  });
  it('publishes both links in the pre-rendered page head',()=>{
    const html=read('../index.html');
    expect(html).toContain('rel="ai-catalog"');
    expect(html).toContain('https://serula.site/.well-known/ai-catalog.json');
    expect(html).toContain('https://serula.site/llms.txt');
  });
});
