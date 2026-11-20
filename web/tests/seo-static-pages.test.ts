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

  it('pre-renders a visible product summary and crawlable links before React boots',()=>{
    const html=read('../index.html');
    expect(html).toContain('<h1>Serula Nesting Pro: DXF nesting ve otomatik parça yerleştirme</h1>');
    expect(html).toContain('aria-label="Nesting bilgileri"');
    expect(html).toContain('DXF, SVG veya PLT');
    for(const slug of [...cases.map(([s])=>s),'nesting-rehberi']){
      expect(html).toContain(`href="/${slug}/"`);
    }
    expect(html).toContain('<div id="root">');
    expect(html).toContain('src="/src/main.tsx"');
  });

  it('serves the required IndexNow key as a plain static asset',()=>{
    const key='188fe1a1a113422da8ec84b424ab172c';
    expect(read(`../public/${key}.txt`)).toBe(key);
  });

  it('explains nesting and practical production steps in the initial HTML',()=>{
    const html=read('../index.html');
    expect(html).toContain('<h2 id="seo-nesting-is">Nesting nedir, Serula ne işe yarar?</h2>');
    expect(html).toContain('<h2 id="seo-workflow">DXF yerleştirme nasıl yapılır?</h2>');
    expect(html).toContain('<h2 id="seo-use-cases">Hangi üretim işlerinde kullanılabilir?</h2>');
    expect(html).toContain('kesim veya CAM yazılımınızda tekrar açarak');
    expect(html).toContain('belirli bir tasarruf oranı garanti edilmez');
    expect(html).toContain('<noscript>Serula Nesting kullanmak için JavaScript etkin olmalıdır.</noscript>');
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
