/* ==========================================================================
   Nebula Auth — interactions
   Designed & developed by Balakrishna Undela
   ========================================================================== */
(() => {
  "use strict";

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  const root = document.documentElement;
  const auth = $("#auth");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* storage unavailable */ } },
  };

  /* ------------------------------------------------------------------
     Theme
     ------------------------------------------------------------------ */
  const savedTheme = storage.get("nebula-theme");
  const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  setTheme(savedTheme || (prefersLight ? "light" : "dark"));

  function setTheme(theme) {
    root.dataset.theme = theme;
    $('meta[name="theme-color"]').setAttribute("content", theme === "light" ? "#eef0fb" : "#07070d");
  }

  $("#themeToggle").addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    setTheme(next);
    storage.set("nebula-theme", next);
  });

  /* ------------------------------------------------------------------
     Mode switching (sign in <-> sign up)
     ------------------------------------------------------------------ */
  const panes = { signin: $("#signinPane"), signup: $("#signupPane") };
  const tabs = $$(".switch__btn");

  function setMode(mode) {
    const isSignup = mode === "signup";
    if (auth.classList.contains("is-signup") === isSignup) return;

    auth.classList.toggle("is-signup", isSignup);

    tabs.forEach((tab) => {
      const active = tab.dataset.mode === mode;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });

    Object.entries(panes).forEach(([key, pane]) => {
      const active = key === mode;
      pane.classList.remove("is-active");
      pane.inert = !active;
      if (active) {
        void pane.offsetWidth; // restart the staggered entrance
        pane.classList.add("is-active");
      }
    });

    // focus the first field once the slide settles
    setTimeout(() => {
      const first = $(".field__input", panes[mode]);
      if (first && finePointer) first.focus({ preventScroll: true });
    }, reducedMotion ? 0 : 650);

    history.replaceState(null, "", isSignup ? "#signup" : "#signin");
  }

  panes.signup.inert = true;
  $$("[data-goto]").forEach((el) => el.addEventListener("click", () => setMode(el.dataset.goto)));
  tabs.forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.mode)));
  if (location.hash === "#signup") setMode("signup");

  /* ------------------------------------------------------------------
     3D tilt + cursor glow
     ------------------------------------------------------------------ */
  const glow = $(".cursor-glow");
  if (finePointer && !reducedMotion) {
    let raf = 0;
    window.addEventListener("pointermove", (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        glow.style.setProperty("--x", `${e.clientX}px`);
        glow.style.setProperty("--y", `${e.clientY}px`);

        if (window.innerWidth > 860) {
          const r = auth.getBoundingClientRect();
          const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
          const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
          auth.style.setProperty("--tilt-y", `${(dx * 4).toFixed(2)}deg`);
          auth.style.setProperty("--tilt-x", `${(-dy * 4).toFixed(2)}deg`);
        }
      });
    });
    document.addEventListener("pointerleave", () => {
      auth.style.setProperty("--tilt-x", "0deg");
      auth.style.setProperty("--tilt-y", "0deg");
    });
  } else {
    glow.remove();
  }

  /* ------------------------------------------------------------------
     Password reveal + caps lock hint
     ------------------------------------------------------------------ */
  $$(".field__reveal").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = $(".field__input", btn.parentElement);
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.setAttribute("aria-pressed", String(show));
      btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
      input.focus();
      const end = input.value.length;
      input.setSelectionRange(end, end);
    });
  });

  $$('input[type="password"]').forEach((input) => {
    const hint = $(".field__caps", input.parentElement);
    if (!hint) return;
    const update = (e) => hint.classList.toggle("is-on", !!e.getModifierState && e.getModifierState("CapsLock"));
    input.addEventListener("keydown", update);
    input.addEventListener("keyup", update);
    input.addEventListener("blur", () => hint.classList.remove("is-on"));
  });

  /* ------------------------------------------------------------------
     Password strength
     ------------------------------------------------------------------ */
  const strength = $("#strength");
  const strengthLabel = $(".strength__label", strength);
  const rules = {
    length: (v) => v.length >= 8,
    case: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v),
    number: (v) => /\d/.test(v),
    symbol: (v) => /[^A-Za-z0-9]/.test(v),
  };
  const labels = ["Password strength", "Weak", "Fair", "Good", "Strong 💪"];

  function scorePassword(value) {
    let score = 0;
    Object.entries(rules).forEach(([name, test]) => {
      const met = test(value);
      $(`[data-rule="${name}"]`, strength).classList.toggle("is-met", met);
      if (met) score++;
    });
    if (value && score === 0) score = 1;
    strength.dataset.score = value ? score : 0;
    strengthLabel.textContent = value ? labels[score] : labels[0];
    return score;
  }

  $("#suPassword").addEventListener("input", (e) => scorePassword(e.target.value));

  /* ------------------------------------------------------------------
     Validation
     ------------------------------------------------------------------ */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const validators = {
    name: (v) => (v.trim().length >= 2 ? "" : "Please enter your full name."),
    email: (v) => (!v.trim() ? "Email is required." : EMAIL_RE.test(v.trim()) ? "" : "That email doesn't look right."),
    siPassword: (v) => (!v ? "Password is required." : v.length < 6 ? "Password must be at least 6 characters." : ""),
    suPassword: (v) => (!v ? "Create a password to continue." : scorePassword(v) < 3 ? "Make it stronger — meet at least 3 rules." : ""),
    confirm: (v) => (!v ? "Please confirm your password." : v !== $("#suPassword").value ? "Passwords don't match." : ""),
  };

  function validatorFor(input) {
    if (input.id === "siPassword") return validators.siPassword;
    if (input.id === "suPassword") return validators.suPassword;
    return validators[input.name];
  }

  function validateField(input) {
    const field = input.closest(".field");
    const check = validatorFor(input);
    if (!field || !check) return true;
    const message = check(input.value);
    field.classList.toggle("is-invalid", !!message);
    field.classList.toggle("is-valid", !message);
    input.setAttribute("aria-invalid", String(!!message));
    $(".field__error", field).textContent = message;
    return !message;
  }

  function shake(el) {
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
  }

  $$(".field__input").forEach((input) => {
    input.addEventListener("blur", () => { if (input.value) validateField(input); });
    input.addEventListener("input", () => {
      if (input.closest(".field").classList.contains("is-invalid")) validateField(input);
      if (input.id === "suPassword" && $("#suConfirm").value) validateField($("#suConfirm"));
    });
  });

  function validateForm(form) {
    let firstInvalid = null;
    $$(".field__input", form).forEach((input) => {
      if (!validateField(input) && !firstInvalid) firstInvalid = input;
    });
    if (firstInvalid) {
      shake(firstInvalid.closest(".field"));
      firstInvalid.focus();
    }
    return !firstInvalid;
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function withLoading(form, task) {
    const btn = $('button[type="submit"]', form);
    btn.classList.add("is-loading");
    btn.setAttribute("aria-busy", "true");
    try { await task(); } finally {
      btn.classList.remove("is-loading");
      btn.removeAttribute("aria-busy");
    }
  }

  /* ---------- Sign in ---------- */
  $("#signinForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!validateForm(form)) return;

    await withLoading(form, () => wait(1400));
    const email = form.email.value.trim();
    const name = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    celebrate("Welcome back!", `Great to see you again, ${name}.`);
    form.reset();
    resetFields(form);
  });

  /* ---------- Sign up ---------- */
  $("#signupForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fieldsOk = validateForm(form);
    const terms = $(".check--terms", form);
    const termsOk = form.terms.checked;
    terms.classList.toggle("is-invalid", !termsOk);
    if (!fieldsOk) return;
    if (!termsOk) {
      toast("Please accept the Terms & Privacy Policy.");
      return;
    }

    await withLoading(form, () => wait(1600));
    const first = form.name.value.trim().split(/\s+/)[0];
    celebrate("Account created!", `Welcome to Nebula, ${first}. Your universe awaits ✨`);
    form.reset();
    resetFields(form);
    scorePassword("");
  });

  $("#suTerms").addEventListener("change", (e) => {
    if (e.target.checked) e.target.closest(".check").classList.remove("is-invalid");
  });

  function resetFields(form) {
    $$(".field", form).forEach((f) => f.classList.remove("is-valid", "is-invalid"));
    $$(".field__input", form).forEach((i) => i.removeAttribute("aria-invalid"));
  }

  $$('a.link[href="#"]').forEach((a) => {
    a.addEventListener("click", (e) => { e.preventDefault(); toast(`${a.textContent} — demo page`); });
  });

  /* ---------- Social ---------- */
  $$(".social").forEach((btn) => {
    btn.addEventListener("click", () => toast(`Redirecting to ${btn.dataset.provider}… (demo)`));
  });

  /* ------------------------------------------------------------------
     Modals
     ------------------------------------------------------------------ */
  let lastFocus = null;

  function openModal(modal) {
    lastFocus = document.activeElement;
    modal.hidden = false;
    modal.classList.remove("is-closing");
    const focusable = $("input, button:not(.modal__close)", modal) || $("button", modal);
    setTimeout(() => focusable && focusable.focus(), 60);
  }

  function closeModal(modal) {
    if (modal.hidden) return;
    modal.classList.add("is-closing");
    setTimeout(() => {
      modal.hidden = true;
      modal.classList.remove("is-closing");
      if (lastFocus) lastFocus.focus({ preventScroll: true });
    }, reducedMotion ? 0 : 240);
  }

  $$(".modal").forEach((modal) => {
    $$("[data-close]", modal).forEach((el) => el.addEventListener("click", () => closeModal(modal)));
    modal.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal(modal);
      if (e.key !== "Tab") return;
      // simple focus trap
      const items = $$("button, input, a[href]", modal).filter((el) => !el.disabled && el.offsetParent !== null);
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  });

  const forgotModal = $("#forgotModal");
  $("#forgotBtn").addEventListener("click", () => {
    const email = $("#siEmail").value;
    const fp = $("#fpEmail");
    fp.value = email;
    resetFields(forgotModal);
    openModal(forgotModal);
  });

  $("#forgotForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!validateForm(form)) return;
    await withLoading(form, () => wait(1200));
    closeModal(forgotModal);
    toast(`📬 Reset link sent to ${form.email.value.trim()}`);
    form.reset();
  });

  const successModal = $("#successModal");
  function celebrate(title, text) {
    $("#successTitle").textContent = title;
    $("#successText").textContent = text;
    // restart the check-mark draw animation
    const svg = $(".success-check", successModal);
    svg.replaceWith(svg.cloneNode(true));
    openModal(successModal);
    confetti();
  }

  /* ------------------------------------------------------------------
     Toast
     ------------------------------------------------------------------ */
  const toastEl = $("#toast");
  let toastTimer = 0;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-visible"), 3200);
  }

  /* ------------------------------------------------------------------
     Animated counters in the showcase panel
     ------------------------------------------------------------------ */
  $$("[data-count]").forEach((el, i) => {
    const target = Number(el.dataset.count);
    if (reducedMotion) { el.textContent = target; return; }
    const start = performance.now() + 600 + i * 120;
    const duration = 1600;
    const tick = (now) => {
      const t = Math.min(Math.max((now - start) / duration, 0), 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - t, 4)));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  /* ------------------------------------------------------------------
     Constellation background
     ------------------------------------------------------------------ */
  const sky = $("#constellation");
  const ctx = sky.getContext("2d");
  const mouse = { x: -9999, y: -9999 };
  let stars = [];
  let w = 0;
  let h = 0;
  let dpr = 1;
  let skyRunning = false;

  function resizeSky() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = sky.clientWidth;
    h = sky.clientHeight;
    sky.width = w * dpr;
    sky.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(Math.min(110, (w * h) / 14000));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.4 + 0.4,
    }));
  }

  function drawSky() {
    ctx.clearRect(0, 0, w, h);
    const light = root.dataset.theme === "light";
    const dot = light ? "rgba(70, 60, 160," : "rgba(210, 210, 255,";
    const LINK = 130;

    for (const s of stars) {
      s.x += s.vx;
      s.y += s.vy;
      if (s.x < 0 || s.x > w) s.vx *= -1;
      if (s.y < 0 || s.y > h) s.vy *= -1;

      // gentle attraction toward the cursor
      const mx = mouse.x - s.x;
      const my = mouse.y - s.y;
      const md = Math.hypot(mx, my);
      if (md < 180) {
        s.x += mx * 0.004;
        s.y += my * 0.004;
      }

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `${dot} ${light ? 0.45 : 0.75})`;
      ctx.fill();
    }

    for (let i = 0; i < stars.length; i++) {
      for (let j = i + 1; j < stars.length; j++) {
        const a = stars[i];
        const b = stars[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < LINK) {
          ctx.strokeStyle = `${dot} ${(1 - d / LINK) * (light ? 0.18 : 0.22)})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      const md = Math.hypot(stars[i].x - mouse.x, stars[i].y - mouse.y);
      if (md < 180) {
        ctx.strokeStyle = `rgba(139, 92, 246, ${(1 - md / 180) * 0.6})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(stars[i].x, stars[i].y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.stroke();
      }
    }

    if (!reducedMotion && !document.hidden) requestAnimationFrame(drawSky);
    else skyRunning = false;
  }

  function startSky() {
    if (skyRunning) return;
    skyRunning = true;
    drawSky();
  }

  resizeSky();
  startSky();
  window.addEventListener("resize", resizeSky);
  window.addEventListener("pointermove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !reducedMotion) startSky(); });

  /* ------------------------------------------------------------------
     Confetti
     ------------------------------------------------------------------ */
  const confettiCanvas = $("#confetti");
  const cctx = confettiCanvas.getContext("2d");

  function confetti() {
    if (reducedMotion) return;
    const cw = (confettiCanvas.width = window.innerWidth * dpr);
    const ch = (confettiCanvas.height = window.innerHeight * dpr);
    const colors = ["#8b5cf6", "#22d3ee", "#f472b6", "#34d399", "#fbbf24", "#ffffff"];
    const pieces = Array.from({ length: 180 }, () => ({
      x: cw / 2,
      y: ch * 0.45,
      vx: (Math.random() - 0.5) * 26 * dpr,
      vy: (Math.random() * -22 - 6) * dpr,
      size: (Math.random() * 7 + 4) * dpr,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
      color: colors[(Math.random() * colors.length) | 0],
      shape: Math.random() > 0.5 ? "rect" : "circle",
    }));
    const startedAt = performance.now();

    (function frame(now) {
      const elapsed = now - startedAt;
      cctx.clearRect(0, 0, cw, ch);
      for (const p of pieces) {
        p.vy += 0.55 * dpr;
        p.vx *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        cctx.save();
        cctx.globalAlpha = Math.max(0, 1 - elapsed / 3200);
        cctx.translate(p.x, p.y);
        cctx.rotate(p.rot);
        cctx.fillStyle = p.color;
        if (p.shape === "rect") cctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        else { cctx.beginPath(); cctx.arc(0, 0, p.size / 3, 0, Math.PI * 2); cctx.fill(); }
        cctx.restore();
      }
      if (elapsed < 3200) requestAnimationFrame(frame);
      else cctx.clearRect(0, 0, cw, ch);
    })(startedAt);
  }
})();
