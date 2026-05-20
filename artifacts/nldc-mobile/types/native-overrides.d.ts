declare module "react-native-svg" {
  import type { ComponentType } from "react";
  type SVGProps = Record<string, unknown>;
  const Svg: ComponentType<SVGProps>;
  export default Svg;
  export const Circle: ComponentType<SVGProps>;
  export const Ellipse: ComponentType<SVGProps>;
  export const G: ComponentType<SVGProps>;
  export const Text: ComponentType<SVGProps>;
  export const TSpan: ComponentType<SVGProps>;
  export const TextPath: ComponentType<SVGProps>;
  export const Path: ComponentType<SVGProps>;
  export const Polygon: ComponentType<SVGProps>;
  export const Polyline: ComponentType<SVGProps>;
  export const Line: ComponentType<SVGProps>;
  export const Rect: ComponentType<SVGProps>;
  export const Use: ComponentType<SVGProps>;
  export const Image: ComponentType<SVGProps>;
  export const Symbol: ComponentType<SVGProps>;
  export const Defs: ComponentType<SVGProps>;
  export const Stop: ComponentType<SVGProps>;
  export const LinearGradient: ComponentType<SVGProps>;
  export const RadialGradient: ComponentType<SVGProps>;
  export const Pattern: ComponentType<SVGProps>;
  export const Mask: ComponentType<SVGProps>;
  export const ClipPath: ComponentType<SVGProps>;
  export const Filter: ComponentType<SVGProps>;
  export const ForeignObject: ComponentType<SVGProps>;
  export const Marker: ComponentType<SVGProps>;
}

declare module "react-native-gesture-handler" {
  import type { ComponentType, ReactNode } from "react";
  import { Component } from "react";
  type GHProps = Record<string, unknown>;

  class Swipeable extends Component<GHProps> {
    close(): void;
    openLeft(): void;
    openRight(): void;
    reset(): void;
  }

  const RectButton: ComponentType<GHProps>;
  const BorderlessButton: ComponentType<GHProps>;
  const TouchableOpacity: ComponentType<GHProps>;
  const TouchableHighlight: ComponentType<GHProps>;
  const TouchableNativeFeedback: ComponentType<GHProps>;
  const TouchableWithoutFeedback: ComponentType<GHProps>;
  const DrawerLayout: ComponentType<GHProps>;
  const FlatList: ComponentType<GHProps>;
  const ScrollView: ComponentType<GHProps>;
  const GestureHandlerRootView: ComponentType<{
    style?: object;
    children?: ReactNode;
    [key: string]: unknown;
  }>;
  const Gesture: Record<string, unknown>;
  const GestureDetector: ComponentType<GHProps>;
  const PanGestureHandler: ComponentType<GHProps>;
  const TapGestureHandler: ComponentType<GHProps>;
  const LongPressGestureHandler: ComponentType<GHProps>;
  const PinchGestureHandler: ComponentType<GHProps>;
  const RotationGestureHandler: ComponentType<GHProps>;
  const FlingGestureHandler: ComponentType<GHProps>;
  const NativeViewGestureHandler: ComponentType<GHProps>;
  const BaseButton: ComponentType<GHProps>;

  export {
    Swipeable,
    RectButton,
    BorderlessButton,
    TouchableOpacity,
    TouchableHighlight,
    TouchableNativeFeedback,
    TouchableWithoutFeedback,
    DrawerLayout,
    FlatList,
    ScrollView,
    GestureHandlerRootView,
    Gesture,
    GestureDetector,
    PanGestureHandler,
    TapGestureHandler,
    LongPressGestureHandler,
    PinchGestureHandler,
    RotationGestureHandler,
    FlingGestureHandler,
    NativeViewGestureHandler,
    BaseButton,
  };
}

declare module "react-native-qrcode-svg" {
  import type { ComponentType } from "react";
  type QRCodeProps = Record<string, unknown>;
  const QRCode: ComponentType<QRCodeProps>;
  export default QRCode;
}
