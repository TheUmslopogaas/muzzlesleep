/* ==========================================================================
   LT Product Cards (sections/lt-product-cards.liquid)
   - Carousel (Swiper 11, global) or grid, chosen per device (750px breakpoint)
   - Variant / purchase-option dropdowns update price, badge and image
   - Add to Cart -> /cart/add.js -> Rebuy Smart Cart
   - Cards never navigate: there are no click handlers on the card itself
   ========================================================================== */
(function () {
  'use strict';

  if (window.LTProductCards) {
    window.LTProductCards.init(document);
    return;
  }

  var MQ = window.matchMedia('(min-width: 750px)');
  var REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');
  var ADDED_RESET_MS = 2000;
  var ERROR_HIDE_MS = 5000;

  function parseJSON(el) {
    if (!el) return null;
    try {
      return JSON.parse(el.textContent);
    } catch (e) {
      console.warn('[lt-product-cards] Invalid JSON', e);
      return null;
    }
  }

  function onMQChange(mq, fn) {
    if (mq.addEventListener) mq.addEventListener('change', fn);
    else if (mq.addListener) mq.addListener(fn);
  }

  function offMQChange(mq, fn) {
    if (mq.removeEventListener) mq.removeEventListener('change', fn);
    else if (mq.removeListener) mq.removeListener(fn);
  }

  function routesRoot() {
    var root = window.Shopify && window.Shopify.routes && window.Shopify.routes.root;
    return root || '/';
  }

  function dispatch(name, detail) {
    try {
      document.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: detail }));
    } catch (e) { /* old browsers */ }
  }

  /* Refresh + open the Rebuy Smart Cart (same pattern used across this theme) */
  function notifyCart(cart, openCart) {
    var detail = { cart: cart };
    dispatch('cart:refresh', detail);
    dispatch('cart:updated', detail);
    dispatch('cart:item-added', detail);
    dispatch('rebuy:cart.change', detail);

    var R = window.Rebuy;
    if (R && R.Cart && typeof R.Cart.fetchCart === 'function') {
      try { R.Cart.fetchCart(); } catch (e) { /* noop */ }
    }
    if (openCart && R && R.SmartCart && typeof R.SmartCart.show === 'function') {
      try { R.SmartCart.show(); } catch (e) { /* noop */ }
    }
  }

  /* ------------------------------------------------------------------------
     Card
     ------------------------------------------------------------------------ */
  function Card(el, cfg) {
    this.el = el;
    this.cfg = cfg || {};
    this.labels = this.cfg.labels || {};
    this.data = parseJSON(el.querySelector('[data-lt-pc-data]'));
    if (!this.data || !this.data.variants || !this.data.variants.length) return;

    this.variantSel = el.querySelector('[data-lt-pc-variant]');
    this.planSel = el.querySelector('[data-lt-pc-plan]');
    this.priceWrap = el.querySelector('[data-lt-pc-price-wrap]');
    this.priceEl = el.querySelector('[data-lt-pc-price]');
    this.compareEl = el.querySelector('[data-lt-pc-compare]');
    this.saleBadge = el.querySelector('[data-lt-pc-sale-badge]');
    this.imgEl = el.querySelector('.lt-pc__media img.lt-pc__img');
    this.btn = el.querySelector('[data-lt-pc-atc]');
    this.btnText = el.querySelector('[data-lt-pc-btn-text]');
    this.errorEl = el.querySelector('[data-lt-pc-error]');
    this.dynamicImage = el.getAttribute('data-dynamic-image') === 'true';
    this.atcLabel = this.btn ? (this.btn.getAttribute('data-label') || 'Add to Cart') : '';

    this.variantId = String(el.getAttribute('data-variant-id') || this.data.variants[0].id);
    this.planId = String(el.getAttribute('data-plan-id') || 'onetime');
    this.busy = false;
    this.timers = [];

    var self = this;
    this.onVariant = function () {
      self.variantId = String(self.variantSel.value);
      self.render(true);
    };
    this.onPlan = function () {
      self.planId = String(self.planSel.value);
      self.render(false);
    };
    this.onAdd = function (e) {
      e.preventDefault();
      e.stopPropagation();
      self.add();
    };

    if (this.variantSel) this.variantSel.addEventListener('change', this.onVariant);
    if (this.planSel) this.planSel.addEventListener('change', this.onPlan);
    if (this.btn) this.btn.addEventListener('click', this.onAdd);

    this.render(false);
  }

  Card.prototype.getVariant = function () {
    var id = this.variantId;
    var list = this.data.variants;
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === id) return list[i];
    }
    return list[0];
  };

  /* Keep the selected plan valid for the selected variant */
  Card.prototype.resolvePlan = function (v) {
    var plans = v.plans || {};
    if (this.planId !== 'onetime' && !plans[this.planId]) {
      var next = 'onetime';
      if (this.data.requiresPlan) {
        var order = this.data.planOrder || [];
        for (var i = 0; i < order.length; i++) {
          if (plans[order[i]]) { next = order[i]; break; }
        }
      }
      this.planId = next;
    }
    if (this.planSel) {
      var opts = this.planSel.options;
      for (var j = 0; j < opts.length; j++) {
        if (opts[j].value !== 'onetime') opts[j].disabled = !plans[opts[j].value];
      }
      if (this.planSel.value !== this.planId) this.planSel.value = this.planId;
    }
    return this.planId !== 'onetime' ? plans[this.planId] || null : null;
  };

  Card.prototype.render = function (variantChanged) {
    var v = this.getVariant();
    if (!v) return;
    var plan = this.resolvePlan(v);
    var src = plan || v;

    if (this.priceEl) this.priceEl.textContent = src.price || '';

    var showCompare = !!(this.cfg.showCompare && src.compare);
    if (this.compareEl) {
      this.compareEl.textContent = src.compare || '';
      this.compareEl.hidden = !showCompare;
    }
    if (this.priceWrap) this.priceWrap.classList.toggle('is-sale', showCompare);

    if (this.saleBadge) {
      var pct = Number(src.pct) || 0;
      this.saleBadge.hidden = pct <= 0;
      if (pct > 0) this.saleBadge.textContent = String(this.cfg.saleBadge || '').replace(/\[percent\]/g, pct);
    }

    if (variantChanged && this.dynamicImage && this.imgEl && v.img && v.img.src) {
      this.imgEl.srcset = v.img.srcset || '';
      this.imgEl.src = v.img.src;
    }

    if (!this.busy) this.setButton(v.available ? 'ready' : 'soldout');
  };

  Card.prototype.setButton = function (state) {
    if (!this.btn) return;
    var text = this.atcLabel;
    this.btn.classList.toggle('is-loading', state === 'loading');
    this.btn.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
    this.btn.disabled = state === 'soldout';
    if (state === 'soldout') text = this.labels.soldout || 'Sold Out';
    if (state === 'loading') text = this.labels.adding || this.atcLabel;
    if (state === 'added') text = this.labels.added || this.atcLabel;
    if (this.btnText) this.btnText.textContent = text;
  };

  Card.prototype.showError = function (msg) {
    if (!this.errorEl) return;
    var self = this;
    this.errorEl.textContent = msg;
    this.errorEl.hidden = false;
    this.timers.push(setTimeout(function () { self.hideError(); }, ERROR_HIDE_MS));
  };

  Card.prototype.hideError = function () {
    if (this.errorEl) {
      this.errorEl.hidden = true;
      this.errorEl.textContent = '';
    }
  };

  Card.prototype.add = function () {
    if (this.busy) return;
    var v = this.getVariant();
    if (!v || !v.available) return;

    var self = this;
    var cfg = this.cfg;
    var item = { id: Number(v.id), quantity: 1 };
    var plan = this.resolvePlan(v);
    if (plan) item.selling_plan = Number(this.planId);
    if (cfg.propKey && cfg.propValue) {
      item.properties = {};
      item.properties[cfg.propKey] = cfg.propValue;
    }

    this.busy = true;
    this.hideError();
    this.setButton('loading');

    var root = routesRoot();
    fetch(root + 'cart/add.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify({ items: [item] })
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok || (data && data.status && data.status >= 400)) throw data;
          return data;
        });
      })
      .then(function () {
        return fetch(root + 'cart.js', { headers: { Accept: 'application/json' } })
          .then(function (r) { return r.json(); })
          .catch(function () { return null; });
      })
      .then(function (cart) {
        self.busy = false;
        self.setButton('added');
        notifyCart(cart, cfg.openCart);
        self.timers.push(setTimeout(function () { self.render(false); }, ADDED_RESET_MS));
      })
      .catch(function (err) {
        self.busy = false;
        self.render(false);
        var msg = err && typeof err.description === 'string' && err.description
          ? err.description
          : (self.labels.error || 'Something went wrong. Please try again.');
        self.showError(msg);
        console.error('[lt-product-cards] Add to cart failed', err);
      });
  };

  Card.prototype.destroy = function () {
    this.timers.forEach(clearTimeout);
    if (this.variantSel) this.variantSel.removeEventListener('change', this.onVariant);
    if (this.planSel) this.planSel.removeEventListener('change', this.onPlan);
    if (this.btn) this.btn.removeEventListener('click', this.onAdd);
  };

  /* ------------------------------------------------------------------------
     Section
     ------------------------------------------------------------------------ */
  function Section(root) {
    this.root = root;
    this.cfg = parseJSON(root.querySelector('[data-lt-pc-config]')) || {};
    this.swiperEl = root.querySelector('.lt-pc__swiper');
    this.swiper = null;
    this.mode = null;

    var self = this;
    this.cards = [];
    root.querySelectorAll('[data-lt-pc-card]').forEach(function (el) {
      self.cards.push(new Card(el, self.cfg));
    });

    this.onBreakpoint = function () { self.layout(); };
    onMQChange(MQ, this.onBreakpoint);
    this.layout();
  }

  Section.prototype.deviceConfig = function () {
    return (MQ.matches ? this.cfg.desktop : this.cfg.mobile) || {};
  };

  Section.prototype.layout = function () {
    if (!this.swiperEl) return;
    var dc = this.deviceConfig();
    var key = (MQ.matches ? 'd' : 'm') + ':' + dc.layout;
    if (key === this.mode) return;
    this.mode = key;
    this.destroySwiper();
    if (dc.layout === 'carousel') this.initSwiper(dc);
  };

  Section.prototype.initSwiper = function (dc) {
    var self = this;
    if (typeof window.Swiper !== 'function') {
      /* Swiper not ready yet: CSS scroll-snap keeps the carousel usable meanwhile */
      if (!this.waiting) {
        this.waiting = true;
        window.addEventListener('load', function () {
          self.waiting = false;
          if (typeof window.Swiper === 'function') {
            self.mode = null;
            self.layout();
          }
        }, { once: true });
      }
      return;
    }

    var c = this.cfg;
    var count = this.swiperEl.querySelectorAll('.lt-pc__slide').length;
    var perView = Math.max(1, Number(dc.perView) || 1);
    var spv = perView + (Number(dc.peek) || 0) / 100;
    var group = c.moveBy === 'page' ? Math.max(1, Math.floor(perView)) : 1;
    var root = this.root;

    var opts = {
      slidesPerView: spv,
      spaceBetween: Number(dc.gap) || 0,
      slidesPerGroup: group,
      speed: Number(c.speed) || 500,
      loop: !!c.loop && count >= Math.ceil(spv) + group,
      centerInsufficientSlides: !!c.center,
      watchOverflow: true,
      simulateTouch: !!c.drag,
      grabCursor: !!c.drag,
      preventClicks: true,
      a11y: { enabled: true },
      navigation: false,
      pagination: false
    };

    if (dc.arrows) {
      opts.navigation = {
        prevEl: root.querySelector('.lt-pc__arrow--prev'),
        nextEl: root.querySelector('.lt-pc__arrow--next')
      };
    }
    if (dc.dots) {
      opts.pagination = {
        el: root.querySelector('.lt-pc__dots'),
        clickable: true,
        type: c.dotsType || 'bullets'
      };
    }
    if (c.autoplay && !REDUCED_MOTION.matches) {
      opts.autoplay = {
        delay: Number(c.autoplayDelay) || 5000,
        pauseOnMouseEnter: !!c.pauseOnHover,
        disableOnInteraction: false
      };
    }

    try {
      this.swiper = new window.Swiper(this.swiperEl, opts);
      root.classList.add('is-swiper');
    } catch (e) {
      console.error('[lt-product-cards] Swiper init failed', e);
      this.swiper = null;
    }
  };

  Section.prototype.destroySwiper = function () {
    if (this.swiper) {
      try { this.swiper.destroy(true, true); } catch (e) { /* noop */ }
      this.swiper = null;
    }
    this.root.classList.remove('is-swiper');
    var dots = this.root.querySelector('.lt-pc__dots');
    if (dots) {
      dots.innerHTML = '';
      dots.className = 'lt-pc__dots';
    }
  };

  /* Theme editor: scroll to the block being edited */
  Section.prototype.selectBlock = function (blockEl) {
    if (!this.swiper) return;
    var slide = blockEl.closest('.swiper-slide');
    if (!slide) return;
    if (this.swiper.autoplay && this.swiper.autoplay.running) this.swiper.autoplay.stop();
    var loopIndex = slide.getAttribute('data-swiper-slide-index');
    if (this.swiper.params.loop && loopIndex !== null) {
      this.swiper.slideToLoop(Number(loopIndex));
    } else {
      var idx = Array.prototype.indexOf.call(this.swiper.slides, slide);
      if (idx > -1) this.swiper.slideTo(idx);
    }
  };

  Section.prototype.deselectBlock = function () {
    if (this.swiper && this.swiper.params.autoplay && this.swiper.params.autoplay.enabled && this.swiper.autoplay) {
      this.swiper.autoplay.start();
    }
  };

  Section.prototype.destroy = function () {
    offMQChange(MQ, this.onBreakpoint);
    this.destroySwiper();
    this.cards.forEach(function (card) { if (card.destroy) card.destroy(); });
    this.cards = [];
  };

  /* ------------------------------------------------------------------------
     Bootstrapping + theme editor events
     ------------------------------------------------------------------------ */
  function init(scope) {
    var nodes = [];
    if (scope && scope.matches && scope.matches('[data-lt-pc]')) nodes.push(scope);
    if (scope && scope.querySelectorAll) {
      scope.querySelectorAll('[data-lt-pc]').forEach(function (n) { nodes.push(n); });
    }
    nodes.forEach(function (node) {
      if (node.__ltpc) return;
      node.__ltpc = new Section(node);
    });
  }

  function destroy(scope) {
    if (!scope || !scope.querySelectorAll) return;
    scope.querySelectorAll('[data-lt-pc]').forEach(function (node) {
      if (node.__ltpc) {
        node.__ltpc.destroy();
        node.__ltpc = null;
      }
    });
  }

  function instanceFor(el) {
    var node = el && el.closest ? el.closest('[data-lt-pc]') : null;
    return node ? node.__ltpc : null;
  }

  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
  document.addEventListener('shopify:section:unload', function (e) { destroy(e.target); });
  document.addEventListener('shopify:block:select', function (e) {
    var inst = instanceFor(e.target);
    if (inst) inst.selectBlock(e.target);
  });
  document.addEventListener('shopify:block:deselect', function (e) {
    var inst = instanceFor(e.target);
    if (inst) inst.deselectBlock();
  });

  window.LTProductCards = { init: init, destroy: destroy };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(document); });
  } else {
    init(document);
  }
})();
