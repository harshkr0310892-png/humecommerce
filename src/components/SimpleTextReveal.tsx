import React, { useState, useEffect, useRef } from 'react';

interface SimpleTextRevealProps {
  children: string | string[];
  className?: string;
  useTextType?: boolean;
  textTypeProps?: Partial<{ typingSpeed: number; deletingSpeed: number; pauseDuration: number; loop: boolean; showCursor: boolean; textColors: string[] }>;
}

const SimpleTextReveal: React.FC<SimpleTextRevealProps> = ({
  children,
  className = '',
  useTextType = false,
  textTypeProps
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  const textArray = Array.isArray(children) ? children : [children];
  const currentText = textArray[currentTextIndex];

  const typingSpeed = textTypeProps?.typingSpeed || 80;
  const deletingSpeed = textTypeProps?.deletingSpeed || 50;
  const pauseDuration = textTypeProps?.pauseDuration || 3000;
  const loop = textTypeProps?.loop !== undefined ? textTypeProps.loop : true;

  useEffect(() => {
    // Simple visibility detection without heavy IntersectionObserver
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!useTextType || !isVisible) {
      // When not using text type, just display all children
      if (Array.isArray(children)) {
        setDisplayedText(children.join(''));
      } else {
        setDisplayedText(children);
      }
      return;
    }

    let timeout: NodeJS.Timeout;

    if (isDeleting) {
      if (displayedText === '') {
        setIsDeleting(false);
        setCurrentTextIndex(prev => (loop ? (prev + 1) % textArray.length : prev));
        setCurrentCharIndex(0);
        timeout = setTimeout(() => {
          // Clear the text before starting to type the next one
          setDisplayedText('');
        }, pauseDuration);
      } else {
        timeout = setTimeout(() => {
          setDisplayedText(prev => prev.slice(0, -1));
        }, deletingSpeed);
      }
    } else {
      if (currentCharIndex < currentText.length) {
        timeout = setTimeout(() => {
          setDisplayedText(prev => prev + currentText[currentCharIndex]);
          setCurrentCharIndex(prev => prev + 1);
        }, typingSpeed);
      } else if (textArray.length > 0) {
        if (!loop && currentTextIndex === textArray.length - 1) return;
        timeout = setTimeout(() => {
          setIsDeleting(true);
        }, pauseDuration);
      }
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [currentCharIndex, displayedText, isDeleting, currentTextIndex, textArray, loop, currentText, typingSpeed, deletingSpeed, pauseDuration, useTextType, isVisible, children]);

  const shouldShowCursor = useTextType && textTypeProps?.showCursor !== false && !isDeleting && currentCharIndex < currentText.length;

  if (!useTextType) {
    return (
      <div ref={elementRef} className={className}>
        {children}
      </div>
    );
  }

  return (
    <div ref={elementRef} className={className}>
      <span>{displayedText}</span>
      {shouldShowCursor && <span className="ml-1 animate-pulse">|</span>}
    </div>
  );
};

export default SimpleTextReveal;