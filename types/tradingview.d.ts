declare global {
  interface Window {
    TradingView: {
      widget: new (config: TradingViewWidgetConfig) => void;
    };
  }
}

interface TradingViewWidgetConfig {
  autosize?: boolean;
  symbol: string;
  interval?: string;
  timezone?: string;
  theme?: "light" | "dark";
  style?: string;
  locale?: string;
  toolbar_bg?: string;
  enable_publishing?: boolean;
  allow_symbol_change?: boolean;
  hide_side_toolbar?: boolean;
  show_popup_button?: boolean;
  popup_width?: string;
  popup_height?: string;
  container_id: string;
  watchlist?: string[];
  details?: boolean;
  hotlist?: boolean;
  calendar?: boolean;
  news?: string[];
  studies?: string[];
  disabled_features?: string[];
  enabled_features?: string[];
  loading_screen?: {
    backgroundColor?: string;
    foregroundColor?: string;
  };
  width?: string | number;
  height?: string | number;
}

export {};
