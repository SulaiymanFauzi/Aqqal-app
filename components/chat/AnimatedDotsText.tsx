import React from 'react';
import { Text as RNText } from 'react-native';
import type { TextStyle } from 'react-native';

interface AnimatedDotsTextProps {
  text: string;
  color?: string;
  isActive?: boolean;
  style?: TextStyle | TextStyle[];
}

export const AnimatedDotsText = React.memo(function AnimatedDotsText({
  text,
  color,
  isActive,
  style,
}: AnimatedDotsTextProps) {
  const [dotCount, setDotCount] = React.useState(0);

  React.useEffect(() => {
    if (!isActive) {
      setDotCount(0);
      return;
    }
    setDotCount(1);
    const interval = setInterval(() => {
      setDotCount((prev) => (prev % 3) + 1);
    }, 420);
    return () => clearInterval(interval);
  }, [isActive]);

  const suffix = isActive && dotCount > 0 ? '.'.repeat(dotCount) : '';

  return (
    <RNText
      numberOfLines={1}
      ellipsizeMode="tail"
      style={[style, color ? { color } : null]}
    >
      {text}
      {suffix}
    </RNText>
  );
});
