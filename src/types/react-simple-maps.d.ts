declare module "react-simple-maps" {
  import type { ComponentType } from "react";

  type LooseProps = Record<string, unknown>;

  export const ComposableMap: ComponentType<LooseProps>;
  export const Geographies: ComponentType<LooseProps>;
  export const Geography: ComponentType<LooseProps>;
  export const Sphere: ComponentType<LooseProps>;
}
