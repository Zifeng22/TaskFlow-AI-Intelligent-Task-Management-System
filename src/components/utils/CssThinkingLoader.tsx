import React, { useEffect, useRef } from "react";
import { View, Animated } from "react-native";

interface CssThinkingLoaderProps {
  isDarkmode?: boolean;
  speed?: number;
  size?: number;
}

export default function CssThinkingLoader({
  isDarkmode = false,
  speed = 1,
  size = 24,
}: CssThinkingLoaderProps) {
  const stageAnim = useRef(new Animated.Value(0)).current;
  const dotColor = isDarkmode ? "#FFFFFF" : "#000000";

  useEffect(() => {
    const duration = 4000 / Math.max(speed, 0.1);
    const stageLoop = Animated.loop(
      Animated.timing(stageAnim, {
        toValue: 1,
        duration: duration,
        useNativeDriver: true,
      }),
    );

    stageLoop.start();
    return () => stageLoop.stop();
  }, [speed, stageAnim]);

  const stageRotate = stageAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const dotRotate = stageAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const s = size / 133.33; // Scales proportional to default 24px/40px sizes

  const dot1X = stageAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, 0, -40 * s, -40 * s, 0],
  });
  const dot1Y = stageAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [-35 * s, -35 * s, 0, 0, -35 * s],
  });

  const dot2X = stageAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [-30 * s, -30 * s, 0, 0, -30 * s],
  });
  const dot2Y = stageAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [20 * s, 20 * s, 0, 0, 20 * s],
  });

  const dot3X = stageAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [30 * s, 30 * s, 40 * s, 40 * s, 30 * s],
  });
  const dot3Y = stageAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [20 * s, 20 * s, 0, 0, 20 * s],
  });

  const dotSize = Math.max(3, 10 * s);

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        alignSelf: "center",
      }}
    >
      <Animated.View
        style={{
          width: size,
          height: size,
          position: "relative",
          transform: [{ rotate: stageRotate }],
        }}
      >
        <Animated.View
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: dotSize,
            height: dotSize,
            marginLeft: -dotSize / 2,
            marginTop: -dotSize / 2,
            transform: [{ translateX: dot1X }, { translateY: dot1Y }],
          }}
        >
          <Animated.View
            style={{
              width: "100%",
              height: "100%",
              borderRadius: dotSize / 2,
              backgroundColor: dotColor,
              transform: [{ rotate: dotRotate }],
            }}
          />
        </Animated.View>

        <Animated.View
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: dotSize,
            height: dotSize,
            marginLeft: -dotSize / 2,
            marginTop: -dotSize / 2,
            transform: [{ translateX: dot2X }, { translateY: dot2Y }],
          }}
        >
          <Animated.View
            style={{
              width: "100%",
              height: "100%",
              borderRadius: dotSize / 2,
              backgroundColor: dotColor,
              transform: [{ rotate: dotRotate }],
            }}
          />
        </Animated.View>

        <Animated.View
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: dotSize,
            height: dotSize,
            marginLeft: -dotSize / 2,
            marginTop: -dotSize / 2,
            transform: [{ translateX: dot3X }, { translateY: dot3Y }],
          }}
        >
          <Animated.View
            style={{
              width: "100%",
              height: "100%",
              borderRadius: dotSize / 2,
              backgroundColor: dotColor,
              transform: [{ rotate: dotRotate }],
            }}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}
