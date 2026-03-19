# HKMU Campus Forum - 校园服务平台

香港都会大学（HKMU）校园一站式服务平台，提供多个实用模块。

## 模块列表

| 模块 | 功能 | 链接 |
|------|------|------|
| DSAI Course Planner | DSAI 课程规划与选课系统 | [进入](dsai-planner.html) |
| HKMU News Portal | HKMU 新闻门户网站 | [进入](hkmu-news.html) |
| Student Forum | 学生自由讨论区 | [进入](student-forum.html) |
| Lost & Found | 失物招领系统 | [进入](lost-found.html) |
| IT Club | IT 社团展示 | [进入](it-club.html) |
| Main Interface | 主界面 | [进入](main-interface.html) |

## 技术栈

- HTML5 + CSS3
- JavaScript (ES6+)
- Tailwind CSS (via CDN)
- Bootstrap 5 (via CDN)
- Lucide Icons (via CDN)
- Google Fonts

## 功能特性

- ✅ 完全静态页面，无需后端服务器
- ✅ 响应式设计，支持移动端
- ✅ 使用 localStorage 进行数据持久化
- ✅ 跨模块数据同步（DSAI 系统）

## 本地运行

1. 克隆或下载本项目
2. 直接在浏览器中打开 `index.html`
3. 或使用本地服务器：
   ```bash
   python3 -m http.server 8000
   ```
4. 访问 http://localhost:8000

## 部署到 GitHub Pages

### 快速部署

1. Fork 本仓库
2. 进入仓库 **Settings** → **Pages**
3. 选择 `main` 分支和 `/ (root)` 目录
4. 保存并等待几分钟
5. 访问 `https://your-username.github.io/campus-forum-github/`

## 项目信息

- 开发时间：2026年3月
- 开发团队：HKMU IT 小组
- 许可证：MIT

---

© 2026 Hong Kong Metropolitan University
