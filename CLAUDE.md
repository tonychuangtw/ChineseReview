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
- 2026-08-02 二輪擴充：年級改多選（state.grades 陣列，舊 grade/cumulative 自動遷移）；每日練習 25 題＋弱點加權（weakStrong）＋錯題到期混入；錯題排程 bumpWrongSchedule（1→3→7 天三關畢業）；寫作素材 js/data/writing.js；家長週報 tools/weekly-report.js（systemd：chinese-weekly-report.timer，週日 20:00 台北，讀 LanExamMock backend 的 progress.db，bot token 在 ~/.claude/channels/telegram-chinese/.env）
- ⚠️ 題庫內容不可交給 subagent 量產（2026-08-02 四個 agent 全交假貨），加題一律逐條人工撰寫並跑雙測試
- 單元學習：`buildUnits(DATA, grade)` 依 id 序決定性切單元（4成語+2俚語+4字音+4字形），過關狀態存 state.units["gX-uY"]；教學卡 view-lesson、列表 view-units
- 自創題庫流程：Tony/老婆把 Word 題庫傳到這條 Telegram → 用 python-docx 或 pandoc 抽文字 → 轉成 js/data/custom.js 條目（id x 開頭連號、tag 標範圍如「五上月考1」、answer 為索引）→ 跑 test → commit push。答案不明的題要回問，不可用猜的
- 錯題本保留制（2026-08-02 二次定案，推翻同日稍早的「答對即移除」）：答對記連對次數並延後 due（3→7→14 天），只有手動刪除（單刪/批刪）會移除；「用猜的」按鈕會把答對的題也 addWrong
- 依序刷題進度存 state.drillPos[cat|grades]，自創題庫 key 為 'custom'
- 內容擴充 roadmap（Tony 2026-08-02 定案，每日分批）：閱讀 54→102 篇（小學各8/國中各10/高中各8，優先）；成語 800→1000；字音 420→600；字形 400→600；俚語 320→400；成語 wordExp 逐字解析從小二往上補到全 800 條（小一已完成）；配圖目標全 800 條。動畫暫緩（成本高，Tony 同意先圖+逐字解析）
- 筆順動畫：js/vendor/hanzi-writer.min.js + strokes/uXXXX.json（來源 hanzi-writer-data，Arphic 授權見 strokes/README.md）；新增字形題後跑一次下載腳本補字（參考 git log f3972f1 的做法）；載不到的字自動隱藏面板

## 2026-08-03 全科版擴充（Tony 定案）

- 全科架構：進站先選科目（js/data/subjects.js 的 APP_SUBJECTS：國語/英文/數學/自然/社會），state.subject 記住；國語以外先有架構、題庫空著（schema 同 custom，id 前綴 e/m/n/o），有題後首頁自動出現「開始練習」
- 自創題庫分冊分課：custom 條目加選填 `book`（冊，如"五上"）、`lesson`（課，如"第1課"）；前端 view-custom 依 冊→課 選範圍刷題，進度 key 為 `custom|冊|課`（全庫沿用舊 key 'custom'）；沒標 book 歸「未分類」
- 測驗 UI 規則（2026-08-03 Tony 要求寫明）：
  - 「用猜的」按鈕：只在**第一次就答對**後顯示（答錯的題已自動加入錯題本，回饋文字會標明）；回顧舊題不顯示，回到最新已答對題會恢復顯示
  - 二次作答（2026-08-03）：第一次答錯不公布答案，提示「再想一次」讓學生自我修正，第二次作答後才顯示解析；成績/錯題本/統計一律以第一次為準；選項只剩 2 個的題不啟用（避免送分）
  - 「上一題」回顧：quiz.snaps 快照制，可往回翻已作答題目（唯讀，含作答結果與解析），「返回 →」走回最新題
  - 自創題庫可依 冊/課/難易度(diff)/題型(qtype) 篩選，刷題進度 key 含全部篩選條件；刷完一輪出現 🎉 完成提示
- 解析強化（範本：Tony 提供的鳶飛戾天筆記，指示詞見 docs/deep-exp-guide.md；2026-08-03 Tony 修訂：成語不要國字拆解）：
  - 成語題答題回饋自動列出其他 3 個選項的成語意思（讀 meaning）；字音題第 4 個借來的讀音自動標出處
  - 成語注音比較由前端自動生成（term+zhuyin 逐字），不用寫進資料
  - 選填欄位 `deep`：成語＝典故與成語意思（典故由來/字面意思/引申意思，出處不確定寧缺勿錯）；字音/字形＝兩段式（注音比較＋國字拆解與造字原因）；顯示於答題回饋與單元教學卡
  - deep 進度：2026-08-03 全數完成（成語 800/字音 420/字形 400 共 1620 條，test.js 有覆蓋率測試把關）；自創題庫等 Tony 交題後比照套用；新增題目時 deep 一併撰寫
