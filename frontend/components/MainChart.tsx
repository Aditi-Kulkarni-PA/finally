'use client';

import { useEffect, useRef } from 'react';
import type { PriceUpdate } from '@/types';

interface MainChartProps {
  ticker: string | null;
  prices: Record<string, PriceUpdate>;
  sparklines: Record<string, number[]>;
}

export default function MainChart({ ticker, prices, sparklines }: MainChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<any>(null);
  const currentTickerRef = useRef<string | null>(null);

  useEffect(() => {
    let chart: ReturnType<typeof import('lightweight-charts').createChart> | null = null;

    async function init() {
      if (!containerRef.current) return;
      const { createChart, ColorType, AreaSeries } = await import('lightweight-charts');

      chart = createChart(containerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: '#0d1117' },
          textColor: '#8b949e',
        },
        grid: {
          vertLines: { color: '#21262d' },
          horzLines: { color: '#21262d' },
        },
        crosshair: {
          vertLine: { color: '#30363d' },
          horzLine: { color: '#30363d' },
        },
        rightPriceScale: { borderColor: '#30363d' },
        timeScale: {
          borderColor: '#30363d',
          timeVisible: true,
        },
        handleScroll: true,
        handleScale: true,
      });

      // lightweight-charts v5 uses addSeries(SeriesDefinition, options)
      const areaSeries = chart.addSeries(AreaSeries, {
        lineColor: '#209dd7',
        topColor: 'rgba(32, 157, 215, 0.3)',
        bottomColor: 'rgba(32, 157, 215, 0.0)',
        lineWidth: 2,
      });

      chartRef.current = chart;
      seriesRef.current = areaSeries;
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

  // Update chart data when ticker or sparklines change
  useEffect(() => {
    if (!seriesRef.current || !ticker) return;

    const data = sparklines[ticker];
    if (!data || data.length === 0) return;

    const now = Math.floor(Date.now() / 1000);
    // Assume ~500ms between points; build synthetic timestamps going backwards
    const chartData = data.map((price, i) => ({
      time: (now - (data.length - 1 - i) * 1) as number,
      value: price,
    }));

    // Reset series when ticker changes
    if (currentTickerRef.current !== ticker) {
      currentTickerRef.current = ticker;
    }

    seriesRef.current.setData(chartData);
  }, [ticker, sparklines]);

  const currentPrice = ticker ? prices[ticker]?.price : null;
  const direction = ticker ? prices[ticker]?.direction : null;
  const priceColor = direction === 'up' ? '#3fb950' : direction === 'down' ? '#f85149' : '#e6edf3';

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
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexShrink: 0,
        }}
      >
        <span style={{ color: '#ecad0a', fontWeight: 700, fontSize: '14px' }}>
          {ticker ?? 'Select a ticker'}
        </span>
        {currentPrice != null && (
          <span style={{ color: priceColor, fontSize: '18px', fontWeight: 700 }}>
            ${currentPrice.toFixed(2)}
          </span>
        )}
        {ticker && prices[ticker] && (
          <span style={{ color: priceColor, fontSize: '12px' }}>
            {prices[ticker].change >= 0 ? '+' : ''}
            {prices[ticker].change.toFixed(2)} ({prices[ticker].change_percent >= 0 ? '+' : ''}
            {prices[ticker].change_percent.toFixed(2)}%)
          </span>
        )}
      </div>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }}>
        {!ticker && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#8b949e',
              fontSize: '13px',
            }}
          >
            Click a ticker in the watchlist to see its chart
          </div>
        )}
      </div>
    </div>
  );
}
