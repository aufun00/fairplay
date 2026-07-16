/* FairPlay — mathdoku 专属语言包。本文件装该页全部语种(每语种一个 I18N.<lang> 块)。
   通用置顶栏 + 成绩分享(score/game_share/game_share_btn)来自上级 ../index.lang.js。
   {N} 在 md_rules 里按棋盘尺寸替换。 */
window.I18N = window.I18N || {};
window.I18N.en = Object.assign(window.I18N.en || {}, {
  game_name: "MathDoku",          /* 成绩分享 {game} 用(渲染时后接尺寸,如 "MathDoku 5") */
  md_start: "Start",
  md_resume: "Resume",
  md_pause: "Pause",
  md_win: "Solved!",
  md_rules_title: "How to play",
  md_note: "Notes",
  md_erase: "Erase",
  md_undo: "Undo",
  md_redo: "Redo",
  md_aux: "Helper",
  md_aux_hint: "Pick a cell, then tap the operator to decompose its cage — results collect here.",
  md_aux_none: "no solution",
  md_rules: "Fill the {N}×{N} grid with 1–{N} so no number repeats in any row or column. Colored borders mark cages; the corner shows a target and operator — the cage's numbers must combine with it to reach the target. Single given cells are locked. A number turns red only when it already appears in the same row or column, or its cage can no longer reach its target. Each warning adds penalty time. Fill the grid with no red to win — shortest total time (with penalties) wins.",
  /* 目录条目(inf):home 渲染 L3 用。键名 = mathdoku<size><difficulty> */
  mathdoku54: { name: "MathDoku 5", desc: "5×5 · logic grid" },
  mathdoku94: { name: "MathDoku 9", desc: "9×9 · logic grid" }
});
window.I18N.zh = Object.assign(window.I18N.zh || {}, {
  game_name: "MathDoku",
  md_start: "开始",
  md_resume: "继续",
  md_pause: "暂停",
  md_win: "完成!",
  md_rules_title: "玩法说明",
  md_note: "笔记",
  md_erase: "删除",
  md_undo: "撤销",
  md_redo: "重做",
  md_aux: "分解助手",
  md_aux_hint: "选一个格子,点运算符分解它所在的笼,结果累加在这里。",
  md_aux_none: "无解",
  md_rules: "在 {N}×{N} 方格里填 1~{N},每行、每列数字不重复。彩色粗线围出笼子,左上角是目标数与运算符,笼内数字用该运算凑出目标;单格已给出、不可改。只有两种情况数字变红:该数字同行或同列已出现,或该笼已不可能凑出目标。每次警告都会增加罚时。填满且无红即通关——总用时(含罚时)最短者胜。",
  mathdoku54: { name: "MathDoku 5", desc: "5×5 · 逻辑方格" },
  mathdoku94: { name: "MathDoku 9", desc: "9×9 · 逻辑方格" }
});
