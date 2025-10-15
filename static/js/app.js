const video = document.getElementById('video');
const captureBtn = document.getElementById('captureBtn');
const rescanBtn = document.getElementById('rescanBtn');
const resultDiv = document.getElementById('result');
const dominantSpan = document.getElementById('dominant');
const intensitySpan = document.getElementById('intensity');
const tipsUl = document.getElementById('tips');
const hiddenCanvas = document.getElementById('hiddenCanvas');
const emotionChartCtx = document.getElementById('emotionChart')
  ? document.getElementById('emotionChart').getContext('2d')
  : null;
const saveCheckbox = document.getElementById('saveCheckbox');
const nameInput = document.getElementById('nameInput');
let consentName = null;

let chart = null;

// === CAMERA SETUP ===
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    video.srcObject = stream;
  } catch (err) {
    alert("Camera access is required for this demo: " + err.message);
  }
}

function captureFrame() {
  hiddenCanvas.width = video.videoWidth;
  hiddenCanvas.height = video.videoHeight;
  const ctx = hiddenCanvas.getContext('2d');
  ctx.drawImage(video, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
  return hiddenCanvas.toDataURL('image/png');
}

// === SEND IMAGE TO SERVER ===
async function sendImage(b64) {
  try {
    const res = await fetch('/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: b64 })
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Server returned non-OK status:", res.status, text);
      return { error: `Server error: ${res.status}` };
    }

    const data = await res.json();
    if (data.error) {
      console.warn("Server returned error:", data.error);
    }
    return data;
  } catch (err) {
    console.error("Network or fetch error:", err);
    return { error: err.message || String(err) };
  }
}

// === SAVE SCAN RESULT ===
async function saveScan(result, name) {
  try {
    const avgIntensity =
      Object.values(result.avgIntensities || {}).reduce((a, b) => a + b, 0) /
      (Object.keys(result.avgIntensities || {}).length || 1);

    const payload = {
      dominant_emotion: result.mostFrequent,
      intensity: Math.round(avgIntensity),
      emotions: result.avgIntensities,
      name: name || null
    };

    const res = await fetch('/save_result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Save server returned non-OK status:", res.status, text);
      return { error: `Server error: ${res.status}` };
    }

    const data = await res.json();
    if (data.error) console.warn("Save server returned error:", data.error);
    return data;
  } catch (err) {
    console.warn("Save failed:", err);
    return { error: err.message || String(err) };
  }
}


function drawChart(emotions) {
  if (!emotionChartCtx) return;
  const labels = Object.keys(emotions);
  const data = Object.values(emotions);
  if (chart) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update();
  } else {
    chart = new Chart(emotionChartCtx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Emotion intensity (%)',
          data: data
        }]
      },
      options: {
        scales: { y: { beginAtZero: true, max: 100 } }
      }
    });
  }
}

// === MOOD LOGIC ===
const scanProgress = document.getElementById('scanProgress');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const scanSummary = document.getElementById('scanSummary');
const summaryText = document.getElementById('summaryText');
const summaryChart = document.getElementById('summaryChart');
const closeSummaryBtn = document.getElementById('closeSummaryBtn');
let summaryChartObj = null;

function getSolutionForMood(mood) {
  switch ((mood || '').toLowerCase()) {
    case 'happy': return "Keep doing what you're doing! Share your happiness or write down what made you feel good.";
    case 'sad': return "Try journaling your thoughts, connect with a friend, or take a short walk. If sadness persists, consider talking to a professional.";
    case 'angry': return "Pause and take deep breaths, step away from the trigger, or try muscle relaxation.";
    case 'surprise': return "Take a moment to process it. Celebrate if it's positive; breathe and assess calmly if not.";
    case 'fear': return "Try grounding techniques, slow breathing, and remind yourself you’re safe.";
    case 'disgust': return "Shift your attention to something pleasant, or reframe the thought causing disgust.";
    case 'neutral':
    default: return "You're feeling neutral. Try a small enjoyable activity.";
  }
}

function aggregateResults(results) {
  const emotionCounts = {};
  const emotionSums = {};
  let n = results.length;
  results.forEach(r => {
    if (!r || !r.dominant_emotion) return;
    emotionCounts[r.dominant_emotion] = (emotionCounts[r.dominant_emotion] || 0) + 1;
    for (const [emo, val] of Object.entries(r.emotions || {})) {
      emotionSums[emo] = (emotionSums[emo] || 0) + Number(val);
    }
  });
  let top = null, topCount = 0;
  for (const [emo, count] of Object.entries(emotionCounts)) {
    if (count > topCount) { top = emo; topCount = count; }
  }
  const avgIntensities = {};
  for (const [emo, sum] of Object.entries(emotionSums)) {
    avgIntensities[emo] = Math.round(sum / n);
  }
  const solution = getSolutionForMood(top);
  return { mostFrequent: top, count: topCount, avgIntensities, solution };
}

// === MAIN SCAN HANDLER ===
captureBtn.addEventListener('click', async () => {
  const DURATION = 60;
  const INTERVAL = 5;
  const SAMPLES = Math.floor(DURATION / INTERVAL);
  let results = [];

  captureBtn.disabled = true;
  resultDiv.style.display = 'none';
  scanSummary.style.display = 'none';
  scanProgress.style.display = 'block';
  progressBar.style.width = '0%';
  progressText.textContent = `Scanning... 0/${SAMPLES}`;

  for (let i = 0; i < SAMPLES; ++i) {
    progressBar.style.width = `${Math.round((i/SAMPLES)*100)}%`;
    progressText.textContent = `Scanning... ${i+1}/${SAMPLES}`;
    const b64 = captureFrame();
    try {
      const res = await sendImage(b64);
      if (res && !res.error) results.push(res);
      else console.warn("Analyze error:", res.error);
    } catch (err) {
      console.warn("Network/Fetch error:", err);
    }

    if (i < SAMPLES-1) await new Promise(r => setTimeout(r, INTERVAL*1000));
  }

  progressBar.style.width = '100%';
  progressText.textContent = `Scan complete!`;

  const summary = aggregateResults(results);
  let summaryStr = '';
  if (summary.mostFrequent) {
    summaryStr += `<b>Most frequent mood:</b> ${summary.mostFrequent} (${summary.count} of ${SAMPLES})`;
    summaryStr += `<br><b>What you can do:</b> <span style="color:var(--accent)">${summary.solution}</span>`;
    let refLink = '';
    switch ((summary.mostFrequent || '').toLowerCase()) {
      case 'sad':
        refLink = '<a href="https://www.betterhelp.com/advice/depression/" target="_blank">Visit resources for sadness</a>';
        break;
      case 'neutral':
        refLink = '<a href="https://www.psychologytoday.com/us/basics/wellness" target="_blank">Explore wellness tips</a>';
        break;
      case 'happy':
        refLink = '<a href="https://www.actionforhappiness.org/" target="_blank">Spread happiness</a>';
        break;
      case 'angry':
        refLink = '<a href="https://www.mind.org.uk/information-support/types-of-mental-health-problems/anger/" target="_blank">Anger management resources</a>';
        break;
      case 'fear':
        refLink = '<a href="https://www.anxietycanada.com/" target="_blank">Help for anxiety/fear</a>';
        break;
      case 'disgust':
        refLink = '<a href="https://www.psychologytoday.com/us/basics/emotion/disgust" target="_blank">Understanding disgust</a>';
        break;
      case 'surprise':
        refLink = '<a href="https://www.psychologytoday.com/us/basics/emotion/surprise" target="_blank">Learn about surprise</a>';
        break;
      default:
        refLink = '<a href="https://www.mentalhealth.org.uk/explore-mental-health" target="_blank">General mental health resources</a>';
    }
    summaryStr += `<br><b>Reference:</b> ${refLink}`;
  }
  summaryStr += '<br><b>Average emotion intensities:</b>';
  summaryStr += '<ul>' + Object.entries(summary.avgIntensities).map(([k,v]) => `<li>${k}: ${v}%</li>`).join('') + '</ul>';
  summaryText.innerHTML = summaryStr;

  if (summaryChart) {
    if (summaryChartObj) summaryChartObj.destroy();
    summaryChartObj = new Chart(summaryChart.getContext('2d'), {
      type: 'bar',
      data: {
        labels: Object.keys(summary.avgIntensities),
        datasets: [{ label: 'Avg Intensity (%)', data: Object.values(summary.avgIntensities) }]
      },
      options: { scales: { y: { beginAtZero: true, max: 100 } } }
    });
  }

  scanProgress.style.display = 'none';
  scanSummary.style.display = 'block';
  captureBtn.disabled = false;

  // Auto save if checked
  if (saveCheckbox && saveCheckbox.checked) {
    await saveScan(summary, consentName);
  }
});

closeSummaryBtn && closeSummaryBtn.addEventListener('click', () => {
  scanSummary.style.display = 'none';
});

rescanBtn && rescanBtn.addEventListener('click', () => {
  resultDiv.style.display = 'none';
});

// === THEME SYSTEM ===
const paletteSelect = document.getElementById('paletteSelect');
const themeKey = 'face-mood-theme';

function applyTheme(theme) {
  const body = document.body;
  body.className = (body.className || '').split(' ').filter(c => !c.startsWith('theme-')).join(' ');
  body.classList.add(theme && theme !== 'default' ? `theme-${theme}` : 'theme-default');
}

function saveTheme(theme) {
  try { localStorage.setItem(themeKey, theme); } catch {}
}

function loadTheme() {
  try { return localStorage.getItem(themeKey) || 'default'; } catch { return 'default'; }
}

if (paletteSelect) {
  paletteSelect.value = loadTheme();
  applyTheme(paletteSelect.value);
  paletteSelect.addEventListener('change', e => {
    const theme = paletteSelect.value;
    applyTheme(theme);
    saveTheme(theme);
  });
}

// Camera will be started after questions are answered
