import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Animated,
  Platform,
  Image,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { ARABIC_FONT_FAMILY } from '../chat/constants';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type Scholar = {
  name: string;
  title: string;
  credentials: string;
  image: any;
};

type OnboardingStep = {
  id: number;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap | keyof typeof Ionicons.glyphMap;
  iconSet?: 'material' | 'ionicons';
  image?: any;
  scholars?: Scholar[];
  title: string;
  arabicTitle?: string;
  description: string;
  quote?: string;
  quoteAuthor?: string;
};

const onboardingSteps: OnboardingStep[] = [
  {
    id: 1,
    image: require('../../assets/images/onboarding-illustration-1.png'),
    arabicTitle: 'بِسْمِ ٱللهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
    title: 'Welcome to Aqqal.',
    description: 'The AI for rediscovering knowledge through Islamic thought.',
    quote: '',
    quoteAuthor: '',
  },
  {
    id: 2,
    title: 'Learn through the principles of\n Uṣūl al-Dīn.',
    description: 'Co-developed with academics from Al-Azhar and other institutions.',
    scholars: [
      {
        name: 'Datuk Prof. Syed Ali Tawfik Al-Attas',
        title: 'Advisor',
        credentials: 'Former Director-General, Institute of Islamic Understanding Malaysia',
        image: require('../../assets/images/scholars/syed-ali.png'),
      },
      {
        name: 'Dr. Syafiq Borhanuddin',
        title: 'Advisor',
        credentials: 'Fellow, Institute of Islamic Understanding Malaysia',
        image: require('../../assets/images/scholars/dr-syafiq.png'),
      },
      {
        name: 'Dr. Ikhwan Azlan',
        title: 'Advisor',
        credentials: 'Fellow, Raja Zarith Sofiah Centre for Advanced Studies',
        image: require('../../assets/images/scholars/dr-ikhwan.png'),
      },
      {
        name: 'Ustaz Tariq Jaffri Al-Azhari',
        title: 'Academic Head',
        credentials: 'Al-Azhar University (B.A., M.A. Hadith), IIUM Lecturer',
        image: require('../../assets/images/scholars/ustaz-tariq.png'),
      },
      {
        name: 'Ustazah Wasitah',
        title: 'Research Assistant',
        credentials: 'PhD Candidate, University of Malaya (Quran & Hadith)',
        image: require('../../assets/images/scholars/ustazah-wasitah.png'),
      },
    ],
  },
  {
    id: 3,
    image: require('../../assets/images/onboarding-illustration-3.png'),    iconSet: 'material',
    title: 'Explore Islamic Civilization\'s Works',
    description: 'Explore the Qur\'an, Hadith Collections, and centuries of scholarly works.',
  },
  {
    id: 4,
    icon: 'lightbulb-on',
    iconSet: 'material',
    title: 'AI will never\nreplace scholars.',
    description: 'The scholars are the \ninheritors of the Prophets.\n-Sunan Abi Dawud',

    quoteAuthor: 'Hadith',
  },
];

type Props = {
  onComplete: () => void;
};

export default function OnboardingScreen({ onComplete }: Props) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const [currentStep, setCurrentStep] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [displayedArabicTitle, setDisplayedArabicTitle] = useState('');
  const [displayedTitle, setDisplayedTitle] = useState('');
  const [displayedDescription, setDisplayedDescription] = useState('');
  const [showQuote, setShowQuote] = useState(false);
  const [typingSection, setTypingSection] = useState<'arabic' | 'title' | 'description' | 'done'>('arabic');
  const [scholarsLoaded, setScholarsLoaded] = useState(0);
  const caretOpacity = useRef(new Animated.Value(1)).current;
  const scholarsOpacity = useRef(new Animated.Value(0)).current;
  const typedCharCountRef = useRef(0);

  const isLastStep = currentStep === onboardingSteps.length - 1;
  const step = onboardingSteps[currentStep];

  // Blinking caret animation
  React.useEffect(() => {
    const blinkAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(caretOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(caretOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    blinkAnimation.start();
    return () => blinkAnimation.stop();
  }, [caretOpacity]);

  // Typewriter effect
  React.useEffect(() => {
    setDisplayedArabicTitle('');
    setDisplayedTitle('');
    setDisplayedDescription('');
    setShowQuote(false);
    typedCharCountRef.current = 0;

    const arabicText = step.arabicTitle || '';
    const titleText = step.title;
    const descText = step.description;
    let arabicIndex = 0;
    let titleIndex = 0;
    let descIndex = 0;

    // Type Arabic title first (if present)
    if (arabicText) {
      setTypingSection('arabic');
      const arabicInterval = setInterval(() => {
        if (arabicIndex < arabicText.length) {
          setDisplayedArabicTitle(arabicText.slice(0, arabicIndex + 1));
          incrementTypedCountAndHaptic();
          arabicIndex++;
        } else {
          clearInterval(arabicInterval);
          // Start English title after Arabic is done
          setTimeout(() => startTitleTyping(), 100);
        }
      }, 10); // 40ms per character for Arabic
    } else {
      startTitleTyping();
    }

    function startTitleTyping() {
      setTypingSection('title');
      const titleInterval = setInterval(() => {
        if (titleIndex < titleText.length) {
          setDisplayedTitle(titleText.slice(0, titleIndex + 1));
          incrementTypedCountAndHaptic();
          titleIndex++;
        } else {
          clearInterval(titleInterval);
          // Start description after title is done
          setTimeout(() => startDescTyping(), 100);
        }
      }, 10); // 30ms per character for title
    }

    function startDescTyping() {
      setTypingSection('description');
      const descInterval = setInterval(() => {
        if (descIndex < descText.length) {
          setDisplayedDescription(descText.slice(0, descIndex + 1));
          incrementTypedCountAndHaptic();
          descIndex++;
        } else {
          clearInterval(descInterval);
          // Keep caret blinking at description - don't set to 'done'
          // Show quote after description is done
          setTimeout(() => setShowQuote(true), 200);
        }
      }, 14); // 15ms per character for description
    }
  }, [currentStep, step.arabicTitle, step.title, step.description]);

  const incrementTypedCountAndHaptic = () => {
    typedCharCountRef.current += 1;
    if (typedCharCountRef.current % 2 === 0) {
      Haptics.selectionAsync().catch(() => {});
    }
  };

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setCurrentStep(currentStep + 1);
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  // Handle scholar image loading
  React.useEffect(() => {
    if (step.scholars) {
      setScholarsLoaded(0);
      scholarsOpacity.setValue(0);
    }
  }, [currentStep, step.scholars]);

  const handleScholarImageLoad = () => {
    setScholarsLoaded(prev => {
      const newCount = prev + 1;
      // When all 5 images are loaded, fade them in
      if (newCount === 5) {
        Animated.timing(scholarsOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }
      return newCount;
    });
  };

  const renderScholars = () => {
    if (!step.scholars) return null;
    
    return (
      <Animated.View style={[styles.scholarsMainContainer, { opacity: scholarsOpacity }]}>
        {/* Top Row - 3 scholars */}
        <View style={styles.scholarsTopRow}>
          {step.scholars.slice(0, 3).map((scholar, index) => (
            <Image
              key={index}
              source={scholar.image}
              style={styles.scholarPhoto}
              resizeMode="cover"
              onLoad={handleScholarImageLoad}
            />
          ))}
        </View>
        
        {/* Bottom Row - 2 scholars */}
        <View style={styles.scholarsBottomRow}>
          {step.scholars.slice(3, 5).map((scholar, index) => (
            <Image
              key={index}
              source={scholar.image}
              style={styles.scholarPhoto}
              resizeMode="cover"
              onLoad={handleScholarImageLoad}
            />
          ))}
        </View>
      </Animated.View>
    );
  };

  const renderIcon = () => {
    // If step has scholars, render scholars grid
    if (step.scholars) {
      return renderScholars();
    }
    
    // If step has an image, render it
    if (step.image) {
      return (
        <Image
          source={step.image}
          style={styles.illustrationImage}
          resizeMode="contain"
        />
      );
    }

    // Otherwise render icon
    const iconColor = theme.tint;
    const iconSize = 72;

    if (step.iconSet === 'material') {
      return (
        <MaterialCommunityIcons
          name={step.icon as keyof typeof MaterialCommunityIcons.glyphMap}
          size={iconSize}
          color={iconColor}
        />
      );
    }
    return (
      <Ionicons
        name={step.icon as keyof typeof Ionicons.glyphMap}
        size={iconSize}
        color={iconColor}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Skip Button */}
      {!isLastStep && (
        <Pressable
          onPress={handleSkip}
          style={({ pressed }) => [
            styles.skipButton,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Text style={[styles.skipText, { color: theme.muted }]}>Skip</Text>
        </Pressable>
      )}

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Icon - Fixed at top */}
        <View style={styles.iconSection}>
          <View style={[styles.iconContainer, step.scholars ? {} : { backgroundColor: theme.white }]}>
            {renderIcon()}
          </View>
        </View>

        {/* Text Content - Fixed height container */}
        <View style={styles.textContent}>
        {/* Arabic Title (if present) */}
        {step.arabicTitle && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={[styles.arabicTitle, { color: theme.text }]}>
              {displayedArabicTitle}
              {typingSection === 'arabic' && (
                <Animated.Text style={[styles.caret, { color: theme.text, opacity: caretOpacity }]}>
                  |
                </Animated.Text>
              )}
            </Text>
          </View>
        )}

        {/* Title */}
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.title, { color: theme.text }]}>
            {displayedTitle}
            {typingSection === 'title' && (
              <Animated.Text style={[styles.caret, { color: theme.text, opacity: caretOpacity }]}>
                |
              </Animated.Text>
            )}
          </Text>
        </View>

        {/* Description */}
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.description, { color: theme.muted }]}>
            {displayedDescription}
            {typingSection === 'description' && (
              <Animated.Text style={[styles.caretDesc, { color: theme.muted, opacity: caretOpacity }]}>
                |
              </Animated.Text>
            )}
          </Text>
        </View>
        </View>

        {/* Quote (if present) */}
        {step.quote && showQuote && (
          <View style={styles.quoteContainer}>
            <View style={[styles.quoteLine, { backgroundColor: theme.tint }]} />
            <Text style={[styles.quote, { color: theme.muted }]}>
              {step.quote}
            </Text>
            {step.quoteAuthor && (
              <Text style={[styles.quoteAuthor, { color: theme.muted }]}>
                — {step.quoteAuthor}
              </Text>
            )}
          </View>
        )}
      </Animated.View>

      {/* Bottom Section */}
      <View style={styles.bottomSection}>
        {/* Pagination Dots */}
        <View style={styles.pagination}>
          {onboardingSteps.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    index === currentStep
                      ? theme.tint
                      : colorScheme === 'dark'
                      ? 'rgba(255,255,255,0.2)'
                      : 'rgba(0,0,0,0.15)',
                  width: index === currentStep ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Next/Get Started Button */}
        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [
            styles.nextButton,
            {
              backgroundColor: theme.tint,
              opacity: pressed ? 0.8 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          <Text style={styles.nextButtonText}>
            {isLastStep ? 'Begin Journey' : 'Continue'}
          </Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  skipButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingTop: 60,
    paddingBottom: 40,
  },
  iconSection: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 280,
  },
  iconContainer: {
    minWidth: 140,
    minHeight: 140,
    marginTop: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContent: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 200,
    maxHeight: 200,
  },
  illustrationImage: {
    width: 240,
    height: 240,
    marginBottom: 40,
  },
  arabicTitle: {
    fontSize: 20,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: ARABIC_FONT_FAMILY,
    opacity: 0.9,
  },
  caret: {
    fontSize: 32,
    fontWeight: '300',
    marginLeft: 2,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  description: {
    fontSize: 17,
    lineHeight: 26,
    textAlign: 'center',
    maxWidth: 340,
    marginBottom: 32,
  },
  caretDesc: {
    fontSize: 17,
    fontWeight: '300',
    marginLeft: 2,
    lineHeight: 26,
  },
  quoteContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  quoteLine: {
    width: 40,
    height: 3,
    borderRadius: 2,
    marginBottom: 20,
    opacity: 0.4,
  },
  quote: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    fontStyle: 'italic',
    maxWidth: 300,
    marginBottom: 8,
  },
  quoteAuthor: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
  scholarsMainContainer: {
    alignItems: 'center',
    width: '100%',
    gap: 20,
  },
  scholarsTopRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  scholarsBottomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  scholarPhoto: {
    width: 105,
    height: 105,
    borderRadius: 48.5,
    borderWidth: 3,
    borderColor: '#04a495',
  },
  bottomSection: {
    paddingHorizontal: 32,
    paddingBottom: Platform.OS === 'ios' ? 48 : 32,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 32,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
