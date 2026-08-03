window.APP_DATA = window.APP_DATA || {};
// 全科架構（2026-08-03 Tony 定案）：進站先選年級+科目；國語以外先有架構、題庫後補。
// APP_SUBJECTS 順序即首頁科目卡順序；ready=false 的科目顯示「題庫建置中」。
window.APP_SUBJECTS = [
  { key: 'chinese', name: '國語', icon: '📖', ready: true,  desc: '成語・俚語・字音・字形・閱讀' },
  { key: 'english', name: '英文', icon: '🔤', ready: false, desc: '題庫建置中' },
  { key: 'math',    name: '數學', icon: '🔢', ready: false, desc: '題庫建置中' },
  { key: 'science', name: '自然', icon: '🔬', ready: false, desc: '題庫建置中' },
  { key: 'social',  name: '社會', icon: '🌏', ready: false, desc: '題庫建置中' }
];
// 非國語科目題庫（先空著）。schema（選擇題，比照 custom）：
// { id:"e001"(英)/"m001"(數)/"n001"(自)/"o001"(社), grade:1-12, book:"五上", lesson:"第1課",
//   q:"題目文字", options:["A","B","C","D"], answer:0, exp:"解說" }
window.APP_DATA.english = [];
window.APP_DATA.math = [];
window.APP_DATA.science = [];
window.APP_DATA.social = [];
