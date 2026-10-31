import http from 'http'; import fs from 'fs'; import path from 'path';
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.xml':'application/xml','.txt':'text/plain'};
export function serve(root, port=0){
  return new Promise(res=>{
    const srv=http.createServer((req,resp)=>{
      let p=decodeURIComponent(new URL(req.url,'http://x').pathname);
      let f=path.join(root,p); if(!f.startsWith(root)) {resp.writeHead(403);return resp.end();}
      if(fs.existsSync(f)&&fs.statSync(f).isDirectory()) f=path.join(f,'index.html');
      if(!fs.existsSync(f)){ resp.writeHead(404,{'content-type':'text/html'}); return resp.end(fs.readFileSync(path.join(root,'404.html'))); }
      resp.writeHead(200,{'content-type':TYPES[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(resp);
    });
    srv.listen(port,'127.0.0.1',()=>res({srv,url:`http://localhost:${srv.address().port}`}));
  });
}
