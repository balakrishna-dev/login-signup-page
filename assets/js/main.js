/* ==========================================================================
   Nebula Auth — interactions
   Designed & developed by Balakrishna Undela
   ========================================================================== */
(() => {
  "use strict";

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  const lerp = (a, b, t) => a + (b - a) * t;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const root = document.documentElement;
  const body = document.body;
  const auth = $("#auth");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const isDesktop = () => window.innerWidth > 860;

  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* storage unavailable */ } },
  };

  /* ------------------------------------------------------------------
     Intro loader
     ------------------------------------------------------------------ */
  const loader = $("#loader");
  function reveal() {
    loader.classList.add("is-done");
    setTimeout(() => body.classList.add("is-ready"), 250);
    setTimeout(() => loader.remove(), 1300);
  }
  if (reducedMotion) {
    loader.remove();
    body.classList.add("is-ready");
  } else {
    // wait for fonts so the reveal never flashes fallback type
    Promise.all([wait(1500), document.fonts ? document.fonts.ready : null]).then(reveal);
  }

  /* ------------------------------------------------------------------
     Theme (circular reveal from the toggle)
     ------------------------------------------------------------------ */
  const themeToggle = $("#themeToggle");
  const savedTheme = storage.get("nebula-theme");
  const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  setTheme(savedTheme || (prefersLight ? "light" : "dark"));

  function setTheme(theme) {
    root.dataset.theme = theme;
    $('meta[name="theme-color"]').setAttribute("content", theme === "light" ? "#eef0fb" : "#07070d");
  }

  themeToggle.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    storage.set("nebula-theme", next);

    if (!document.startViewTransition || reducedMotion) {
      setTheme(next);
      return;
    }
    const r = themeToggle.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const transition = document.startViewTransition(() => setTheme(next));
    transition.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 750, easing: "cubic-bezier(.22, 1, .36, 1)", pseudoElement: "::view-transition-new(root)" }
      );
    });
  });

  /* ------------------------------------------------------------------
     Split showcase headlines into letters
     ------------------------------------------------------------------ */
  $$(".overlay__panel h2").forEach((h2) => {
    let i = 0;
    const frag = document.createDocumentFragment();
    [...h2.childNodes].forEach((node) => {
      if (node.nodeType !== Node.TEXT_NODE) { frag.append(node.cloneNode(true)); return; }
      node.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.append(" "); return; }
        const word = document.createElement("span");
        word.className = "word";
        [...part].forEach((ch) => {
          const c = document.createElement("span");
          c.className = "char";
          c.textContent = ch;
          c.style.setProperty("--i", i++);
          word.append(c);
        });
        frag.append(word);
      });
    });
    h2.replaceChildren(frag);
  });

  /* ------------------------------------------------------------------
     Mode switching (sign in <-> sign up)
     ------------------------------------------------------------------ */
  const panes = { signin: $("#signinPane"), signup: $("#signupPane") };
  const tabs = $$(".switch__btn");
  const overlayWrap = $(".overlay-wrap");
  let liquidTimer = 0;

  function setMode(mode) {
    const isSignup = mode === "signup";
    if (auth.classList.contains("is-signup") === isSignup) return;

    auth.classList.toggle("is-signup", isSignup);

    // liquid bulge on the leading edge of the sliding panel
    overlayWrap.classList.remove("is-liquid-l", "is-liquid-r");
    void overlayWrap.offsetWidth;
    overlayWrap.classList.add(isSignup ? "is-liquid-l" : "is-liquid-r");
    clearTimeout(liquidTimer);
    liquidTimer = setTimeout(() => overlayWrap.classList.remove("is-liquid-l", "is-liquid-r"), 800);

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

    scene.morphTo(isSignup ? "galaxy" : "planet");
    if (isSignup) runCounters();

    setTimeout(() => {
      const first = $(".field__input", panes[mode]);
      if (first && finePointer) first.focus({ preventScroll: true });
    }, reducedMotion ? 0 : 700);

    history.replaceState(null, "", isSignup ? "#signup" : "#signin");
  }

  panes.signup.inert = true;
  $$("[data-goto]").forEach((el) => el.addEventListener("click", () => setMode(el.dataset.goto)));
  tabs.forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.mode)));

  /* ------------------------------------------------------------------
     Pointer effects: tilt, glow, spotlight, cursor ring, magnetic
     ------------------------------------------------------------------ */
  const glow = $(".cursor-glow");
  const ring = $(".cursor-ring");
  const pointer = { x: innerWidth / 2, y: innerHeight / 2 };

  if (finePointer && !reducedMotion) {
    let raf = 0;
    window.addEventListener("pointermove", (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      ring.classList.add("is-visible");
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        glow.style.setProperty("--x", `${e.clientX}px`);
        glow.style.setProperty("--y", `${e.clientY}px`);

        const r = auth.getBoundingClientRect();
        auth.style.setProperty("--mx", `${e.clientX - r.left}px`);
        auth.style.setProperty("--my", `${e.clientY - r.top}px`);

        if (isDesktop()) {
          const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
          const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
          auth.style.setProperty("--tilt-y", `${(dx * 4).toFixed(2)}deg`);
          auth.style.setProperty("--tilt-x", `${(-dy * 4).toFixed(2)}deg`);
        }
      });
    });
    document.addEventListener("pointerleave", () => {
      ring.classList.remove("is-visible");
      auth.style.setProperty("--tilt-x", "0deg");
      auth.style.setProperty("--tilt-y", "0deg");
    });

    // cursor ring follows with a little lag and reacts to what's underneath
    const ringPos = { x: pointer.x, y: pointer.y, s: 1 };
    let ringScale = 1;
    document.addEventListener("pointerover", (e) => {
      const el = e.target.closest("a, button, label, [role=tab]");
      const field = e.target.closest("input");
      ring.classList.toggle("is-hover", !!el);
      ringScale = el ? 1.5 : field ? 0.55 : 1;
    });
    document.addEventListener("pointerdown", () => { ringPos.s = 0.7; });
    (function ringLoop() {
      ringPos.x = lerp(ringPos.x, pointer.x, 0.2);
      ringPos.y = lerp(ringPos.y, pointer.y, 0.2);
      ringPos.s = lerp(ringPos.s, ringScale, 0.15);
      ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0) scale(${ringPos.s.toFixed(3)})`;
      requestAnimationFrame(ringLoop);
    })();

    // magnetic buttons
    $$(".btn--primary, .social, .theme-toggle").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const dx = clamp((e.clientX - (r.left + r.width / 2)) * 0.25, -10, 10);
        const dy = clamp((e.clientY - (r.top + r.height / 2)) * 0.35, -7, 7);
        el.style.translate = `${dx}px ${dy}px`;
      });
      el.addEventListener("pointerleave", () => { el.style.translate = ""; });
    });
  } else {
    glow.remove();
    ring.remove();
  }

  // click ripple
  $$(".btn, .social").forEach((el) => {
    el.addEventListener("pointerdown", (e) => {
      if (reducedMotion) return;
      const r = el.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 2.2;
      const dot = document.createElement("span");
      dot.className = "ripple";
      dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
      el.append(dot);
      dot.addEventListener("animationend", () => dot.remove());
    });
  });

  /* ------------------------------------------------------------------
     Mascot
     ------------------------------------------------------------------ */
  const buddies = $$(".buddy").map((el) => ({ el, form: el.closest("form"), typing: false, timer: 0 }));
  const buddyOf = (form) => buddies.find((b) => b.form === form);

  function gaze(b, gx, gy) {
    b.el.style.setProperty("--gx", `${gx.toFixed(2)}px`);
    b.el.style.setProperty("--gy", `${gy.toFixed(2)}px`);
  }

  function lookAtCaret(b, input) {
    const len = Math.min(input.value.length, 30);
    gaze(b, -6 + (len / 30) * 12, 4.5);
  }

  function buddyMood(b, mood, ms) {
    if (!b) return;
    clearTimeout(b.timer);
    b.el.classList.remove("is-sad", "is-happy");
    void b.el.offsetWidth;
    b.el.classList.add(mood);
    b.timer = setTimeout(() => b.el.classList.remove(mood), ms);
  }

  window.addEventListener("pointermove", (e) => {
    buddies.forEach((b) => {
      if (b.typing || !b.el.offsetParent) return;
      const r = b.el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(d / 140, 1);
      gaze(b, (dx / d) * 6 * k, (dy / d) * 4.5 * k);
    });
  });

  buddies.forEach((b) => {
    b.form.addEventListener("focusin", (e) => {
      const input = e.target.closest(".field__input");
      if (!input) return;
      const field = input.closest(".field");
      const reveal = $(".field__reveal", field);
      const isSecret = input.type === "password" || !!reveal;
      b.typing = true;
      b.el.classList.toggle("is-hiding", isSecret);
      b.el.classList.toggle("is-peeking", isSecret && reveal?.getAttribute("aria-pressed") === "true");
      if (isSecret) gaze(b, 0, 3);
      else lookAtCaret(b, input);
    });
    b.form.addEventListener("input", (e) => {
      const input = e.target.closest(".field__input");
      if (input && !b.el.classList.contains("is-hiding")) lookAtCaret(b, input);
    });
    b.form.addEventListener("focusout", () => {
      setTimeout(() => {
        if (b.form.contains(document.activeElement) && document.activeElement.matches(".field__input, .field__reveal")) return;
        b.typing = false;
        b.el.classList.remove("is-hiding", "is-peeking");
        gaze(b, 0, 0);
      }, 0);
    });
  });

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
      const b = buddyOf(btn.closest("form"));
      if (b) b.el.classList.toggle("is-peeking", show);
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
      buddyMood(buddyOf(form), "is-sad", 1600);
    }
    return !firstInvalid;
  }

  // every primary button gets a check mark it can morph into
  $$(".btn--primary").forEach((btn) => {
    btn.insertAdjacentHTML("beforeend", '<svg class="btn__check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>');
  });

  async function withLoading(form, task) {
    const btn = $('button[type="submit"]', form);
    btn.style.translate = "";
    btn.classList.add("is-loading");
    btn.setAttribute("aria-busy", "true");
    try { await task(); } finally {
      btn.classList.remove("is-loading");
      btn.removeAttribute("aria-busy");
    }
    return btn;
  }

  async function succeed(btn) {
    btn.classList.add("is-success");
    await wait(reducedMotion ? 0 : 850);
    setTimeout(() => btn.classList.remove("is-success"), 600);
  }

  /* ---------- Sign in ---------- */
  $("#signinForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!validateForm(form)) return;

    const btn = await withLoading(form, () => wait(1300));
    buddyMood(buddyOf(form), "is-happy", 1400);
    await succeed(btn);
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
      buddyMood(buddyOf(form), "is-sad", 1600);
      toast("Please accept the Terms & Privacy Policy.");
      return;
    }

    const btn = await withLoading(form, () => wait(1500));
    buddyMood(buddyOf(form), "is-happy", 1400);
    await succeed(btn);
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
    $("#fpEmail").value = $("#siEmail").value;
    resetFields(forgotModal);
    openModal(forgotModal);
  });

  $("#forgotForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!validateForm(form)) return;
    const btn = await withLoading(form, () => wait(1200));
    await succeed(btn);
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
  function runCounters() {
    $$("[data-count]").forEach((el, i) => {
      const target = Number(el.dataset.count);
      if (reducedMotion) { el.textContent = target; return; }
      const start = performance.now() + 800 + i * 120;
      const duration = 1400;
      const tick = (now) => {
        const t = clamp((now - start) / duration, 0, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - t, 4)));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  /* ------------------------------------------------------------------
     Constellation background (+ shooting stars & click shockwaves)
     ------------------------------------------------------------------ */
  const sky = $("#constellation");
  const ctx = sky.getContext("2d");
  const mouse = { x: -9999, y: -9999 };
  const waves = [];
  const meteors = [];
  let nextMeteor = performance.now() + 2500;
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
      ix: 0,
      iy: 0,
      r: Math.random() * 1.4 + 0.4,
    }));
  }

  function drawSky(now) {
    ctx.clearRect(0, 0, w, h);
    const light = root.dataset.theme === "light";
    const dot = light ? "rgba(70, 60, 160," : "rgba(210, 210, 255,";
    const LINK = 130;

    for (const s of stars) {
      s.x += s.vx + s.ix;
      s.y += s.vy + s.iy;
      s.ix *= 0.93;
      s.iy *= 0.93;
      if (s.x < 0 || s.x > w) { s.vx *= -1; s.ix *= -1; s.x = clamp(s.x, 0, w); }
      if (s.y < 0 || s.y > h) { s.vy *= -1; s.iy *= -1; s.y = clamp(s.y, 0, h); }

      // gentle attraction toward the cursor
      const mx = mouse.x - s.x;
      const my = mouse.y - s.y;
      if (Math.hypot(mx, my) < 180) {
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

    // shockwave rings
    for (let i = waves.length - 1; i >= 0; i--) {
      const wv = waves[i];
      const t = (now - wv.t0) / 900;
      if (t >= 1) { waves.splice(i, 1); continue; }
      const e = 1 - Math.pow(1 - t, 3);
      ctx.beginPath();
      ctx.arc(wv.x, wv.y, e * 240, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(139, 92, 246, ${(1 - t) * 0.7})`;
      ctx.lineWidth = 2 * (1 - t) + 0.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(wv.x, wv.y, e * 160, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(34, 211, 238, ${(1 - t) * 0.45})`;
      ctx.stroke();
    }

    // shooting stars
    if (now > nextMeteor) {
      meteors.push({ x: Math.random() * w * 0.7 + w * 0.3, y: Math.random() * h * 0.35, life: 0 });
      nextMeteor = now + 3000 + Math.random() * 4000;
    }
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.life += 1 / 60;
      m.x -= 11;
      m.y += 4.5;
      if (m.life > 1.1) { meteors.splice(i, 1); continue; }
      const alpha = Math.sin(Math.min(m.life / 1.1, 1) * Math.PI);
      const tail = ctx.createLinearGradient(m.x, m.y, m.x + 160, m.y - 65);
      tail.addColorStop(0, light ? `rgba(90, 70, 200, ${alpha})` : `rgba(255, 255, 255, ${alpha})`);
      tail.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.strokeStyle = tail;
      ctx.lineWidth = 1.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x + 160, m.y - 65);
      ctx.stroke();
    }

    if (!reducedMotion && !document.hidden) requestAnimationFrame(drawSky);
    else skyRunning = false;
  }

  function startSky() {
    if (skyRunning) return;
    skyRunning = true;
    requestAnimationFrame(drawSky);
  }

  resizeSky();
  if (reducedMotion) drawSky(performance.now()); else startSky();
  window.addEventListener("resize", resizeSky);
  window.addEventListener("pointermove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !reducedMotion) startSky(); });

  // click on empty space → shockwave that pushes the stars away
  document.addEventListener("pointerdown", (e) => {
    if (reducedMotion || e.target.closest(".auth, .modal, .topbar, .credit")) return;
    waves.push({ x: e.clientX, y: e.clientY, t0: performance.now() });
    for (const s of stars) {
      const dx = s.x - e.clientX;
      const dy = s.y - e.clientY;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 260) {
        const force = (1 - d / 260) * 9;
        s.ix += (dx / d) * force;
        s.iy += (dy / d) * force;
      }
    }
  });

  /* ------------------------------------------------------------------
     Showcase particle scene: planet <-> galaxy morph
     ------------------------------------------------------------------ */
  const scene = (() => {
    const canvas = $("#morph");
    const c = canvas.getContext("2d");
    const N = 900;
    const GOLDEN = Math.PI * (3 - Math.sqrt(5));
    const shapes = { planet: [], galaxy: [] };

    for (let i = 0; i < N; i++) {
      // planet: a fibonacci sphere, with a fifth of the points forming a ring
      if (i % 5 === 0) {
        const a = Math.random() * Math.PI * 2;
        const rr = 1.35 + Math.random() * 0.28;
        shapes.planet.push([Math.cos(a) * rr, (Math.random() - 0.5) * 0.03, Math.sin(a) * rr]);
      } else {
        const y = 1 - (i / (N - 1)) * 2;
        const r = Math.sqrt(1 - y * y);
        shapes.planet.push([Math.cos(GOLDEN * i) * r * 0.92, y * 0.92, Math.sin(GOLDEN * i) * r * 0.92]);
      }
      // galaxy: three logarithmic arms plus a bright core
      const arm = i % 3;
      const t = Math.pow(Math.random(), 0.7);
      const angle = t * Math.PI * 3.2 + (arm * Math.PI * 2) / 3;
      const spread = (1 - t) * 0.18 + 0.05;
      const radius = 0.08 + t * 1.45;
      shapes.galaxy.push([
        Math.cos(angle) * radius + (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * 0.12 * (1.2 - t),
        Math.sin(angle) * radius + (Math.random() - 0.5) * spread,
      ]);
    }

    const tint = ["255,255,255", "165,243,252", "251,207,232", "196,181,253"];
    const parts = shapes.planet.map((p) => ({
      x: p[0], y: p[1], z: p[2],
      sx: p[0], sy: p[1], sz: p[2],
      tx: p[0], ty: p[1], tz: p[2],
      d: 0,
      jx: Math.random() - 0.5, jy: Math.random() - 0.5, jz: Math.random() - 0.5,
      c: Math.random() < 0.6 ? 0 : 1 + ((Math.random() * 3) | 0),
      s: Math.random() * 0.8 + 0.6,
    }));

    let cw = 0, ch = 0, sdpr = 1;
    let rotY = 0, tiltX = 0.35, tiltTarget = 0.35;
    let hoverX = 0, hoverY = 0, hx = 0, hy = 0;
    let morphStart = -1e9;
    let running = false;
    const MORPH_MS = 1700;

    function resize() {
      sdpr = Math.min(window.devicePixelRatio || 1, 2);
      cw = canvas.clientWidth;
      ch = canvas.clientHeight;
      canvas.width = cw * sdpr;
      canvas.height = ch * sdpr;
      c.setTransform(sdpr, 0, 0, sdpr, 0, 0);
    }

    function morphTo(name) {
      morphStart = performance.now();
      tiltTarget = name === "galaxy" ? 1.08 : 0.35;
      shapes[name].forEach((p, i) => {
        const q = parts[i];
        q.sx = q.x; q.sy = q.y; q.sz = q.z;
        q.tx = p[0]; q.ty = p[1]; q.tz = p[2];
        q.d = Math.random() * 0.3;
      });
      if (reducedMotion) frame(morphStart + MORPH_MS);
    }

    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    function frame(now) {
      c.clearRect(0, 0, cw, ch);
      const P = (now - morphStart) / MORPH_MS;
      rotY += 0.0032;
      hx = lerp(hx, hoverX, 0.05);
      hy = lerp(hy, hoverY, 0.05);
      tiltX = lerp(tiltX, tiltTarget + hy * 0.35, 0.04);
      const ay = rotY + hx * 0.8;
      const cosY = Math.cos(ay), sinY = Math.sin(ay);
      const cosX = Math.cos(tiltX), sinX = Math.sin(tiltX);
      const R = Math.min(cw, ch) * 0.27;
      const cx = cw / 2, cy = ch / 2;

      for (const q of parts) {
        if (P < 1.4) {
          const t = clamp((P - q.d) / 0.7, 0, 1);
          const e = ease(t);
          const burst = Math.sin(Math.PI * e) * 0.9;
          q.x = lerp(q.sx, q.tx, e) + q.jx * burst;
          q.y = lerp(q.sy, q.ty, e) + q.jy * burst;
          q.z = lerp(q.sz, q.tz, e) + q.jz * burst;
        }
        const x1 = q.x * cosY - q.z * sinY;
        const z1 = q.x * sinY + q.z * cosY;
        const y1 = q.y * cosX - z1 * sinX;
        const z2 = q.y * sinX + z1 * cosX;
        const persp = 2.6 / (2.6 + z2);
        const px = cx + x1 * R * persp;
        const py = cy + y1 * R * persp;
        const size = q.s * persp * 1.8;
        c.globalAlpha = clamp(0.2 + (persp - 0.7) * 1.2, 0.1, 0.9);
        c.fillStyle = `rgb(${tint[q.c]})`;
        c.fillRect(px - size / 2, py - size / 2, size, size);
      }
      c.globalAlpha = 1;
    }

    function loop(now) {
      if (!isDesktop() || document.hidden || reducedMotion) { running = false; return; }
      frame(now);
      requestAnimationFrame(loop);
    }

    function start() {
      if (running || !isDesktop()) return;
      running = true;
      requestAnimationFrame(loop);
    }

    overlayWrap.addEventListener("pointermove", (e) => {
      const r = overlayWrap.getBoundingClientRect();
      hoverX = (e.clientX - r.left) / r.width - 0.5;
      hoverY = (e.clientY - r.top) / r.height - 0.5;
    });
    overlayWrap.addEventListener("pointerleave", () => { hoverX = 0; hoverY = 0; });
    window.addEventListener("resize", () => { resize(); start(); });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) start(); });

    resize();
    if (reducedMotion) frame(performance.now()); else start();
    return { morphTo };
  })();

  if (location.hash === "#signup") setMode("signup");

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
