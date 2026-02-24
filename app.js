const priceChartContainer = document.getElementById("price-chart");
const rsiChartContainer = document.getElementById("rsi-chart");
const chartTitle = document.getElementById("chart-title");
const lastPriceEl = document.getElementById("last-price");
const recommendationSignalEl = document.getElementById("recommendation-signal");
const recommendationScoreEl = document.getElementById("recommendation-score");
const analysisListEl = document.getElementById("analysis-list");
const advancedAnalysisListEl = document.getElementById("advanced-analysis-list");
const shortScoreEl = document.getElementById("score-short");
const midScoreEl = document.getElementById("score-mid");
const longScoreEl = document.getElementById("score-long");
const favoritesListEl = document.getElementById("favorites-list");
const rankingListEl = document.getElementById("ranking-list");
const rankingUpdatedEl = document.getElementById("ranking-updated");
const timeframeButtons = {
  "4h": document.getElementById("tf-4h"),
  "1d": document.getElementById("tf-1d"),
  "1w": document.getElementById("tf-1w"),
};

const controls = {
  symbolInput: document.getElementById("symbol-input"),
  applySymbolBtn: document.getElementById("apply-symbol-btn"),
  addFavoriteBtn: document.getElementById("add-favorite-btn"),
  manageFavoritesBtn: document.getElementById("manage-favorites-btn"),
  smaEnabled: document.getElementById("sma-enabled"),
  smaPeriod: document.getElementById("sma-period"),
  emaEnabled: document.getElementById("ema-enabled"),
  emaPeriod: document.getElementById("ema-period"),
  bbEnabled: document.getElementById("bb-enabled"),
  bbPeriod: document.getElementById("bb-period"),
  bbStd: document.getElementById("bb-std"),
  rsiEnabled: document.getElementById("rsi-enabled"),
  rsiPeriod: document.getElementById("rsi-period"),
  drawingTool: document.getElementById("drawing-tool"),
  autoOverlayEnabled: document.getElementById("auto-overlay-enabled"),
  autoRandomCount: document.getElementById("auto-random-count"),
  clearDrawingsBtn: document.getElementById("clear-drawings-btn"),
};

const DEFAULT_FAVORITES = ["AAPL", "MSFT", "BTCUSD"];
const FAVORITES_KEY = "quantscope:favorites";
const MARKET_CACHE_TTL_MS = 5 * 60 * 1000;
const TIMEFRAME_CONFIG = {
  "4h": { label: "4시간봉", stepSeconds: 4 * 60 * 60, bars: 360, noise: 1.3 },
  "1d": { label: "일봉", stepSeconds: 24 * 60 * 60, bars: 220, noise: 1.0 },
  "1w": { label: "주봉", stepSeconds: 7 * 24 * 60 * 60, bars: 180, noise: 0.8 },
};

const COMPANY_INFO = {
  AAPL: { name: "애플", base: 215 },
  MSFT: { name: "마이크로소프트", base: 385 },
  NVDA: { name: "엔비디아", base: 900 },
  AMZN: { name: "아마존", base: 190 },
  GOOGL: { name: "알파벳", base: 175 },
  GOOG: { name: "알파벳", base: 176 },
  META: { name: "메타", base: 520 },
  TSLA: { name: "테슬라", base: 180 },
  AVGO: { name: "브로드컴", base: 1450 },
  COST: { name: "코스트코", base: 780 },
  NFLX: { name: "넷플릭스", base: 620 },
  AMD: { name: "AMD", base: 170 },
  ADBE: { name: "어도비", base: 520 },
  INTC: { name: "인텔", base: 42 },
  QCOM: { name: "퀄컴", base: 185 },
  PYPL: { name: "페이팔", base: 65 },
  BTCUSD: { name: "비트코인", base: 62000 },
};

const NASDAQ_TOP50 = [
  "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "GOOG", "META", "TSLA", "AVGO", "COST",
  "NFLX", "ASML", "AMD", "ADBE", "PEP", "TMUS", "CSCO", "TXN", "INTC", "QCOM",
  "AMGN", "INTU", "HON", "AMAT", "BKNG", "ADI", "SBUX", "MDLZ", "ISRG", "GILD",
  "ADP", "REGN", "LRCX", "PANW", "VRTX", "MU", "MELI", "KLAC", "CRWD", "ABNB",
  "CDNS", "SNPS", "ORLY", "CSX", "PYPL", "MAR", "FTNT", "MRVL", "CTAS", "AEP",
];

function seededRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

function normalizeTicker(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9._-]/g, "")
    .slice(0, 15);
}

function hashTicker(symbol) {
  let hash = 0;
  for (let i = 0; i < symbol.length; i += 1) {
    hash = (hash * 31 + symbol.charCodeAt(i)) % 1000003;
  }
  return hash || 137;
}

function estimateBasePrice(symbol, seed) {
  const info = COMPANY_INFO[symbol];
  if (info && typeof info.base === "number") {
    return info.base;
  }
  if (symbol.includes("BTC")) {
    return 42000 + (seed % 9000);
  }
  if (symbol.includes("ETH")) {
    return 2200 + (seed % 700);
  }
  if (symbol.includes("USD") && symbol.length >= 6) {
    return 1 + (seed % 140) / 100;
  }
  return 40 + (seed % 360);
}

function companyLabel(symbol) {
  const info = COMPANY_INFO[symbol];
  if (info && info.name) {
    return `${symbol} (${info.name})`;
  }
  return symbol;
}

function toYahooSymbol(symbol) {
  if (symbol === "BTCUSD") {
    return "BTC-USD";
  }
  if (/^[A-Z]{6}$/.test(symbol) && symbol.endsWith("USD")) {
    return `${symbol.slice(0, 3)}${symbol.slice(3)}=X`;
  }
  return symbol;
}

function generateSeries(symbol, timeframe = "1d") {
  const frame = TIMEFRAME_CONFIG[timeframe] || TIMEFRAME_CONFIG["1d"];
  const bars = frame.bars;
  const seed = hashTicker(symbol);
  const rand = seededRandom(seed);

  let basePrice = estimateBasePrice(symbol, seed);
  const now = Math.floor(Date.now() / 1000);
  const step = frame.stepSeconds;
  const start = now - bars * step;

  const data = [];
  for (let i = 0; i < bars; i += 1) {
    const time = start + i * step;
    const drift = (rand() - 0.5) * (basePrice * 0.02 * frame.noise);
    const open = basePrice;
    const close = Math.max(1, open + drift);
    const high = Math.max(open, close) + rand() * (basePrice * 0.01);
    const low = Math.min(open, close) - rand() * (basePrice * 0.01);
    const volume = Math.floor(rand() * 7000000 + 500000);

    data.push({
      time,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(Math.max(0.1, low).toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });

    basePrice = close;
  }
  return data;
}

function aggregateTo4H(candles1h) {
  const grouped = new Map();
  for (const candle of candles1h) {
    const bucket = Math.floor(candle.time / (4 * 60 * 60)) * (4 * 60 * 60);
    const existing = grouped.get(bucket);
    if (!existing) {
      grouped.set(bucket, { ...candle, time: bucket });
      continue;
    }
    existing.high = Math.max(existing.high, candle.high);
    existing.low = Math.min(existing.low, candle.low);
    existing.close = candle.close;
    existing.volume += candle.volume;
  }
  return [...grouped.values()].sort((a, b) => a.time - b.time);
}

function parseYahooCandles(payload, timeframe) {
  const result = payload?.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const timestamps = result?.timestamp;
  if (!quote || !timestamps) {
    return null;
  }

  const candles = [];
  for (let i = 0; i < timestamps.length; i += 1) {
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    const volume = quote.volume?.[i] || 0;
    if (
      typeof open !== "number" ||
      typeof high !== "number" ||
      typeof low !== "number" ||
      typeof close !== "number"
    ) {
      continue;
    }
    candles.push({
      time: timestamps[i],
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.max(0, Number(volume)),
    });
  }

  if (candles.length === 0) {
    return null;
  }
  if (timeframe === "4h") {
    return aggregateTo4H(candles);
  }
  return candles;
}

const marketCache = new Map();

async function fetchMarketSeries(symbol, timeframe) {
  const cacheKey = `${symbol}:${timeframe}`;
  const cached = marketCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < MARKET_CACHE_TTL_MS) {
    return cached.candles;
  }

  const yahooSymbol = toYahooSymbol(symbol);
  const interval = timeframe === "1w" ? "1wk" : timeframe === "4h" ? "1h" : "1d";
  const range = timeframe === "1w" ? "5y" : timeframe === "4h" ? "6mo" : "1y";
  const target = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${interval}&range=${range}`;
  const urls = [target, `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`];

  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        continue;
      }
      const payload = await response.json();
      const parsed = parseYahooCandles(payload, timeframe);
      if (parsed && parsed.length > 20) {
        marketCache.set(cacheKey, { candles: parsed, timestamp: Date.now() });
        return parsed;
      }
    } catch (_error) {
      continue;
    }
  }

  const fallback = generateSeries(symbol, timeframe);
  marketCache.set(cacheKey, { candles: fallback, timestamp: Date.now() });
  return fallback;
}

function sma(candles, period) {
  const out = [];
  for (let i = 0; i < candles.length; i += 1) {
    if (i + 1 < period) {
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j += 1) {
      sum += candles[j].close;
    }
    out.push({ time: candles[i].time, value: Number((sum / period).toFixed(2)) });
  }
  return out;
}

function ema(candles, period) {
  const out = [];
  if (candles.length < period) {
    return out;
  }

  const multiplier = 2 / (period + 1);
  let emaValue = candles.slice(0, period).reduce((acc, c) => acc + c.close, 0) / period;
  out.push({ time: candles[period - 1].time, value: Number(emaValue.toFixed(2)) });

  for (let i = period; i < candles.length; i += 1) {
    emaValue = (candles[i].close - emaValue) * multiplier + emaValue;
    out.push({ time: candles[i].time, value: Number(emaValue.toFixed(2)) });
  }
  return out;
}

function bollinger(candles, period, stdDev) {
  const middle = sma(candles, period);
  const outUpper = [];
  const outLower = [];

  for (let i = period - 1; i < candles.length; i += 1) {
    const slice = candles.slice(i - period + 1, i + 1);
    const mean = middle[i - (period - 1)].value;
    const variance = slice.reduce((acc, c) => acc + (c.close - mean) ** 2, 0) / period;
    const deviation = Math.sqrt(variance);

    outUpper.push({ time: candles[i].time, value: Number((mean + stdDev * deviation).toFixed(2)) });
    outLower.push({ time: candles[i].time, value: Number((mean - stdDev * deviation).toFixed(2)) });
  }

  return { middle, upper: outUpper, lower: outLower };
}

function rsi(candles, period) {
  const out = candles.slice(0, period).map((candle) => ({ time: candle.time }));
  if (candles.length <= period) {
    return out;
  }

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i += 1) {
    const delta = candles[i].close - candles[i - 1].close;
    if (delta >= 0) {
      gains += delta;
    } else {
      losses += Math.abs(delta);
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period; i < candles.length; i += 1) {
    const delta = candles[i].close - candles[i - 1].close;
    const gain = Math.max(delta, 0);
    const loss = Math.max(-delta, 0);

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const value = 100 - 100 / (1 + rs);
    out.push({ time: candles[i].time, value: Number(value.toFixed(2)) });
  }

  return out;
}

const chartOptions = {
  layout: {
    background: { color: "#0b1a30" },
    textColor: "#a9bfdb",
  },
  grid: {
    vertLines: { color: "#1f3552" },
    horzLines: { color: "#1f3552" },
  },
  rightPriceScale: {
    borderColor: "#33527a",
    minimumWidth: 72,
  },
  timeScale: {
    borderColor: "#33527a",
  },
  crosshair: {
    mode: LightweightCharts.CrosshairMode.Magnet,
  },
};

const priceChart = LightweightCharts.createChart(priceChartContainer, {
  ...chartOptions,
  width: priceChartContainer.clientWidth,
  height: 430,
});

const rsiChart = LightweightCharts.createChart(rsiChartContainer, {
  ...chartOptions,
  width: rsiChartContainer.clientWidth,
  height: 170,
});

const candleSeries = priceChart.addCandlestickSeries({
  upColor: "#0dbc9f",
  downColor: "#d44949",
  borderVisible: false,
  wickUpColor: "#0dbc9f",
  wickDownColor: "#d44949",
});

const volumeSeries = priceChart.addHistogramSeries({
  priceFormat: { type: "volume" },
  priceScaleId: "",
  color: "rgba(71, 132, 203, 0.5)",
  lastValueVisible: false,
  priceLineVisible: false,
});

priceChart.priceScale("").applyOptions({
  scaleMargins: { top: 0.8, bottom: 0 },
});

let indicatorSeries = [];
let rsiSeries = null;
let rsiUpperLine = null;
let rsiLowerLine = null;
let latestCandles = [];
let currentSymbol = normalizeTicker(controls.symbolInput.value) || "AAPL";
let selectedTimeframe = "1d";
let drawingMode = "none";
let pendingAnchor = null;
let drawingSeries = [];
let autoOverlaySeries = [];
let drawingStats = { trendline: 0, fibonacci: 0 };
let autoOverlayStats = { trendline: 0, fibonacci: 0, random: 0 };
let syncingVisibleRange = false;
let isFavoritesManageMode = false;
let renderRequestId = 0;

function clearIndicators() {
  for (const series of indicatorSeries) {
    priceChart.removeSeries(series);
  }
  indicatorSeries = [];

  if (rsiSeries) {
    rsiChart.removeSeries(rsiSeries);
    rsiSeries = null;
  }
  if (rsiUpperLine) {
    rsiChart.removeSeries(rsiUpperLine);
    rsiUpperLine = null;
  }
  if (rsiLowerLine) {
    rsiChart.removeSeries(rsiLowerLine);
    rsiLowerLine = null;
  }
}

function clampPeriod(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 2) {
    return fallback;
  }
  return parsed;
}

function clearDrawings() {
  for (const series of drawingSeries) {
    priceChart.removeSeries(series);
  }
  drawingSeries = [];
  pendingAnchor = null;
  drawingStats = { trendline: 0, fibonacci: 0 };
}

function clearAutoOverlays() {
  for (const series of autoOverlaySeries) {
    priceChart.removeSeries(series);
  }
  autoOverlaySeries = [];
  autoOverlayStats = { trendline: 0, fibonacci: 0, random: 0 };
}

function syncVisibleRange(sourceChart, targetChart) {
  sourceChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
    if (syncingVisibleRange || range === null) {
      return;
    }
    syncingVisibleRange = true;
    try {
      targetChart.timeScale().setVisibleLogicalRange(range);
    } finally {
      syncingVisibleRange = false;
    }
  });
}

function loadFavorites() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    if (Array.isArray(parsed)) {
      const normalized = parsed.map((item) => normalizeTicker(item)).filter(Boolean);
      return [...new Set([...DEFAULT_FAVORITES, ...normalized])].slice(0, 12);
    }
  } catch (_error) {
    return DEFAULT_FAVORITES.slice();
  }
  return DEFAULT_FAVORITES.slice();
}

function saveFavorites(items) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(items));
}

let favorites = loadFavorites();

function renderFavorites() {
  favoritesListEl.innerHTML = "";
  for (const ticker of favorites) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "favorite-chip";
    chip.textContent = ticker;
    chip.addEventListener("click", () => {
      if (isFavoritesManageMode) {
        favorites = favorites.filter((value) => value !== ticker);
        saveFavorites(favorites);
        renderFavorites();
        if (currentSymbol === ticker) {
          currentSymbol = favorites[0] || "AAPL";
          controls.symbolInput.value = currentSymbol;
          render();
        }
        return;
      }
      controls.symbolInput.value = ticker;
      currentSymbol = ticker;
      render();
    });
    favoritesListEl.appendChild(chip);
  }

  favoritesListEl.classList.toggle("manage-mode", isFavoritesManageMode);
  controls.manageFavoritesBtn.classList.toggle("active", isFavoritesManageMode);
}

function sortedAnchors(a, b) {
  if (typeof a.time === "number" && typeof b.time === "number" && a.time > b.time) {
    return [b, a];
  }
  return [a, b];
}

function drawLineOverlay(targetArray, start, end, color, width = 1) {
  const series = priceChart.addLineSeries({
    color,
    lineWidth: width,
    lastValueVisible: false,
    priceLineVisible: false,
  });
  series.setData([
    { time: start.time, value: start.price },
    { time: end.time, value: end.price },
  ]);
  targetArray.push(series);
}

function drawTrendline(a, b) {
  const [start, end] = sortedAnchors(a, b);
  drawLineOverlay(drawingSeries, start, end, "#ffb347", 2);
  drawingStats.trendline += 1;
}

function drawFibonacci(a, b) {
  const [start, end] = sortedAnchors(a, b);
  const high = Math.max(start.price, end.price);
  const low = Math.min(start.price, end.price);
  const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

  for (const level of levels) {
    const price = Number((high - (high - low) * level).toFixed(2));
    drawLineOverlay(
      drawingSeries,
      { time: start.time, price },
      { time: end.time, price },
      "#7fc8b5",
      1
    );
  }
  drawingStats.fibonacci += 1;
}

function renderAutomaticOverlays(candles, symbol) {
  clearAutoOverlays();
  if (!controls.autoOverlayEnabled.checked) {
    return;
  }

  const swings = getSwingPoints(candles, 4);
  const highs = swings.filter((s) => s.type === "high");
  const lows = swings.filter((s) => s.type === "low");

  if (highs.length >= 2) {
    const a = highs[highs.length - 2];
    const b = highs[highs.length - 1];
    drawLineOverlay(autoOverlaySeries, { time: a.time, price: a.price }, { time: b.time, price: b.price }, "#f2a65a", 1);
    autoOverlayStats.trendline += 1;
  }
  if (lows.length >= 2) {
    const a = lows[lows.length - 2];
    const b = lows[lows.length - 1];
    drawLineOverlay(autoOverlaySeries, { time: a.time, price: a.price }, { time: b.time, price: b.price }, "#6ad3c0", 1);
    autoOverlayStats.trendline += 1;
  }

  if (highs.length >= 1 && lows.length >= 1) {
    const pivotHigh = highs[highs.length - 1];
    const pivotLow = lows[lows.length - 1];
    const start = pivotHigh.time < pivotLow.time ? pivotHigh : pivotLow;
    const end = pivotHigh.time < pivotLow.time ? pivotLow : pivotHigh;
    const high = Math.max(pivotHigh.price, pivotLow.price);
    const low = Math.min(pivotHigh.price, pivotLow.price);
    const levels = [0.236, 0.382, 0.5, 0.618, 0.786];
    for (const level of levels) {
      const price = Number((high - (high - low) * level).toFixed(2));
      drawLineOverlay(
        autoOverlaySeries,
        { time: start.time, price },
        { time: end.time, price },
        "rgba(127, 200, 181, 0.75)",
        1
      );
      autoOverlayStats.fibonacci += 1;
    }
  }

  const randomCount = Math.max(0, Math.min(8, Number.parseInt(controls.autoRandomCount.value, 10) || 0));

  if (candles.length > 60 && randomCount > 0) {
    const rand = seededRandom(hashTicker(symbol) + candles.length * 17);
    for (let i = 0; i < randomCount; i += 1) {
      const startIndex = Math.floor(rand() * (candles.length - 30));
      const endIndex = Math.min(candles.length - 1, startIndex + 12 + Math.floor(rand() * 18));
      const startCandle = candles[startIndex];
      const endCandle = candles[endIndex];
      const startPrice = rand() > 0.5 ? startCandle.high : startCandle.low;
      const endPrice = rand() > 0.5 ? endCandle.high : endCandle.low;
      drawLineOverlay(
        autoOverlaySeries,
        { time: startCandle.time, price: Number(startPrice.toFixed(2)) },
        { time: endCandle.time, price: Number(endPrice.toFixed(2)) },
        "rgba(239, 200, 126, 0.75)",
        1
      );
      autoOverlayStats.random += 1;
    }
  }
}

function scoreLabel(score) {
  if (score >= 70) {
    return "매수 우위";
  }
  if (score <= 30) {
    return "매도 주의";
  }
  return "중립";
}

function applyScoreBadgeClass(element, score) {
  element.classList.remove("buy", "sell");
  if (score >= 70) {
    element.classList.add("buy");
  } else if (score <= 30) {
    element.classList.add("sell");
  }
}

function calculateRecommendationScore(candles, params) {
  const smaData = sma(candles, params.smaPeriod);
  const emaData = ema(candles, params.emaPeriod);
  const bands = bollinger(candles, params.bbPeriod, params.bbStd);
  const rsiData = rsi(candles, params.rsiPeriod);
  const latestRsiPoint = [...rsiData].reverse().find((row) => row.value !== undefined);
  const last = candles[candles.length - 1];

  let score = 50;
  const latestSma = smaData.length > 0 ? smaData[smaData.length - 1].value : null;
  const latestEma = emaData.length > 0 ? emaData[emaData.length - 1].value : null;
  const latestUpper = bands.upper.length > 0 ? bands.upper[bands.upper.length - 1].value : null;
  const latestLower = bands.lower.length > 0 ? bands.lower[bands.lower.length - 1].value : null;
  const latestRsi = latestRsiPoint ? latestRsiPoint.value : null;

  if (latestSma !== null) {
    score += last.close >= latestSma ? 10 : -10;
  }
  if (latestEma !== null) {
    score += last.close >= latestEma ? 10 : -10;
  }
  if (latestUpper !== null && latestLower !== null) {
    if (last.close > latestUpper) {
      score -= 15;
    } else if (last.close < latestLower) {
      score += 15;
    }
  }
  if (latestRsi !== null) {
    if (latestRsi >= 70) {
      score -= 20;
    } else if (latestRsi <= 30) {
      score += 20;
    }
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function renderRanking(timeframe, params, currentTicker) {
  const ranking = NASDAQ_TOP50.map((ticker) => {
    const candles = generateSeries(ticker, timeframe);
    const score = calculateRecommendationScore(candles, params);
    return { ticker, score };
  }).sort((a, b) => b.score - a.score);

  rankingListEl.innerHTML = "";
  for (const [index, item] of ranking.slice(0, 20).entries()) {
    const li = document.createElement("li");
    if (item.ticker === currentTicker) {
      li.classList.add("current");
    }
    li.textContent = `${index + 1}. ${companyLabel(item.ticker)} - ${item.score}점 (${scoreLabel(item.score)})`;
    rankingListEl.appendChild(li);
  }

  const now = new Date();
  rankingUpdatedEl.textContent = `${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

function horizonScore(candles, shortPeriod, longPeriod, rsiPeriod) {
  let score = 50;
  const shortSma = sma(candles, shortPeriod);
  const longEma = ema(candles, longPeriod);
  const rsiData = rsi(candles, rsiPeriod);
  const last = candles[candles.length - 1];

  if (shortSma.length > 0 && last.close > shortSma[shortSma.length - 1].value) {
    score += 18;
  } else {
    score -= 18;
  }
  if (longEma.length > 0 && last.close > longEma[longEma.length - 1].value) {
    score += 16;
  } else {
    score -= 16;
  }
  if (rsiData.length > 0) {
    const latest = [...rsiData].reverse().find((row) => row.value !== undefined)?.value;
    if (latest !== undefined) {
      if (latest < 30) {
        score += 12;
      } else if (latest > 70) {
        score -= 12;
      }
    }
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function renderHorizonScores(candles) {
  const short = horizonScore(candles, 7, 20, 7);
  const mid = horizonScore(candles, 20, 50, 14);
  const long = horizonScore(candles, 50, 100, 21);

  shortScoreEl.textContent = `단기 ${short}점 (${scoreLabel(short)})`;
  midScoreEl.textContent = `중기 ${mid}점 (${scoreLabel(mid)})`;
  longScoreEl.textContent = `장기 ${long}점 (${scoreLabel(long)})`;
  applyScoreBadgeClass(shortScoreEl, short);
  applyScoreBadgeClass(midScoreEl, mid);
  applyScoreBadgeClass(longScoreEl, long);
}

function getSwingPoints(candles, lookback = 3) {
  const swings = [];
  for (let i = lookback; i < candles.length - lookback; i += 1) {
    const current = candles[i];
    let isHigh = true;
    let isLow = true;

    for (let j = i - lookback; j <= i + lookback; j += 1) {
      if (j === i) {
        continue;
      }
      if (candles[j].high >= current.high) {
        isHigh = false;
      }
      if (candles[j].low <= current.low) {
        isLow = false;
      }
    }

    if (isHigh) {
      swings.push({ type: "high", index: i, price: current.high, time: current.time });
    }
    if (isLow) {
      swings.push({ type: "low", index: i, price: current.low, time: current.time });
    }
  }
  return swings.sort((a, b) => a.index - b.index);
}

function analyzeElliottWave(candles) {
  const swings = getSwingPoints(candles, 4);
  const highs = swings.filter((s) => s.type === "high").slice(-3);
  const lows = swings.filter((s) => s.type === "low").slice(-3);

  if (highs.length < 3 || lows.length < 3) {
    return "엘리어트 파동: 스윙 포인트가 부족해 구조 판별 신뢰도가 낮습니다.";
  }

  const highUp = highs[0].price < highs[1].price && highs[1].price < highs[2].price;
  const lowUp = lows[0].price < lows[1].price && lows[1].price < lows[2].price;
  const highDown = highs[0].price > highs[1].price && highs[1].price > highs[2].price;
  const lowDown = lows[0].price > lows[1].price && lows[1].price > lows[2].price;

  if (highUp && lowUp) {
    return "엘리어트 파동: 고점/저점이 계단식 상승으로 충격파(상승 1~5파) 가능성이 있습니다.";
  }
  if (highDown && lowDown) {
    return "엘리어트 파동: 고점/저점이 계단식 하락으로 하락 충격파 가능성이 있습니다.";
  }
  return "엘리어트 파동: 현재는 조정파(A-B-C) 또는 횡보 전환 가능성이 더 큽니다.";
}

function analyzeChartPatterns(candles) {
  const swings = getSwingPoints(candles, 3);
  const highs = swings.filter((s) => s.type === "high");
  const lows = swings.filter((s) => s.type === "low");
  const messages = [];

  const lastHighA = highs[highs.length - 2];
  const lastHighB = highs[highs.length - 1];
  if (lastHighA && lastHighB) {
    const highAvg = (lastHighA.price + lastHighB.price) / 2;
    const near = Math.abs(lastHighA.price - lastHighB.price) / highAvg <= 0.015;
    if (near) {
      messages.push("차트 패턴: 이중 천정(Double Top) 유사 구간이 보여 저항 확인이 필요합니다.");
    }
  }

  const lastLowA = lows[lows.length - 2];
  const lastLowB = lows[lows.length - 1];
  if (lastLowA && lastLowB) {
    const lowAvg = (lastLowA.price + lastLowB.price) / 2;
    const near = Math.abs(lastLowA.price - lastLowB.price) / lowAvg <= 0.015;
    if (near) {
      messages.push("차트 패턴: 이중 바닥(Double Bottom) 유사 구간이 보여 지지 반등을 체크하세요.");
    }
  }

  const top3 = highs.slice(-3);
  if (top3.length === 3) {
    const left = top3[0].price;
    const head = top3[1].price;
    const right = top3[2].price;
    const shouldersNear = Math.abs(left - right) / ((left + right) / 2) <= 0.03;
    const headHigher = head > left * 1.02 && head > right * 1.02;
    if (shouldersNear && headHigher) {
      messages.push("차트 패턴: 헤드앤숄더 유사 구조가 관찰되어 추세 전환 가능성을 점검하세요.");
    }
  }

  if (messages.length === 0) {
    messages.push("차트 패턴: 뚜렷한 반전 패턴은 약하며 추세 지속/횡보 가능성을 함께 보세요.");
  }

  return messages;
}

function renderAdvancedAnalysis(candles) {
  const lines = [];
  lines.push(analyzeElliottWave(candles));
  for (const msg of analyzeChartPatterns(candles)) {
    lines.push(msg);
  }

  const toolName = drawingMode === "trendline" ? "추세선" : drawingMode === "fibonacci" ? "피보나치" : "없음";
  lines.push(`작도 상태: ${toolName} / 추세선 ${drawingStats.trendline}개 / 피보나치 ${drawingStats.fibonacci}개`);
  lines.push(`자동 작도: ${controls.autoOverlayEnabled.checked ? "활성" : "비활성"}`);
  if (controls.autoOverlayEnabled.checked) {
    lines.push(
      `자동 작도 구성: 추세선 ${autoOverlayStats.trendline}개 / 피보나치 ${autoOverlayStats.fibonacci}개 / 임의 패턴 ${autoOverlayStats.random}개`
    );
  }

  advancedAnalysisListEl.innerHTML = "";
  for (const text of lines) {
    const li = document.createElement("li");
    li.textContent = text;
    advancedAnalysisListEl.appendChild(li);
  }
}

async function render() {
  const requestId = ++renderRequestId;
  const symbol = normalizeTicker(currentSymbol || controls.symbolInput.value) || "AAPL";
  const timeframe = selectedTimeframe;
  const frame = TIMEFRAME_CONFIG[timeframe] || TIMEFRAME_CONFIG["1d"];
  currentSymbol = symbol;
  controls.symbolInput.value = symbol;
  const candles = await fetchMarketSeries(symbol, timeframe);
  if (requestId !== renderRequestId) {
    return;
  }
  latestCandles = candles;

  chartTitle.textContent = `${companyLabel(symbol)} 가격 (${frame.label})`;

  candleSeries.setData(candles);
  volumeSeries.setData(
    candles.map((c) => ({
      time: c.time,
      value: c.volume,
      color: c.close >= c.open ? "rgba(17, 181, 163, 0.45)" : "rgba(212, 73, 73, 0.45)",
    }))
  );

  const last = candles[candles.length - 1];
  lastPriceEl.textContent = `현재가 ${last.close.toLocaleString()} USD`;

  clearIndicators();

  const smaPeriod = clampPeriod(controls.smaPeriod.value, 20);
  const emaPeriod = clampPeriod(controls.emaPeriod.value, 50);
  const bbPeriod = clampPeriod(controls.bbPeriod.value, 20);
  const bbStd = Number.parseFloat(controls.bbStd.value);
  const rsiPeriod = clampPeriod(controls.rsiPeriod.value, 14);
  const safeStd = Number.isFinite(bbStd) && bbStd > 0 ? bbStd : 2;
  const recommendationParams = {
    smaPeriod,
    emaPeriod,
    bbPeriod,
    bbStd: safeStd,
    rsiPeriod,
  };
  const smaData = sma(candles, smaPeriod);
  const emaData = ema(candles, emaPeriod);
  const bands = bollinger(candles, bbPeriod, safeStd);
  const rsiData = rsi(candles, rsiPeriod);
  const latestRsiPoint = [...rsiData].reverse().find((row) => row.value !== undefined);

  const insights = [];
  let score = 50;
  const latestSma = smaData.length > 0 ? smaData[smaData.length - 1].value : null;
  const latestEma = emaData.length > 0 ? emaData[emaData.length - 1].value : null;
  const latestUpper = bands.upper.length > 0 ? bands.upper[bands.upper.length - 1].value : null;
  const latestLower = bands.lower.length > 0 ? bands.lower[bands.lower.length - 1].value : null;
  const latestRsi = latestRsiPoint ? latestRsiPoint.value : null;

  if (latestSma !== null) {
    if (last.close >= latestSma) {
      score += 10;
      insights.push(`SMA(${smaPeriod}) 위에서 거래 중: 추세가 상대적으로 강합니다.`);
    } else {
      score -= 10;
      insights.push(`SMA(${smaPeriod}) 아래에서 거래 중: 단기 약세 가능성을 확인하세요.`);
    }
  }

  if (latestEma !== null) {
    if (last.close >= latestEma) {
      score += 10;
      insights.push(`EMA(${emaPeriod}) 상향 유지: 모멘텀이 살아있을 수 있습니다.`);
    } else {
      score -= 10;
      insights.push(`EMA(${emaPeriod}) 하향 이탈: 변동성 확대 구간을 주의하세요.`);
    }
  }

  if (latestUpper !== null && latestLower !== null) {
    if (last.close > latestUpper) {
      score -= 15;
      insights.push("볼린저 상단 돌파: 단기 과열일 수 있어 분할 대응이 유리합니다.");
    } else if (last.close < latestLower) {
      score += 15;
      insights.push("볼린저 하단 이탈: 과매도 반등 가능성을 점검해볼 수 있습니다.");
    } else {
      insights.push("볼린저 밴드 내부 움직임: 추세 확인 후 진입하는 접근이 안전합니다.");
    }
  }

  if (latestRsi !== null) {
    if (latestRsi >= 70) {
      score -= 20;
      insights.push(`RSI(${rsiPeriod}) ${latestRsi}: 과매수 구간으로 단기 조정 가능성을 보세요.`);
    } else if (latestRsi <= 30) {
      score += 20;
      insights.push(`RSI(${rsiPeriod}) ${latestRsi}: 과매도 구간으로 반등 여지를 확인하세요.`);
    } else {
      insights.push(`RSI(${rsiPeriod}) ${latestRsi}: 중립 구간으로 추세 확인이 필요합니다.`);
    }
  }

  if (controls.smaEnabled.checked) {
    const smaSeries = priceChart.addLineSeries({
      color: "#f4c542",
      lineWidth: 2,
      title: `SMA ${smaPeriod}`,
    });
    smaSeries.setData(smaData);
    indicatorSeries.push(smaSeries);
  }

  if (controls.emaEnabled.checked) {
    const emaSeries = priceChart.addLineSeries({
      color: "#53a5ff",
      lineWidth: 2,
      title: `EMA ${emaPeriod}`,
    });
    emaSeries.setData(emaData);
    indicatorSeries.push(emaSeries);
  }

  if (controls.bbEnabled.checked) {
    const middleSeries = priceChart.addLineSeries({ color: "#d2dde8", lineWidth: 1 });
    const upperSeries = priceChart.addLineSeries({ color: "#5fb2c3", lineWidth: 1 });
    const lowerSeries = priceChart.addLineSeries({ color: "#5fb2c3", lineWidth: 1 });

    middleSeries.setData(bands.middle);
    upperSeries.setData(bands.upper);
    lowerSeries.setData(bands.lower);

    indicatorSeries.push(middleSeries, upperSeries, lowerSeries);
  }

  if (controls.rsiEnabled.checked) {
    rsiSeries = rsiChart.addLineSeries({
      color: "#d67cff",
      lineWidth: 2,
      title: `RSI ${rsiPeriod}`,
    });
    rsiSeries.setData(rsiData);

    const bounds = candles.map((row) => row.time);
    rsiUpperLine = rsiChart.addLineSeries({ color: "#556d93", lineWidth: 1 });
    rsiLowerLine = rsiChart.addLineSeries({ color: "#556d93", lineWidth: 1 });
    rsiUpperLine.setData(bounds.map((time) => ({ time, value: 70 })));
    rsiLowerLine.setData(bounds.map((time) => ({ time, value: 30 })));
  }

  if (insights.length === 0) {
    insights.push("활성화된 지표가 없어 추천 점수를 계산하지 않았습니다.");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  let signal = "중립";
  if (score >= 70) {
    signal = "매수 우위";
  } else if (score <= 30) {
    signal = "매도 주의";
  }

  recommendationSignalEl.textContent = `추천 신호: ${signal}`;
  recommendationScoreEl.textContent = `${score}점`;
  applyScoreBadgeClass(recommendationScoreEl, score);
  analysisListEl.innerHTML = "";
  for (const text of insights) {
    const li = document.createElement("li");
    li.textContent = text;
    analysisListEl.appendChild(li);
  }

  renderHorizonScores(candles);
  renderAutomaticOverlays(candles, symbol);
  renderAdvancedAnalysis(candles);
  renderRanking(timeframe, recommendationParams, symbol);

  priceChart.timeScale().fitContent();
  const alignedRange = priceChart.timeScale().getVisibleLogicalRange();
  if (alignedRange !== null) {
    rsiChart.timeScale().setVisibleLogicalRange(alignedRange);
  }
}

priceChart.subscribeClick((param) => {
  if (drawingMode === "none") {
    return;
  }
  if (!param.point || param.time === undefined || param.time === null) {
    return;
  }

  const price = candleSeries.coordinateToPrice(param.point.y);
  if (price === null || price === undefined) {
    return;
  }

  const anchor = { time: param.time, price: Number(price.toFixed(2)) };

  if (!pendingAnchor) {
    pendingAnchor = anchor;
    return;
  }

  if (drawingMode === "trendline") {
    drawTrendline(pendingAnchor, anchor);
  } else if (drawingMode === "fibonacci") {
    drawFibonacci(pendingAnchor, anchor);
  }

  pendingAnchor = null;
  if (latestCandles.length > 0) {
    renderAdvancedAnalysis(latestCandles);
  }
});

controls.applySymbolBtn.addEventListener("click", () => {
  currentSymbol = normalizeTicker(controls.symbolInput.value) || "AAPL";
  render();
});
controls.symbolInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    currentSymbol = normalizeTicker(controls.symbolInput.value) || "AAPL";
    render();
  }
});
controls.addFavoriteBtn.addEventListener("click", () => {
  const ticker = normalizeTicker(controls.symbolInput.value) || "AAPL";
  if (!favorites.includes(ticker)) {
    favorites = [ticker, ...favorites].slice(0, 12);
    saveFavorites(favorites);
    renderFavorites();
  }
  currentSymbol = ticker;
  render();
});
controls.manageFavoritesBtn.addEventListener("click", () => {
  isFavoritesManageMode = !isFavoritesManageMode;
  renderFavorites();
});
controls.autoRandomCount.addEventListener("input", () => {
  if (latestCandles.length > 0) {
    renderAutomaticOverlays(latestCandles, currentSymbol);
    renderAdvancedAnalysis(latestCandles);
  }
});

const liveRenderElements = [
  controls.smaEnabled,
  controls.smaPeriod,
  controls.emaEnabled,
  controls.emaPeriod,
  controls.bbEnabled,
  controls.bbPeriod,
  controls.bbStd,
  controls.rsiEnabled,
  controls.rsiPeriod,
  controls.drawingTool,
  controls.autoOverlayEnabled,
];

for (const [timeframe, button] of Object.entries(timeframeButtons)) {
  button.addEventListener("click", () => {
    selectedTimeframe = timeframe;
    for (const [key, target] of Object.entries(timeframeButtons)) {
      target.classList.toggle("active", key === timeframe);
    }
    render();
  });
}

for (const element of liveRenderElements) {
  element.addEventListener("change", () => {
    if (element === controls.drawingTool) {
      drawingMode = controls.drawingTool.value;
      pendingAnchor = null;
    }
    render();
  });
}
controls.clearDrawingsBtn.addEventListener("click", () => {
  clearDrawings();
  if (latestCandles.length > 0) {
    renderAdvancedAnalysis(latestCandles);
  }
});

window.addEventListener("resize", () => {
  priceChart.applyOptions({ width: priceChartContainer.clientWidth });
  rsiChart.applyOptions({ width: rsiChartContainer.clientWidth });
});

syncVisibleRange(priceChart, rsiChart);
syncVisibleRange(rsiChart, priceChart);

renderFavorites();
render();
