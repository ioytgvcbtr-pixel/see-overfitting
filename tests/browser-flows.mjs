import assert from 'node:assert/strict';

// Shared semantic flow: CUA tab adapter locally, Playwright page in hosted CI.
export async function autonomousGarden(tab) {
  const p=tab.playwright;
  await p.getByRole('button',{name:'概念工坊',exact:true}).click();
  await p.getByRole('button',{name:'约束的形状'}).click();
  const learning=p.getByRole('region',{name:'约束花园学习挑战',exact:true});
  await learning.getByRole('button',{name:'自主寻找反例',exact:true}).click();
  await p.getByRole('combobox',{name:'首轮计划α',exact:true}).selectOption('0.1');
  await learning.getByRole('button',{name:'降低',exact:true}).click();
  await learning.getByRole('button',{name:'锁定预测，开始实验'}).click();
  await learning.getByRole('button',{name:'核验这次实验',exact:true}).waitFor({state:'visible'});
  const slider=p.getByRole('slider',{name:'工坊正则化强度α',exact:true});
  await p.getByRole('status',{name:'工坊正则化强度α 2',exact:true}).waitFor({state:'visible'});
  for(let i=3;i<=4;i++) {
    await slider.press('ArrowRight');
    await p.getByRole('status',{name:`工坊正则化强度α ${i}`,exact:true}).waitFor({state:'visible'});
  }
  await learning.getByRole('button',{name:'核验这次实验',exact:true}).click();
  await learning.getByText('已核验 1 次',{exact:true}).waitFor({state:'visible'});
  await tab.reload();
  await learning.getByRole('button',{name:'继续学习',exact:true}).click();
  await learning.getByText('已核验 1 次',{exact:true}).waitFor({state:'visible'});
  await slider.press('End');
  await learning.getByRole('button',{name:'核验这次实验',exact:true}).click();
  await learning.getByText('自主反例已通过实算核验',{exact:true}).waitFor({state:'visible'});
  await learning.getByRole('button',{name:'去新数据里验证'}).click();
  await learning.getByRole('img').first().waitFor({state:'visible'});
  assert.equal(await learning.getByLabel('本题实测观测',{exact:true}).count(),1);
  // Leave a draft and restore it before the immutable first answer.
  await learning.getByRole('button',{name:'降低',exact:true}).click();
  await learning.locator('.island-reason-options button').nth(0).click();
  await learning.getByRole('button',{name:'暂存学习，继续探索'}).click();
  await tab.reload();
  await learning.getByRole('button',{name:'继续学习',exact:true}).click();
  assert.equal(await learning.getByRole('button',{name:'降低',exact:true}).getAttribute('aria-pressed'),'true');
  await learning.getByRole('button',{name:'提交判断与依据'}).click();
  await learning.getByText('首次迁移：',{exact:false}).waitFor({state:'visible'});
  const result=await learning.innerText();
  assert.match(result,/首次迁移/);
  return {flow:'autonomous-garden-and-transfer-draft',passed:true};
}

export async function offlineSettings(tab) {
  const p=tab.playwright;
  await p.getByRole('button',{name:'设置与数据',exact:true}).click();
  const text=await p.getByRole('main').innerText();
  assert.match(text,/规则|未配置|关闭/);
  assert.doesNotMatch(text,/sk-[a-zA-Z0-9_-]{12,}/);
  return {flow:'offline-settings-no-credential-echo',passed:true};
}
