"use client";
import {useEffect,useState} from "react";
import {ArrowDownToLine,Check,Copy,FlaskConical,KeyRound,LoaderCircle,RefreshCw,Save,Upload} from "lucide-react";
import {api} from "@/lib/experiment";
import {connectionLabel,workspaceChanged,type ConnectionStatus} from "@/lib/workspace";
import HelpHint from "./HelpHint";

type Config={base_url:string;model:string;enabled:boolean;key_configured:boolean;timeout:number;max_tokens:number;reasoning_effort:string;connection:ConnectionStatus};
type ImportPreview={new:number;existing:number;recomputed:boolean;by_type:Record<string,number>};

export default function WorkspaceSettings(){
  const [config,setConfig]=useState<Config|null>(null),[key,setKey]=useState("");
  const [busy,setBusy]=useState<string|null>(null),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const [retry,setRetry]=useState(0),[backupText,setBackupText]=useState("");
  const [dirty,setDirty]=useState(false);
  const [errorArea,setErrorArea]=useState<"ai"|"backup">("ai");
  const [file,setFile]=useState<{name:string;payload:unknown}|null>(null),[preview,setPreview]=useState<ImportPreview|null>(null);
  useEffect(()=>{
    const abort=new AbortController();setError("");
    api<Config>("/workspace/settings",undefined,abort.signal).then(setConfig).catch(e=>{if(e.name!=="AbortError")setError(e.message);});
    return()=>abort.abort();
  },[retry]);
  async function work(label:string,fn:()=>Promise<void>,area:"ai"|"backup"="ai"){setBusy(label);setErrorArea(area);setError("");setNotice("");try{await fn();}catch(e){setError((e as Error).message);}finally{setBusy(null);}}
  async function save(){if(!config)return;await work("保存设置",async()=>{
    const {connection:_connection,key_configured:_configured,reasoning_effort:_effort,...settings}=config;
    const value=await api<Config>("/workspace/settings",{...settings,api_key:key||undefined});
    setConfig(value);setKey("");setDirty(false);setNotice("设置已保存并生效。");workspaceChanged();
  });}
  return <section className="workspace-page settings-page" aria-label="设置与数据">
    <header className="workspace-page-heading"><h1>设置与学习数据</h1><p>检查AI连接，备份和恢复学习记录。</p></header>
    {error&&<div className="workspace-notice error" role="alert"><p>{error}</p>{errorArea==="backup"?<button className="text-button" disabled={!!busy} onClick={()=>document.querySelector<HTMLInputElement>('.workspace-page input[type="file"]')?.click()}><Upload size={20}/>重新选择备份</button>:!config&&<button className="text-button" disabled={!!busy} onClick={()=>setRetry(n=>n+1)}><RefreshCw size={20}/>重新读取设置</button>}</div>}
    {notice&&<p className="workspace-notice" role="status"><Check size={20}/>{notice}</p>}
    {busy&&<p className="workspace-pending" role="status"><LoaderCircle size={20} className="spin"/>{busy}…</p>}
    <div className="workspace-settings-grid">
      <section className="workspace-setting-section" aria-labelledby="ai-settings-title">
        <div className="workspace-section-heading"><KeyRound size={24}/><h2 id="ai-settings-title">AI讲解</h2><HelpHint title="关于连接测试"><p>沿用本机已有配置。连接测试会向当前服务发送一次简短请求；模型密钥不会被读回页面或包含在学习备份中。实验核心无需AI连接。</p></HelpHint></div>
        {!config?<p>正在读取本机设置…</p>:<>
          <div className="workspace-connection"><strong>{connectionLabel(config.connection)}</strong><p>{config.connection.notice}</p>
            {config.connection.checked_at&&<span>最近测试 {new Date(config.connection.checked_at).toLocaleString("zh-CN")}</span>}
          </div>
          <button className="button secondary" disabled={!!busy||dirty||!config.enabled||!config.key_configured} onClick={()=>void work("测试AI连接",async()=>{
            const connection=await api<ConnectionStatus>("/workspace/settings/test",{});setConfig({...config,connection});workspaceChanged();
          })}><FlaskConical size={20}/>测试AI连接</button>
          <details className="workspace-advanced"><summary>调整模型连接</summary>
            <label className="workspace-toggle"><input type="checkbox" checked={config.enabled} onChange={e=>{setConfig({...config,enabled:e.target.checked});setDirty(true);}} disabled={!!busy}/>启用AI讲解</label>
            <label className="workspace-field">服务地址<input type="url" value={config.base_url} onChange={e=>{setConfig({...config,base_url:e.target.value});setDirty(true);}} disabled={!!busy}/></label>
            <label className="workspace-field">模型名称<input value={config.model} onChange={e=>{setConfig({...config,model:e.target.value});setDirty(true);}} disabled={!!busy}/></label>
            <label className="workspace-field">{config.key_configured?"更新密钥（留空保留）":"模型密钥"}<input type="password" autoComplete="off" value={key} onChange={e=>{setKey(e.target.value);setDirty(true);}} disabled={!!busy}/></label>
            {dirty&&<p className="workspace-small">先保存修改，再测试连接。</p>}
            <p className="workspace-small">思考强度 xhigh</p>
            <button className="button primary" disabled={!!busy} onClick={()=>void save()}><Save size={20}/>保存设置</button>
          </details>
        </>}
      </section>
      <section className="workspace-setting-section" aria-labelledby="backup-title">
        <div className="workspace-section-heading"><ArrowDownToLine size={24}/><h2 id="backup-title">学习备份</h2><HelpHint title="会保存什么"><p>保存课程、四岛、AI方案及实验记录，排除模型配置和密钥。恢复前先校验并复算；已有同标识记录保持，导入记录注明来源。当前是本机学习工作区。</p></HelpHint></div>
        <p>把首答、发现和实验一起带走。</p>
        <div className="workspace-backup-actions"><a className="button secondary" href="/api/workspace/backup/file" download="fitlab-learning.json"><ArrowDownToLine size={20}/>下载学习备份</a>
        <button className="text-button" disabled={!!busy} onClick={()=>void work("生成学习备份",async()=>{
          const value=await api<unknown>("/workspace/backup");const text=JSON.stringify(value,null,2);setBackupText(text);
          setNotice("备份内容已生成，可在下方预览或复制。");
        },"backup")}>预览备份</button></div>
        {backupText&&<details className="workspace-advanced"><summary>预览或复制备份</summary><textarea aria-label="学习备份内容" readOnly value={backupText} rows={6}/><button className="text-button" onClick={()=>void work("复制备份",async()=>{await navigator.clipboard.writeText(backupText);setNotice("备份内容已复制。");},"backup")}><Copy size={20}/>复制备份内容</button></details>}
        <div className="workspace-restore">
          <h3>恢复已有学习</h3>
          <label className="workspace-file"><Upload size={20}/><span>{file?.name??"选择学习备份"}</span><input type="file" aria-label="选择学习备份" accept=".json,application/json" disabled={!!busy} onChange={async e=>{
            setPreview(null);setFile(null);setError("");setErrorArea("backup");const value=e.target.files?.[0];e.currentTarget.value="";if(!value)return;
            if(value.size>16*1024*1024){setError("备份超过16MB，请选择较小的学习备份。");return;}
            try{setFile({name:value.name,payload:JSON.parse(await value.text())});}catch{setError("没有读到有效JSON，请重新选择学习备份。");}
          }}/></label>
          {file&&<button className="button secondary" disabled={!!busy} onClick={()=>void work("校验并复算备份",async()=>{setPreview(await api<ImportPreview>("/workspace/backup/preview",file.payload));},"backup")}>预览恢复</button>}
          {preview&&<div className="workspace-import-preview"><p>可恢复 <strong>{preview.new}</strong> 条；已有 <strong>{preview.existing}</strong> 条保持。</p><p className="workspace-small">数值已复算。导入来源会标明，原首答不会被覆盖。</p>
            <button className="button primary" disabled={!!busy||preview.new===0} onClick={()=>void work("恢复学习记录",async()=>{
              const result=await api<ImportPreview>("/workspace/backup/restore",file!.payload);setPreview(null);setFile(null);setNotice(`已恢复${result.new}条，已有${result.existing}条记录保持。`);workspaceChanged();
            },"backup")}><Upload size={20}/>恢复{preview.new}条记录</button>
          </div>}
        </div>
      </section>
    </div>
  </section>;
}
