/* ============================================================
   Nyay Setu — UTILITY FUNCTIONS
   utils.js — Toast, Modal, Validation, Formatting, Ripple
   ============================================================ */

const Utils = {
  /* --------------------------------------------------------
     ID GENERATION
     -------------------------------------------------------- */
  generateId(prefix = 'id') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}`;
  },

  /* --------------------------------------------------------
     HTML ESCAPING
     -------------------------------------------------------- */
  escapeHtml(str) {
    if (str == null) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(str).replace(/[&<>"']/g, m => map[m]);
  },

  /* --------------------------------------------------------
     TOAST NOTIFICATIONS
     -------------------------------------------------------- */
  showToast(message, type = 'info', duration = 4000) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const icons = {
      success: 'check_circle',
      error: 'error',
      warning: 'warning',
      info: 'info'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-icon">
        <span class="material-symbols-rounded icon-sm icon-filled">${icons[type] || icons.info}</span>
      </div>
      <span class="toast-message">${message}</span>
      <span class="material-symbols-rounded toast-close" onclick="Utils.removeToast(this.closest('.toast'))">close</span>
    `;

    container.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => this.removeToast(toast), duration);
    }

    return toast;
  },

  removeToast(toast) {
    if (!toast || !toast.parentElement) return;
    toast.classList.add('removing');
    setTimeout(() => {
      if (toast.parentElement) toast.parentElement.removeChild(toast);
    }, 300);
  },

  /* --------------------------------------------------------
     MODAL MANAGEMENT
     -------------------------------------------------------- */
  _modalCallbacks: {},

  showModal(content, options = {}) {
    const { title = '', size = '', onClose = null, showClose = true, actions = [] } = options;
    
    let overlay = document.getElementById('modal-container');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'modal-container';
      document.body.appendChild(overlay);
    }

    const sizeClass = size ? `modal-${size}` : '';
    
    let actionsHTML = '';
    if (actions.length > 0) {
      actionsHTML = `<div class="modal-footer">${actions.map((a, idx) => {
        const cbKey = `modal_btn_${Date.now()}_${idx}`;
        this._modalCallbacks[cbKey] = a.action || a.onclick;
        const clickHandler = typeof a.action === 'function' ? `Utils.triggerModalAction('${cbKey}')` : a.onclick || 'Utils.hideModal()';
        return `<button type="button" class="btn ${a.class || 'btn-secondary'}" onclick="${clickHandler}">${a.text}</button>`;
      }).join('')}</div>`;
    }

    overlay.innerHTML = `
      <div class="modal-overlay ${sizeClass}" onclick="Utils.handleModalOverlayClick(event)">
        <div class="modal-content" onclick="event.stopPropagation()">
          ${title || showClose ? `
            <div class="modal-header">
              <h3 class="modal-title">${title}</h3>
              ${showClose ? '<button type="button" class="modal-close" onclick="Utils.hideModal()"><span class="material-symbols-rounded">close</span></button>' : ''}
            </div>
          ` : ''}
          <div class="modal-body">${content}</div>
          ${actionsHTML}
        </div>
      </div>
    `;

    this._modalOnClose = onClose;
    requestAnimationFrame(() => {
      const el = overlay.querySelector('.modal-overlay');
      if (el) el.classList.add('active');
    });
  },

  triggerModalAction(key) {
    if (this._modalCallbacks[key]) {
      if (typeof this._modalCallbacks[key] === 'function') {
        this._modalCallbacks[key]();
      }
    }
  },

  hideModal() {
    const overlay = document.getElementById('modal-container');
    if (!overlay) return;
    const el = overlay.querySelector('.modal-overlay');
    if (el) {
      el.classList.remove('active');
      setTimeout(() => {
        overlay.innerHTML = '';
        if (this._modalOnClose) {
          this._modalOnClose();
          this._modalOnClose = null;
        }
      }, 250);
    }
  },

  handleModalOverlayClick(event) {
    if (event.target.classList.contains('modal-overlay')) {
      Utils.hideModal();
    }
  },

  _confirmResolve: null,

  showConfirm(title, message, options = {}) {
    return new Promise((resolve) => {
      const { confirmText = 'Confirm', cancelText = 'Cancel', type = 'primary' } = options;
      
      // Store resolve on the Utils object so onclick strings can access it
      Utils._confirmResolve = resolve;
      
      let overlay = document.getElementById('modal-container');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'modal-container';
        document.body.appendChild(overlay);
      }

      overlay.innerHTML = `
        <div class="modal-overlay" onclick="if(event.target===this){Utils._resolveConfirm(false)}">
          <div class="modal-content" onclick="event.stopPropagation()">
            <div class="modal-header">
              <h3 class="modal-title">${title}</h3>
              <button type="button" class="modal-close" onclick="Utils._resolveConfirm(false)"><span class="material-symbols-rounded">close</span></button>
            </div>
            <div class="modal-body">
              <p style="color:var(--color-gray-600);line-height:1.6">${message}</p>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="Utils._resolveConfirm(false)">${cancelText}</button>
              <button type="button" class="btn btn-${type}" onclick="Utils._resolveConfirm(true)">${confirmText}</button>
            </div>
          </div>
        </div>
      `;

      requestAnimationFrame(() => {
        const el = overlay.querySelector('.modal-overlay');
        if (el) el.classList.add('active');
      });
    });
  },

  _resolveConfirm(value) {
    const overlay = document.getElementById('modal-container');
    if (overlay) {
      const el = overlay.querySelector('.modal-overlay');
      if (el) el.classList.remove('active');
      setTimeout(() => { overlay.innerHTML = ''; }, 250);
    }
    if (Utils._confirmResolve) {
      const resolve = Utils._confirmResolve;
      Utils._confirmResolve = null;
      resolve(value);
    }
  },

  /* --------------------------------------------------------
     DATE & TIME FORMATTING
     -------------------------------------------------------- */
  formatDate(date, format = 'short') {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const options = {
      short: { day: 'numeric', month: 'short', year: 'numeric' },
      long: { day: 'numeric', month: 'long', year: 'numeric' },
      full: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
      numeric: { day: '2-digit', month: '2-digit', year: 'numeric' }
    };

    return d.toLocaleDateString('en-IN', options[format] || options.short);
  },

  formatTime(date) {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  },

  formatDateTime(date) {
    return `${this.formatDate(date)} at ${this.formatTime(date)}`;
  },

  formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  },

  timeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    const intervals = [
      { label: 'year', seconds: 31536000 },
      { label: 'month', seconds: 2592000 },
      { label: 'week', seconds: 604800 },
      { label: 'day', seconds: 86400 },
      { label: 'hour', seconds: 3600 },
      { label: 'minute', seconds: 60 }
    ];

    for (const interval of intervals) {
      const count = Math.floor(seconds / interval.seconds);
      if (count >= 1) {
        return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
      }
    }
    return 'Just now';
  },

  /* --------------------------------------------------------
      VALIDATION
      -------------------------------------------------------- */
  validateEmail(email) {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(String(email).toLowerCase());
  },

  validatePhone(phone) {
    const re = /^[6-9]\d{9}$/;
    return re.test(String(phone).replace(/[\s\-\+]/g, '').replace(/^91/, ''));
  },

  validateBarNumber(bar) {
    const value = String(bar || '').trim().toUpperCase();
    if (!/^[A-Z]{2}\/[A-Z0-9]+\/\d{4}$/.test(value)) return false;
    const year = Number(value.split('/').pop());
    return year >= 1950 && year <= new Date().getFullYear();
  },

  validateOTP(otp) {
    return /^\d{6}$/.test(String(otp));
  },

  /* --------------------------------------------------------
     HTML ESCAPING (XSS protection for user-supplied strings)
     -------------------------------------------------------- */
  escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  /* --------------------------------------------------------
     RIPPLE EFFECT
     -------------------------------------------------------- */
  createRipple(event) {
    const button = (event.currentTarget && event.currentTarget.getBoundingClientRect)
      ? event.currentTarget
      : event.target?.closest?.('.btn-primary, .btn-secondary, .btn-danger, .btn-accent, .btn, .u-btn');
    if (!button || typeof button.getBoundingClientRect !== 'function') return;

    const diameter = Math.max(button.clientWidth || 0, button.clientHeight || 0);
    if (!diameter) return;
    const radius = diameter / 2;
    const rect = button.getBoundingClientRect();

    const circle = document.createElement('span');
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - rect.left - radius}px`;
    circle.style.top = `${event.clientY - rect.top - radius}px`;
    circle.classList.add('ripple');

    const existingRipple = button.querySelector('.ripple');
    if (existingRipple) existingRipple.remove();

    button.appendChild(circle);
    setTimeout(() => circle.remove(), 600);
  },

  initRipples() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-primary, .btn-secondary, .btn-danger, .btn-accent');
      if (btn) this.createRipple(e);
    });
  },

  scrollToTop(smooth = true) {
    window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
  },

  getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  },

  randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },

  randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  randomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Utils.initRipples();
});
