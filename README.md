# 落笔 · 手写稿生成器

一个完全在浏览器本地运行的中文手写稿生成器，支持实时预览、多页排版和高清导出。

在线体验：[https://ggooaappee.github.io/handwriting-studio/](https://ggooaappee.github.io/handwriting-studio/)

## 功能

- 三款开源中文手写字体
- 黑色、蓝色和铅笔灰墨水
- 素白纸、横线纸、方格纸和点阵纸
- 字号、行距、页边距和对齐方式调整
- 文字凌乱度、笔画随机度和轻微勾画控制
- 最长自动排版到多页 A4
- 300 DPI PNG、ZIP 和 PDF 导出
- `.txt`、`.md`、`.docx` 文本导入
- 所有文字只在浏览器本地处理，不上传服务器

## 本地运行

```bash
pnpm install
pnpm dev
```

生产构建：

```bash
pnpm test
pnpm build
pnpm preview
```

## 字体许可

项目内置字体来自 Google Fonts，并依照 SIL Open Font License 1.1 使用：

- Long Cang
- Ma Shan Zheng
- Zhi Mang Xing

完整许可见 [public/fonts/OFL.txt](public/fonts/OFL.txt)。

## 设计参考

交互与参数设计参考了常见的在线手写稿工具，包括字体切换、纸张样式、文字凌乱度和随机勾画。应用代码、界面和 Canvas 排版实现均为本项目独立实现。

## License

[MIT](LICENSE)
