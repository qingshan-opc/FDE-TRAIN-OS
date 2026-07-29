document.documentElement.classList.add('js');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.08 });
  document.querySelectorAll('.rv').forEach(el => io.observe(el));
  setTimeout(() => document.querySelectorAll('.rv').forEach(el => el.classList.add('in')), 1500);
  window.addEventListener('beforeprint', () => {
    document.querySelectorAll('details.day').forEach(d => d.setAttribute('open', ''));
  });
