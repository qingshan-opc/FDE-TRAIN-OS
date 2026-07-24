const { chromium } = require("@playwright/test");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto("http://127.0.0.1:8760/", { waitUntil: "domcontentloaded", timeout: 20000 }).catch(()=>{});
  await p.waitForTimeout(2200);
  await p.screenshot({ path: "/tmp/land-mobile.png" });
  await b.close();
  console.log("done");
})();
