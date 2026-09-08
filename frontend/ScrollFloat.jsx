import { useEffect, useMemo, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import './ScrollFloat.css';

gsap.registerPlugin(ScrollTrigger);

const ScrollFloat = ({
  children,
  scrollContainerRef,
  containerClassName = '',
  textClassName = '',
  animationDuration = 1,
  ease = 'back.inOut(2)',
  scrollStart = 'top bottom-=10%',
  scrollEnd = 'bottom center+=20%',
  stagger = 0.03,
}) => {
  const containerRef = useRef(null);

  // Group into words; wrap each word in inline-block whitespace-nowrap so "VULNORA" is 100% unbreakable
  const splitText = useMemo(() => {
    const text = typeof children === 'string' ? children : '';
    const words = text.split(' ');
    return words.map((word, wIdx) => (
      <span
        className="word"
        key={wIdx}
        style={{ display: 'inline-block', whiteSpace: 'nowrap' }}
      >
        {word.split('').map((char, cIdx) => (
          <span className="char" key={cIdx} style={{ display: 'inline-block' }}>
            {char}
          </span>
        ))}
        {wIdx < words.length - 1 && (
          <span className="space" style={{ display: 'inline-block', width: '0.35em' }}>
            &nbsp;
          </span>
        )}
      </span>
    ));
  }, [children]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const scroller =
      scrollContainerRef && scrollContainerRef.current
        ? scrollContainerRef.current
        : window;

    const charElements = el.querySelectorAll('.char');

    gsap.fromTo(
      charElements,
      {
        willChange: 'opacity, transform',
        opacity: 0,
        yPercent: 70,
        scaleY: 1.15,
        scaleX: 0.95,
        transformOrigin: '50% 0%',
      },
      {
        duration: animationDuration,
        ease: ease,
        opacity: 1,
        yPercent: 0,
        scaleY: 1,
        scaleX: 1,
        stagger: stagger,
        scrollTrigger: {
          trigger: el,
          scroller,
          start: scrollStart,
          end: scrollEnd,
          scrub: true,
        },
      }
    );
  }, [scrollContainerRef, animationDuration, ease, scrollStart, scrollEnd, stagger]);

  return (
    <h2 ref={containerRef} className={`scroll-float ${containerClassName}`}>
      <span className={`scroll-float-text ${textClassName}`}>{splitText}</span>
    </h2>
  );
};

export default ScrollFloat;
