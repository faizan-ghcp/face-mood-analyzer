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
  const DURATION = 10;
  const INTERVAL = 1;
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
    // Prominent 'What you can do' section
    summaryStr += `<div id="whatYouCanDo" style="margin:18px 0; padding:18px 22px; background:#eaf6ff; border-radius:14px; box-shadow:0 2px 8px #4f8cff22; font-size:1.25em; font-weight:600; color:var(--accent); text-align:center;">
      <span style="font-size:1.15em;">What you can do:</span><br>
      <span style="display:inline-block; margin-top:8px;">${summary.solution}</span>
    </div>`;
    // Cache the last suggestion for quick access
    try { localStorage.setItem('lastSuggestion', summary.solution); } catch {}
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

  // Wellness Resources Section
  const wellnessSection = document.getElementById('wellnessResources');
  const wellnessContent = document.getElementById('wellnessContent');
  if (wellnessSection && wellnessContent) {
    let resourcesHtml = '';
    switch ((summary.mostFrequent || '').toLowerCase()) {
      case 'sad':
        resourcesHtml = `
          <b>Feeling Sad?</b><br>
          <ul>
            <li><a href="https://www.betterhelp.com/advice/depression/" target="_blank">Professional help for sadness</a></li>
            <li><a href="https://www.mind.org.uk/information-support/types-of-mental-health-problems/depression/" target="_blank">Mind: Depression resources</a></li>
            <li><a href="https://www.psychologytoday.com/us/basics/depression" target="_blank">Psychology Today: Understanding Depression</a></li>
          </ul>`;
        break;
      case 'neutral':
        resourcesHtml = `
          <b>Feeling Neutral?</b><br>
          <ul>
            <li><a href="https://fourwellness.co/blog/31-simple-wellness-tips-for-healthy-and-happy-livings" target="_blank">Wellness tips</a></li>
            <li><a href="https://www.verywellmind.com/wellness-4157210" target="_blank">Verywell Mind: Wellness</a></li>
            <li><a href="https://www.actionforhappiness.org/" target="_blank">Action for Happiness</a></li>
          </ul>`;
        break;
      case 'happy':
        resourcesHtml = `
          <b>Feeling Happy?</b><br>
          <ul>
            <li><a href="https://www.actionforhappiness.org/" target="_blank">Spread happiness</a></li>
            <li><a href="https://www.psychologytoday.com/us/basics/happiness" target="_blank">Psychology Today: Happiness</a></li>
            <li><a href="https://www.ted.com/topics/happiness" target="_blank">TED Talks: Happiness</a></li>
          </ul>`;
        break;
      case 'angry':
        resourcesHtml = `
          <b>Feeling Angry?</b><br>
          <ul>
            <li><a href="https://www.mind.org.uk/information-support/types-of-mental-health-problems/anger/" target="_blank">Anger management resources</a></li>
            <li><a href="https://www.psychologytoday.com/us/basics/anger" target="_blank">Psychology Today: Anger</a></li>
            <li><a href="https://www.healthline.com/health/mental-health/how-to-control-anger" target="_blank">Healthline: How to Control Anger</a></li>
          </ul>`;
        break;
      case 'fear':
        resourcesHtml = `
          <b>Feeling Fearful or Anxious?</b><br>
          <ul>
            <li><a href="https://www.anxietycanada.com/" target="_blank">Help for anxiety/fear</a></li>
            <li><a href="https://www.psychologytoday.com/us/basics/anxiety" target="_blank">Psychology Today: Anxiety</a></li>
            <li><a href="https://www.mind.org.uk/information-support/types-of-mental-health-problems/anxiety-and-panic-attacks/" target="_blank">Mind: Anxiety & Panic Attacks</a></li>
          </ul>`;
        break;
      case 'disgust':
        resourcesHtml = `
          <b>Feeling Disgust?</b><br>
          <ul>
            <li><a href="https://www.paulekman.com/universal-emotions/what-is-disgust/" target="_blank">Understanding Disgust</a></li>
            <li><a href="https://www.verywellmind.com/what-is-disgust-2795412" target="_blank">Verywell Mind: Disgust</a></li>
          </ul>`;
        break;
      case 'surprise':
        resourcesHtml = `
          <b>Feeling Surprised?</b><br>
          <ul>
            <li><a href="https://www.paulekman.com/universal-emotions/what-is-surprise/" target="_blank">Learn about Surprise</a></li>
            <li><a href="https://www.paulekman.com/universal-emotions/what-is-surprise/" target="_blank">Verywell Mind: Surprise</a></li>
          </ul>`;
        break;
      default:
        resourcesHtml = `
          <b>General Wellness Resources</b><br>
          <ul>
            <li><a href="https://www.mentalhealth.org.uk/explore-mental-health" target="_blank">Mental Health Foundation</a></li>
            <li><a href="https://www.psychologytoday.com/us/basics/wellness" target="_blank">Psychology Today: Wellness</a></li>
          </ul>`;
    }
    wellnessContent.innerHTML = resourcesHtml;
    wellnessSection.style.display = '';
  }

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
  // Show Music Help section after scan
  var musicHelp = document.getElementById('musicHelp');
  if (musicHelp) musicHelp.style.display = '';
  captureBtn.disabled = false;

  // Show note section and handle note saving BEFORE summary report
  const noteSection = document.getElementById('noteSection');
  const noteInput = document.getElementById('noteInput');
  const saveNoteBtn = document.getElementById('saveNoteBtn');
  const noteStatus = document.getElementById('noteStatus');
  if (noteSection && noteInput && saveNoteBtn && noteStatus) {
    noteInput.value = '';
    noteStatus.textContent = '';
    noteSection.style.display = '';
    scanSummary.style.display = 'none';
    saveNoteBtn.disabled = false;
    saveNoteBtn.onclick = async function() {
      saveNoteBtn.disabled = true;
      noteStatus.textContent = 'Saving...';
      const note = noteInput.value.trim();
      // Save scan with note (only after note is submitted)
      const payload = {
        dominant_emotion: summary.mostFrequent,
        intensity: Math.round(Object.values(summary.avgIntensities || {}).reduce((a,b)=>a+b,0)/(Object.keys(summary.avgIntensities||{}).length||1)),
        emotions: summary.avgIntensities,
        name: consentName || null,
        note: note || null
      };
      try {
        const res = await fetch('/save_result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.status === 'ok') {
          noteStatus.textContent = 'Note saved!';
          if (typeof window.earnBadgeForNote === 'function') {
            window.earnBadgeForNote();
          }
          // After saving note, hide note section and show summary report
          noteSection.style.display = 'none';
          scanSummary.style.display = 'block';
        } else {
          noteStatus.textContent = data.error || 'Save failed';
        }
      } catch (err) {
        noteStatus.textContent = 'Error saving note';
      }
      setTimeout(()=>{noteStatus.textContent='';}, 3000);
      saveNoteBtn.disabled = false;
    };
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
// (already declared above)

function showQuestion(idx) {
  const card = document.getElementById('questionCard');
  const qText = document.getElementById('questionText');
  const optBtns = document.getElementById('optionButtons');
  const nextBtn = document.getElementById('nextQuestionBtn');
  const qProgress = document.getElementById('questionProgress');
  if (idx >= questions.length) {
    card.style.display = 'none';
    document.getElementById('camera').style.display = '';
    if (window.startCamera) window.startCamera();
    return;
  }
  const q = questions[idx];
  qProgress.textContent = `Question ${idx+1} of ${questions.length}`;
  qText.textContent = q.question;
  optBtns.innerHTML = '';
  nextBtn.style.display = 'none';
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.textContent = opt;
    btn.style.background = q.colors[i] || '#eee';
    btn.style.color = '#222';
    btn.style.margin = '6px';
    btn.style.padding = '10px 18px';
    btn.style.border = 'none';
    btn.style.borderRadius = '8px';
    btn.style.cursor = 'pointer';
    btn.onclick = () => {
      answers[idx] = opt;
      Array.from(optBtns.children).forEach(b => b.disabled = false);
      btn.disabled = true;
      // Go to next question after 1 second
      setTimeout(() => {
        showQuestion(++currentQuestion);
      }, 1000);
    };
    optBtns.appendChild(btn);
  });
}
