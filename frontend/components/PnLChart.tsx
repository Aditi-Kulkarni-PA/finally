'use client';

import { useEffect, useRef } from 'react';
import type { PortfolioSnapshot } from '@/types';

interface PnLChartProps {
  history: PortfolioSnapshot[];
}

export default function PnLChart({ history }: PnLChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<any>(null);

  useEffect(() => {
    async function init() {
      if (!containerRef.current) return;
      const { createChart, ColorType, LineSeries } = await import('lightweight-charts');

      const chart = createChart(containerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: '#0d1117' },
          textColor: '#8b949e',
        },
        grid: {
          vertLines: { color: '#21262d' },
          horzLines: { color: '#21262d' },
        },
        rightPriceScale: { borderColor: '#30363d' },
        timeScale: {
          borderColor: '#30363d',
          timeVisible: true,
        },
        crosshair: {
          vertLine: { color: '#30363d' },
          horzLine: { color: '#30363d' },
        },
        handleScroll: true,
        handleScale: true,
      });

      // lightweight-charts v5 uses addSeries(SeriesDefinition, options)
      const lineSeries = chart.addSeries(LineSeries, {
        color: '#ecad0a',
        lineWidth: 2,
        priceLineVisible: false,
      });

      chartRef.current = chart;
      seriesRef.current = lineSeries;
    }

    init();

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, []);

  // Resize chart with container
  useEffect(() => {
    if (!chartRef.current || !containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (chartRef.current && containerRef.current) {
        chartRef.current.resize(
          containerRef.current.clientWidth,
          containerRef.current.clientHeight
        );
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Update data when history changes
  useEffect(() => {
    if (!seriesRef.current || !history.length) return;

    const chartData = history
      .map((snap) => ({
        time: Math.floor(new Date(snap.recorded_at).getTime() / 1000) as number,
        value: snap.total_value,
      }))
      // Remove duplicates by time (keep last)
      .reduce((acc: { time: number; value: number }[], pt) => {
        if (acc.length > 0 && acc[acc.length - 1].time === pt.time) {
          acc[acc.length - 1] = pt;
        } else {
          acc.push(pt);
        }
        return acc;
      }, [])
      .sort((a, b) => a.time - b.time);

    if (chartData.length > 0) {
      seriesRef.current.setData(chartData);
    }
  }, [history]);

  return (
    <div
      style={{
        background: '#161b22',
        border: '1px solid #30363d',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #30363d',
          color: '#8b949e',
          fontSize: '10px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          flexShrink: 0,
        }}
      >
        Portfolio Value Over Time
      </div>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }}>
        {history.length === 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#8b949e',
              fontSize: '12px',
            }}
          >
            No history yet — portfolio snapshots accumulate over time
          </div>
        )}
      </div>
    </div>
  );
}
