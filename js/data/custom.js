window.APP_DATA = window.APP_DATA || {};
// 自創題庫:由家長提供的題庫檔(Word 等)轉檔而來。
// schema: { id:"x001", book:"五上", lesson:"第1課", tag:"五上月考1",
//           q:"題目文字", options:["A","B","C","D"], answer:0, exp:"解說" }
// id 以 x 開頭連號;answer 是正確選項索引(0-3);tag 標示來源範圍。
// book(冊)/lesson(課) 為分冊分課用,前端可依 冊→課 選範圍練習;沒有就歸入「未分類」。
window.APP_DATA.custom = [];
