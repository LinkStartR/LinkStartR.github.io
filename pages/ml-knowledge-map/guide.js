(() => {
  const current = document.querySelector('.mini-map [aria-current="page"]');
  if (current) {
    const map = current.closest('.mini-map');
    const position = current.getBoundingClientRect().left - map.getBoundingClientRect().left + map.scrollLeft;
    map.scrollLeft = position - (map.clientWidth - current.clientWidth) / 2;
  }
  const cards = [...document.querySelectorAll('.concept-card')];
  const links = [...document.querySelectorAll('.docs-sidebar a[data-card]')].filter(link => {
    const destination = new URL(link.href, window.location.href);
    return destination.origin === window.location.origin && destination.pathname === window.location.pathname;
  });
  const status = document.querySelector('.reading-status');
  if (cards.length && 'IntersectionObserver' in window) {
    const visibleCards = new Set();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) visibleCards.add(entry.target);
        else visibleCards.delete(entry.target);
      });
      const visible = [...visibleCards].sort((a,b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
      if (!visible.length) return;
      const active = visible[0];
      links.forEach(link => {
        const selected = link.dataset.card === active.id;
        link.classList.toggle('active', selected);
        if (selected) {
          link.setAttribute('aria-current', 'location');
          const group = link.closest('.doc-group');
          if (group) group.open = true;
        }
        else link.removeAttribute('aria-current');
      });
      if (status) status.textContent = `当前概念 ${cards.indexOf(active) + 1} / ${cards.length}`;
    }, {rootMargin: '-110px 0px -45% 0px', threshold: 0});
    cards.forEach(card => observer.observe(card));
  }

  const sidebar = document.querySelector('.docs-sidebar');
  const toggle = document.querySelector('.docs-toggle');
  const backdrop = document.querySelector('.docs-backdrop');
  const main = document.querySelector('main');
  if (!sidebar || !toggle) return;
  const desktop = window.matchMedia('(min-width: 981px)');

  function focusContent(element) {
    if (!element) return;
    const hadTabindex = element.hasAttribute('tabindex');
    if (!hadTabindex) {
      element.setAttribute('tabindex', '-1');
      element.addEventListener('blur', () => element.removeAttribute('tabindex'), {once: true});
    }
    element.focus({preventScroll: true});
  }

  function setNavigation(open, restoreFocus = false) {
    const expanded = !desktop.matches && open;
    document.body.classList.toggle('docs-nav-open', expanded);
    toggle.setAttribute('aria-expanded', String(expanded));
    sidebar.inert = !desktop.matches && !expanded;
    if (sidebar.inert) sidebar.setAttribute('aria-hidden', 'true');
    else sidebar.removeAttribute('aria-hidden');
    if (backdrop) backdrop.inert = !expanded;
    if (expanded) {
      const firstLink = [...sidebar.querySelectorAll('a[href]')].find(link => link.getClientRects().length);
      if (firstLink) firstLink.focus({preventScroll: true});
    } else if (restoreFocus && !desktop.matches) {
      toggle.focus({preventScroll: true});
    }
  }

  function isNavigationOpen() {
    return !desktop.matches && document.body.classList.contains('docs-nav-open');
  }

  toggle.addEventListener('click', () => {
    const open = isNavigationOpen();
    setNavigation(!open, open);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && isNavigationOpen()) {
      event.preventDefault();
      setNavigation(false, true);
    }
  });
  if (backdrop) backdrop.addEventListener('click', () => setNavigation(false, true));
  if (main) main.addEventListener('click', event => {
    if (!isNavigationOpen()) return;
    const sidebarHadFocus = sidebar.contains(document.activeElement);
    setNavigation(false);
    if (sidebarHadFocus) {
      const control = event.target.closest('a[href], button, input, select, textarea, [tabindex]');
      if (control) control.focus({preventScroll: true});
      else focusContent(main);
    }
  });
  sidebar.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || !isNavigationOpen()) return;
    const destination = new URL(link.href, window.location.href);
    let target = null;
    if (destination.origin === window.location.origin && destination.pathname === window.location.pathname && destination.hash) {
      target = document.getElementById(decodeURIComponent(destination.hash.slice(1)));
    }
    setNavigation(false, !target);
    if (target) focusContent(target);
  });
  desktop.addEventListener('change', () => {
    const sidebarHadFocus = sidebar.contains(document.activeElement);
    setNavigation(false, sidebarHadFocus);
  });
  setNavigation(false);
})();
