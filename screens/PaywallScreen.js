// screens/PaywallScreen.js
import React, { useRef, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from 'expo-haptics';
import { useAppContext } from "../context/AppContext";
import { usePremiumFeatures } from "../hooks/usePremiumFeatures";
import PremiumPaywall from "../components/PremiumPaywall";
import { GRADIENTS, TYPOGRAPHY, SPACING, BORDER_RADIUS, COLORS } from "../utils/theme";

const { width } = Dimensions.get('window');

export default function PaywallScreen({ navigation, route }) {
  const { actions } = useAppContext();
  const { handleSubscribe, hidePaywall } = usePremiumFeatures();
  const { feature } = route?.params || {};
  
  // Animation values
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnimation, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleClose = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      hidePaywall();
    }
  };

  const handleSubscribeComplete = async (tier) => {
    await actions.refreshPremiumStatus();
    handleClose();
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[COLORS.obsidian, COLORS.warmCharcoal, COLORS.charcoal]}
        style={StyleSheet.absoluteFill}
      />
      
      <Animated.View 
        style={[
          styles.content,
          {
            opacity: fadeAnimation,
            transform: [{ translateY: slideAnimation }],
          },
        ]}
      >
        <PremiumPaywall
          feature={feature}
          onSubscribe={handleSubscribeComplete}
          onClose={handleClose}
          showCloseButton={true}
        />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  content: {
    flex: 1,
  },
});
