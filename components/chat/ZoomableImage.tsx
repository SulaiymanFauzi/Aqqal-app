import React from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import ReanimatedAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ZoomableImageProps {
  uri: string;
  onClose: () => void;
  initialLayout: { x: number; y: number; width: number; height: number } | null;
}

export function ZoomableImage({ uri, onClose, initialLayout }: ZoomableImageProps) {
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Calculate initial position and scale
  const initialScale = initialLayout ? initialLayout.width / SCREEN_WIDTH : 0.3;
  const initialX = initialLayout ? initialLayout.x - (SCREEN_WIDTH - initialLayout.width) / 2 : 0;
  const initialY = initialLayout ? initialLayout.y - (SCREEN_HEIGHT - initialLayout.height) / 2 : 0;

  const scale = useSharedValue(initialScale);
  const translateX = useSharedValue(initialX);
  const translateY = useSharedValue(initialY);
  const opacity = useSharedValue(0);
  const backgroundOpacity = useSharedValue(0);

  // Animate in on mount
  React.useEffect(() => {
    const config = {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    };
    scale.value = withTiming(1, config);
    translateX.value = withTiming(0, config);
    translateY.value = withTiming(0, config);
    opacity.value = withTiming(1, config);
    backgroundOpacity.value = withTiming(0.95, config);
  }, []);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const newScale = savedScale.value * e.scale;
      scale.value = Math.max(1, Math.min(4, newScale));
    })
    .onEnd(() => {
      if (scale.value < 1.1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        savedScale.value = scale.value;

        const maxTranslateX = (SCREEN_WIDTH * (scale.value - 1)) / 2;
        const maxTranslateY = (SCREEN_HEIGHT * (scale.value - 1)) / 2;

        if (Math.abs(translateX.value) > maxTranslateX) {
          translateX.value = withSpring(
            translateX.value > 0 ? maxTranslateX : -maxTranslateX
          );
          savedTranslateX.value = translateX.value;
        }
        if (Math.abs(translateY.value) > maxTranslateY) {
          translateY.value = withSpring(
            translateY.value > 0 ? maxTranslateY : -maxTranslateY
          );
          savedTranslateY.value = translateY.value;
        }
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (savedScale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      } else {
        translateY.value = e.translationY;
        const progress = Math.min(Math.abs(e.translationY) / 200, 1);
        opacity.value = 1 - progress * 0.5;
        scale.value = 1 - progress * 0.2;
        backgroundOpacity.value = 0.95 * (1 - progress);
      }
    })
    .onEnd((e) => {
      if (savedScale.value > 1) {
        const maxTranslateX = (SCREEN_WIDTH * (savedScale.value - 1)) / 2;
        const maxTranslateY = (SCREEN_HEIGHT * (savedScale.value - 1)) / 2;

        if (Math.abs(translateX.value) > maxTranslateX) {
          translateX.value = withSpring(
            translateX.value > 0 ? maxTranslateX : -maxTranslateX
          );
        }
        if (Math.abs(translateY.value) > maxTranslateY) {
          translateY.value = withSpring(
            translateY.value > 0 ? maxTranslateY : -maxTranslateY
          );
        }

        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      } else {
        if (Math.abs(e.translationY) > 100 || Math.abs(e.velocityY) > 500) {
          const config = {
            duration: 250,
            easing: Easing.in(Easing.cubic),
          };
          scale.value = withTiming(initialScale, config);
          translateX.value = withTiming(initialX, config);
          translateY.value = withTiming(initialY, config);
          opacity.value = withTiming(0, config);
          backgroundOpacity.value = withTiming(0, config, (finished) => {
            if (finished) {
              runOnJS(onClose)();
            }
          });
        } else {
          translateY.value = withSpring(0);
          opacity.value = withSpring(1);
          scale.value = withSpring(1);
          backgroundOpacity.value = withSpring(0.95);
        }
      }
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withSpring(2);
        savedScale.value = 2;
      }
    });

  const composed = Gesture.Simultaneous(
    doubleTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture)
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const animatedBackgroundStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(0, 0, 0, ${backgroundOpacity.value})`,
  }));

  return (
    <>
      <ReanimatedAnimated.View style={[StyleSheet.absoluteFill, animatedBackgroundStyle]} />
      <GestureDetector gesture={composed}>
        <ReanimatedAnimated.Image
          source={{ uri }}
          style={[styles.imageViewerImage, animatedStyle]}
          resizeMode="contain"
        />
      </GestureDetector>
    </>
  );
}

const styles = StyleSheet.create({
  imageViewerImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
});
