/**
 * AmbientGlow provides the vibrant, premium background glow effects seen in modern designs.
 * 
 * - Dark mode: Soft cyan/blue gradient orb on upper-left, warm ember/coral glow orb on bottom-right,
 *   plus subtle radial wave lines.
 * - Light mode: Soft warm ambient gradients with ultra-clean cream warmth.
 */
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect, Path } from 'react-native-svg';
import { useTheme } from '@/hooks/useTheme';

export function AmbientGlow() {
  const { isDark } = useTheme();

  if (isDark) {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            {/* Top-Left Cyan Glow */}
            <RadialGradient
              id="topCyanGlow"
              cx="10%"
              cy="20%"
              rx="60%"
              ry="45%"
              fx="10%"
              fy="20%"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0%" stopColor="#00A3FF" stopOpacity="0.3" />
              <Stop offset="50%" stopColor="#0055FF" stopOpacity="0.12" />
              <Stop offset="100%" stopColor="#0B0D12" stopOpacity="0" />
            </RadialGradient>

            {/* Bottom-Right Coral/Red Glow */}
            <RadialGradient
              id="bottomCoralGlow"
              cx="85%"
              cy="80%"
              rx="65%"
              ry="50%"
              fx="85%"
              fy="80%"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0%" stopColor="#FF4D4D" stopOpacity="0.35" />
              <Stop offset="45%" stopColor="#FF7A00" stopOpacity="0.15" />
              <Stop offset="100%" stopColor="#0B0D12" stopOpacity="0" />
            </RadialGradient>
          </Defs>

          {/* Background fill */}
          <Rect width="100%" height="100%" fill="#090B0E" />

          {/* Top Cyan Glow Overlay */}
          <Rect width="100%" height="100%" fill="url(#topCyanGlow)" />

          {/* Bottom Coral Glow Overlay */}
          <Rect width="100%" height="100%" fill="url(#bottomCoralGlow)" />

          {/* Ambient wave contour lines for extra depth (matching image 1) */}
          <Path
            d="M -100 200 C 100 300, 300 150, 500 280 C 700 400, 600 600, 800 700"
            stroke="#00A3FF"
            strokeWidth="1"
            strokeOpacity="0.08"
            fill="none"
          />
          <Path
            d="M -100 280 C 120 380, 320 220, 520 360 C 720 500, 620 700, 820 800"
            stroke="#00A3FF"
            strokeWidth="1"
            strokeOpacity="0.05"
            fill="none"
          />
          <Path
            d="M -100 360 C 140 460, 340 290, 540 440 C 740 600, 640 800, 840 900"
            stroke="#FF4D4D"
            strokeWidth="1"
            strokeOpacity="0.06"
            fill="none"
          />
        </Svg>
      </View>
    );
  }

  // Light Mode ambient warmth matching Image 2
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient
            id="lightWarmth"
            cx="50%"
            cy="15%"
            rx="80%"
            ry="60%"
            fx="50%"
            fy="15%"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor="#FFFBF7" stopOpacity="1" />
            <Stop offset="60%" stopColor="#F5EFF6" stopOpacity="0.6" />
            <Stop offset="100%" stopColor="#F6F2EC" stopOpacity="1" />
          </RadialGradient>
          <RadialGradient
            id="lightAccentSoft"
            cx="80%"
            cy="70%"
            rx="50%"
            ry="40%"
            fx="80%"
            fy="70%"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor="#EADCF8" stopOpacity="0.4" />
            <Stop offset="100%" stopColor="#F6F2EC" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="#F6F2EC" />
        <Rect width="100%" height="100%" fill="url(#lightWarmth)" />
        <Rect width="100%" height="100%" fill="url(#lightAccentSoft)" />
      </Svg>
    </View>
  );
}
