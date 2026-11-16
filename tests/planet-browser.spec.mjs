import {test,expect} from '@playwright/test';
async function nav(page,label){const menu=page.getByRole('button',{name:'展开导航',exact:true});if(await menu.isVisible())await menu.click();await page.getByRole('button',{name:label,exact:true}).click();}
async function exampleRun(page,task,card,model){
 await nav(page,task);await page.getByRole('button',{name:new RegExp(card)}).click();
 await page.getByRole('button',{name:'5 模型参数',exact:true}).click();
 if(await page.locator('.pp-mobile-model').isVisible())await page.locator('.pp-mobile-model select').selectOption(model);else await page.locator('.pp-model-radio').getByRole('button',{name:task==='分类任务'?'决策树分类':'决策树回归',exact:true}).click();
 await expect(page.locator('.pp-parameter-form input').first()).toHaveValue('');
 await page.getByText('需要一组可尝试的示例？',{exact:true}).click();await page.getByRole('button',{name:'采用这组示例配置',exact:true}).click();
 await page.getByRole('button',{name:'去训练',exact:true}).click();await page.getByRole('button',{name:'暂不确定',exact:true}).click();await page.getByRole('button',{name:'训练这组配置',exact:true}).click();
 await expect(page.getByRole('region',{name:'真实训练结果'})).toBeVisible({timeout:45000});
}
test('Model Planet blank fields, real pipeline and paired AI transfer',async({page})=>{
 await page.goto('/');await expect(page.getByRole('heading',{name:'把模型，亲手跑明白。'})).toBeVisible();
 await exampleRun(page,'回归任务','混凝土','tree_r');
 await page.getByRole('tab',{name:'预测机制',exact:true}).click();await expect(page.locator('.pp-tree-nodes')).toBeVisible();
 await page.getByRole('tab',{name:'边界/条件切片',exact:true}).click();await page.getByRole('button',{name:'计算当前条件视图',exact:true}).click();await expect(page.locator('.pp-chart figcaption').filter({hasText:'条件切片'})).toBeVisible({timeout:45000});
 await page.getByRole('button',{name:'7 对照解释',exact:true}).click();await page.getByRole('button',{name:'生成可执行建议',exact:true}).click();await expect(page.getByRole('button',{name:'采用并训练这项建议',exact:true})).toBeVisible();await page.getByRole('button',{name:'采用并训练这项建议',exact:true}).click();
 await expect(page.getByRole('button',{name:'带着这个结果再验证',exact:true})).toBeEnabled({timeout:45000});await page.getByRole('button',{name:'带着这个结果再验证',exact:true}).click();
 const quiz=page.getByRole('region',{name:'新情境迁移验证'});await expect(quiz).toBeVisible({timeout:45000});await expect(quiz.getByText('选择依据',{exact:true})).toHaveCount(0);await quiz.locator('fieldset button').first().click();await quiz.getByRole('button',{name:'锁定判断，选择依据',exact:true}).click();await expect(quiz.getByText('选择依据',{exact:true})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:/继续 混凝土/}).click();await expect(page.getByText('已锁定：',{exact:false})).toBeVisible();
 await page.screenshot({path:'artifacts/local/playwright-results/planet-desktop.png',fullPage:true,animations:'disabled'});
});
test('mobile classroom keeps blank split fields, working model choices and no overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await exampleRun(page,'分类任务','企鹅','tree_c');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 await page.getByRole('button',{name:'4 划分数据',exact:true}).click();await expect(page.getByLabel('训练比例 %',{exact:false})).toHaveValue('60');
 await page.getByRole('button',{name:'5 模型参数',exact:true}).click();await page.locator('.pp-mobile-model select').selectOption('knn_c');await expect(page.locator('.pp-parameter-form input').first()).toHaveValue('');
 await page.screenshot({path:'artifacts/local/playwright-results/planet-mobile.png',fullPage:true,animations:'disabled'});
});
