/**
 * A tiny, deliberate icon set drawn with react-native-svg. Keeping our own
 * strokes — rather than pulling in an icon font — means every glyph shares the
 * same weight and rounded caps as the Melo mark.
 */
import { memo } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export type IconName =
  | 'check'
  | 'checkDouble'
  | 'clock'
  | 'plus'
  | 'chevronLeft'
  | 'chevronDown'
  | 'chevronRight'
  | 'arrowUp'
  | 'arrowRight'
  | 'copy'
  | 'share'
  | 'close'
  | 'globe'
  | 'person'
  | 'alert'
  | 'trash'
  | 'retry';

export interface IconProps {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}

function IconComponent({ name, size = 24, color, strokeWidth = 2 }: IconProps) {
  const stroke = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityRole="image">
      {name === 'check' && <Path d="M4 12.5 9.5 18 20 6.5" {...stroke} />}
      {name === 'checkDouble' && (
        <>
          <Path d="M2 12.5 6.5 17 15 6.5" {...stroke} />
          <Path d="M10.5 15.5 11.5 17 21 6.5" {...stroke} />
        </>
      )}
      {name === 'clock' && (
        <>
          <Circle cx={12} cy={12} r={8.5} {...stroke} />
          <Path d="M12 7.5V12l3 2" {...stroke} />
        </>
      )}
      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...stroke} />}
      {name === 'chevronLeft' && <Path d="M15 5 8 12l7 7" {...stroke} />}
      {name === 'chevronDown' && <Path d="M5 9l7 7 7-7" {...stroke} />}
      {name === 'chevronRight' && <Path d="M9 5l7 7-7 7" {...stroke} />}
      {name === 'arrowUp' && (
        <>
          <Path d="M12 19V6" {...stroke} />
          <Path d="M5.5 12.5 12 6l6.5 6.5" {...stroke} />
        </>
      )}
      {name === 'arrowRight' && (
        <>
          <Path d="M5 12h14" {...stroke} />
          <Path d="M12.5 5.5 19 12l-6.5 6.5" {...stroke} />
        </>
      )}
      {name === 'copy' && (
        <>
          <Path d="M9 9V6.5A1.5 1.5 0 0 1 10.5 5h7A1.5 1.5 0 0 1 19 6.5v7a1.5 1.5 0 0 1-1.5 1.5H15" {...stroke} />
          <Path
            d="M6.5 9h7A1.5 1.5 0 0 1 15 10.5v7A1.5 1.5 0 0 1 13.5 19h-7A1.5 1.5 0 0 1 5 17.5v-7A1.5 1.5 0 0 1 6.5 9Z"
            {...stroke}
          />
        </>
      )}
      {name === 'share' && (
        <>
          <Path d="M12 15V4" {...stroke} />
          <Path d="M8.5 7.5 12 4l3.5 3.5" {...stroke} />
          <Path d="M6 12H5.5A1.5 1.5 0 0 0 4 13.5v5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 18.5 12H18" {...stroke} />
        </>
      )}
      {name === 'close' && <Path d="M6 6l12 12M18 6 6 18" {...stroke} />}
      {name === 'globe' && (
        <>
          <Circle cx={12} cy={12} r={8.5} {...stroke} />
          <Path d="M3.5 12h17" {...stroke} />
          <Path d="M12 3.5c2.2 2.4 3.4 5.4 3.4 8.5S14.2 18.1 12 20.5c-2.2-2.4-3.4-5.4-3.4-8.5S9.8 5.9 12 3.5Z" {...stroke} />
        </>
      )}
      {name === 'person' && (
        <>
          <Circle cx={12} cy={8.5} r={3.75} {...stroke} />
          <Path d="M5 19.5c1.2-3.4 3.8-5 7-5s5.8 1.6 7 5" {...stroke} />
        </>
      )}
      {name === 'alert' && (
        <>
          <Circle cx={12} cy={12} r={8.5} {...stroke} />
          <Path d="M12 7.5v5" {...stroke} />
          <Circle cx={12} cy={16.2} r={0.9} fill={color} />
        </>
      )}
      {name === 'trash' && (
        <>
          <Path d="M4.5 7h15" {...stroke} />
          <Path d="M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7" {...stroke} />
          <Path d="M6.5 7l1 11.5A2 2 0 0 0 9.5 20.5h5a2 2 0 0 0 2-2L17.5 7" {...stroke} />
        </>
      )}
      {name === 'retry' && (
        <>
          <Path d="M20 12a8 8 0 1 1-2.6-5.9" {...stroke} />
          <Path d="M20 4v4.5h-4.5" {...stroke} />
        </>
      )}
    </Svg>
  );
}

export const Icon = memo(IconComponent);
