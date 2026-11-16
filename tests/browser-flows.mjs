import assert from 'node:assert/strict';

// Shared semantic flow: CUA tab adapter locally, Playwright page in hosted CI.
export async function autonomousGarden(tab,onCheckpoint=async()=>{}) {
  const p=tab.playwright;
  await p.getByRole('button',{name:'概念工坊',exact:true}).click();
  await p.getByRole('button',{name:'约束的形状'}).click();
  const learning=p.getByRole('region',{name:'约束花园学习挑战',exact:true});
  await learning.getByRole('button',{name:'自主寻找反例',exact:true}).click();
  await p.getByRole('combobox',{name:'首轮计划α',exact:true}).selectOption('0.1');
  await onCheckpoint('prediction');
  await learning.getByRole('button',{name:'降低',exact:true}).click();
  await learning.getByRole('button',{name:'锁定预测，开始实验'}).click();
  await learning.getByRole('button',{name:'核验这次实验',exact:true}).waitFor({state:'visible'});
  await onCheckpoint('experiment');
  const slider=p.getByRole('slider',{name:'工坊正则化强度α',exact:true});
  await p.getByRole('status',{name:'工坊正则化强度α 2',exact:true}).waitFor({state:'visible'});
  for(let i=3;i<=4;i++) {
    await slider.press('ArrowRight');
    await p.getByRole('status',{name:`工坊正则化强度α ${i}`,exact:true}).waitFor({state:'visible'});
  }
  await learning.getByRole('button',{name:'核验这次实验',exact:true}).click();
  await learning.getByText('已核验 1 次',{exact:true}).waitFor({state:'visible'});
  await onCheckpoint('first-trial');
  await tab.reload();
  await learning.getByRole('button',{name:'继续学习',exact:true}).click();
  await learning.getByText('已核验 1 次',{exact:true}).waitFor({state:'visible'});
  await slider.press('End');
  await learning.getByRole('button',{name:'核验这次实验',exact:true}).click();
  await learning.getByText('自主反例已通过实算核验',{exact:true}).waitFor({state:'visible'});
  await onCheckpoint('review');
  await learning.getByRole('button',{name:'去新数据里验证'}).click();
  await p.getByLabel('本题实测观测',{exact:true}).getByRole('img').first().waitFor({state:'visible'});
  assert.equal(await p.getByLabel('本题实测观测',{exact:true}).count(),1);
  const scenes=p.locator('.transfer-scene-switch button');
  await scenes.last().click();
  assert.equal(await scenes.last().getAttribute('aria-pressed'),'true');
  await scenes.first().click();
  await p.getByText('已实算',{exact:true}).waitFor({state:'visible'});
  const expectedValue=Number(await p.locator('.transfer-observation-plots figure').nth(1).locator('.transfer-observation-row strong').nth(0).innerText());
  const sceneValue=Number(await p.locator('[data-evidence="validation"] b').innerText());
  assert.ok(Math.abs(expectedValue-sceneValue)<.00011,'new-seed observations must match the inspected scene');
  await onCheckpoint('transfer');
  // Leave a draft and restore it before the immutable first answer.
  await learning.locator('.island-answer-options button').nth(0).click();
  const firstChoice=await learning.locator('.island-answer-options button').nth(0).innerText();
  const lock=learning.getByRole('button',{name:'锁定判断，选择依据',exact:true});
  const twoStep=await lock.count()===1;
  if(twoStep)await lock.click();
  await learning.locator('.island-reason-options button').nth(0).click();
  await learning.getByRole('button',{name:'暂存学习，继续探索'}).click();
  await tab.reload();
  await learning.getByRole('button',{name:'继续学习',exact:true}).click();
  if(twoStep)assert.match(await learning.locator('.island-locked-decision').innerText(),new RegExp(firstChoice));
  else assert.equal(await learning.locator('.island-answer-options button').nth(0).getAttribute('aria-pressed'),'true');
  await learning.getByRole('button',{name:'提交判断与依据'}).click();
  await learning.getByText('首次迁移：',{exact:false}).waitFor({state:'visible'});
  await onCheckpoint('complete');
  const result=await learning.innerText();
  assert.match(result,/首次迁移/);
  return {flow:'autonomous-garden-and-transfer-draft',passed:true};
}

export async function offlineSettings(tab) {
  const p=tab.playwright;
  await p.getByRole('button',{name:'设置与数据',exact:true}).click();
  await p.getByRole('button',{name:'测试AI连接',exact:true}).waitFor({state:'visible'});
  const text=await p.getByRole('main').innerText();
  assert.match(text,/规则|未配置|关闭/);
  assert.doesNotMatch(text,/sk-[a-zA-Z0-9_-]{12,}/);
  return {flow:'offline-settings-no-credential-echo',passed:true};
}

export async function gardenCausality(tab){
  const p=tab.playwright;
  await p.getByRole('button',{name:'概念工坊',exact:true}).click();
  await p.getByRole('button',{name:'约束的形状',exact:true}).click();
  const alpha=p.getByRole('slider',{name:'工坊正则化强度α',exact:true});
  await alpha.waitFor({state:'visible'});
  const layout=await p.evaluate(()=>{const input=document.querySelector('input[aria-label="工坊正则化强度α"]');const r=input.getBoundingClientRect();return{height:innerHeight,bottom:r.bottom,overflow:document.documentElement.scrollWidth>innerWidth+1};});
  assert.ok(!layout.overflow);
  assert.ok(layout.bottom<layout.height,'primary alpha control should be in the first desktop viewport');
  await p.getByRole('button',{name:/查看第\d+项对预测的贡献/}).first().press('Enter');
  await p.getByText(/第\d+项怎样影响曲线/).waitFor({state:'visible'});
  const select=p.getByRole('combobox',{name:'选择验证探针',exact:true});
  await select.selectOption('0');
  const before=await p.locator('.garden-probe-readout').innerText();
  const metric=await p.locator('[data-evidence="validation"] b').innerText();
  await p.getByRole('slider',{name:'验证探针位置',exact:true}).press('ArrowRight');
  assert.equal(await select.evaluate(el=>el.value),'1');
  assert.notEqual(await p.locator('.garden-probe-readout').innerText(),before);
  assert.equal(await p.locator('[data-evidence="validation"] b').innerText(),metric,'probe movement must not retrain or change aggregate MSE');
  await alpha.press('End');
  await p.getByRole('status',{name:'工坊正则化强度α 7',exact:true}).waitFor({state:'visible'});
  await p.getByText('已实算',{exact:true}).waitFor({state:'visible'});
  await p.getByRole('button',{name:'重设局部刻度',exact:true}).press('Enter');
  assert.equal(await p.getByRole('img',{name:/弱约束范数/}).count(),1);
  return {flow:'garden-contribution-probe-and-first-screen',passed:true,layout};
}

export async function aiTransfer(tab){
  await autonomousGarden(tab);
  const p=tab.playwright,learning=p.getByRole('region',{name:'约束花园学习挑战',exact:true});
  const original=await learning.getByText('首次迁移：',{exact:false}).innerText();
  await learning.locator('.island-ai-tool summary').click();
  await learning.getByRole('button',{name:'生成可执行方案',exact:true}).click();
  await learning.getByRole('button',{name:'执行这项操作',exact:true}).click();
  await learning.getByRole('button',{name:'带着这个结果再验证',exact:false}).click();
  await learning.getByText('这次独立检验：',{exact:false}).waitFor({state:'visible'});
  assert.equal(await learning.locator('.island-reason-options button').count(),0);
  await learning.locator('.island-answer-options button').nth(0).click();
  await learning.getByRole('button',{name:'锁定判断，选择依据',exact:true}).click();
  await learning.locator('.island-reason-options button').nth(0).click();
  await learning.getByRole('button',{name:'提交判断与依据',exact:false}).click();
  await learning.getByRole('button',{name:'返回原学习记录',exact:true}).click();
  await learning.getByText(original,{exact:true}).waitFor({state:'visible'});
  assert.equal(await learning.getByText('首次迁移：',{exact:false}).innerText(),original);
  return {flow:'ai-result-to-new-marked-transfer',passed:true};
}
