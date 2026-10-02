import { memo, useCallback, useEffect, useRef } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ListRenderItem,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { AVATARS, AVATAR_KEYS, isAvatarKey, type AvatarKey } from '@/constants/avatars';
import { useTheme } from '@/hooks/useTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { AnimatedPressable, usePressable } from '@/hooks/usePressable';
import { initialsOf } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';

export interface AvatarGridProps {
  value: string | null;
  onChange: (key: AvatarKey | null) => void;
  name: string;
  hint?: string;
  allowInitials?: boolean;
}

const REEL_CELL_SIZE = 108;
const REEL_IMAGE_SIZE = 100;

export function AvatarGrid({ value, onChange, name, hint, allowInitials = false }: AvatarGridProps) {
  const { colors, typography, spacing, screenPadding } = useTheme();
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const listRef = useRef<FlatList<AvatarKey>>(null);
  const hasInteracted = useRef(false);

  const selectedIndex = isAvatarKey(value) ? AVATAR_KEYS.indexOf(value) : -1;
  const sidePadding = Math.max(0, (width - screenPadding * 2 - REEL_CELL_SIZE) / 2);
  const scrollX = useSharedValue(Math.max(selectedIndex, 0) * REEL_CELL_SIZE);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollX.set(event.contentOffset.x);
  });

  useEffect(() => {
    if (selectedIndex < 0 || hasInteracted.current) return;

    const selectedOffset = selectedIndex * REEL_CELL_SIZE;
    listRef.current?.scrollToOffset({ offset: selectedOffset, animated: true });
  }, [selectedIndex]);

  const selectAvatar = useCallback((key: AvatarKey) => {
    hasInteracted.current = true;
    const index = AVATAR_KEYS.indexOf(key);
    listRef.current?.scrollToOffset({
      offset: index * REEL_CELL_SIZE,
      animated: true,
    });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(key);
  }, [onChange]);

  const selectFromOffset = useCallback((offset: number) => {
    const index = Math.max(0, Math.min(AVATAR_KEYS.length - 1, Math.round(offset / REEL_CELL_SIZE)));
    const key = AVATAR_KEYS[index];
    if (key) onChange(key);
  }, [onChange]);

  const renderItem = useCallback<ListRenderItem<AvatarKey>>(
    ({ item, index }) => (
      <AvatarReelCell
        avatarKey={item}
        index={index}
        selected={value === item}
        reducedMotion={reducedMotion}
        scrollX={scrollX}
        onSelect={selectAvatar}
      />
    ),
    [reducedMotion, scrollX, selectAvatar, value],
  );

  const keyExtractor = useCallback((item: AvatarKey) => item, []);

  return (
    <View style={[styles.container, { paddingTop: spacing.xxxl }]}>
      {value === null ? (
        <View
          accessible
          accessibilityLabel={`Using initials for ${name}`}
          style={[
            styles.initialsPreview,
            { backgroundColor: colors.accentTint, borderColor: colors.accent },
          ]}
        >
          <View
            accessible={false}
            style={styles.initialsPlaceholder}
          >
            <Text style={[typography.hero, { color: colors.accent }]}>
              {initialsOf(name)}
            </Text>
          </View>
        </View>
      ) : null}

      {value === null ? (
        <AvatarCaption name={name} colors={colors} typography={typography} spacing={spacing} initials />
      ) : null}

      <Animated.FlatList<AvatarKey>
        ref={listRef}
        data={AVATAR_KEYS}
        horizontal
        snapToInterval={REEL_CELL_SIZE}
        snapToAlignment="start"
        decelerationRate="fast"
        style={styles.reelList}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.reel,
          {
            paddingHorizontal: sidePadding,
          },
        ]}
        initialScrollIndex={selectedIndex < 0 ? 0 : selectedIndex}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={5}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({
          length: REEL_CELL_SIZE,
          offset: REEL_CELL_SIZE * index,
          index,
        })}
        onScrollBeginDrag={() => {
          hasInteracted.current = true;
        }}
        onScrollEndDrag={(event) => {
          const offset = event.nativeEvent.contentOffset.x;
          selectFromOffset(offset);
        }}
        onMomentumScrollEnd={(event) => {
          const offset = event.nativeEvent.contentOffset.x;
          selectFromOffset(offset);
        }}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        accessibilityLabel="Choose an avatar"
        extraData={selectedIndex}
      />

      {value !== null ? (
        <AvatarCaption name={name} colors={colors} typography={typography} spacing={spacing} />
      ) : null}

      {allowInitials ? (
        <Button
          label={value === null ? 'Using initials' : 'Use initials instead'}
          variant="ghost"
          size="compact"
          onPress={() => onChange(null)}
          disabled={value === null}
          haptic={false}
          style={{ marginTop: spacing.sm }}
        />
      ) : null}

      {hint ? (
        <Text
          style={[
            typography.caption,
            styles.hint,
            { color: colors.textMuted, marginTop: spacing.md },
          ]}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function AvatarCaption({
  name,
  colors,
  typography,
  spacing,
  initials = false,
}: {
  name: string;
  colors: ReturnType<typeof useTheme>['colors'];
  typography: ReturnType<typeof useTheme>['typography'];
  spacing: ReturnType<typeof useTheme>['spacing'];
  initials?: boolean;
}) {
  return (
    <View style={styles.caption}>
      <Text
        style={[
          typography.section,
          styles.selectedName,
          { color: colors.textPrimary, marginTop: spacing.md },
        ]}
        numberOfLines={1}
      >
        {name.trim() || 'Your avatar'}
      </Text>
      <Text
        style={[
          typography.caption,
          styles.selectedLabel,
          { color: colors.textMuted, marginTop: spacing.xxs, marginBottom: spacing.xl },
        ]}
      >
        {initials ? 'Using your initials' : 'Selected avatar'}
      </Text>
    </View>
  );
}

const AvatarReelCell = memo(function AvatarReelCell({
  avatarKey,
  index,
  selected,
  reducedMotion,
  scrollX,
  onSelect,
}: {
  avatarKey: AvatarKey;
  index: number;
  selected: boolean;
  reducedMotion: boolean;
  scrollX: SharedValue<number>;
  onSelect: (key: AvatarKey) => void;
}) {
  const { colors } = useTheme();
  const { onPressIn, onPressOut, style: pressStyle } = usePressable({
    scale: 0.98,
  });
  const onPress = useCallback(() => onSelect(avatarKey), [avatarKey, onSelect]);
  const focusStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + Math.max(0, 1 - Math.abs(scrollX.get() / REEL_CELL_SIZE - index)) * 0.6,
    transform: reducedMotion
      ? []
      : [{
          scale: 0.76 + Math.max(0, 1 - Math.abs(scrollX.get() / REEL_CELL_SIZE - index)) * 0.24,
        }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="radio"
      accessibilityLabel={`Avatar ${AVATAR_KEYS.indexOf(avatarKey) + 1}`}
      accessibilityState={{ selected }}
      testID={`avatar-tile-${avatarKey}`}
      style={[styles.reelCell, pressStyle]}
    >
      <Animated.View
        style={[
          styles.reelAvatarFrame,
          focusStyle,
          { borderColor: selected ? colors.accent : 'transparent' },
        ]}
      >
        <Image
          source={AVATARS[avatarKey]}
          style={[styles.reelAvatar, { backgroundColor: colors.surface }]}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      </Animated.View>
    </AnimatedPressable>
  );
});

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  caption: { alignItems: 'center' },
  reelList: { width: '100%', flexGrow: 0 },
  selectedName: { maxWidth: '90%', textAlign: 'center' },
  selectedLabel: { textAlign: 'center' },
  initialsPreview: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initialsPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  reel: { alignItems: 'center' },
  reelCell: {
    width: REEL_CELL_SIZE,
    height: 116,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reelAvatarFrame: {
    width: REEL_IMAGE_SIZE + 6,
    height: REEL_IMAGE_SIZE + 6,
    borderRadius: (REEL_IMAGE_SIZE + 6) / 2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  reelAvatar: {
    width: REEL_IMAGE_SIZE,
    height: REEL_IMAGE_SIZE,
    borderRadius: REEL_IMAGE_SIZE / 2,
    opacity: 1,
  },
  hint: { textAlign: 'center', paddingHorizontal: 20 },
});
