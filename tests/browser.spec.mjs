import {test,expect} from '@playwright/test';
import {autonomousGarden,offlineSettings} from './browser-flows.mjs';

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
