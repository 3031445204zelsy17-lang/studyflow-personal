/**
 * bridge.js  v2
 * 作用一：修复 index.html 缺少初始化代码导致首页空白的问题
 * 作用二：在课程弹窗里注入「查看完整详情」按钮，链接到 course-detail.html
 * 作用三：通过 localStorage 同步两页的课程状态
 *
 * 使用方法：在 index.html 的 </body> 前添加一行：
 *   <script src="bridge.js"></script>
 * 目录结构：
 *   project/
 *   ├── index.html
 *   ├── bridge.js
 *   └── pages/
 *       └── course-detail.html
 */

(function () {

  // ── 配置 ─────────────────────────────────────────────────────────
  const DETAIL_PAGE = 'course-detail.html';

  // ── 1. 修复首页空白：页面加载后自动渲染 Home 内容 ─────────────────
  document.addEventListener('DOMContentLoaded', function () {

    // 等 index.html 的脚本全部执行完再初始化
    requestAnimationFrame(function () {

      const mainContent = document.getElementById('mainContent');

      // 如果 mainContent 仍然是空的，手动渲染首页
      if (mainContent && mainContent.innerHTML.trim() === '') {
        if (typeof window.renderHomePage === 'function') {
          mainContent.innerHTML = window.renderHomePage();
        }
      }

      // 初始化图标
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }

      // 高亮 Home 导航按钮
      const navLinks = document.querySelectorAll('.nav-link');
      if (navLinks.length > 0) {
        navLinks.forEach(l => {
          l.classList.remove('text-hkmu-blue', 'font-semibold');
          l.classList.add('text-text-secondary');
        });
        navLinks[0].classList.remove('text-text-secondary');
        navLinks[0].classList.add('text-hkmu-blue', 'font-semibold');
      }

      // ── 2. 修复 showPage 依赖 event.target 导致无法程序化调用的问题 ──
      const _original = window.showPage;
      if (typeof _original === 'function') {
        window.showPage = function (pageName) {
          const mainContent = document.getElementById('mainContent');
          if (!mainContent) return;

          // 更新导航高亮（不依赖 event.target）
          document.querySelectorAll('.nav-link').forEach(l => {
            l.classList.remove('text-hkmu-blue', 'font-semibold');
            l.classList.add('text-text-secondary');
          });
          document.querySelectorAll('.nav-link').forEach(btn => {
            const oc = btn.getAttribute('onclick') || '';
            if (oc.includes("'" + pageName + "'")) {
              btn.classList.remove('text-text-secondary');
              btn.classList.add('text-hkmu-blue', 'font-semibold');
            }
          });

          // 关闭移动端菜单
          const mobileMenu = document.getElementById('mobileMenu');
          if (mobileMenu) mobileMenu.classList.add('hidden');

          // 渲染对应页面
          const renders = {
            home:     window.renderHomePage,
            progress: window.renderProgressPage,
            courses:  window.renderCoursesPage,
            plan:     window.renderPlanPage
          };
          const fn = renders[pageName];
          if (typeof fn === 'function') {
            mainContent.innerHTML = fn();
          }

          if (typeof lucide !== 'undefined') lucide.createIcons();
        };
      }

      // ── 3. 拦截 openCourseModal，注入「查看完整详情」按钮 ───────────
      const _originalModal = window.openCourseModal;
      if (typeof _originalModal === 'function') {
        window.openCourseModal = function (courseId) {
          _originalModal.call(this, courseId);

          requestAnimationFrame(function () {
            if (document.getElementById('bridge-detail-btn')) return;

            const btn = document.createElement('a');
            btn.id = 'bridge-detail-btn';
            btn.href = DETAIL_PAGE + '?id=' + encodeURIComponent(courseId);
            btn.style.cssText = [
              'display:inline-flex', 'align-items:center', 'gap:10px',
              'margin-top:24px', 'padding:50px 100px',
              'background:#0066CC', 'color:white',
              'border-radius:20px', 'font-size:25px',
              'font-weight:700', 'text-decoration:none',
              'transition:background 0.2s', 'width:100%',
              'justify-content:center'
            ].join(';');
            btn.onmouseover = () => btn.style.background = '#0052a3';
            btn.onmouseout  = () => btn.style.background = '#0066CC';
            btn.innerHTML   = '📄 查看完整课程详情页';

            const modalContent = document.getElementById('courseModalContent');
            if (modalContent) modalContent.insertBefore(btn, modalContent.firstChild);
          });
        };
      }
    });
  });

  // ── 4. 页面重新可见时同步 localStorage 课程状态 ────────────────────
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      const saved = JSON.parse(localStorage.getItem('courseStatuses') || '{}');
      if (window.userProgress) {
        Object.assign(window.userProgress, saved);
      }
    }
  });

})();
