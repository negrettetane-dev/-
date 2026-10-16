export function setupScrollReveal(selector: string): () => void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    return () => {};
  }

  const revealed = new WeakSet<Element>();
  const enterObserver = new IntersectionObserver(entries => {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting && !target.classList.contains('is-visible') && !target.classList.contains('has-revealed')) {
        target.classList.remove('is-exiting');
        target.classList.add('is-visible');
        revealed.add(target);
      }
    });
  });
  const exitObserver = new IntersectionObserver(entries => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting && revealed.has(target) && !target.classList.contains('is-exiting')) {
        target.classList.remove('is-visible');
        target.classList.remove('has-revealed');
        target.classList.add('is-exiting');
      }
    });
  }, { rootMargin: '120px 0px' });

  const observe = (root: ParentNode) => {
    if (root instanceof Element && root.matches(selector)) {
      root.classList.add('scroll-reveal');
      enterObserver.observe(root);
      exitObserver.observe(root);
    }
    root.querySelectorAll(selector).forEach(element => {
      element.classList.add('scroll-reveal');
      enterObserver.observe(element);
      exitObserver.observe(element);
    });
  };

  observe(document.body);
  const onAnimationEnd = (event: AnimationEvent) => {
    if (event.animationName !== 'scroll-reveal' || !(event.target instanceof Element)) return;
    event.target.classList.remove('is-visible');
    event.target.classList.add('has-revealed');
  };
  document.addEventListener('animationend', onAnimationEnd);
  const mutations = new MutationObserver(records => {
    records.forEach(record => {
      record.addedNodes.forEach(node => {
        if (node instanceof Element) observe(node);
      });
      record.removedNodes.forEach(node => {
        if (!(node instanceof Element)) return;
        enterObserver.unobserve(node);
        exitObserver.unobserve(node);
        node.querySelectorAll(selector).forEach(element => {
          enterObserver.unobserve(element);
          exitObserver.unobserve(element);
        });
      });
    });
  });
  mutations.observe(document.body, { childList: true, subtree: true });

  return () => {
    mutations.disconnect();
    enterObserver.disconnect();
    exitObserver.disconnect();
    document.removeEventListener('animationend', onAnimationEnd);
    document.querySelectorAll('.scroll-reveal').forEach(element => {
      element.classList.remove('scroll-reveal', 'is-visible', 'is-exiting', 'has-revealed');
    });
  };
}
