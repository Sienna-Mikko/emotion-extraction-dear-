# Sienna · 温暖记录 App

一个本地优先（local-first）的轻量记录应用，包含三个页面：

- **home**：欢迎页 + 启动时随机情感副标题（使用中保持不变）
- **Mikkohub**：本地文字卷册（可编辑/只读、封面、10w 字提醒、全局搜索定位）
- **care**：按日期记录体重，并用带断点的折线图展示趋势

## 运行

```bash
npm install
npm start
```

然后打开：`http://localhost:4173`

## 主要实现点

- 数据全部存储在浏览器 `localStorage`。
- Home 副标题使用 `sessionStorage` 锁定一次随机结果，避免同次使用中变化。
- Mikkohub 每卷达到 `100000` 字时弹窗提示：
  `sienna💙这本已经很厚了，要不要开新卷?`
- 搜索返回结果会携带 `bookId + charIndex`，点击后可定位到对应卷册内容位置。
- Care 折线图中如果日期不连续（中间有漏记），会断线而非强行连线。
