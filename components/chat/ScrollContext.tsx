import React from 'react';

interface ScrollContextType {
  isScrolling: boolean;
  setScrollVelocity: (velocity: number) => void;
}

export const ScrollContext = React.createContext<ScrollContextType>({
  isScrolling: false,
  setScrollVelocity: () => {},
});

export function ScrollProvider({ children }: { children: React.ReactNode }) {
  const [isScrolling, setIsScrolling] = React.useState(false);
  const scrollTimeoutRef = React.useRef<any>(null);
  const velocityThreshold = 0.5; // Adjust this to control sensitivity

  const handleSetVelocity = React.useCallback((velocity: number) => {
    const speed = Math.abs(velocity);
    
    // Show boxes if scrolling fast enough
    if (speed > velocityThreshold) {
      setIsScrolling(true);
      
      // Clear any existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      // Hide boxes after scrolling stops
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 300);
    }
  }, []);

  React.useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <ScrollContext.Provider value={{ isScrolling, setScrollVelocity: handleSetVelocity }}>
      {children}
    </ScrollContext.Provider>
  );
}

export function useScrollContext() {
  return React.useContext(ScrollContext);
}
