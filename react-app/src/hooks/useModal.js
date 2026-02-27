import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Custom hook for managing modal state with accessibility features
 * Includes focus trap, escape key handling, and focus restoration
 *
 * @param {object} options - Configuration options
 * @param {boolean} options.closeOnEscape - Close modal on Escape key (default: true)
 * @param {boolean} options.closeOnOverlayClick - Close on overlay click (default: true)
 * @returns {object} Modal state and handlers
 */
export function useModal(options = {}) {
  const {
    closeOnEscape = true,
    closeOnOverlayClick = true
  } = options;

  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState(null);
  const previousActiveElement = useRef(null);
  const modalRef = useRef(null);

  const open = useCallback((modalData = null) => {
    // Store the currently focused element to restore later
    previousActiveElement.current = document.activeElement;
    setData(modalData);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setData(null);

    // Restore focus to the element that opened the modal
    if (previousActiveElement.current && previousActiveElement.current.focus) {
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => {
        previousActiveElement.current?.focus();
      }, 0);
    }
  }, []);

  // Handle escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        close();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEscape, close]);

  // Focus trap and initial focus
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    // Focus the first focusable element (or the modal itself)
    if (firstFocusable) {
      firstFocusable.focus();
    } else {
      modal.focus();
    }

    // Trap focus within the modal
    const handleTabKey = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };

    modal.addEventListener('keydown', handleTabKey);
    return () => modal.removeEventListener('keydown', handleTabKey);
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Overlay click handler
  const handleOverlayClick = useCallback((e) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      close();
    }
  }, [closeOnOverlayClick, close]);

  return {
    isOpen,
    data,
    open,
    close,
    modalRef,
    handleOverlayClick,
    // Props to spread on the modal container
    modalProps: {
      ref: modalRef,
      role: 'dialog',
      'aria-modal': true,
      tabIndex: -1
    },
    // Props to spread on the overlay
    overlayProps: {
      onClick: handleOverlayClick
    }
  };
}

export default useModal;
