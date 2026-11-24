# Recorder Base

可複製並依需求延伸的 Vue 3 + TypeScript 基礎專案。

## 開發與驗證

```sh
pnpm install
pnpm dev
pnpm check
pnpm lint
pnpm build
pnpm preview
```

`check` 執行型別檢查；目前沒有業務邏輯或測試套件。`lint` 會自動修正檔案。

## 已包含

- Vue Router：首頁、設定頁，以及未知路徑回首頁。
- 響應式外框、明暗主題與本機主題偏好。
- 共用按鈕樣式、確認視窗、Modal、選單、Toast、照片預覽等元件。
- Pinia 初始化，供各紀錄器加入自己的 store。
- PWA manifest 與 service worker；安裝體驗仍需在目標裝置驗證。

不預設登入、後端、資料表或紀錄欄位。

## 複製後調整

1. 修改 `package.json` 的專案名稱。
2. 修改 `src/config/app.ts` 的網站名稱、說明與 storagePrefix。每個專案應使用不同的儲存前綴。
3. 同步修改 `index.html` 的網頁標題、手機主畫面名稱，並替換 `public/icon.svg`。如需更完整的裝置支援，可再補 PNG 與 Apple touch icon。
4. 在 `src/styles/theme.css` 修改配色；PWA 顏色在 `vite.config.ts`。
5. 在 `src/views/` 新增頁面、`src/router/index.ts` 加入路由，並調整 `src/layouts/AppLayout.vue` 的導覽。
6. 按需求新增資料模型、store、儲存與登入機制。

## 部署

複製 `.env.example` 為 `.env.local`。根目錄部署使用 `APP_BASE=/`，子目錄部署例如 `APP_BASE=/my-recorder/`。變更後重新啟動開發伺服器或建置。

採 hash 路由，例如 `/#/settings`，靜態主機不需額外設定路由 fallback。

GitHub Pages workflow 僅供手動觸發，預設使用 repository 名稱作為子目錄。先將 repository 的 Pages source 設為 GitHub Actions；若使用自訂網域根目錄或帳號首頁倉庫，請將 workflow 的 `APP_BASE` 改成 `/`。複製時不要沿用舊專案的 `.env.local`、`dist`、`node_modules` 或 Git 遠端設定。

從舊站移轉到相同網址時，應在瀏覽器開發工具取消舊 service worker 註冊並清除該站快取，再檢查新版本。

## 共用元件約定

- `AppDialog`：原生 modal dialog 包裝，掛載即開啟。由瀏覽器管理焦點、背景互動限制與 Escape；`close` 事件由父層處理，以 `v-if` 卸載元件。`closeOnBackdrop=false` 僅禁止點擊背景，Escape 仍可關閉。必須提供 `aria-label` 或 `aria-labelledby`。
- `ConfirmDialog`：透過 `v-if` 顯示，父層處理 `confirm`、`cancel` 後卸載；預設焦點在取消按鈕。
- `FixedModal`：同樣以 `v-if` 管理生命週期，提供 `header`、`body`、`footer` slot。使用 `labelledby` 指向標題 ID，或提供 `label`。`panelTag="form"` 時，`submit` 事件已阻止頁面重新載入。強調色可設 `--accent-color`。
- `FixedSelect`：原生 select，維持字串 `v-model` 與 `{ value, label }[]`。透過外層 label、`id`/`for` 或 `aria-label` 提供名稱，方向鍵與手機選單由瀏覽器處理。
- `PhotoPreview`：以 `v-if` 掛載，父層處理 `close`、`delete`，使用 `v-model:index` 更新照片索引。支援左右鍵切換；觸控縮放仍需實機驗證。
- `AppToast`：以 `message` 控制顯示，父層收到 `close` 時清空訊息；不會自動消失。

新增或修改彈窗後，手動確認：開啟時焦點進入、Tab/Shift+Tab 不進入背景、Escape 關閉、焦點回到開啟按鈕，以及多層彈窗關閉後仍能操作前一層。另確認背景捲動於最後一層關閉後恢復。
