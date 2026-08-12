# ZYRONMATRIX

ZYRONMATRIX 是一个在浏览器本地处理图片和视频的 Canvas 像素艺术引擎，支持点阵、ASCII、1-bit 抖动和磨砂玻璃效果。

## 本地开发

需要 Node.js 20.19+。

```bash
pnpm install
pnpm dev
```

常用检查：

```bash
pnpm test
pnpm build
pnpm preview
```

## 代码结构

```text
index.html                          页面语义与控件骨架
guide.html                          使用说明页
src/main.ts                         应用组装、DOM 事件和现有渲染入口
src/styles.css                      Tailwind 入口与站点样式
src/render/grid.ts                  网格几何、降采样和 Stucki 抖动
src/media/video-frame-scheduler.ts  rVFC 视频帧调度与 rAF 兼容回退
src/presets/storage.ts              分账号的本地预设存储
src/services/firebase.ts            延迟加载的认证与云预设服务
public/                              图标、robots.txt、sitemap.xml
```

HTML 现在只负责稳定的页面结构，样式、逻辑和第三方服务已经从单文件中拆出。新增算法应优先放进独立的严格 TypeScript 模块，并通过 `src/**/*.test.ts` 覆盖；`src/main.ts` 是迁移期间的组合层，后续可继续按 `dom/`、`export/` 和渲染 sink 拆分，而不需要更换 UI 框架。

Firebase 和 JSZip 均采用按需加载。本地渲染不依赖 Firebase 成功启动，JSZip 只在视频序列导出时下载。
