# 豆豆背单词

基于 Vue 3 + Vite 的单词学习应用，支持多词库、多学习计划、考试模式。

## 功能特性

- 多词库支持：从 CDN 自动同步词库
- 多学习计划：自由配置词库、题型和数量
- SM-2 间隔重复算法智能选词
- 三种题型：看英文选中文、看中文写英文、例句填空
- 考试模式：独立的考试功能，带加权评分
- 实时进度保存：刷新页面不丢失
- 学习记录：按日期展示完整学习历史
- 数据备份：JSON 导入/导出

## 开发

```bash
npm install
./scripts/test.sh
```

开发服务器默认运行在 http://localhost:5173

## 构建

```bash
npm run build
```

产物在 `dist/` 目录：
- `remember_words.html` — 入口页面
- `remember_words/` — JS/CSS 资源

## 发布

需要 Python 依赖：

```bash
pip install -r requirements.txt
```

执行发布：

```bash
python scripts/deploy.py
```

会自动构建并上传到七牛云，发布后访问：
https://statics01.readland.cn/remember_words.html

## 词库管理

词库源文件放在 `datasets/` 目录，通过 `datasets/index.yaml` 描述元数据。

CSV 格式（v2，6列）：
```
english,chinese,phonetic,exampleEn,exampleCn,explanation
```

发布时会自动计算 MD5、生成 index.csv 并上传到 CDN。

## 项目结构

```
src/
  main.ts          # 入口
  App.vue          # 根组件 + 底部 TabBar
  router/          # Vue Router (hash mode)
  stores/          # Pinia stores
  views/           # 页面组件
  components/      # 通用组件
  lib/             # 工具库（存储、SM-2、同步等）
datasets/          # 词库源文件
scripts/
  test.sh          # 启动开发服务器
  deploy.py        # 构建 + 发布到七牛云
```
