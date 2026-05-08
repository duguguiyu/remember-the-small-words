# 记单词小助手

一个面向小朋友的背单词 Web App，单 HTML 文件，数据存储于浏览器 localStorage。

## 快速开始

```bash
./scripts/test.sh
# 浏览器打开 http://localhost:8080
```

## 功能

- **词库管理**：CSV 导入，搜索，查看单词详情（含 Markdown 解释、TTS 发音）
- **学习计划**：配置复习周期、题型数量（看英文选中文 / 看中文写英文 / 例句填空）
- **例句填空**：从英文例句中挖空目标单词，可听整句发音、查看中文释义，填写答案（需词库含例句字段）
- **间隔复习**：简化版 SM-2 算法，自动选取优先级最高的单词；内置方差控制（过度复习惩罚 + 当日去重 + 随机抖动），避免少数词反复出现
- **答案容错**：看中文写英文和例句填空模式下，忽略符号差异（连字符、撇号、句号等），字母内容正确即算对，同时提示正确写法
- **学习流程**：预习 → 确认 → 测试 → 复盘 → 错题循环 → 完成庆祝
- **学习记录**：每日完成情况、轮次详情、missed 标记
- **移动端适配**：手机友好的可爱风格界面

## CSV 词库格式

支持两种格式，导入时自动检测。

### 基础格式（4 列）

字段依次为：英文、中文、音标、完整解释（Markdown 格式，可多行需用引号包裹）。

```csv
apple,苹果,/ˈæp.əl/,"**词性**: 名词
**例句**: I eat an apple every day."
banana,香蕉,/bəˈnæn.ə/,一种黄色的水果
```

### 含例句格式（6 列）

在音标和解释之间增加英文例句和中文例句两列，用于「例句填空」题型。

```csv
apple,苹果,/ˈæp.əl/,I eat an apple every day.,我每天吃一个苹果。,"**词性**: 名词"
banana,香蕉,/bəˈnæn.ə/,The banana is yellow and sweet.,这根香蕉又黄又甜。,一种黄色的水果
```

> 整个 CSV 文件需统一使用同一种格式。导入器会根据首条有效数据行的列数自动判断（≥6 列为含例句格式）。

示例文件：[sample-words.csv](sample-words.csv)（基础格式）

## 技术栈

- 纯 HTML / CSS / JS（单文件 `index.html`）
- CDN 依赖：PapaParse（CSV 解析）、marked（Markdown 渲染）、canvas-confetti（庆祝动画）
- Web Speech API（TTS 发音）
- localStorage（数据持久化）

## 文件结构

```
index.html         主应用（唯一入口）
sample-words.csv   示例词库
scripts/test.sh    本地测试服务器启动脚本
```
