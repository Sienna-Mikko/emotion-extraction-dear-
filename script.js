const inputEl = document.getElementById('inputText');
const analyzeBtn = document.getElementById('analyzeBtn');
const demoBtn = document.getElementById('demoBtn');
const pointsListEl = document.getElementById('pointsList');
const annotatedEl = document.getElementById('annotatedText');

const emphasisWords = [
  '必须', '一定', '关键', '核心', '最重要', '绝对', '立刻', '马上',
  '非常', '尤其', '深刻', '强烈', '惊喜', '担心', '焦虑', '兴奋', '温暖'
];

const splitSentences = (text) => text
  .split(/(?<=[。！？!?；;\n])/)
  .map((s) => s.trim())
  .filter(Boolean);

const sentenceScore = (sentence) => {
  let score = 1;

  emphasisWords.forEach((word) => {
    if (sentence.includes(word)) {
      score += 2;
    }
  });

  const exclamations = (sentence.match(/[!！]/g) || []).length;
  const questions = (sentence.match(/[?？]/g) || []).length;
  score += exclamations * 2 + questions;

  if (sentence.length > 24) {
    score += 1;
  }

  return score;
};

const pickTopPoints = (text) => {
  const sentences = splitSentences(text);
  if (!sentences.length) return [];

  const scored = sentences.map((sentence, index) => ({
    sentence,
    score: sentenceScore(sentence),
    index,
  }));

  const count = Math.min(3, Math.max(1, Math.round(sentences.length / 3)));

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence);
};

const escapeHtml = (str) => str
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

const annotateText = (text, points) => {
  let html = escapeHtml(text);

  points.forEach((point, idx) => {
    const escapedPoint = escapeHtml(point);
    const markerClass = idx % 2 === 0 ? 'highlight' : 'underline';
    html = html.replace(escapedPoint, `<span class="${markerClass}">${escapedPoint}</span>`);
  });

  emphasisWords.forEach((word) => {
    const safeWord = escapeHtml(word);
    const reg = new RegExp(safeWord, 'g');
    html = html.replace(reg, `<span class="underline">${safeWord}</span>`);
  });

  return html;
};

const render = () => {
  const text = inputEl.value.trim();
  pointsListEl.innerHTML = '';

  if (!text) {
    annotatedEl.innerHTML = '<span class="empty">请输入文本后再提取。</span>';
    return;
  }

  const points = pickTopPoints(text);

  points.forEach((point) => {
    const li = document.createElement('li');
    li.textContent = point;
    pointsListEl.appendChild(li);
  });

  annotatedEl.innerHTML = annotateText(text, points);
};

analyzeBtn.addEventListener('click', render);

demoBtn.addEventListener('click', () => {
  inputEl.value = '你现在的进度其实已经很不错了，但接下来最重要的是把节奏稳定住。你必须每天留出 30 分钟做复盘，这会直接决定你能不能突破瓶颈！我知道你有点焦虑，不过这很正常，因为你正在成长。只要你坚持两周，你会非常明显地看到变化。';
  render();
});

annotatedEl.innerHTML = '<span class="empty">标注后的文本会显示在这里。</span>';
