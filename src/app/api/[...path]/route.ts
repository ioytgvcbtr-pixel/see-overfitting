export const dynamic = "force-dynamic";
async function proxy(request: Request, context: {params: Promise<{path:string[]}>}) {
  const origin = process.env.FITLAB_API_ORIGIN || "http://127.0.0.1:8000";
  if (!/^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(origin)) return Response.json({detail:"计算服务地址配置不正确。"},{status:503});
  const {path} = await context.params;
  const url = `${origin}/${path.map(encodeURIComponent).join("/")}${new URL(request.url).search}`;
  try {
    const response = await fetch(url, {method:request.method, headers:{"Content-Type":request.headers.get("Content-Type") || "application/json"},
      body:request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      signal:request.signal, cache:"no-store"});
    const headers = new Headers({"Cache-Control":"no-store"});
    for (const key of ["Content-Type","Content-Disposition"]) { const value=response.headers.get(key); if(value)headers.set(key,value); }
    return new Response(response.body,{status:response.status,headers});
  } catch { return Response.json({detail:"计算服务暂未连接，请检查启动状态后重试。"},{status:503}); }
}
export {proxy as GET,proxy as POST,proxy as HEAD};
