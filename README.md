# Sienna Warm Record (Android App)

这是一个 **Kotlin + Jetpack Compose** 的 Android App 工程，可以直接导入 Android Studio。

## 功能结构

- **Home**
  - 欢迎文案：`欢迎回家，Sienna💙`
  - 启动后随机抽取一句情感副标题，并在当前会话内保持不变。

- **Mikkohub**（本地文字储存）
  - 创建卷册、编辑卷册名
  - 编辑/仅阅读模式切换
  - 选择图片作为封面
  - 每卷显示创建日期
  - 达到 `100000` 字时弹窗提示：
    `sienna💙这本已经很厚了，要不要开新卷?`
  - 全局搜索所有卷册，返回片段并可点击定位到对应卷册

- **Care**（健康记录）
  - 每日记录体重
  - 折线图以日期为 X 轴、体重为 Y 轴
  - 中间断更会断线，不会误连

## 技术栈

- Kotlin
- Jetpack Compose + Material3
- DataStore Preferences（本地持久化）
- Kotlinx Serialization

## 导入 Android Studio

1. 打开 Android Studio
2. `File -> Open` 选择本仓库根目录
3. 等待 Gradle Sync 完成
4. 连接模拟器或真机后运行 `app`

## 关键文件

- `app/src/main/java/com/sienna/warmrecord/MainActivity.kt`
- `app/src/main/AndroidManifest.xml`
- `app/build.gradle.kts`
- `settings.gradle.kts`
