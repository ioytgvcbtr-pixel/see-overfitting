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
 await page.goto('/');await expect(page.getByRole('heading',{name:/把模型，.*亲手跑明白。/})).toBeVisible();
 await exampleRun(page,'回归任务','混凝土','tree_r');
 await page.getByRole('tab',{name:'预测机制',exact:true}).click();await expect(page.locator('.pp-tree-nodes')).toBeVisible();
 await page.getByRole('tab',{name:'边界/条件切片',exact:true}).click();await page.getByRole('button',{name:'计算当前条件视图',exact:true}).click();await expect(page.locator('.pp-chart figcaption').filter({hasText:'条件切片'})).toBeVisible({timeout:45000});
 await page.getByRole('button',{name:'7 对照解释',exact:true}).click();await page.getByRole('button',{name:'生成可执行建议',exact:true}).click();await expect(page.getByRole('button',{name:'采用并训练这项建议',exact:true})).toBeVisible();await page.getByRole('button',{name:'采用并训练这项建议',exact:true}).click();
 await expect(page.getByRole('button',{name:'带着这个结果再验证',exact:true})).toBeEnabled({timeout:45000});await page.getByRole('button',{name:'带着这个结果再验证',exact:true}).click();
 const quiz=page.getByRole('region',{name:'新情境迁移验证'});await expect(quiz).toBeVisible({timeout:45000});await expect(quiz.getByText('选择依据',{exact:true})).toHaveCount(0);await quiz.locator('fieldset button').first().click();await quiz.getByRole('button',{name:'锁定判断，选择依据',exact:true}).click();await expect(quiz.getByText('选择依据',{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByRole('heading',{name:'对照解释',exact:true})).toBeVisible();await expect(page.getByText('已锁定：',{exact:false})).toBeVisible();
 await page.screenshot({path:'artifacts/local/playwright-results/planet-desktop.png',fullPage:true,animations:'disabled'});
});
test('mobile classroom keeps blank split fields, working model choices and no overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await exampleRun(page,'分类任务','企鹅','tree_c');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 await page.getByRole('button',{name:'4 划分数据',exact:true}).click();await expect(page.getByLabel('训练比例 %',{exact:false})).toHaveValue('60');
 await page.getByRole('button',{name:'5 模型参数',exact:true}).click();await page.locator('.pp-mobile-model select').selectOption('knn_c');await expect(page.locator('.pp-parameter-form input').first()).toHaveValue('');
 await page.screenshot({path:'artifacts/local/playwright-results/planet-mobile.png',fullPage:true,animations:'disabled'});
});

test('unified workshop preserves a student draft and context colors without a document reload',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'分类任务',exact:true}).click();
 await expect(page.locator('.planet-app')).toHaveAttribute('data-palette','lagoon');
 await page.getByRole('button',{name:/企鹅物种识别/}).click();await page.getByRole('button',{name:'4 划分数据',exact:true}).click();
 await page.getByLabel('训练比例 %',{exact:true}).fill('61');
 const origin=await page.evaluate(()=>performance.timeOrigin);
 await page.getByRole('button',{name:'模型机制工坊',exact:true}).click();await page.getByRole('button',{name:'概念工坊',exact:true}).click();await page.getByRole('button',{name:'约束的形状',exact:true}).click();
 await expect(page.getByRole('slider',{name:'工坊正则化强度α',exact:true})).toBeVisible();
 await expect(page.locator('main')).toHaveCount(1);await expect(page.locator('.sidebar')).toHaveCount(0);await expect(page.locator('iframe')).toHaveCount(0);
 await page.getByRole('button',{name:'开始学习',exact:true}).click();await page.getByRole('button',{name:/继续 企鹅/}).click();
 await expect(page.getByLabel('训练比例 %',{exact:true})).toHaveValue('61');expect(await page.evaluate(()=>performance.timeOrigin)).toBe(origin);
 await page.getByLabel('训练比例 %',{exact:true}).fill('60');
 const alignment=await page.locator('.pp-form-grid').first().evaluate(e=>{const inputs=[...e.querySelectorAll('.pp-field')].slice(0,2).map(v=>v.querySelector('input,select').getBoundingClientRect());return Math.abs(inputs[0].top-inputs[1].top);});expect(alignment).toBeLessThan(1);
 await page.getByText('外观',{exact:true}).click();await page.getByRole('button',{name:'晴空蓝',exact:true}).click();await expect(page.locator('.planet-app')).toHaveAttribute('data-palette','sky');
 await page.reload();await expect(page.locator('.planet-app')).toHaveAttribute('data-palette','sky');await expect(page.getByLabel('训练比例 %',{exact:true})).toHaveValue('60');
});


test('task cards align actions and six palettes leave the main page within the viewport',async({page})=>{
 await page.goto('/#classroom/classification');await expect(page.locator('.pp-task-card')).toHaveCount(5);
 const rows=await page.locator('.pp-task-card').evaluateAll(cards=>cards.map(e=>({top:e.getBoundingClientRect().top,action:e.querySelector('.pp-card-action').getBoundingClientRect().top})));
 for(const card of rows)for(const peer of rows.filter(v=>Math.abs(v.top-card.top)<1))expect(Math.abs(card.action-peer.action)).toBeLessThan(1);
 await page.getByText('外观',{exact:true}).click();
 for(const name of ['鸢尾紫','海湾青','杏子橙','晴空蓝','森林绿','星空靛']){await page.getByRole('button',{name,exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);}
 await page.getByRole('button',{name:'跟随学习场景',exact:true}).click();await expect(page.locator('.planet-app')).toHaveAttribute('data-palette','lagoon');
});

test('learning route persists understanding and experiment edits without student data upload',async({page})=>{
 await page.goto('/');await expect(page.getByText(/机制基础课.*3/)).toHaveCount(0);
 await page.getByRole('button',{name:'学习航线',exact:true}).click();await page.getByRole('button',{name:'从什么是机器学习开始',exact:true}).click();
 await expect(page.getByRole('heading',{name:'什么是机器学习？',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'读完了，做个小检查',exact:true}).click();await page.getByRole('button',{name:'输入信息与要预测的目标',exact:true}).click();await page.getByRole('button',{name:'保存判断并核对',exact:true}).click();
 await expect(page.getByText('检查通过，本课增加一格。',{exact:true})).toBeVisible();await page.reload();await expect(page.getByText('本课已完成',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'我的学习记录',exact:true}).click();await expect(page.getByRole('progressbar',{name:'知识航线',exact:true})).toHaveAttribute('aria-valuenow','1');
 await page.getByRole('button',{name:'分类任务',exact:true}).click();await expect(page.getByRole('button',{name:'导入一份CSV',exact:true})).toHaveCount(0);await expect(page.locator('input[accept*=csv]')).toHaveCount(0);
 await page.getByRole('button',{name:/企鹅物种识别/}).click();await page.getByRole('button',{name:'4 划分数据',exact:true}).click();await page.getByLabel('训练比例 %',{exact:true}).fill('62');await page.getByLabel('验证比例 %',{exact:true}).click();
 await page.getByRole('button',{name:'我的学习记录',exact:true}).click();await page.getByRole('button',{name:'实验操作',exact:true}).click();await expect(page.getByRole('heading',{name:'修改实验配置',exact:true}).first()).toBeVisible();
 await page.getByText(/查看\d+项选择变化/).first().click();await expect(page.getByText('训练比例',{exact:true}).first()).toBeVisible();
 await page.screenshot({path:'artifacts/local/playwright-results/study-records.png',fullPage:true,animations:'disabled'});
});

test('all completed lessons fill every progress segment green',async({page,request})=>{
 const answers=[1,2,0,1,0,2,1,2,0,2,1,0,2,0,1,2,1,0];
 const response=await request.get('http://127.0.0.1:3002/api/study/overview');const overview=await response.json();
 for(let i=0;i<overview.lessons.length;i++){const id=overview.lessons[i].id;await request.post(`http://127.0.0.1:3002/api/study/lessons/${id}/open`,{data:{}});await request.post(`http://127.0.0.1:3002/api/study/lessons/${id}/read`,{data:{}});const a=await request.post(`http://127.0.0.1:3002/api/study/lessons/${id}/answer`,{data:{id:crypto.randomUUID().replaceAll('-',''),choice:`${id}-${answers[i]}`}});expect(a.ok()).toBe(true);}
 await page.goto('/#classroom/learning');const meter=page.getByRole('progressbar',{name:'知识航线',exact:true});await expect(meter).toHaveAttribute('aria-valuenow','18');await expect(page.locator('.pp-learning-progress.is-complete')).toBeVisible();await expect(page.locator('.pp-segment-meter>span[data-state=done]')).toHaveCount(18);
 await expect(page.locator('.pp-segment-meter>span').last()).toHaveCSS('background-color','rgb(45, 113, 79)');
});
