import type {Catalog,Model} from './planet';

export function mechanismDataset(catalog:Catalog,model:Model){
 const id=model.id==='poisson'?'bike':model.task==='classification'?'iris':'concrete';
 return catalog.datasets.find(d=>d.id===id)!;
}
export function mechanismControl(model:Model){
 const key=model.mechanism==='boundary'?'gamma':model.mechanism==='forest'?'n_estimators':model.mechanism==='boosting'?'n_estimators':null;
 return model.parameters.find(f=>f.key===key)||model.parameters[0];
}
export function mechanismQuestion(model:Model){
 if(model.id==='poisson')return '正则化改变后，计数预测的线性部分怎样变化？';
 return ({linear:'改变约束或截距，哪些系数与预测会变化？',neighbors:'改变K后，哪些真实邻居参与这次预测？',boundary:'改变γ后，同一支持向量的影响范围怎样变化？',tree:'改变树深后，样本会沿哪条真实路径到达叶子？',forest:'改变树的数量，完整集成与单树输出有何不同？',gaussian:'改变方差平滑，按类估计的密度会怎样变化？',boosting:'改变阶段数量，已训练集成的验证表现怎样变化？'} as Record<string,string>)[model.mechanism]||model.summary;
}
