import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const clamp = (arr, min, max) => {
  const safe = Array.isArray(arr) ? arr.filter((x) => typeof x === 'string' && x.trim()) : [];
  const dedup = [...new Set(safe.map((x) => x.trim()))];
  if (!dedup.length && min > 0) return [];
  return dedup.slice(0, max);
};

const extractJson = (text) => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
};

app.post('/api/analyze', async (req, res) => {
  const text = (req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'text 不能为空' });

  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: '后端未配置 KIMI_API_KEY，请先配置 .env' });
  }

  const baseUrl = process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1';
  const model = process.env.KIMI_MODEL || 'moonshot-v1-8k';

  const systemPrompt = `你是中文文本重点提取助手。请严格输出 JSON，不要输出任何额外解释。`;
  const userPrompt = `请分析下面文本，并返回 JSON，字段必须包含：
{
  "boldShort": ["..."],
  "boldLong": ["..."],
  "italicShort": ["..."]
}
规则：
1) boldShort：1-5个短句/词语（优先强调词、情绪词、强语气）。
2) boldLong：1-5个长句（信息密度高、关键结论）。
3) italicShort：1-3个短句（情绪峰值、感染力强，尽量避免和boldShort重复）。
4) 必须是原文中的片段，不要改写。
5) 如果某类确实提取不到，可返回空数组。

待分析文本：\n${text}`;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: 'Kimi API 调用失败', detail: errText.slice(0, 500) });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const parsed = extractJson(content);

    if (!parsed) {
      return res.status(502).json({ error: 'Kimi 返回内容无法解析为 JSON', raw: content });
    }

    const boldShort = clamp(parsed.boldShort, 0, 5);
    const boldLong = clamp(parsed.boldLong, 0, 5);
    const italicShort = clamp(parsed.italicShort, 0, 3).filter((x) => !boldShort.includes(x));

    return res.json({ boldShort, boldLong, italicShort });
  } catch (error) {
    return res.status(500).json({ error: '服务端异常', detail: String(error) });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = Number(process.env.PORT || 4173);
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
