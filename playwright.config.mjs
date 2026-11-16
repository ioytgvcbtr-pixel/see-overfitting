import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests',testMatch:['browser.spec.mjs','planet-browser.spec.mjs'],workers:1,retries:0,timeout:60000,
  use:{baseURL:'http://127.0.0.1:3002',headless:true,viewport:{width:1440,height:1000},trace:'retain-on-failure',screenshot:'only-on-failure'},
  reporter:[['list'],['html',{outputFolder:'artifacts/local/playwright-report',open:'never'}]],
  outputDir:'artifacts/local/playwright-results',
  webServer:{command:'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start.ps1 -WebPort 3002 -ApiPort 8002 -Production -NoBrowser',
    url:'http://127.0.0.1:3002/api/health',reuseExistingServer:false,timeout:90000,
    env:{FITLAB_DB:'artifacts/local/ci-browser.sqlite',FITLAB_ENV_FILE:'artifacts/local/ci-no-api.env',AI_ENABLED:'0'}},
});
