/* ==========================================================================
   LT BF Deals (sections/lt-bf-deals.liquid)
   - Layout per device (750px breakpoint): grid | carousel (Swiper, global) | stack
   - Variant dropdown (only if a bundle has >1 variant) updates price/badge/image
   - Add to Cart -> /cart/add.js -> Rebuy Smart Cart
   - Card links are plain <a> tags rendered only when a block asks for them
   ========================================================================== */
(function () {
  'use strict';

  if (window.LTBFDeals) {
    window.LTBFDeals.init(document);
    return;
  }

  var MQ = window.matchMedia('(min-width: 750px)');
  var REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');
  var ADDED_RESET_MS = 2000;
  var ERROR_HIDE_MS = 5000;

  function parseJSON(el) {
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) {
      console.warn('[lt-bf-deals] Invalid JSON', e);
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
    var r = window.Shopify && window.Shopify.routes && window.Shopify.routes.root;
    return r || '/';
  }

  function dispatch(name, detail) {
    try { document.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: detail })); } catch (e) { /* noop */ }
  }

  /* Refresh + open the Rebuy Smart Cart (same pattern as lt-product-cards.js) */
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
    this.data = parseJSON(el.querySelector('[data-lt-bf-data]'));
    if (!this.data || !this.data.variants || !this.data.variants.length) return;

    this.variantSel = el.querySelector('[data-lt-bf-variant]');
    this.priceEl = el.querySelector('[data-lt-bf-price]');
    this.compareEl = el.querySelector('[data-lt-bf-compare]');
    this.badgeEl = el.querySelector('[data-lt-bf-badge]');
    this.imgEl = el.querySelector('img.lt-bf__img');
    this.btn = el.querySelector('[data-lt-bf-atc]');
    this.btnText = el.querySelector('[data-lt-bf-btn-text]');
    this.errorEl = el.querySelector('[data-lt-bf-error]');
    this.atcLabel = this.btn ? (this.btn.getAttribute('data-label') || 'Add to Cart') : '';

    this.variantId = String(el.getAttribute('data-variant-id') || this.data.variants[0].id);
    this.busy = false;
    this.timers = [];

    var self = this;
    this.onVariant = function () {
      self.variantId = String(self.variantSel.value);
      self.render(true);
    };
    this.onAdd = function (e) {
      e.preventDefault();
      e.stopPropagation();
      self.add();
    };

    if (this.variantSel) this.variantSel.addEventListener('change', this.onVariant);
    if (this.btn) this.btn.addEventListener('click', this.onAdd);
  }

  Card.prototype.getVariant = function () {
    var list = this.data.variants;
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === this.variantId) return list[i];
    }
    return list[0];
  };

  Card.prototype.render = function (variantChanged) {
    var v = this.getVariant();
    if (!v) return;

    if (this.priceEl) this.priceEl.textContent = v.price || '';
    if (this.compareEl) {
      this.compareEl.textContent = v.compare || '';
      this.compareEl.hidden = !(this.cfg.showCompare && v.compare);
    }
    if (this.badgeEl && this.cfg.showSaveBadge) {
      var pct = Number(v.pct) || 0;
      this.badgeEl.hidden = pct <= 0;
      if (pct > 0) {
        this.badgeEl.textContent = String(this.cfg.saveBadge || '')
          .replace(/\[percent\]/g, pct)
          .replace(/\[amount\]/g, v.save || '');
      }
    }
    if (variantChanged && this.imgEl && v.img) {
      this.imgEl.removeAttribute('srcset');
      this.imgEl.src = v.img;
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
    if (!this.errorEl) return;
    this.errorEl.hidden = true;
    this.errorEl.textContent = '';
  };

  Card.prototype.add = function () {
    if (this.busy) return;
    var v = this.getVariant();
    if (!v || !v.available) return;

    var self = this;
    var cfg = this.cfg;
    var item = { id: Number(v.id), quantity: 1 };
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
        console.error('[lt-bf-deals] Add to cart failed', err);
      });
  };

  Card.prototype.destroy = function () {
    this.timers.forEach(clearTimeout);
    if (this.variantSel) this.variantSel.removeEventListener('change', this.onVariant);
    if (this.btn) this.btn.removeEventListener('click', this.onAdd);
  };

  /* ------------------------------------------------------------------------
     Section
     ------------------------------------------------------------------------ */
  function Section(root) {
    this.root = root;
    this.cfg = parseJSON(root.querySelector('[data-lt-bf-config]')) || {};
    this.swiperEl = root.querySelector('.lt-bf__swiper');
    this.swiper = null;
    this.mode = null;

    var self = this;
    this.cards = [];
    root.querySelectorAll('[data-lt-bf-card]').forEach(function (el) {
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
      /* CSS scroll-snap keeps the carousel usable until Swiper loads */
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
    var root = this.root;
    var count = this.swiperEl.querySelectorAll('.lt-bf__slide').length;
    var perView = Math.max(1, Number(dc.perView) || 1);
    var spv = perView + (Number(dc.peek) || 0) / 100;

    var opts = {
      slidesPerView: spv,
      spaceBetween: Number(dc.gap) || 0,
      speed: 500,
      loop: !!c.loop && count >= Math.ceil(spv) + 1,
      centerInsufficientSlides: true,
      watchOverflow: true,
      grabCursor: true,
      preventClicks: true,
      a11y: { enabled: true },
      navigation: dc.arrows ? {
        prevEl: root.querySelector('.lt-bf__arrow--prev'),
        nextEl: root.querySelector('.lt-bf__arrow--next')
      } : false,
      pagination: dc.dots ? { el: root.querySelector('.lt-bf__dots'), clickable: true } : false
    };
    if (c.autoplay && !REDUCED_MOTION.matches) {
      opts.autoplay = { delay: Number(c.autoplayDelay) || 5000, pauseOnMouseEnter: true, disableOnInteraction: false };
    }

    try {
      this.swiper = new window.Swiper(this.swiperEl, opts);
      root.classList.add('is-swiper');
    } catch (e) {
      console.error('[lt-bf-deals] Swiper init failed', e);
      this.swiper = null;
    }
  };

  Section.prototype.destroySwiper = function () {
    if (this.swiper) {
      try { this.swiper.destroy(true, true); } catch (e) { /* noop */ }
      this.swiper = null;
    }
    this.root.classList.remove('is-swiper');
    var dots = this.root.querySelector('.lt-bf__dots');
    if (dots) {
      dots.innerHTML = '';
      dots.className = 'lt-bf__dots';
    }
  };

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
    if (scope && scope.matches && scope.matches('[data-lt-bf]')) nodes.push(scope);
    if (scope && scope.querySelectorAll) {
      scope.querySelectorAll('[data-lt-bf]').forEach(function (n) { nodes.push(n); });
    }
    nodes.forEach(function (node) {
      if (node.__ltbf) return;
      node.__ltbf = new Section(node);
    });
  }

  function destroy(scope) {
    if (!scope || !scope.querySelectorAll) return;
    scope.querySelectorAll('[data-lt-bf]').forEach(function (node) {
      if (node.__ltbf) {
        node.__ltbf.destroy();
        node.__ltbf = null;
      }
    });
  }

  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
  document.addEventListener('shopify:section:unload', function (e) { destroy(e.target); });
  document.addEventListener('shopify:block:select', function (e) {
    var node = e.target.closest ? e.target.closest('[data-lt-bf]') : null;
    if (node && node.__ltbf) node.__ltbf.selectBlock(e.target);
  });

  window.LTBFDeals = { init: init, destroy: destroy };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(document); });
  } else {
    init(document);
  }
})();
