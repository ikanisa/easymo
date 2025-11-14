declare module "@easymo/ui" {
  export * from "../../packages/ui/src/index.ts";
}

declare module "@easymo/ui/components/Button" {
  export type ButtonProps = import("../../packages/ui/src/components/Button").ButtonProps;
  export const Button: typeof import("../../packages/ui/src/components/Button").Button;
  export { buttonVariants } from "../../packages/ui/src/components/Button";
}

declare module "@easymo/ui/widgets/SessionTimelineWidget" {
  export type SessionTimelineEvent = import("../../packages/ui/src/widgets/SessionTimelineWidget").SessionTimelineEvent;
  export const SessionTimelineWidget: typeof import("../../packages/ui/src/widgets/SessionTimelineWidget").SessionTimelineWidget;
}

declare module "@easymo/ui/widgets/KpiWidget" {
  export type KpiWidgetProps = import("../../packages/ui/src/widgets/KpiWidget").KpiWidgetProps;
  export const KpiWidget: typeof import("../../packages/ui/src/widgets/KpiWidget").KpiWidget;
}

declare module "@easymo/ui/widgets/PaymentStatusWidget" {
  export type PaymentStatusWidgetProps = import("../../packages/ui/src/widgets/PaymentStatusWidget").PaymentStatusWidgetProps;
  export const PaymentStatusWidget: typeof import("../../packages/ui/src/widgets/PaymentStatusWidget").PaymentStatusWidget;
}

declare module "@easymo/ui/widgets/GeoHeatmapWidget" {
  export type GeoHeatmapWidgetProps = import("../../packages/ui/src/widgets/GeoHeatmapWidget").GeoHeatmapWidgetProps;
  export const GeoHeatmapWidget: typeof import("../../packages/ui/src/widgets/GeoHeatmapWidget").GeoHeatmapWidget;
}

declare module "@easymo/ui/widgets/PlaceWidget" {
  export type PlaceWidgetProps = import("../../packages/ui/src/widgets/PlaceWidget").PlaceWidgetProps;
  export const PlaceWidget: typeof import("../../packages/ui/src/widgets/PlaceWidget").PlaceWidget;
}

declare module "@easymo/ui/table/Table" {
  export * from "../../packages/ui/src/table/Table";
}

declare module "@easymo/ui/charts/TrendAreaChart" {
  export type TrendAreaChartProps = import("../../packages/ui/src/charts/TrendAreaChart").TrendAreaChartProps;
  export const TrendAreaChart: typeof import("../../packages/ui/src/charts/TrendAreaChart").TrendAreaChart;
}
