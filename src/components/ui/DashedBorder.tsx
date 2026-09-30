/**
 * A dashed outline with rounded corners.
 *
 * React Native's `borderStyle: 'dashed'` cannot be trusted here: combined with a
 * border radius it renders inconsistently across platforms — on Android it often
 * comes out solid or square. Drawing the ring as an SVG rounded rect gives the
 * same dashes everywhere, which matters because the Connect field is the one
 * place the spec asks for a dashed edge.
 *
 * The container is measured first so the dash pattern is not stretched; a
 * `preserveAspectRatio="none"` SVG would distort the stroke width.
 */
import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

export interface DashedBorderProps {
  radius: number;
  color: string;
  strokeWidth?: number;
  dashLength?: number;
  dashGap?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function DashedBorder({
  radius,
  color,
  strokeWidth = 1.5,
  dashLength = 6,
  dashGap = 4,
  style,
  children,
}: DashedBorderProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) =>
      current.width === width && current.height === height ? current : { width, height }
    );
  };

  return (
    <View onLayout={onLayout} style={style}>
      {children}
      {size.width > 0 && size.height > 0 ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width={size.width} height={size.height}>
            <Rect
              x={strokeWidth / 2}
              y={strokeWidth / 2}
              width={Math.max(0, size.width - strokeWidth)}
              height={Math.max(0, size.height - strokeWidth)}
              rx={Math.max(0, radius - strokeWidth / 2)}
              ry={Math.max(0, radius - strokeWidth / 2)}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashLength} ${dashGap}`}
              fill="none"
            />
          </Svg>
        </View>
      ) : null}
    </View>
  );
}
