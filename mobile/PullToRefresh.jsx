import React, { useState, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
};

export default function PullToRefresh({ children, onRefresh }) {
  const [isMobile, setIsMobile] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullStartY, setPullStartY] = useState(null);
  const containerRef = useRef(null);
  const isAtTopRef = useRef(true);

  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  useEffect(() => {
    if (!isMobile || !containerRef.current) return;

    const container = containerRef.current;
    
    const handleScroll = () => {
      isAtTopRef.current = container.scrollTop <= 0;
    };

    const handleTouchStart = (e) => {
      if (isAtTopRef.current && !isRefreshing) {
        setPullStartY(e.touches[0].clientY);
      }
    };

    const handleTouchMove = (e) => {
      if (pullStartY === null || isRefreshing || !isAtTopRef.current) return;

      const currentY = e.touches[0].clientY;
      const distance = currentY - pullStartY;

      if (distance > 0) {
        setPullDistance(Math.min(distance, 120));
        if (distance > 10) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = async () => {
      if (pullDistance > 80 && !isRefreshing && onRefresh) {
        setIsRefreshing(true);
        try {
          await onRefresh();
        } catch (error) {
          console.error('Refresh failed:', error);
        } finally {
          setTimeout(() => {
            setIsRefreshing(false);
            setPullDistance(0);
            setPullStartY(null);
          }, 300);
        }
      } else {
        setPullDistance(0);
        setPullStartY(null);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobile, pullStartY, pullDistance, isRefreshing, onRefresh]);

  if (!isMobile) {
    return <div ref={containerRef} className="h-full overflow-auto">{children}</div>;
  }

  const threshold = 80;
  const showIndicator = pullDistance > 0 || isRefreshing;
  const indicatorText = isRefreshing ? 'Refreshing...' : pullDistance > threshold ? 'Release to refresh' : 'Pull to refresh';

  return (
    <div ref={containerRef} className="h-full overflow-auto relative">
      {showIndicator && (
        <div 
          className="absolute top-0 left-0 right-0 z-50 flex items-center justify-center transition-all duration-200"
          style={{ 
            height: Math.max(pullDistance, isRefreshing ? 60 : 0),
            opacity: Math.min(pullDistance / 80, 1)
          }}
        >
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{indicatorText}</span>
          </div>
        </div>
      )}
      <div style={{ transform: `translateY(${Math.min(pullDistance, 60)}px)`, transition: isRefreshing || pullDistance === 0 ? 'transform 0.3s' : 'none' }}>
        {children}
      </div>
    </div>
  );
}