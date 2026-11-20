import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const cases=[
  ['dxf-nesting','DXF nesting'],
  ['lazer-kesim-nesting','Lazer kesim'],
  ['cnc-nesting','CNC nesting'],
] as const;

describe('static public SEO landing pages',()=>{
  it.each(cases)('%s has standalone indexable HTML and canonical metadata',(slug,keyword)=>{
    const html=read(`../${slug}/index.html`);
    expect(html).toContain('<html lang="tr">');
    expect(html).toContain('<h1>');
    expect(html.toLowerCase()).toContain(keyword.toLowerCase());
    expect(html).toContain(`<link rel="canonical" href="https://serula.site/${slug}/">`);
    expect(html).toContain('content="index,follow"');
    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain('href="/"');
    expect(html).not.toContain('src="/src/main.tsx"');
    const schema=JSON.parse(html.match(/<script type="application\/ld\+json">(.+?)<\/script>/s)?.[1]??'null');
    expect(schema).toMatchObject({'@type':'WebPage',url:`https://serula.site/${slug}/`,inLanguage:'tr'});
  });

  it('sitemap declares only the real public page URLs',()=>{
    const xml=read('../public/sitemap.xml');
    for(const slug of cases.map(([s])=>s)){
      expect(xml).toContain(`https://serula.site/${slug}/`);
    }
    expect(xml).toContain('https://serula.site/nesting-rehberi/');
    expect(xml).toContain('<lastmod>2026-11-20</lastmod>');
    expect(xml).toContain('https://serula.site/</loc>');
    expect(xml).not.toContain('/admin');
  });

  it('nesting guide offers useful indexable steps and structured Article information',()=>{
    const html=read('../nesting-rehberi/index.html');
    expect(html).toContain('<h1>Nesting nasıl yapılır? DXF yerleştirme rehberi</h1>');
    expect(html).toContain('<link rel="canonical" href="https://serula.site/nesting-rehberi/">');
    expect(html).toContain('content="index,follow"');
    expect(html).toContain('href="/dxf-nesting/"');
    expect(html).toContain('href="/lazer-kesim-nesting/"');
    expect(html).toContain('href="/cnc-nesting/"');
    expect(html).not.toContain('script src=');
    const ld=JSON.parse(html.match(/<script type="application\/ld\+json">(.+?)<\/script>/s)?.[1]??'null');
    expect(ld['@graph']).toEqual(expect.arrayContaining([
      expect.objectContaining({'@type':'Article',inLanguage:'tr',mainEntityOfPage:'https://serula.site/nesting-rehberi/'}),
      expect.objectContaining({'@type':'BreadcrumbList'}),
    ]));
  });

  it('all topic pages link directly to the public nesting guide',()=>{
    for(const slug of cases.map(([s])=>s)){
      expect(read(`../${slug}/index.html`)).toContain('<a href="/nesting-rehberi/">Nesting rehberi</a>');
    }
  });

  it('main app has structured data with no invented price or reviews',()=>{
    const html=read('../index.html');
    const data=JSON.parse(html.match(/<script type="application\/ld\+json">(.+?)<\/script>/s)?.[1]??'null');
    expect(data['@graph']).toEqual(expect.arrayContaining([
      expect.objectContaining({'@type':'WebSite',url:'https://serula.site/'}),
      expect.objectContaining({'@type':'SoftwareApplication',name:'Serula Nesting Pro'}),
    ]));
    expect(html).toContain('<link rel="canonical" href="https://serula.site/">');
    expect(html).not.toContain('aggregateRating');
  });

  it('admin module and admin CSS load only behind admin route',()=>{
    const main=read('../src/main.tsx');
    const admin=read('../src/Admin.tsx');
    expect(main).toContain("lazy(() => import('./Admin'))");
    expect(main).not.toContain("import Admin from './Admin'");
    expect(main).not.toContain("import './admin-compact-controls.css'");
    expect(admin).toContain("import './admin-compact-controls.css'");
  });

  it('Vite builds the public pages separately without changing the editor entry',()=>{
    const config=read('../vite.config.ts');
    expect(config).toContain("app:'index.html'");
    for(const slug of [...cases.map(([s])=>s),'nesting-rehberi'])expect(config).toContain(`'${slug}/index.html'`);
  });
});
