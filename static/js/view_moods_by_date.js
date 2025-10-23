// view_moods_by_date.js
// Loads all mood scans for a given date and displays them with a chart

async function fetchMoodsByDate(dateStr) {
  const jwt = localStorage.getItem('jwt');
  const res = await fetch(`/api/history?date=${encodeURIComponent(dateStr)}`, {
    headers: jwt ? { 'Authorization': 'Bearer ' + jwt } : {}
  });
  const data = await res.json();
  return data && Array.isArray(data.history) ? data.history : [];
}

function renderMoodList(entries) {
  // Sort entries oldest to newest
  const sorted = [...entries].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const tbody = document.querySelector('#moodsByDateTable tbody');
  const noDataMsg = document.getElementById('noDataMsg');
  if (!sorted.length) {
    tbody.innerHTML = '';
    noDataMsg.style.display = '';
    return;
  }
  noDataMsg.style.display = 'none';
  tbody.innerHTML = sorted.map(e =>
    `<tr>
      <td>${new Date(e.timestamp).toLocaleTimeString()}</td>
      <td>${e.dominant}</td>
      <td>${e.intensity}%</td>
      <td>${e.note || ''}</td>
    </tr>`
  ).join('');
}

function renderChart(entries) {
  // Sort entries oldest to newest
  const sorted = [...entries].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const ctx = document.getElementById('moodChart').getContext('2d');
  if (!sorted.length) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    return;
  }
  const labels = sorted.map(e => new Date(e.timestamp).toLocaleTimeString());
  const emotions = Object.keys(sorted[0].emotions || {});
  const datasets = emotions.map(em => ({
    label: em,
    data: sorted.map(r => r.emotions[em] || 0),
    fill: false,
    tension: 0.2
  }));
  if (window.moodChartObj) window.moodChartObj.destroy();
  window.moodChartObj = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      plugins: { legend: { display: true } },
      scales: { y: { beginAtZero: true, max: 100 } }
    }
  });
}

window.addEventListener('DOMContentLoaded', async function() {
  const params = new URLSearchParams(window.location.search);
  let date = params.get('date');
  const dateLabel = document.getElementById('dateLabel');
  const datePicker = document.getElementById('datePicker');
  if (date) {
    dateLabel.textContent = date;
    datePicker.value = date;
  } else {
    // Default to today
    const today = new Date().toISOString().slice(0,10);
    date = today;
    dateLabel.textContent = today;
    datePicker.value = today;
  }
  async function loadForDate(dateStr) {
    dateLabel.textContent = dateStr;
    datePicker.value = dateStr;
    const moods = await fetchMoodsByDate(dateStr);
    renderMoodList(moods);
    renderChart(moods);
  }
  await loadForDate(date);
  datePicker.addEventListener('change', function() {
    const newDate = this.value;
    if (newDate) {
      // Update URL without reload
      const url = new URL(window.location.href);
      url.searchParams.set('date', newDate);
      window.history.replaceState({}, '', url);
      loadForDate(newDate);
    }
  });
});
