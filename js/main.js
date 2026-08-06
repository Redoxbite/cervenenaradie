(() => {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  // Mobile brand nav
  const toggle = document.getElementById("nav-toggle");
  const brandNav = document.getElementById("brand-nav");
  toggle?.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!open));
    brandNav?.classList.toggle("is-open", !open);
  });

  brandNav?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      toggle?.setAttribute("aria-expanded", "false");
      brandNav.classList.remove("is-open");
    });
  });

  // Hero carousel
  const slides = [...document.querySelectorAll(".hero__slide")];
  const dots = [...document.querySelectorAll(".hero__dot")];
  let index = 0;
  let timer;

  function goTo(i) {
    index = (i + slides.length) % slides.length;
    slides.forEach((slide, n) => slide.classList.toggle("is-active", n === index));
    dots.forEach((dot, n) => dot.classList.toggle("is-active", n === index));
  }

  function startAuto() {
    stopAuto();
    timer = window.setInterval(() => goTo(index + 1), 5500);
  }

  function stopAuto() {
    if (timer) window.clearInterval(timer);
  }

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      goTo(Number(dot.dataset.slide));
      startAuto();
    });
  });

  if (slides.length > 1) startAuto();

  // Cart demo
  const cart = [];
  const badge = document.getElementById("cart-badge");
  const label = document.getElementById("cart-label");
  const toast = document.getElementById("toast");
  let toastTimer;

  function showToast(message) {
    if (!toast) return;
    toast.hidden = false;
    toast.textContent = message;
    requestAnimationFrame(() => toast.classList.add("is-show"));
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.classList.remove("is-show");
      window.setTimeout(() => {
        toast.hidden = true;
      }, 260);
    }, 2200);
  }

  function updateCartUi() {
    const count = cart.length;
    if (badge) {
      badge.hidden = count === 0;
      badge.textContent = String(count);
    }
    if (label) {
      label.textContent = count === 0 ? "Prázdny košík" : `Košík (${count})`;
    }
  }

  document.querySelectorAll(".btn--cart").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-product") || "Produkt";
      const price = Number(btn.getAttribute("data-price") || 0);
      cart.push({ name, price });
      updateCartUi();
      showToast(`Pridané: ${name}`);
    });
  });

  // Search — prevent empty submit bounce
  document.querySelector(".search")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = e.target.querySelector("input")?.value?.trim();
    if (q) showToast(`Hľadám: ${q}`);
  });
})();
