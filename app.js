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

const controls = {
  symbolInput: document.getElementById("symbol-input"),
  applySymbolBtn: document.getElementById("apply-symbol-btn"),
  addFavoriteBtn: document.getElementById("add-favorite-btn"),
  smaEnabled: document.getElementById("sma-enabled"),
  smaPeriod: document.getElementById("sma-period"),
  emaEnabled: document.getElementById("ema-enabled"),
  emaPeriod: document.getElementById("ema-period"),
  bbEnabled: document.getElementById("bb-enabled"),
  bbPeriod: document.getElementById("bb-period"),
  bbStd: document.getElementById("bb-std"),
  rsiEnabled: document.getElementById("rsi-enabled"),
  rsiPeriod: document.getElementById("rsi-period"),
  applyBtn: document.getElementById("apply-btn"),
  drawingTool: document.getElementById("drawing-tool"),
  autoOverlayEnabled: document.getElementById("auto-overlay-enabled"),
  clearDrawingsBtn: document.getElementById("clear-drawings-btn"),
};

const DEFAULT_FAVORITES = ["AAPL", "MSFT", "BTCUSD"];
const FAVORITES_KEY = "quantscope:favorites";

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

function generateSeries(symbol, bars = 220) {
  const seed = hashTicker(symbol);
  const rand = seededRandom(seed);

  let basePrice = estimateBasePrice(symbol, seed);
  const now = Math.floor(Date.now() / 1000);
  const day = 24 * 60 * 60;
  const start = now - bars * day;

  const data = [];
  for (let i = 0; i < bars; i += 1) {
    const time = start + i * day;
    const drift = (rand() - 0.5) * (basePrice * 0.02);
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
  const out = [];
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

  for (let i = period + 1; i < candles.length; i += 1) {
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
let drawingMode = "none";
let pendingAnchor = null;
let drawingSeries = [];
let autoOverlaySeries = [];
let drawingStats = { trendline: 0, fibonacci: 0 };
let autoOverlayStats = { trendline: 0, fibonacci: 0, random: 0 };
let syncingVisibleRange = false;

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
      controls.symbolInput.value = ticker;
      currentSymbol = ticker;
      render();
    });
    favoritesListEl.appendChild(chip);
  }
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

  if (candles.length > 60) {
    const rand = seededRandom(hashTicker(symbol) + candles.length * 17);
    for (let i = 0; i < 2; i += 1) {
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
    const latest = rsiData[rsiData.length - 1].value;
    if (latest < 30) {
      score += 12;
    } else if (latest > 70) {
      score -= 12;
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

function render() {
  const symbol = normalizeTicker(currentSymbol || controls.symbolInput.value) || "AAPL";
  currentSymbol = symbol;
  controls.symbolInput.value = symbol;
  const candles = generateSeries(symbol);
  latestCandles = candles;

  chartTitle.textContent = `${symbol} 가격`;

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
  const insights = [];
  let score = 50;
  let latestSma = null;
  let latestEma = null;
  let latestUpper = null;
  let latestLower = null;
  let latestRsi = null;

  if (controls.smaEnabled.checked) {
    const smaData = sma(candles, smaPeriod);
    const smaSeries = priceChart.addLineSeries({
      color: "#f4c542",
      lineWidth: 2,
      title: `SMA ${smaPeriod}`,
    });
    smaSeries.setData(smaData);
    indicatorSeries.push(smaSeries);
    if (smaData.length > 0) {
      latestSma = smaData[smaData.length - 1].value;
      if (last.close >= latestSma) {
        score += 10;
        insights.push(`SMA(${smaPeriod}) 위에서 거래 중: 추세가 상대적으로 강합니다.`);
      } else {
        score -= 10;
        insights.push(`SMA(${smaPeriod}) 아래에서 거래 중: 단기 약세 가능성을 확인하세요.`);
      }
    }
  }

  if (controls.emaEnabled.checked) {
    const emaData = ema(candles, emaPeriod);
    const emaSeries = priceChart.addLineSeries({
      color: "#53a5ff",
      lineWidth: 2,
      title: `EMA ${emaPeriod}`,
    });
    emaSeries.setData(emaData);
    indicatorSeries.push(emaSeries);
    if (emaData.length > 0) {
      latestEma = emaData[emaData.length - 1].value;
      if (last.close >= latestEma) {
        score += 10;
        insights.push(`EMA(${emaPeriod}) 상향 유지: 모멘텀이 살아있을 수 있습니다.`);
      } else {
        score -= 10;
        insights.push(`EMA(${emaPeriod}) 하향 이탈: 변동성 확대 구간을 주의하세요.`);
      }
    }
  }

  if (controls.bbEnabled.checked) {
    const safeStd = Number.isFinite(bbStd) && bbStd > 0 ? bbStd : 2;
    const bands = bollinger(candles, bbPeriod, safeStd);

    const middleSeries = priceChart.addLineSeries({ color: "#d2dde8", lineWidth: 1 });
    const upperSeries = priceChart.addLineSeries({ color: "#5fb2c3", lineWidth: 1 });
    const lowerSeries = priceChart.addLineSeries({ color: "#5fb2c3", lineWidth: 1 });

    middleSeries.setData(bands.middle);
    upperSeries.setData(bands.upper);
    lowerSeries.setData(bands.lower);

    indicatorSeries.push(middleSeries, upperSeries, lowerSeries);

    if (bands.upper.length > 0 && bands.lower.length > 0) {
      latestUpper = bands.upper[bands.upper.length - 1].value;
      latestLower = bands.lower[bands.lower.length - 1].value;
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
  }

  if (controls.rsiEnabled.checked) {
    const rsiData = rsi(candles, rsiPeriod);

    rsiSeries = rsiChart.addLineSeries({
      color: "#d67cff",
      lineWidth: 2,
      title: `RSI ${rsiPeriod}`,
    });
    rsiSeries.setData(rsiData);

    const bounds = rsiData.map((row) => row.time);
    rsiUpperLine = rsiChart.addLineSeries({ color: "#556d93", lineWidth: 1 });
    rsiLowerLine = rsiChart.addLineSeries({ color: "#556d93", lineWidth: 1 });
    rsiUpperLine.setData(bounds.map((time) => ({ time, value: 70 })));
    rsiLowerLine.setData(bounds.map((time) => ({ time, value: 30 })));

    if (rsiData.length > 0) {
      latestRsi = rsiData[rsiData.length - 1].value;
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

  priceChart.timeScale().fitContent();
  rsiChart.timeScale().fitContent();
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

controls.applyBtn.addEventListener("click", render);
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
controls.drawingTool.addEventListener("change", () => {
  drawingMode = controls.drawingTool.value;
  pendingAnchor = null;
  if (latestCandles.length > 0) {
    renderAdvancedAnalysis(latestCandles);
  }
});
controls.autoOverlayEnabled.addEventListener("change", () => {
  if (latestCandles.length > 0) {
    renderAutomaticOverlays(latestCandles, currentSymbol);
    renderAdvancedAnalysis(latestCandles);
  }
});
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
