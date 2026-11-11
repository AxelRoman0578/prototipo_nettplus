import { useEffect, useRef } from "react";
import { init, use, type EChartsCoreOption } from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  AriaComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  AriaComponent,
  CanvasRenderer,
]);

export function Chart({
  option,
  label,
  onSelect,
  height = 260,
}: {
  option: EChartsCoreOption;
  label: string;
  onSelect?: (name: string) => void;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<ReturnType<typeof init> | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  useEffect(() => {
    const instance = init(ref.current!);
    chart.current = instance;
    instance.on("click", (params) => {
      if (params.name) select.current?.(params.name);
    });
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(ref.current!);
    return () => {
      observer.disconnect();
      instance.dispose();
      chart.current = null;
    };
  }, []);
  useEffect(() => {
    chart.current?.setOption(
      {
        animationDuration: 350,
        textStyle: {
          fontFamily: "Inter, sans-serif",
          color: "#70809b",
          fontSize: 11,
        },
        tooltip: {
          trigger: "axis",
          renderMode: "richText",
          backgroundColor: "#fff",
          borderColor: "#dfe6f0",
        },
        ...option,
        aria: { enabled: true, description: label },
      },
      true,
    );
  }, [option, label]);
  return (
    <div
      ref={ref}
      style={{ height, width: "100%" }}
      role="img"
      aria-label={label}
    />
  );
}
