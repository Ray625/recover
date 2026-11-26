# Supabase 設定與驗證

## 目前專案

Project URL：`https://gpewljdgryxoiyseqdil.supabase.co`。

公開連線設定放在忽略的 `.env.local`：

```dotenv
VITE_SUPABASE_URL=https://gpewljdgryxoiyseqdil.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=專案的公開金鑰
```

新版使用 `PUBLISHABLE_KEY` 變數；若專案只有 legacy anon key，也可以填入這個變數。不要使用 service_role 或 secret key。舊 MeowNote 的 ANON_KEY 不會被程式讀取。

變更環境變數後重新啟動 `pnpm dev`。正式部署則須重新建置；GitHub Pages 的同名 Repository Variables 已接入 workflow。

## 資料庫

開啟 `supabase/migrations/202611260001_fitness_documents.sql`，複製檔案內完整的 SQL 到 Supabase SQL Editor 執行。SQL Editor 接收 SQL 內容，不是檔案路徑。

本次使用者已執行成功；正式專案唯讀檢查已確認資料表存在，匿名讀取回傳權限拒絕。

- `fitness_documents`：每個帳戶一份完整紀錄文件，包含分類、動作、訓練與歷史快照。
- RLS 僅允許 authenticated 使用者存取自己的 `user_id`。
- 同步透過 `save_fitness_document` 一次保存完整資料，以 revision 原子檢查避免不同裝置互相覆寫。
- 文件模式沿用目前本機資料格式，沒有分頁查詢截斷千筆紀錄的問題；未來如需大量伺服器端分析，可再遷移為分表設計。

## Email 與密碼登入

目前使用 Email／密碼。正式專案已啟用 Email，且新註冊需要信箱確認。

請在 Supabase Dashboard → Authentication → URL Configuration 確認：

1. Site URL 設為實際使用的網站網址；本機測試通常是 `http://localhost:5173/`。
2. Redirect URLs 加入 `http://localhost:5173/#/account`。若使用 `127.0.0.1` 或其他連接埠，加入對應的實際網址。
3. 上線後，把正式站的 `https://你的網域/部署路徑/#/account` 也加入 Redirect URLs，並將 Site URL 調整為正式站。

註冊確認與重設密碼使用 PKCE，自動交換回跳 URL 的 code；應在發起操作的同一瀏覽器完成確認。如果確認連結過期或換了裝置，可重新發起註冊／重設流程。

帳戶頁提供註冊、登入、忘記密碼、更新密碼及本機登出；不會自動替使用者註冊或寄信。正式註冊、確認信、重設密碼郵件送達與實機回跳仍需使用者實際驗收。

官方參考：[密碼登入](https://supabase.com/docs/guides/auth/passwords)、[PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow)、[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)。

## 資料使用方式

- 未登入：維持原本的本機紀錄，儲存 key 為 `fitness-log:v1`。
- 登入：載入個人雲端資料；每個帳戶使用自己的本機快取與待同步狀態。
- 原本的本機紀錄不會自動上傳；帳戶頁的「匯入本機紀錄」需確認後才合併。分類與動作依名稱／分類對應，紀錄依 ID 去重，原始本機資料保留。
- 修改後先保存至該帳戶的本機快取，再於約 300ms 後背景同步；失敗依 1、2、4、8 秒逐步退避，最長 30 秒自動重試。回到前景、恢復網路、按「同步」或可見頁面每 30 秒也會再嘗試。每次請求最多等待 15 秒，不疊加 SDK 的另一層重試。
- 此版不是 Realtime 訂閱，其他裝置的新資料可透過上述刷新方式載入。
- 雲端 revision 已更新而本機也有待同步內容時停止覆寫，顯示版本衝突。選擇「載入雲端版本」會先保存本機版本，再載入雲端，可「匯出同步前備份」。不會自動合併同一筆紀錄的衝突。
- 登出前會嘗試同步；仍有待同步資料時先確認，資料保留在該帳戶的裝置快取，不轉成訪客資料，也不出現在其他帳戶。
- 本機儲存損壞時維持原始資料保護。不要依賴唯一一份瀏覽器快取，仍可在設定頁匯出備份。

## 自動驗證

```sh
pnpm test:db
pnpm test:cloud
```

`test:db` 以 PGlite 執行原始 migration，測試 RLS、匿名存取拒絕、跨帳戶寫入拒絕及版本衝突。它不是正式 Supabase 的 SQL 執行。

`test:cloud` 使用獨立的本機伺服器、假的 API URL 與模擬回應，驗證登入、帳戶隔離、訪客匯入、離線保存、跨裝置刷新與衝突備份，不會讀寫正式專案或寄信。產物位於 `test-results-cloud/` 與 `playwright-cloud-report/`，和本機功能測試分開。

正式專案目前僅執行公開設定與匿名權限的唯讀檢查；尚未替使用者登入或寫入真實訓練資料。

## 自動同步與資料保護補強

- 同步狀態、最後同步時間及手動「同步」只在帳戶頁顯示；其他頁面保存後自動排程，不跳出同步完成提示。
- 工作資料、待同步版本、正在上傳的原始快照與最後確認時間都會保存在帳戶本機快取。只有確認雲端成功並持久保存回應後，才清除待同步狀態。
- 雲端已成功儲存但回應遺失時，比對 revision 與內容辨識成功請求；不因 JSONB 改變物件欄位順序而誤判衝突。若上傳途中又修改資料，先確認前一份，再繼續上傳新版本。
- 新裝置尚未成功取得帳戶資料且沒有有效快取時，暫停新增與寫入，避免預設空資料誤覆蓋雲端。
- 雲端版本有真正衝突或已知文件突然不存在時保留本機副本，停止自動覆寫。手動載入雲端或匯入替代備份前，先保留目前帳戶資料。
- 本機空間不足時不宣稱保存成功、不關閉尚未儲存的編輯表單，也不把未保存內容當成成功變更上傳。
- 有帳戶待同步變更時註冊離頁保護提示；行動瀏覽器不保證顯示提示，因此真正的保護仍是每次變更即寫入本機。重新開啟同一帳戶後繼續核對與同步。
- 瀏覽器儲存仍受裝置容量、清除網站資料與私密瀏覽生命週期影響；尚未同步的內容應保留匯出備份，不能視為已存入雲端。
