/** Existing same-origin billing contract; never download before authorization. */
export async function authorizeExport(projectName:string,sourceFileName:string,fileName:string,dxf:string,projectJson:string){
  const response=await fetch('/api/export/authorize',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({projectName,sourceFileName,fileName,dxf,projectJson})});
  const data=await response.json().catch(()=>({}));
  if(response.status===401){window.dispatchEvent(new Event('serula-login-required'));throw Error(data.error||'DXF indirmek için giriş yapmalısınız.')}
  if(response.status===402)throw Error((data.error||'Nesting hakkınız kalmadı.')+' Yeni hak için m93hasan@icloud.com veya +90 539 348 06 22 üzerinden iletişime geçebilirsiniz.');
  if(!response.ok)throw Error(data.error||'İndirme yetkisi alınamadı.');
  return data;
}
