# LiftLog

手機優先的健身紀錄網站。寬螢幕沿用相同配置，內容置中，最多 480px。

## 開發

```sh
pnpm install
pnpm dev
```

目前支援日曆、簡略／逐組紀錄、完成勾選、單項複製、整日複製課表、分類與動作管理、明暗主題、JSON 備份匯出／匯入。已加入 Supabase Email／密碼帳戶與雲端同步；統計留待後續階段。

未登入時資料保存在目前瀏覽器；登入後依帳戶保存快取並同步 Supabase。清除網站資料會移除本機與尚未同步內容，請定期於設定頁匯出備份。匯入會先驗證格式，再確認是否取代目前資料。無法讀取原有資料時會阻止一般寫入，匯出可取回原始內容，再匯入有效備份。

詳細規則見 [健身網站規格](docs/FITNESS_SPEC.md)；雲端初始化、Auth 回跳網址與同步限制見 [Supabase 設定](docs/SUPABASE_SETUP.md)。

## 驗證

```sh
pnpm check
pnpm lint
pnpm build
pnpm test:e2e:install
pnpm test:e2e
pnpm test:e2e:report
pnpm test:db
pnpm test:cloud
```

`lint` 會自動修正檔案。Playwright 自動啟動測試伺服器（127.0.0.1:4175），執行 Chromium 桌面、Pixel 7 與 iPhone 13 WebKit 手機模擬；WebKit 模擬不代表 iPhone Safari 實機驗證。每個測試有獨立的瀏覽器儲存，不接觸日常瀏覽器資料。首次安裝或升級 Playwright 後需執行 `test:e2e:install`，瀏覽器放在忽略的 node_modules 裡。

測試涵蓋日曆日期、簡略與詳細模式切換、逐組不同重量與次數、持久保存、編輯與刪除、兩種複製流程、完成狀態、分類刪除限制、歷史快照、動作管理、備份驗證、鍵盤焦點及損壞資料保護。健身測試固定日期，避免執行月份影響結果。

測試截圖及失敗追蹤在 `test-results/`，HTML 報告在 `playwright-report/`，均不加入 Git。測試封鎖 service worker，PWA 安裝與離線更新需另行驗證。互動模式可執行 `pnpm test:e2e:ui`。

## 結構

- `src/domain/fitness.ts`：資料模型、備份驗證與初始分類。
- `src/stores/fitness.ts`：本機保存、日期、完成狀態與複製課表。
- `src/views/CalendarView.vue`：月曆、日期紀錄與選單。
- `src/components/fitness/WorkoutEditor.vue`：新增／編輯／單項複製表單。
- `src/views/SettingsView.vue`：分類、動作與備份管理。
- `src/layouts/AppLayout.vue`：手機外框、底部導覽與中央新增。
- `tests/e2e/`：瀏覽器操作測試。

## 部署設定

`.env.example` 的 `APP_BASE=/` 用於根目錄部署；子目錄部署可設 `APP_BASE=/my-fitness/`。Hash 路由不需要靜態主機提供路由 fallback。

GitHub Pages workflow 僅手動觸發，預設以 repository 名稱作為子目錄；自訂網域根目錄部署需改為 `/`。本輪未執行部署。
