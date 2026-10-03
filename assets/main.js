(() => {
  const navigation = document.querySelector('.site-navigation');
  const trigger = document.querySelector('.nav-trigger');
  const menu = document.querySelector('#site-menu');
  let closeTimer;

  function cancelClose() {
    clearTimeout(closeTimer);
  }

  function openMenu() {
    cancelClose();
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    trigger.setAttribute('aria-label', '关闭站点导航');
  }

  function closeMenu(returnFocus = false) {
    cancelClose();
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-label', '打开站点导航');
    if (returnFocus) trigger.focus();
  }

  if (navigation && trigger && menu) {
    trigger.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse' && matchMedia('(hover: hover)').matches) openMenu();
    });
    navigation.addEventListener('pointerenter', cancelClose);
    navigation.addEventListener('pointerleave', event => {
      if (event.pointerType === 'mouse' && !navigation.contains(document.activeElement)) {
        closeTimer = setTimeout(() => closeMenu(), 180);
      }
    });
    trigger.addEventListener('click', () => {
      if (menu.hidden) openMenu();
      else closeMenu();
    });
    trigger.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        openMenu();
        menu.querySelector('a').focus();
      }
    });
    menu.querySelector('.nav-close').addEventListener('click', () => closeMenu(true));
    menu.addEventListener('click', event => {
      if (event.target.closest('a')) closeMenu();
    });
    navigation.addEventListener('focusout', event => {
      if (event.relatedTarget && !navigation.contains(event.relatedTarget)) closeMenu();
    });
    document.addEventListener('pointerdown', event => {
      if (!menu.hidden && !navigation.contains(event.target)) closeMenu();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !menu.hidden) closeMenu(true);
    });
  }

  const motionToggles = document.querySelectorAll('.motion-toggle');
  motionToggles.forEach(motionToggle => {
    motionToggle.addEventListener('click', () => {
      const paused = document.body.classList.toggle('motion-paused');
      motionToggles.forEach(button => {
        button.setAttribute('aria-pressed', String(paused));
        button.textContent = paused ? '继续动画' : '暂停动画';
      });
    });
  });
})();
