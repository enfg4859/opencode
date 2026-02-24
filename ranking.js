const rankingListEl = document.getElementById("ranking-page-list");
const rankingStatusEl = document.getElementById("ranking-status");
const refreshBtn = document.getElementById("ranking-refresh-btn");

const timeframeButtons = {
  "4h": document.getElementById("ranking-tf-4h"),
  "1d": document.getElementById("ranking-tf-1d"),
  "1w": document.getElementById("ranking-tf-1w"),
};

const TIMEFRAME_CONFIG = {
  "4h": { stepSeconds: 4 * 60 * 60, bars: 360, noise: 1.3 },
  "1d": { stepSeconds: 24 * 60 * 60, bars: 220, noise: 1.0 },
  "1w": { stepSeconds: 7 * 24 * 60 * 60, bars: 180, noise: 0.8 },
};

const COMPANY_INFO = {
  AAPL: "애플",
  MSFT: "마이크로소프트",
  NVDA: "엔비디아",
  AMZN: "아마존",
  GOOGL: "알파벳",
  GOOG: "알파벳",
  META: "메타",
  TSLA: "테슬라",
  AVGO: "브로드컴",
  COST: "코스트코",
};

const NASDAQ_TOP50 = [
  "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "GOOG", "META", "TSLA", "AVGO", "COST",
  "NFLX", "ASML", "AMD", "ADBE", "PEP", "TMUS", "CSCO", "TXN", "INTC", "QCOM",
  "AMGN", "INTU", "HON", "AMAT", "BKNG", "ADI", "SBUX", "MDLZ", "ISRG", "GILD",
  "ADP", "REGN", "LRCX", "PANW", "VRTX", "MU", "MELI", "KLAC", "CRWD", "ABNB",
  "CDNS", "SNPS", "ORLY", "CSX", "PYPL", "MAR", "FTNT", "MRVL", "CTAS", "AEP",
];

let selectedTimeframe = "1d";

function seededRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

function hashTicker(symbol) {
  let hash = 0;
  for (let i = 0; i < symbol.length; i += 1) {
    hash = (hash * 31 + symbol.charCodeAt(i)) % 1000003;
  }
  return hash || 137;
}

function estimateBasePrice(symbol, seed) {
  if (symbol === "MSFT") {
    return 385;
  }
  if (symbol === "AAPL") {
    return 215;
  }
  if (symbol.includes("BTC")) {
    return 62000;
  }
  return 40 + (seed % 360);
}

function companyLabel(symbol) {
  if (COMPANY_INFO[symbol]) {
    return `${symbol} (${COMPANY_INFO[symbol]})`;
  }
  return symbol;
}

function generateSeries(symbol, timeframe) {
  const frame = TIMEFRAME_CONFIG[timeframe] || TIMEFRAME_CONFIG["1d"];
  const seed = hashTicker(symbol);
  const rand = seededRandom(seed);

  let basePrice = estimateBasePrice(symbol, seed);
  const now = Math.floor(Date.now() / 1000);
  const start = now - frame.bars * frame.stepSeconds;

  const candles = [];
  for (let i = 0; i < frame.bars; i += 1) {
    const time = start + i * frame.stepSeconds;
    const drift = (rand() - 0.5) * (basePrice * 0.02 * frame.noise);
    const open = basePrice;
    const close = Math.max(1, open + drift);
    const high = Math.max(open, close) + rand() * (basePrice * 0.01);
    const low = Math.min(open, close) - rand() * (basePrice * 0.01);

    candles.push({
      time,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(Math.max(0.1, low).toFixed(2)),
      close: Number(close.toFixed(2)),
    });

    basePrice = close;
  }

  return candles;
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
    out.push({ time: candles[i].time, value: sum / period });
  }
  return out;
}

function ema(candles, period) {
  if (candles.length < period) {
    return [];
  }
  const out = [];
  const multiplier = 2 / (period + 1);
  let emaValue = candles.slice(0, period).reduce((acc, c) => acc + c.close, 0) / period;
  out.push({ time: candles[period - 1].time, value: emaValue });
  for (let i = period; i < candles.length; i += 1) {
    emaValue = (candles[i].close - emaValue) * multiplier + emaValue;
    out.push({ time: candles[i].time, value: emaValue });
  }
  return out;
}

function bollinger(candles, period, stdDev) {
  const middle = sma(candles, period);
  const upper = [];
  const lower = [];
  for (let i = period - 1; i < candles.length; i += 1) {
    const slice = candles.slice(i - period + 1, i + 1);
    const mean = middle[i - (period - 1)].value;
    const variance = slice.reduce((acc, c) => acc + (c.close - mean) ** 2, 0) / period;
    const deviation = Math.sqrt(variance);
    upper.push({ time: candles[i].time, value: mean + stdDev * deviation });
    lower.push({ time: candles[i].time, value: mean - stdDev * deviation });
  }
  return { upper, lower };
}

function rsi(candles, period) {
  if (candles.length <= period) {
    return [];
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
  const out = [];
  for (let i = period; i < candles.length; i += 1) {
    const delta = candles[i].close - candles[i - 1].close;
    avgGain = (avgGain * (period - 1) + Math.max(delta, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-delta, 0)) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    out.push(100 - 100 / (1 + rs));
  }
  return out;
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

function calculateScore(candles) {
  const params = { smaPeriod: 20, emaPeriod: 50, bbPeriod: 20, bbStd: 2, rsiPeriod: 14 };
  const last = candles[candles.length - 1];
  const smaData = sma(candles, params.smaPeriod);
  const emaData = ema(candles, params.emaPeriod);
  const bands = bollinger(candles, params.bbPeriod, params.bbStd);
  const rsiData = rsi(candles, params.rsiPeriod);

  let score = 50;
  const latestSma = smaData.length > 0 ? smaData[smaData.length - 1].value : null;
  const latestEma = emaData.length > 0 ? emaData[emaData.length - 1].value : null;
  const latestUpper = bands.upper.length > 0 ? bands.upper[bands.upper.length - 1].value : null;
  const latestLower = bands.lower.length > 0 ? bands.lower[bands.lower.length - 1].value : null;
  const latestRsi = rsiData.length > 0 ? rsiData[rsiData.length - 1] : null;

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

function renderRanking() {
  rankingStatusEl.textContent = "계산 중";
  const ranking = NASDAQ_TOP50.map((ticker) => {
    const candles = generateSeries(ticker, selectedTimeframe);
    const score = calculateScore(candles);
    return { ticker, score };
  }).sort((a, b) => b.score - a.score);

  rankingListEl.innerHTML = "";
  for (const [index, item] of ranking.entries()) {
    const li = document.createElement("li");
    li.textContent = `${index + 1}. ${companyLabel(item.ticker)} - ${item.score}점 (${scoreLabel(item.score)})`;
    rankingListEl.appendChild(li);
  }

  rankingStatusEl.textContent = `완료 (${selectedTimeframe})`;
}

for (const [timeframe, button] of Object.entries(timeframeButtons)) {
  button.addEventListener("click", () => {
    selectedTimeframe = timeframe;
    for (const [key, target] of Object.entries(timeframeButtons)) {
      target.classList.toggle("active", key === timeframe);
    }
  });
}

refreshBtn.addEventListener("click", renderRanking);
renderRanking();
