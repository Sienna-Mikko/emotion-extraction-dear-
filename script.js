const inputEl = document.getElementById('inputText');
const analyzeBtn = document.getElementById('analyzeBtn');
const demoBtn = document.getElementById('demoBtn');
const boldShortListEl = document.getElementById('boldShortList');
const boldLongListEl = document.getElementById('boldLongList');
const italicShortListEl = document.getElementById('italicShortList');
const annotatedEl = document.getElementById('annotatedText');

const emphasisWords = [
  '必须', '一定', '关键', '核心', '最重要', '绝对', '立刻', '马上',
  '非常', '尤其', '深刻', '强烈', '惊喜', '担心', '焦虑', '兴奋', '温暖',
  '突破', '复盘', '坚持', '成长', '风险', '机会'
];

const splitSentences = (text) => text
  .split(/(?<=[。！？!?；;\n])/)
  .map((s) => s.trim())
  .filter(Boolean);

const splitPhrases = (text) => text
  .split(/[，,。！？!?；;\n、：:]/)
  .map((s) => s.trim())
  .filter(Boolean)
  .filter((s) => s.length >= 2 && s.length <= 14);

const scoreUnit = (unit) => {
  let score = 1;

  emphasisWords.forEach((word) => {
    if (unit.includes(word)) score += 3;
  });

  const exclamations = (unit.match(/[!！]/g) || []).length;
  const questions = (unit.match(/[?？]/g) || []).length;
  score += exclamations * 2 + questions;

  if (/(先|再|最后|因为|所以|但是|不过|只要|如果)/.test(unit)) {
    score += 1;
  }

  return score;
};

const uniqueByText = (arr) => {
  const seen = new Set();
  return arr.filter((item) => {
    if (seen.has(item)) return false;
    seen.add(item);
    return true;
  });
};

const pickTop = (items, minCount, maxCount) => {
  if (!items.length) return [];

  const scored = uniqueByText(items)
    .map((text, index) => ({ text, score: scoreUnit(text), index }))
    .sort((a, b) => b.score - a.score);

  const count = Math.min(maxCount, Math.max(minCount, Math.round(scored.length / 2)));
  return scored.slice(0, count).map((x) => x.text);
};

const escapeHtml = (str) => str
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const annotateText = (text, boldItems, italicItems) => {
  let html = escapeHtml(text);

  const boldSorted = [...new Set(boldItems)].sort((a, b) => b.length - a.length);
  boldSorted.forEach((item) => {
    const escaped = escapeHtml(item);
    const reg = new RegExp(escapeRegExp(escaped), 'g');
    html = html.replace(reg, `<span class="emphasis-bold">${escaped}</span>`);
  });

  const italicSorted = [...new Set(italicItems)].sort((a, b) => b.length - a.length);
  italicSorted.forEach((item) => {
    const escaped = escapeHtml(item);
    const reg = new RegExp(escapeRegExp(escaped), 'g');
    html = html.replace(reg, `<span class="emphasis-italic">${escaped}</span>`);
  });

  return html;
};

const renderList = (el, items) => {
  el.innerHTML = '';
  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    el.appendChild(li);
  });
};

const extractRules = (text) => {
  const sentences = splitSentences(text);
  const shortSentences = sentences.filter((s) => s.length <= 28);
  const longSentences = sentences.filter((s) => s.length >= 29);
  const shortPhrases = splitPhrases(text).filter((s) => s.length <= 14);

  const boldShort = pickTop([...shortPhrases, ...shortSentences], 1, 5);
  const boldLong = pickTop(longSentences, 1, 5);

  const remainingShort = shortSentences.filter((s) => !boldShort.includes(s));
  const italicShort = pickTop(remainingShort, 1, 3);

  return { boldShort, boldLong, italicShort };
};

const render = () => {
  const text = inputEl.value.trim();

  if (!text) {
    boldShortListEl.innerHTML = '';
    boldLongListEl.innerHTML = '';
    italicShortListEl.innerHTML = '';
    annotatedEl.innerHTML = '<span class="empty">请输入文本后再提取。</span>';
    return;
  }

  const { boldShort, boldLong, italicShort } = extractRules(text);

  renderList(boldShortListEl, boldShort);
  renderList(boldLongListEl, boldLong);
  renderList(italicShortListEl, italicShort);

  const allBold = [...boldShort, ...boldLong];
  annotatedEl.innerHTML = annotateText(text, allBold, italicShort);
};

analyzeBtn.addEventListener('click', render);

demoBtn.addEventListener('click', () => {
  inputEl.value = '你现在的进度其实已经很不错了，但接下来最重要的是把节奏稳定住。你必须每天留出30分钟做复盘，这会直接决定你能不能突破瓶颈！我知道你有点焦虑，不过这很正常，因为你正在成长。只要你坚持两周，你会非常明显地看到变化。现在先把每日目标压缩成3件最关键的事，再逐步提速。';
  render();
});

annotatedEl.innerHTML = '<span class="empty">标注后的文本会显示在这里。</span>';
