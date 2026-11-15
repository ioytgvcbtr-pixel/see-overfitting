import type { IslandTask } from "@/lib/island-learning";
import { proofNumber } from "@/lib/island-learning";
import HelpHint from "./HelpHint";

export default function TransferEvidence({task}:{task:IslandTask}) {
  const data=task.assessment;
  if (!data) return null;
  const format=(v:number)=>proofNumber(v,data.percent?"forest":"regularization");
  return <div className="transfer-observations" aria-label="本题实测观测">
    <div className="transfer-observation-title"><strong>这组数据告诉我们</strong><HelpHint title="怎样读观测图"><p>{data.note}柱长不能跨列比较；这些是题目观测，判断与依据仍由你选择。</p></HelpHint></div>
    <div className="transfer-observation-plots">{data.columns.map((column,c)=>{
      const max=Math.max(...data.rows.map(r=>r.values[c]),1e-12);
      return <figure key={column}><figcaption>{column}</figcaption>
        {data.rows.map((r,i)=><div className="transfer-observation-row" key={r.label}>
          <span>{r.label}</span><strong>{format(r.values[c])}</strong>
          <svg viewBox="0 0 240 12" role="img" aria-label={`${r.label}，${column} ${format(r.values[c])}`}>
            <rect width="240" height="12" rx="6" fill="var(--transfer-track)"/>
            <rect width={240*r.values[c]/max} height="12" rx="6" fill={c===0?"var(--transfer-blue)":c===1?"var(--transfer-orange)":"var(--transfer-green)"}/>
          </svg>
        </div>)}
      </figure>;
    })}</div>
    <details><summary>查看数值表</summary><div className="transfer-table-scroll"><table><thead><tr><th>条件</th>{data.columns.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{data.rows.map(r=><tr key={r.label}><th>{r.label}</th>{r.values.map((v,i)=><td key={i}>{format(v)}</td>)}</tr>)}</tbody></table></div></details>
  </div>;
}
