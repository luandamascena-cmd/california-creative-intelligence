"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, HeatmapChart, LineChart, PieChart } from "echarts/charts";
import {
  CalendarComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
  AriaComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsCoreOption, ECElementEvent } from "echarts/core";
import { C } from "./theme";

echarts.use([
  BarChart, HeatmapChart, LineChart, PieChart, CalendarComponent, DataZoomComponent, GridComponent,
  LegendComponent, MarkLineComponent, TooltipComponent, VisualMapComponent, AriaComponent, CanvasRenderer,
]);

export interface EChartHandle {
  png: (name: string) => void;
}

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

interface Props {
  option: EChartsCoreOption;
  height?: number | string;
  onClick?: (e: ECElementEvent) => void;
  ariaLabel: string;
}

export const EChart = forwardRef<EChartHandle, Props>(function EChart({ option, height = 280, onClick, ariaLabel }, ref) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const clickRef = useRef(onClick);
  clickRef.current = onClick;

  useEffect(() => {
    if (!el.current) return;
    const c = echarts.init(el.current, undefined, { renderer: "canvas" });
    chart.current = c;
    c.on("click", (e) => clickRef.current?.(e as ECElementEvent));
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      c.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    const motion = !reducedMotion();
    chart.current?.setOption(
      {
        animation: motion,
        animationDuration: 700,
        animationDurationUpdate: 450,
        animationEasing: "cubicOut",
        animationEasingUpdate: "cubicInOut",
        aria: { enabled: true, label: { description: ariaLabel } },
        textStyle: { fontFamily: "Archivo, system-ui, sans-serif" },
        ...option,
      },
      { notMerge: false, replaceMerge: ["series", "xAxis", "yAxis", "visualMap", "calendar", "dataZoom", "legend"] },
    );
  }, [option, ariaLabel]);

  useImperativeHandle(ref, () => ({
    png: (name: string) => {
      const url = chart.current?.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: C.card });
      if (!url) return;
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}.png`;
      a.click();
    },
  }));

  return <div ref={el} role="img" aria-label={ariaLabel} style={{ height, width: "100%" }} />;
});
