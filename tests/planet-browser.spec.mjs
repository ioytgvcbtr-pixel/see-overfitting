import {test,expect} from '@playwright/test';
async function nav(page,label){const menu=page.getByRole('button',{name:'展开导航',exact:true});if(await menu.isVisible())await menu.click();await page.getByRole('button',{name:label,exact:true}).click();}
async function exampleRun(page,task,card,model){
 await nav(page,task);await page.getByRole('button',{name:new RegExp(card)}).click();
 await page.getByRole('button',{name:'5 模型参数',exact:true}).click();
 if(await page.locator('.pp-mobile-model').isVisible())await page.locator('.pp-mobile-model select').selectOption(model);else await page.locator('.pp-model-radio').getByRole('button',{name:({tree_c:'决策树分类',tree_r:'决策树回归',ridge:'岭回归',knn_c:'K近邻分类'})[model],exact:true}).click();
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
 const quiz=page.getByRole('region',{name:'新情境迁移验证'});await expect(quiz).toBeVisible({timeout:45000});await expect(quiz.getByText('选择依据',{exact:true})).toHaveCount(0);await quiz.getByRole('radio',{name:'A更低',exact:true}).check();await quiz.getByRole('button',{name:'锁定新情境判断',exact:true}).click();await expect(quiz.getByRole('heading',{name:'读完证据，再解释一次',exact:true})).toBeVisible();
 await page.reload();await expect(page.getByRole('heading',{name:'对照解释',exact:true})).toBeVisible();await expect(page.getByText('本题首答：',{exact:false})).toBeVisible();
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
 await page.getByRole('button',{name:'读完了，做个小检查',exact:true}).click();await page.getByRole('radio',{name:'用测量特征学习物种，在未参与训练的样本上评估',exact:true}).check();await page.getByRole('button',{name:'保存判断并核对',exact:true}).click();
 await expect(page.getByText('检查通过，学习进度已保存。',{exact:true})).toBeVisible();await page.reload();await expect(page.getByText('本课已完成',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'我的学习记录',exact:true}).click();await expect(page.getByRole('progressbar',{name:'知识航线',exact:true})).toHaveAttribute('aria-valuenow','1');
 await page.getByRole('button',{name:'分类任务',exact:true}).click();await expect(page.getByRole('button',{name:'导入一份CSV',exact:true})).toHaveCount(0);await expect(page.locator('input[accept*=csv]')).toHaveCount(0);
 await page.getByRole('button',{name:/企鹅物种识别/}).click();await page.getByRole('button',{name:'4 划分数据',exact:true}).click();await page.getByLabel('训练比例 %',{exact:true}).fill('62');await page.getByLabel('验证比例 %',{exact:true}).click();
 await page.getByRole('button',{name:'我的学习记录',exact:true}).click();await page.getByRole('button',{name:'实验操作',exact:true}).click();await expect(page.getByRole('heading',{name:'修改实验配置',exact:true}).first()).toBeVisible();
 await page.getByText(/查看\d+项选择变化/).first().click();await expect(page.getByText('训练比例',{exact:true}).first()).toBeVisible();
 await page.screenshot({path:'artifacts/local/playwright-results/study-records.png',fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:'模型机制工坊',exact:true}).click();await page.getByRole('button',{name:'查看机制学习记录',exact:true}).click();await expect(page.getByRole('progressbar',{name:'机制探索四站',exact:true})).toBeVisible();
});

test('all completed lessons fill every progress segment green',async({page,request})=>{
 const answers=[1,2,0,1,0,2,1,0,2,1,0,2,1,0,2,1,0,2];
 const response=await request.get('http://127.0.0.1:3002/api/study/overview');const overview=await response.json();
 for(let i=0;i<overview.lessons.length;i++){const id=overview.lessons[i].id;await request.post(`http://127.0.0.1:3002/api/study/lessons/${id}/open`,{data:{}});await request.post(`http://127.0.0.1:3002/api/study/lessons/${id}/read`,{data:{}});const a=await request.post(`http://127.0.0.1:3002/api/study/lessons/${id}/answer`,{data:{id:crypto.randomUUID().replaceAll('-',''),choice:`${id}-v2-${answers[i]}`}});expect(a.ok()).toBe(true);}
 await page.goto('/#classroom/learning');const meter=page.getByRole('progressbar',{name:'知识航线',exact:true});await expect(meter).toHaveAttribute('aria-valuenow','18');await expect(page.locator('.pp-learning-progress.is-complete')).toBeVisible();await expect(page.locator('.pp-segment-meter>span[data-state=done]')).toHaveCount(18);
 await expect(page.locator('.pp-segment-meter>span').last()).toHaveCSS('background-color','rgb(45, 113, 79)');
});

test('settings is independent and DeepSeek depth/key preferences save without echo',async({page})=>{
 await page.goto('/#settings');await expect(page.getByRole('heading',{name:'让学习，按你的节奏。',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'设置',exact:true})).toHaveAttribute('aria-current','page');await expect(page.locator('.pp-workshop:visible')).toHaveCount(0);
 await expect(page.getByLabel('DeepSeek模型',{exact:true})).toBeVisible();await expect(page.getByLabel('服务地址',{exact:true})).toHaveCount(0);
 await page.getByLabel('思考深度',{exact:true}).selectOption('low');await page.locator('#deepseek-new-key').fill('browser-fixture-key-not-real');await page.getByRole('button',{name:'保存AI设置',exact:true}).click();
 await expect(page.getByText('已保存，下一次AI请求会使用这份配置。',{exact:true})).toBeVisible();await expect(page.locator('#deepseek-new-key')).toHaveValue('');await expect(page.locator('body')).not.toContainText('browser-fixture-key-not-real');
 await page.reload();await expect(page.getByLabel('思考深度',{exact:true})).toHaveValue('low');
 await page.getByRole('button',{name:'返回学习',exact:true}).click();await expect(page).not.toHaveURL(/settings/);
});

test('space pet supports interaction, local answers, history and mobile placement',async({page,request})=>{
 await page.goto('/#classroom/start');const before=(await (await request.get('http://127.0.0.1:3002/api/study/overview')).json()).completed;
 await page.getByRole('button',{name:'和小模聊聊',exact:true}).click();const panel=page.getByRole('dialog',{name:'小模学习助手',exact:true});await expect(panel).toBeVisible();
 await panel.getByRole('button',{name:'投喂星光',exact:true}).click();await expect(panel.getByRole('status').filter({hasText:'收到了星光'})).toBeVisible();
 await panel.getByRole('textbox',{name:'向小模提问',exact:true}).fill('什么是过拟合？');await panel.getByRole('button',{name:'发送给小模',exact:true}).click();await expect(panel.locator('.pp-pet-answer-text')).toContainText('过拟合');await expect(panel.getByText('本地提示',{exact:true})).toBeVisible();
 expect((await (await request.get('http://127.0.0.1:3002/api/study/overview')).json()).completed).toBe(before);
 await panel.getByRole('button',{name:'关闭小模问答',exact:true}).click();await page.reload();await page.getByRole('button',{name:'和小模聊聊',exact:true}).click();await expect(panel.locator('.pp-pet-answer-text')).toContainText('过拟合');
 await panel.getByRole('button',{name:'关闭小模问答',exact:true}).click();await page.setViewportSize({width:390,height:844});await expect(page.getByRole('button',{name:'和小模聊聊',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 const target=await page.getByRole('button',{name:'和小模聊聊',exact:true}).boundingBox();expect(target.width).toBeGreaterThanOrEqual(44);expect(target.y).toBeLessThan(65);
 await page.getByRole('button',{name:'和小模聊聊',exact:true}).click();await expect(panel).toBeVisible();await expect(panel.getByRole('textbox',{name:'向小模提问',exact:true})).toBeVisible();
 await page.screenshot({path:'artifacts/local/playwright-results/pet-mobile.png',fullPage:true,animations:'disabled'});
});


test('course practice keeps its return path through mechanism and data tasks',async({page})=>{
 await page.goto('/#classroom/learning/ml-intro');await page.getByRole('button',{name:'去对应场景试一试',exact:true}).click();
 const ribbon=page.getByRole('complementary',{name:'课题实践',exact:true});await expect(ribbon).toContainText('什么是机器学习？');
 await ribbon.getByRole('button',{name:'回到原课题',exact:true}).click();await expect(page.getByRole('heading',{name:'什么是机器学习？',exact:true})).toBeVisible();
 await page.goto('/#classroom/learning/linear');await page.getByRole('button',{name:'进入Ridge系数实验',exact:true}).click();await expect(page.getByRole('slider',{name:'正则化强度 α调节',exact:true})).toBeVisible();await expect(ribbon).toContainText('从线性模型到正则化');
 await page.reload();await expect(ribbon).toContainText('从线性模型到正则化');await ribbon.getByRole('button',{name:'回到原课题',exact:true}).click();await expect(page.getByRole('heading',{name:'从线性模型到正则化',exact:true})).toBeVisible();
});

test('task filters and model search help students find an appropriate experiment',async({page})=>{
 await page.goto('/#classroom/classification');await page.getByRole('button',{name:'二分类',exact:true}).click();await expect(page.locator('.pp-task-card')).toHaveCount(1);await expect(page.locator('.pp-task-card')).toContainText('票据');
 await page.getByRole('button',{name:'多标签',exact:true}).click();await expect(page.locator('.pp-task-card')).toHaveCount(1);await expect(page.locator('.pp-task-card')).toContainText('多标签');
 await page.getByRole('button',{name:'模型图鉴',exact:true}).click();await page.getByRole('searchbox',{name:'搜索模型',exact:true}).fill('Ridge');await expect(page.locator('.pp-atlas>article')).toHaveCount(1);await expect(page.locator('.pp-atlas>article')).toContainText('岭回归');
 await page.getByRole('searchbox',{name:'搜索模型',exact:true}).fill('not-a-model');await expect(page.getByRole('button',{name:'清除搜索',exact:true})).toBeVisible();await page.getByRole('button',{name:'清除搜索',exact:true}).click();await expect(page.locator('.pp-atlas>article')).toHaveCount(17);
});

test('planet companion respects motion preferences and keeps interactions local',async({page,request})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('/#classroom/settings');const switcher=page.getByRole('switch',{name:/^待机动作/});await expect(switcher).toBeChecked();
 await expect(page.locator('.pp-pet-launcher>svg')).toHaveAttribute('data-animating','true');await switcher.uncheck();await expect(page.locator('.pp-pet-launcher>svg')).toHaveAttribute('data-animating','false');
 await page.reload();await expect(switcher).not.toBeChecked();await switcher.check();await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.pp-pet-launcher>svg')).toHaveAttribute('data-animating','false');await page.emulateMedia({reducedMotion:'no-preference'});await expect(page.locator('.pp-pet-launcher>svg')).toHaveAttribute('data-animating','true');await page.getByRole('button',{name:'和小模聊聊',exact:true}).click();const panel=page.getByRole('dialog',{name:'小模学习助手',exact:true});
 const before=(await(await request.get('http://127.0.0.1:3002/api/study/overview')).json()).completed;await panel.getByRole('button',{name:'卫星绕行',exact:true}).click();await expect(panel.locator('.pp-pet-panel-avatar>svg')).toHaveAttribute('data-mood','orbit');expect((await(await request.get('http://127.0.0.1:3002/api/study/overview')).json()).completed).toBe(before);
});

test('all model entries target their own mechanism and a real kernel run can be revised',async({page,request})=>{
 test.setTimeout(120000);
 const {models}=await(await request.get('http://127.0.0.1:3002/api/lab/catalog')).json();
 await page.goto('/#classroom/models');
 for(const model of models){
  const card=page.locator('.pp-atlas>article').filter({has:page.getByRole('heading',{name:model.title,exact:true})});
  await card.getByRole('button',{name:'先看预测机制',exact:true}).click();
  await expect(page).toHaveURL(new RegExp('/#classroom/model-mechanism/'+model.id+'$'));
  await expect(page.getByRole('article',{name:model.title+'机制实验',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'返回模型图鉴',exact:true}).click();
 }
 await page.locator('.pp-atlas>article').filter({has:page.getByRole('heading',{name:'RBF SVM',exact:true})}).getByRole('button',{name:'先看预测机制',exact:true}).click();
 await page.getByRole('button',{name:'训练机制示例',exact:true}).click();await expect(page.locator('.pp-kernel-bars')).toBeVisible({timeout:45000});
 await page.getByRole('spinbutton',{name:'核影响范围 γ',exact:true}).fill('0.2');await expect(page.getByRole('status').filter({hasText:'设置已修改'})).toBeVisible();
 await page.getByRole('button',{name:'按新设置重新训练',exact:true}).click();await expect(page.getByText('当前展示这次真实训练的结果。',{exact:true})).toBeVisible({timeout:45000});
 await page.reload();await expect(page.locator('.pp-kernel-bars')).toBeVisible();await expect(page.getByRole('spinbutton',{name:'核影响范围 γ',exact:true})).toHaveValue('0.2');
});

test('home gives one primary learning action and short screens keep step actions reachable',async({page})=>{
 await page.goto('/');await expect(page.locator('.pp-home-hero .pp-btn.primary')).toHaveCount(1);await expect(page.getByRole('heading',{name:'自由实验',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'分类任务',exact:true}).click();await page.getByRole('button',{name:/企鹅物种识别/}).click();await page.getByRole('button',{name:'5 模型参数',exact:true}).click();
 await page.locator('.pp-model-radio').getByRole('button',{name:'逻辑回归',exact:true}).click();await page.getByRole('textbox',{name:'误分/拟合惩罚 C',exact:true}).fill('2');
 await page.getByRole('button',{name:'打开逻辑回归示例课',exact:true}).click();await expect(page.getByRole('heading',{name:'逻辑回归',exact:true})).toBeVisible();await page.getByRole('button',{name:'返回当前实验',exact:true}).click();await expect(page.getByRole('textbox',{name:'误分/拟合惩罚 C',exact:true})).toHaveValue('2');
 for(const [width,height] of [[1366,768],[1024,768],[390,844]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));
  await expect(page.getByRole('navigation',{name:'实验步骤',exact:true}).getByRole('button',{name:'5 模型参数',exact:true})).toBeInViewport();const actions=page.getByRole('navigation',{name:'实验步骤操作',exact:true});const next=actions.getByRole('button',{name:'去训练',exact:true});await expect(next).toBeVisible();
  const box=await next.boundingBox();expect(box.y).toBeGreaterThanOrEqual(60);expect(box.y+box.height).toBeLessThan(height);expect(box.width).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await expect(next).toBeInViewport();
 }
});

test('floating companion preserves content width and columns on desktop and tablet',async({page})=>{
 test.setTimeout(120000);
 for(const width of [1440,1024]){
  await page.setViewportSize({width,height:900});
  for(const hash of ['start','classification','settings','model-mechanism/knn_c']){
   await page.goto('/#classroom/'+hash);await expect(page.locator(hash==='start'?'.pp-home-hero':hash==='classification'?'.pp-task-grid':hash==='settings'?'.pp-settings-columns':'.pp-model-lab')).toBeVisible();
   const main=page.locator('main'),before=await main.boundingBox();
   const columns=await page.locator('.pp-home-hero,.pp-task-grid,.pp-settings-columns,.pp-model-lab-layout').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().height).map(e=>getComputedStyle(e).gridTemplateColumns));
   await page.getByRole('button',{name:'和小模聊聊',exact:true}).click();const panel=page.getByRole('dialog',{name:'小模学习助手',exact:true});await expect(panel).toBeVisible();
   const after=await main.boundingBox();expect(Math.abs(after.width-before.width)).toBeLessThan(1);
   expect(await page.locator('.pp-home-hero,.pp-task-grid,.pp-settings-columns,.pp-model-lab-layout').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().height).map(e=>getComputedStyle(e).gridTemplateColumns))).toEqual(columns);
   if(await panel.getByRole('button',{name:'移到右侧',exact:true}).isVisible())await panel.getByRole('button',{name:'移到右侧',exact:true}).click();const right=await panel.boundingBox();expect(right.x+right.width).toBeLessThanOrEqual(width);expect(await panel.evaluate(e=>getComputedStyle(e).position)).toBe('fixed');
   await panel.getByRole('button',{name:'移到左侧',exact:true}).click();const left=await panel.boundingBox();expect(left.x).toBeLessThan(right.x);expect(Math.abs((await main.boundingBox()).width-before.width)).toBeLessThan(1);
   const handle=panel.getByRole('button',{name:'移动小模浮窗，方向键可调整位置',exact:true});await handle.focus();await handle.press('ArrowRight');expect((await panel.boundingBox()).x).toBeCloseTo(left.x+24,0);const shortHeight=(await panel.boundingBox()).height;await handle.press('Enter');expect((await panel.boundingBox()).height).toBeGreaterThan(shortHeight);expect(Math.abs((await main.boundingBox()).width-before.width)).toBeLessThan(1);await handle.press('Enter');
   await panel.getByRole('button',{name:'关闭小模问答',exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  }
 }
});

for(const {id,title,field,value,scene} of [{id:'knn_c',title:'K近邻分类',field:'邻居数 K',value:'17',scene:'.pp-neighbor-scene'},{id:'ridge',title:'岭回归',field:'正则化强度 α',value:'10',scene:'.pp-coefficient-scene'}]){
 test('representative lesson '+id+' preserves prediction evidence and transfers to a new context',async({page})=>{
  test.setTimeout(120000);await page.goto('/#classroom/model-mechanism/'+id);
  await expect(page.locator('.pp-mechanism-starter')).toBeVisible();await expect(page.getByRole('list',{name:'代表课学习闭环',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'训练机制示例',exact:true}).click();await expect(page.locator(scene)).toBeVisible({timeout:45000});
  if(id==='ridge')expect(await page.getByRole('slider',{name:field+'调节',exact:true}).getAttribute('min')).toBe('-6');
  await page.getByRole('combobox',{name:'验证样本',exact:true}).selectOption({index:1});await expect(page.getByRole('combobox',{name:'验证样本',exact:true})).toBeEnabled({timeout:45000});const originalRow=await page.getByRole('combobox',{name:'验证样本',exact:true}).inputValue();let focusedFeature=null;if(id==='ridge'){await page.getByRole('combobox',{name:'观察一个特征',exact:true}).selectOption({index:3});focusedFeature=await page.getByRole('combobox',{name:'观察一个特征',exact:true}).inputValue();}
  await page.getByRole('spinbutton',{name:field,exact:true}).fill(value);await expect(page.getByRole('button',{name:'锁定预测并训练B',exact:true})).toBeEnabled();
  await page.getByRole('radio',{name:'降低',exact:true}).check();await page.getByRole('button',{name:'锁定预测并训练B',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'验证样本',exact:true})).toBeEnabled({timeout:45000});await expect(page.getByRole('combobox',{name:'验证样本',exact:true})).toHaveValue(originalRow);if(focusedFeature)await expect(page.getByRole('combobox',{name:'观察一个特征',exact:true})).toHaveValue(focusedFeature);if(id==='knn_c'){const neighbor=page.getByRole('combobox',{name:'观察训练邻居',exact:true});await neighbor.selectOption({index:16});const row=await neighbor.inputValue();await expect(page.locator('.pp-neighbor-scene g[data-focused=true]')).toHaveAttribute('data-row',row);}
  const comparison=page.getByRole('region',{name:'机制受控对照',exact:true});await expect(comparison).toBeVisible({timeout:45000});await expect(comparison).toContainText('同一群体');await expect(comparison.getByRole('status')).toContainText(/预测与这次实算/);
  const diagnostic=page.getByRole('button',{name:id==='knn_c'?'观察一个错分点':'观察偏差较大的验证点',exact:true});if(await diagnostic.isEnabled()){await diagnostic.click();await expect(diagnostic).toBeEnabled({timeout:45000});}const selectedRow=await page.getByRole('combobox',{name:'验证样本',exact:true}).inputValue();
  await page.getByRole('button',{name:'和小模聊聊',exact:true}).click();const pet=page.getByRole('dialog',{name:'小模学习助手',exact:true});await pet.getByRole('textbox',{name:'向小模提问',exact:true}).fill('解释当前样本和这次参数');await pet.getByRole('button',{name:'发送给小模',exact:true}).click();await expect(pet.locator('.pp-pet-answer-text').last()).toContainText(title);await expect(pet.locator('.pp-pet-answer-text').last()).toContainText('验证样本'+selectedRow);await expect(pet.locator('.pp-pet-answer-text').last()).toContainText('定格A');await pet.getByRole('button',{name:'关闭小模问答',exact:true}).click();
  await page.getByRole('button',{name:'换个情境验证',exact:true}).click();const quiz=page.getByRole('region',{name:'新情境迁移验证',exact:true});await expect(quiz).toBeVisible({timeout:45000});await expect(quiz.locator('.pp-transfer-readings')).toHaveCount(0);
  await quiz.getByRole('radio',{name:'A更低',exact:true}).check();await quiz.getByRole('button',{name:'锁定新情境判断',exact:true}).click();await expect(quiz.locator('.pp-transfer-readings')).toBeVisible();
  await quiz.getByRole('group',{name:'根据实算读数，哪组验证误差更低？',exact:true}).getByRole('radio').first().check();await quiz.locator('input[name=reason]').first().check();await quiz.getByRole('button',{name:'保存依据并核验',exact:true}).click();await expect(quiz.getByRole('status')).toBeVisible();
  await page.reload();await expect(quiz).toContainText('本题首答：A更低');await expect(page.getByRole('combobox',{name:'验证样本',exact:true})).toHaveValue(selectedRow);if(focusedFeature)await expect(page.getByRole('combobox',{name:'观察一个特征',exact:true})).toHaveValue(focusedFeature);await expect(page.getByRole('spinbutton',{name:field,exact:true})).toHaveValue(value);
 });
}


test('mechanism toolbar and sticky actions remain usable across short and narrow screens',async({page})=>{
 test.setTimeout(120000);await page.goto('/#classroom/model-mechanism/knn_c');await page.getByRole('button',{name:'训练机制示例',exact:true}).click();await expect(page.locator('.pp-neighbor-scene')).toBeVisible({timeout:45000});
 const toolbar=page.getByRole('toolbar',{name:'机制画布工具',exact:true}),figure=toolbar.getByRole('button',{name:'图形',exact:true}),readings=toolbar.getByRole('button',{name:'读数',exact:true});await figure.focus();await figure.press('ArrowRight');await expect(readings).toBeFocused();await readings.press('Space');await expect(readings).toHaveAttribute('aria-pressed','true');await expect(page.locator('.pp-neighbor-scene')).toHaveCount(0);await figure.click();await expect(page.locator('.pp-neighbor-scene')).toBeVisible();
 for(const [width,height] of [[1366,768],[1024,768],[390,844],[320,667]]){await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));const box=await page.locator('.pp-lab-command').boundingBox();expect(box.y).toBeGreaterThanOrEqual(60);expect(box.y+box.height).toBeLessThan(height);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);await expect(page.getByRole('spinbutton',{name:'邻居数 K',exact:true})).toBeInViewport();}
});


test('formal Ridge results reuse their actual run in the coefficient scene',async({page})=>{
 test.setTimeout(90000);await page.goto('/');await exampleRun(page,'回归任务','混凝土','ridge');await page.getByRole('tab',{name:'预测机制',exact:true}).click();await expect(page.locator('.pp-coefficient-scene')).toBeVisible();await expect(page.getByRole('region',{name:'真实训练结果'})).toBeVisible();await expect(page).toHaveURL(/#classroom\/workbench$/);await page.getByRole('toolbar',{name:'机制画布工具',exact:true}).getByRole('button',{name:'读数',exact:true}).click();await expect(page.locator('.pp-coefficient-bars')).toBeVisible();
});


test('result tabs support deliberate keyboard activation, focus return and preserved computations',async({page})=>{
 test.setTimeout(120000);await page.goto('/');await exampleRun(page,'回归任务','混凝土','ridge');
 const tabs=page.getByRole('tablist',{name:'结果视图',exact:true}),overview=tabs.getByRole('tab',{name:'预测对照',exact:true}),residual=tabs.getByRole('tab',{name:'残差',exact:true});
 await overview.focus();await overview.press('ArrowRight');await expect(residual).toBeFocused();await expect(overview).toHaveAttribute('aria-selected','true');await residual.press('Enter');const panel=page.getByRole('tabpanel',{name:'残差',exact:true});await expect(panel).toBeVisible();await expect(panel.locator('svg[role=img]')).toBeVisible();const zero=await panel.locator('[data-zero-line=true]').evaluate(e=>({d:e.getAttribute('d'),stroke:getComputedStyle(e).stroke,width:getComputedStyle(e).strokeWidth}));expect(zero.d).toMatch(/^M74 ([0-9.]+)H544$/);const zeroY=Number(zero.d.match(/^M74 ([0-9.]+)/)[1]);expect(zeroY).toBeGreaterThanOrEqual(40);expect(zeroY).toBeLessThanOrEqual(280);expect(zero.stroke).not.toBe('none');expect(parseFloat(zero.width)).toBeGreaterThan(0);
 await panel.getByRole('combobox',{name:'选择验证样本',exact:true}).selectOption({index:3});const row=await panel.getByRole('combobox',{name:'选择验证样本',exact:true}).inputValue();await expect(panel.locator('g[data-selected=true]')).toHaveAttribute('data-row',row);await panel.getByText('查看样本数值',{exact:true}).click();await expect(panel.getByRole('table')).toBeVisible();
 await tabs.getByRole('tab',{name:'学习曲线',exact:true}).click();const learning=page.getByRole('tabpanel',{name:'学习曲线',exact:true});await learning.getByRole('button',{name:'实际运行学习曲线',exact:true}).click();await expect(learning.locator('.pp-series')).toHaveCount(2,{timeout:45000});await learning.getByText('查看曲线数值',{exact:true}).click();await expect(learning.getByRole('table')).toContainText('训练池使用比例');
 let analysisRequests=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/analysis/learning'))analysisRequests++;});await overview.click();await tabs.getByRole('tab',{name:'学习曲线',exact:true}).click();await expect(learning.locator('.pp-series')).toHaveCount(2);expect(analysisRequests).toBe(0);
 await overview.click();await page.locator('[data-result-panel=learning]').evaluate(e=>e.dispatchEvent(new Event('beforematch',{bubbles:true})));await expect(tabs.getByRole('tab',{name:'学习曲线',exact:true})).toHaveAttribute('aria-selected','true');await expect(learning).toBeVisible();
 for(const width of [1024,390,320]){await page.setViewportSize({width,height:844});await tabs.getByRole('tab',{name:'稳定性',exact:true}).click();await expect(tabs.getByRole('tab',{name:'稳定性',exact:true})).toBeInViewport();const ys=await tabs.getByRole('tab').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().y));expect(Math.max(...ys)-Math.min(...ys)).toBeLessThan(1);const metricYs=await page.locator('.pp-results>.pp-metrics strong').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().y));expect(Math.max(...metricYs)-Math.min(...metricYs)).toBeLessThan(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);}
});

test('classification slices provide labeled patterns, complete coordinates and a numerical alternative',async({page})=>{
 test.setTimeout(90000);await page.goto('/');await exampleRun(page,'分类任务','企鹅','tree_c');await page.getByRole('tab',{name:'边界/条件切片',exact:true}).click();await page.getByRole('button',{name:'计算当前条件视图',exact:true}).click();const panel=page.getByRole('tabpanel',{name:'边界/条件切片',exact:true});await expect(panel.locator('.pp-surface-chart')).toBeVisible({timeout:45000});await expect(panel.locator('[aria-label="预测类别图例"]>span')).toHaveCount(3);await expect(panel.locator('pattern')).toHaveCount(5);await panel.getByText('查看切片网格数值',{exact:true}).click();await expect(panel.getByRole('table')).toContainText('单元格是固定条件下的预测');await panel.getByText('查看切片网格数值',{exact:true}).click();
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);const landedFont=await panel.locator('.pp-chart-viewport>svg').evaluate(e=>parseFloat(getComputedStyle(e.querySelector('text')).fontSize)*e.getBoundingClientRect().width/e.viewBox.baseVal.width);expect(landedFont).toBeGreaterThanOrEqual(12);await page.emulateMedia({forcedColors:'active'});const active=page.getByRole('tablist',{name:'结果视图',exact:true}).locator('[aria-selected=true]');expect(await active.evaluate(e=>getComputedStyle(e,'::after').borderBottomStyle)).toBe('solid');expect(await active.evaluate(e=>getComputedStyle(e,'::after').borderBottomWidth)).toBe('3px');
});

test('generated planet illustrations load, keep entrances separate and retain working navigation',async({page})=>{
 test.setTimeout(120000);await page.goto('/');
 for(const key of ['classification','regression']){const img=page.locator(`.pp-world [data-art=${key}] img`);await expect.poll(()=>img.evaluate(e=>e.complete&&e.naturalWidth>0),{timeout:30000}).toBe(true);await expect(img).toHaveAttribute('loading','eager');await expect(img).toHaveAttribute('fetchpriority','high');await expect(img).toHaveAttribute('sizes',/44vw/);}
 for(const [width,height] of [[1366,768],[1024,768],[390,844],[320,667]]){await page.setViewportSize({width,height});const boxes=await page.locator('.pp-world>button').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];expect(Math.max(0,Math.min(a.right,b.right)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y))).toBe(0);}expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);const gaps=await page.locator('.pp-island').evaluateAll(es=>es.map(e=>e.querySelector('strong').getBoundingClientRect().top-e.querySelector('.pp-generated-art').getBoundingClientRect().bottom));expect(Math.min(...gaps)).toBeGreaterThanOrEqual(0);}
 await page.getByRole('button',{name:/^分类港/}).click();await expect(page.getByRole('heading',{name:'从分类港，认出不同。',exact:true})).toBeVisible();await nav(page,'模型机制工坊');
 for(const key of ['error','sensitivity','regularization','forest']){const img=page.locator(`.pp-station-art [data-art=${key}] img`);await img.scrollIntoViewIfNeeded();await expect.poll(()=>img.evaluate(e=>e.complete&&e.naturalWidth>0),{timeout:30000}).toBe(true);}
 await expect(page.locator('.pp-station-number')).toHaveCount(4);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
});

test('late lesson progress stays with its original lesson after navigation',async({page,request})=>{
 await request.post('/api/learning-archive/reset',{headers:{'X-ModelPlanet-Archive':'1'},data:{scope:'progress',confirmed:true}});const lessons=(await(await request.get('/api/study/overview')).json()).lessons;
 const held=Promise.withResolvers(),release=Promise.withResolvers();await page.route('**/api/study/lessons/ml-intro/read',async route=>{const response=await route.fetch();held.resolve();await release.promise;await route.fulfill({response});});
 await page.goto('/#classroom/learning/ml-intro');await page.getByRole('button',{name:'读完了，做个小检查',exact:true}).click();await held.promise;await page.getByRole('button',{name:'下一课',exact:true}).click();await expect(page.getByRole('heading',{name:lessons[1].title,exact:true})).toBeVisible();release.resolve();await page.waitForTimeout(200);
 await expect(page.getByRole('button',{name:'读完了，做个小检查',exact:true})).toBeEnabled();await expect(page.getByRole('region',{name:'本课小检查',exact:true})).toHaveCount(0);expect((await(await request.get('/api/study/lessons/ml-intro')).json()).progress.read_at).toBeTruthy();expect((await(await request.get('/api/study/lessons/'+lessons[1].id)).json()).progress.read_at).toBeUndefined();
});

test('a late cached transfer and a missing cache cannot attach to a new run',async({page,request})=>{
 test.setTimeout(120000);await page.goto('/');await exampleRun(page,'分类任务','企鹅','tree_c');await page.getByRole('button',{name:'7 对照解释',exact:true}).click();
 const report=await page.locator('a[href*="/report?format=json"]').getAttribute('href'),source=report.match(/runs\/([a-f0-9]{32})/)[1];const job=await(await request.post('/api/lab/runs/'+source+'/challenge',{data:{blind:true}})).json();let finished;
 await expect.poll(async()=>{finished=await(await request.get('/api/lab/runs/'+job.id)).json();return finished.state;},{timeout:45000}).toBe('completed');const qid=finished.result.quiz_id;
 await page.evaluate(id=>localStorage.setItem('modelplanet-last-quiz',id),qid);const held=Promise.withResolvers(),release=Promise.withResolvers();let captured=false;
 await page.route('**/api/lab/quizzes/'+qid,async route=>{if(captured){await route.continue();return;}captured=true;const response=await route.fetch();held.resolve();await release.promise;await route.fulfill({response}).catch(()=>{});});
 await page.reload();await held.promise;await page.getByRole('button',{name:'生成可执行建议',exact:true}).click();await page.getByRole('button',{name:'采用并训练这项建议',exact:true}).click();await expect(page.getByRole('button',{name:'带着这个结果再验证',exact:true})).toBeEnabled({timeout:45000});expect(await page.locator('a[href*="/report?format=json"]').getAttribute('href')).not.toContain(source);release.resolve();await page.waitForTimeout(200);await expect(page.getByRole('region',{name:'新情境迁移验证',exact:true})).toHaveCount(0);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.evaluate(()=>localStorage.setItem('modelplanet-last-quiz','f'.repeat(32)));const missing=page.waitForResponse(r=>r.url().includes('/lab/quizzes/'+'f'.repeat(32)));await page.reload();await missing;await expect(page.getByRole('region',{name:'真实训练结果'})).toBeVisible();await page.waitForTimeout(200);expect(errors).toEqual([]);
});

test('complete learning archives export, reset, import and undo through the student interface',async({page,request})=>{
 test.setTimeout(180000);await page.goto('/#classroom/experiments');
 async function resetAll(){await page.getByRole('button',{name:'重置学习进度',exact:true}).click();const dialog=page.getByRole('dialog',{name:'重新开始学习？',exact:true});await expect(dialog.getByRole('button',{name:'取消',exact:true})).toBeFocused();await dialog.getByRole('radio',{name:/^全部学习记录/}).check();await Promise.all([page.waitForEvent('load'),dialog.getByRole('button',{name:'确认重置',exact:true}).click()]);await expect(page.getByRole('progressbar',{name:'知识航线',exact:true})).toHaveAttribute('aria-valuenow','0');}
 await resetAll();await nav(page,'学习航线');await page.getByRole('button',{name:'从什么是机器学习开始',exact:true}).click();await page.getByRole('button',{name:'读完了，做个小检查',exact:true}).click();await page.getByRole('radio',{name:'用测量特征学习物种，在未参与训练的样本上评估',exact:true}).check();await page.getByRole('button',{name:'保存判断并核对',exact:true}).click();await expect(page.getByText('检查通过，学习进度已保存。',{exact:true})).toBeVisible();await exampleRun(page,'分类任务','企鹅','tree_c');await nav(page,'我的学习记录');
 const settings=await(await request.get('/api/workspace/settings')).json(),downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'导出全部学习记录',exact:true}).click();const download=await downloaded,filePath=await download.path(),fs=await import('node:fs/promises');const pack=JSON.parse(await fs.readFile(filePath,'utf8'));expect(pack.format).toBe('modelplanet-learning-archive');expect(pack.models.runs).toHaveLength(1);expect(JSON.stringify(pack)).not.toContain('api_key');const first=pack.knowledge.progress[0].attempts[0];
 await resetAll();const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入学习档案',exact:true}).click();await(await chooser).setFiles(filePath);const restore=page.getByRole('dialog',{name:'恢复这份学习档案？',exact:true});await expect(restore).toContainText('1 / 18');await Promise.all([page.waitForEvent('load'),restore.getByRole('button',{name:'恢复这份档案',exact:true}).click()]);await expect(page.getByRole('progressbar',{name:'知识航线',exact:true})).toHaveAttribute('aria-valuenow','1');const overview=await(await request.get('/api/study/overview')).json();expect(overview.experiment_count).toBe(1);expect(overview.progress['ml-intro'].first_answer.id).toBe(first.id);
 await page.getByRole('button',{name:'重置学习进度',exact:true}).click();await page.getByRole('dialog',{name:'重新开始学习？',exact:true}).press('Escape');await expect(page.getByRole('button',{name:'重置学习进度',exact:true})).toBeFocused();expect((await(await request.get('/api/workspace/settings')).json()).reasoning_effort).toBe(settings.reasoning_effort);
 await page.setViewportSize({width:320,height:667});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);await page.getByRole('button',{name:'撤销上次重置或导入',exact:true}).click();const undo=page.getByRole('dialog',{name:'恢复上次操作前的档案？',exact:true});await Promise.all([page.waitForEvent('load'),undo.getByRole('button',{name:'恢复上次档案',exact:true}).click()]);await expect(page.getByRole('progressbar',{name:'知识航线',exact:true})).toHaveAttribute('aria-valuenow','0');
});

test('classroom entry points share one archive and current task destinations',async({page})=>{
 await page.goto('/#classroom/experiments');await expect(page.getByRole('heading',{name:'我的学习记录',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'导出全部学习记录',exact:true})).toHaveCount(1);
 await expect(page.locator('a[href*="backup/file"]')).toHaveCount(0);await expect(page.locator('input[type=file]:visible')).toHaveCount(0);
 for(const [hash,title,canonical] of [['#mechanisms/history','我的学习记录','#classroom/experiments'],['#mechanisms/settings','让学习，按你的节奏。','#classroom/settings'],['#path','从第一课出发，读懂机器学习。','#classroom/learning'],['#datasets','去回归谷，预测未知。','#classroom/regression']]){
  await page.goto('/'+hash);await expect(page.locator('main h1').first()).toHaveText(title);await expect.poll(()=>page.evaluate(()=>location.hash)).toBe(canonical);await expect(page.locator('main')).toHaveCount(1);await expect(page.locator('.workspace-page,.dataset-lab,.sidebar')).toHaveCount(0);
 }
 await page.goto('/#mechanisms/studio');await expect(page.getByRole('group',{name:'选择对照主题',exact:true})).toBeVisible();
 await page.getByRole('radio',{name:/^样本与噪声/}).check();await expect(page.locator('.studio-intro h1')).toContainText('样本数量与噪声');
 await expect(page.getByRole('radio',{name:/^样本与噪声/})).toBeFocused();await page.reload();await expect(page.locator('.studio-intro h1')).toContainText('样本数量与噪声');
 await expect(page.getByRole('navigation',{name:'机制学习导航'}).getByRole('button')).toHaveCount(4);
 await page.setViewportSize({width:320,height:667});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 const boxes=await page.locator('.pp-foundation-picker label').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};}));expect(boxes.every(r=>r.left>=0&&r.right<=320&&r.height>=44)).toBe(true);
});

test('executed mechanism suggestions expose real evidence in current learning records',async({page,request})=>{
 const parameters={scene:'complexity',degree:4,samples:12,noise:.22,alpha:.00000001,seed:42};
 const plan=await(await request.post('/api/actions/plan',{data:{kind:'synthetic',parameters}})).json();const run=await(await request.post('/api/actions/'+plan.id+'/execute',{data:{parameters}})).json();
 await page.goto('/#classroom/experiments');await page.getByRole('button',{name:'机制探索',exact:true}).click();
 const row=page.locator('.pp-study-event').filter({hasText:'实验建议 · '+plan.change.label}).first();await row.getByRole('button',{name:'查看核验证据',exact:true}).click();
 const proof=row.getByRole('region',{name:'实验核验证据',exact:true});await expect(proof).toContainText('规则方案');
 await expect(proof).toContainText(run.before.metrics.validation_mse.toPrecision(5));await expect(proof).toContainText(run.after.metrics.validation_mse.toPrecision(5));
 await proof.getByText('查看实验条件',{exact:true}).click();await expect(proof.getByRole('region',{name:'执行前后参数',exact:true})).toBeVisible();
 await page.setViewportSize({width:320,height:667});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
});
