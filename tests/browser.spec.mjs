import {test,expect} from '@playwright/test';
import {autonomousGarden,offlineSettings,gardenCausality,aiTransfer} from './browser-flows.mjs';

test('autonomous investigation and interrupted transfer preserve first answers',async({page})=>{
  await page.goto('/');
  await autonomousGarden({playwright:page,reload:()=>page.reload()});
  await expect(page.getByRole('alert').filter({hasText:/服务器|失败/})).toHaveCount(0);
});

test('offline settings and narrow layout',async({page})=>{
  await page.goto('/');
  await offlineSettings({playwright:page,reload:()=>page.reload()});
  await page.setViewportSize({width:390,height:844});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
  expect(overflow).toBe(false);
});

test('garden contributions and probe are usable in a short desktop viewport',async({page})=>{
  await page.setViewportSize({width:1366,height:768});
  await page.goto('/');
  await gardenCausality({playwright:page,reload:()=>page.reload()});
});

test('AI experiment starts an independent marked transfer',async({page})=>{
  await page.goto('/');
  await aiTransfer({playwright:page,reload:()=>page.reload()});
});

test('mobile garden keeps primary controls and branch targets readable',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#concepts');
  await page.getByRole('button',{name:'约束的形状',exact:true}).click();
  const branches=page.getByRole('button',{name:/查看第\d+项对预测的贡献/});
  await expect(branches).toHaveCount(3);
  await expect(page.getByRole('button',{name:'展开导航',exact:true})).toBeVisible();
  const state=await page.evaluate(()=>{
    const a=document.querySelector('input[aria-label="工坊正则化强度α"]').getBoundingClientRect();
    const targets=[...document.querySelectorAll('.garden-term')].map(e=>e.getBoundingClientRect());
    return {overflow:document.documentElement.scrollWidth>innerWidth+1,alphaBottom:a.bottom,
      small:targets.filter(r=>r.width<43||r.height<43).length};
  });
  expect(state.overflow).toBe(false);
  expect(state.alphaBottom).toBeLessThan(844);
  expect(state.small).toBe(0);
  await page.screenshot({path:'artifacts/local/playwright-results/garden-mobile.png',fullPage:true});
});
