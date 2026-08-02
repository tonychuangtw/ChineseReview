# chinese — 中文成語俚語字音字形複習網站 + 任務線

這是 `claude-telegram@chinese` 線（bot @Tonychinesereviewbot）的 workdir。Tony 在這條線討論這個網站的需求與加題。

## 專案概要

- 純靜態網站，比照 LanExamMock 模式：vanilla JS、無 build、GitHub Pages 部署、localStorage 存進度
- repo：github.com/tonychuangtw/ChineseReview（Pages 從 main branch root 出）
- 2026-08-02 Tony 拍板的規格：
  1. 年級分層國小1-6／國中7-9／高中10-12
  2. 注音與拼音雙版本（一鍵切換，資料內建兩種標音）
  3. 首發題庫：成語 200、俚語諺語 80、字音 150、字形 150；之後慢慢加
  4. 內容以教育部頒定內容為準；出版社題庫有版權 → 同題型風格**原創出題**，不逐字抄
  5. 手寫＝「看注音寫國字」：畫布手寫 → 翻答案 → 自評對錯 → 錯題本

## 改動守則

- 改完必跑 `node test/test.js`（資料完整性 + 題目生成邏輯）和 `node test/zy-check.js`
- 加題直接改 `js/data/*.js`，遵守檔頭既有 schema；id 連號不重複、grade 1-12、繁體台灣用字
- 注音規則：一聲不標調號、輕聲 ˙ 前置、詞注音字間空格；拼音含聲調符號
- 字音以教育部《國語一字多音審訂表》審訂音為準
- push 到 main 即自動上 Pages，無需其他部署步驟
- 日期一律用 app.js 的 `fmtDate`（本地時區），不要用 `toISOString`（UTC 會差 8 小時）

## 2026-08-02 之後的擴充

- 登入同步：js/sync.js，後端共用 LanExamMock progress API（app=chinese），詳見本機 memory
- 每日練習：`composeDaily` 以「日期|年級|含以下年級」做種子，同日同設定出同一組題；精熟迴圈錯題重做到全對；紀錄存 state.daily[日期]，進度頁「家長檢視」讀這份
- 成語 `syn`（同義詞陣列）出同義題；`src`（如 "108會考"）標歷屆出處，不確定出處寧缺勿錯
- 閱讀題庫 js/data/reading.js：{id,grade,title,genre,src,passage,questions:[{q,options[4],answer,exp}]}
- 成語配圖：`node tools/gen-idiom-images.js --grades 1-6`（Gemini 2.5 Flash Image，金鑰在 ~/.gemini/.env），產 img/idioms/<id>.webp，前端自動載入、載不到自動隱藏
