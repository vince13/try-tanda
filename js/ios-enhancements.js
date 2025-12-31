/**
 * iOS Enhancements for Tanda Web App
 * Provides iOS-specific UI patterns, haptic feedback, and advanced gestures
 */

// Haptic Feedback Helper
// Use window.HapticFeedback if already defined to avoid duplicate declaration
const HapticFeedback = window.HapticFeedback || {
  light: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  },
  medium: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(20);
    }
  },
  heavy: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(30);
    }
  },
  success: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([10, 50, 10]);
    }
  },
  error: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([20, 50, 20, 50, 20]);
    }
  },
  selection: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(5);
    }
  }
};

// iOS Bottom Sheet Modal
class BottomSheet {
  constructor(options = {}) {
    this.id = options.id || 'bottom-sheet';
    this.content = options.content || '';
    this.onClose = options.onClose || null;
    this.dismissible = options.dismissible !== false;
    this.init();
  }

  init() {
    // Create bottom sheet HTML
    const sheetHTML = `
      <div id="${this.id}" class="ios-bottom-sheet" style="display: none;">
        <div class="ios-bottom-sheet-backdrop"></div>
        <div class="ios-bottom-sheet-content">
          <div class="ios-bottom-sheet-handle"></div>
          <div class="ios-bottom-sheet-body">${this.content}</div>
        </div>
      </div>
    `;
    
    // Add to body if not exists
    if (!document.getElementById(this.id)) {
      document.body.insertAdjacentHTML('beforeend', sheetHTML);
    }

    const sheet = document.getElementById(this.id);
    const backdrop = sheet.querySelector('.ios-bottom-sheet-backdrop');
    const content = sheet.querySelector('.ios-bottom-sheet-content');

    // Backdrop click to dismiss
    if (this.dismissible && backdrop) {
      backdrop.addEventListener('click', () => this.close());
    }

    // Swipe down to dismiss
    this.setupSwipeToDismiss(content);
  }

  show() {
    const sheet = document.getElementById(this.id);
    if (!sheet) return;
    
    sheet.style.display = 'block';
    // Trigger animation
    requestAnimationFrame(() => {
      sheet.classList.add('show');
      HapticFeedback.light();
    });
  }

  close() {
    const sheet = document.getElementById(this.id);
    if (!sheet) return;
    
    sheet.classList.remove('show');
    HapticFeedback.light();
    
    setTimeout(() => {
      sheet.style.display = 'none';
      if (this.onClose) this.onClose();
    }, 300);
  }

  setupSwipeToDismiss(element) {
    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    element.addEventListener('touchstart', (e) => {
      startY = e.touches[0].clientY;
      isDragging = true;
    }, { passive: true });

    element.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;
      
      if (deltaY > 0) {
        element.style.transform = `translateY(${deltaY}px)`;
        element.style.opacity = Math.max(0.5, 1 - deltaY / 200);
      }
    }, { passive: true });

    element.addEventListener('touchend', () => {
      if (!isDragging) return;
      isDragging = false;
      
      const deltaY = currentY - startY;
      if (deltaY > 100) {
        this.close();
      } else {
        element.style.transform = '';
        element.style.opacity = '';
      }
    }, { passive: true });
  }

  updateContent(newContent) {
    const body = document.querySelector(`#${this.id} .ios-bottom-sheet-body`);
    if (body) {
      body.innerHTML = newContent;
    }
  }
}

// Pull to Refresh
class PullToRefresh {
  constructor(options = {}) {
    this.container = options.container || document.body;
    this.onRefresh = options.onRefresh || null;
    this.threshold = options.threshold || 80;
    this.init();
  }

  init() {
    let startY = 0;
    let currentY = 0;
    let isPulling = false;
    let pullDistance = 0;

    const indicator = document.createElement('div');
    indicator.className = 'pull-to-refresh-indicator';
    indicator.innerHTML = '<i class="fas fa-spinner"></i>';
    this.container.insertBefore(indicator, this.container.firstChild);

    this.container.addEventListener('touchstart', (e) => {
      if (this.container.scrollTop === 0) {
        startY = e.touches[0].clientY;
        isPulling = true;
      }
    }, { passive: true });

    this.container.addEventListener('touchmove', (e) => {
      if (!isPulling || this.container.scrollTop > 0) {
        isPulling = false;
        return;
      }

      currentY = e.touches[0].clientY;
      pullDistance = currentY - startY;

      if (pullDistance > 0) {
        e.preventDefault();
        const progress = Math.min(pullDistance / this.threshold, 1);
        indicator.style.opacity = progress;
        indicator.style.transform = `translateY(${pullDistance * 0.5}px) rotate(${progress * 360}deg)`;
        
        if (pullDistance > this.threshold) {
          indicator.classList.add('ready');
          HapticFeedback.medium();
        } else {
          indicator.classList.remove('ready');
        }
      }
    }, { passive: false });

    this.container.addEventListener('touchend', () => {
      if (!isPulling) return;
      isPulling = false;

      if (pullDistance > this.threshold && this.onRefresh) {
        indicator.classList.add('refreshing');
        HapticFeedback.success();
        this.onRefresh(() => {
          indicator.classList.remove('refreshing', 'ready');
          indicator.style.opacity = '0';
          indicator.style.transform = '';
          pullDistance = 0;
        });
      } else {
        indicator.classList.remove('ready');
        indicator.style.opacity = '0';
        indicator.style.transform = '';
        pullDistance = 0;
      }
    }, { passive: true });
  }
}

// Advanced Gesture Handler
class GestureHandler {
  constructor(element, options = {}) {
    this.element = element;
    this.onSwipeLeft = options.onSwipeLeft || null;
    this.onSwipeRight = options.onSwipeRight || null;
    this.onSwipeUp = options.onSwipeUp || null;
    this.onSwipeDown = options.onSwipeDown || null;
    this.onLongPress = options.onLongPress || null;
    this.onDoubleTap = options.onDoubleTap || null;
    this.swipeThreshold = options.swipeThreshold || 50;
    this.longPressDuration = options.longPressDuration || 500;
    this.init();
  }

  init() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let longPressTimer = null;
    let lastTap = 0;
    let tapCount = 0;

    this.element.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();

      // Long press detection
      if (this.onLongPress) {
        longPressTimer = setTimeout(() => {
          HapticFeedback.medium();
          if (this.onLongPress) this.onLongPress(e);
        }, this.longPressDuration);
      }
    }, { passive: true });

    this.element.addEventListener('touchmove', (e) => {
      // Cancel long press if moved
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }, { passive: true });

    this.element.addEventListener('touchend', (e) => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }

      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const touchEndTime = Date.now();
      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;
      const deltaTime = touchEndTime - touchStartTime;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Swipe detection
      if (distance > this.swipeThreshold && deltaTime < 300) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          // Horizontal swipe
          if (deltaX > 0 && this.onSwipeRight) {
            HapticFeedback.light();
            this.onSwipeRight(e);
          } else if (deltaX < 0 && this.onSwipeLeft) {
            HapticFeedback.light();
            this.onSwipeLeft(e);
          }
        } else {
          // Vertical swipe
          if (deltaY > 0 && this.onSwipeDown) {
            HapticFeedback.light();
            this.onSwipeDown(e);
          } else if (deltaY < 0 && this.onSwipeUp) {
            HapticFeedback.light();
            this.onSwipeUp(e);
          }
        }
      }

      // Double tap detection
      if (this.onDoubleTap && distance < 10 && deltaTime < 300) {
        const currentTime = Date.now();
        if (currentTime - lastTap < 300) {
          tapCount++;
          if (tapCount === 2) {
            HapticFeedback.medium();
            this.onDoubleTap(e);
            tapCount = 0;
          }
        } else {
          tapCount = 1;
        }
        lastTap = currentTime;
      }
    }, { passive: true });
  }
}

// iOS-style transitions helper
const IOSTransitions = {
  slideUp: (element, callback) => {
    element.style.transform = 'translateY(100%)';
    element.style.opacity = '0';
    element.style.display = 'block';
    requestAnimationFrame(() => {
      element.style.transition = 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1), opacity 0.3s';
      element.style.transform = 'translateY(0)';
      element.style.opacity = '1';
      if (callback) setTimeout(callback, 300);
    });
  },

  slideDown: (element, callback) => {
    element.style.transition = 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1), opacity 0.3s';
    element.style.transform = 'translateY(100%)';
    element.style.opacity = '0';
    if (callback) setTimeout(callback, 300);
  },

  fadeIn: (element, callback) => {
    element.style.opacity = '0';
    element.style.display = 'block';
    requestAnimationFrame(() => {
      element.style.transition = 'opacity 0.3s ease';
      element.style.opacity = '1';
      if (callback) setTimeout(callback, 300);
    });
  },

  fadeOut: (element, callback) => {
    element.style.transition = 'opacity 0.3s ease';
    element.style.opacity = '0';
    if (callback) setTimeout(callback, 300);
  },

  scaleIn: (element, callback) => {
    element.style.transform = 'scale(0.8)';
    element.style.opacity = '0';
    element.style.display = 'block';
    requestAnimationFrame(() => {
      element.style.transition = 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1), opacity 0.3s';
      element.style.transform = 'scale(1)';
      element.style.opacity = '1';
      if (callback) setTimeout(callback, 300);
    });
  }
};

// Make available globally
window.HapticFeedback = HapticFeedback;
window.BottomSheet = BottomSheet;
window.PullToRefresh = PullToRefresh;
window.GestureHandler = GestureHandler;
window.IOSTransitions = IOSTransitions;

// iOS Enhancements loaded - no logging needed in production

