(() => {
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.querySelector('#mobile-nav');

  if (!toggle || !menu) return;

  const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';

  function closeMenu(returnFocus = false) {
    if (!isOpen()) return;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', '打开导航菜单');
    menu.hidden = true;
    if (returnFocus) toggle.focus();
  }

  toggle.addEventListener('click', () => {
    if (isOpen()) {
      closeMenu();
      return;
    }
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', '关闭导航菜单');
  });

  menu.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
  });

  menu.addEventListener('focusout', event => {
    if (event.relatedTarget && !menu.contains(event.relatedTarget) && event.relatedTarget !== toggle) {
      closeMenu();
    }
  });

  document.addEventListener('click', event => {
    if (isOpen() && !menu.contains(event.target) && !toggle.contains(event.target)) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && isOpen()) closeMenu(true);
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 640) closeMenu();
  });
})();
