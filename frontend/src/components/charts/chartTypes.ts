import type { ReactNode } from 'react';

export type ChartDimensions = {
  width: number;
  height: number;
};

export type ChartMargin = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type ChartInnerDimensions = ChartDimensions & {
  margin: ChartMargin;
  innerWidth: number;
  innerHeight: number;
};

export type ChartTooltipRow = {
  label: string;
  value: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
};

export type ChartTooltipState = {
  visible: boolean;
  x: number;
  y: number;
  title?: ReactNode;
  rows: ChartTooltipRow[];
};

export type BusinessDateKey = `${number}-${number}-${number}`;
