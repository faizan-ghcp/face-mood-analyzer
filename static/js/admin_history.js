// admin_history.js
// Fetch mood history for admin and render table and chart

document.addEventListener('DOMContentLoaded', function() {
    // Check admin session (JWT in cookie)
    fetch('/admin/check_session', { credentials: 'include' })
        .then(res => {
            if (!res.ok) window.location.href = '/admin/login';
        });

    fetch('/admin/mood_history', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
            window.allMoodData = data;
            renderUserFilter(data);
            renderTable(data);
            renderChart(data);
        });

    document.getElementById('logoutBtn').onclick = function() {
        fetch('/admin/logout', { method: 'POST', credentials: 'include' })
            .then(() => window.location.href = '/admin/login');
    };
});

function renderUserFilter(data) {
    let users = Array.from(new Set(data.map(row => row.username).filter(Boolean)));
    const filterBar = document.createElement('div');
    filterBar.style = 'margin-bottom:10px;';
    filterBar.innerHTML = `<label for="userFilter">Filter by User:</label> <select id="userFilter"><option value="">All Users</option>${users.map(u=>`<option value="${u}">${u}</option>`).join('')}</select>`;
    const container = document.querySelector('.container');
    container.insertBefore(filterBar, document.getElementById('adminSummary'));
    document.getElementById('userFilter').onchange = function() {
        const val = this.value;
        let filtered = val ? window.allMoodData.filter(row => row.username === val) : window.allMoodData;
        renderTable(filtered);
        renderChart(filtered);
    };
}

function renderTable(data) {
    const tbody = document.querySelector('#moodTable tbody');
    tbody.innerHTML = '';
    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding:8px 10px; border:1px solid #d0d7de; text-align:center;">${new Date(row.date).toLocaleString()}</td>
            <td style="padding:8px 10px; border:1px solid #d0d7de; text-align:center;">${row.username || ''}</td>
            <td style="padding:8px 10px; border:1px solid #d0d7de; font-weight:600; color:var(--accent); text-align:center;">${row.mood}</td>
            <td style="padding:8px 10px; border:1px solid #d0d7de; text-align:center;">${row.intensity !== undefined ? row.intensity.toFixed(1) + '%' : ''}</td>
            <td style="padding:8px 10px; border:1px solid #d0d7de; color:#444; text-align:center;">${row.note ? row.note : '<span style=\"color:#bbb;\">—</span>'}</td>
            <td style="padding:8px 10px; border:1px solid #d0d7de; text-align:center;">
                <button onclick="deleteEntry(${row.id})" style="background:#e74c3c;color:#fff;border:none;border-radius:8px;padding:6px 14px;cursor:pointer;">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderChart(data) {
    const ctx = document.getElementById('moodChart').getContext('2d');
    if (!data.length) return;
    // Use up to 50 most recent entries, oldest to newest
    const recent = data.slice(0, 50).reverse();
    const labels = recent.map(e => new Date(e.date).toLocaleString());
    const emotions = Object.keys(recent[0].emotions || {});
    const datasets = emotions.map(em => ({
        label: em,
        data: recent.map(r => r.emotions ? (r.emotions[em] || 0) : 0),
        fill: false,
        tension: 0.2,
        borderColor: getColorForMood(em),
        backgroundColor: getColorForMood(em)
    }));
    if (window.moodChart && typeof window.moodChart.destroy === 'function') window.moodChart.destroy();
    window.moodChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            plugins: { legend: { display: true } },
            scales: { y: { beginAtZero: true, max: 100 } }
        }
    });
}

// Helper: assign a color to each mood
function getColorForMood(mood) {
    const colors = {
        happy: 'rgba(255, 205, 86, 1)',
        sad: 'rgba(54, 162, 235, 1)',
        angry: 'rgba(255, 99, 132, 1)',
        surprise: 'rgba(153, 102, 255, 1)',
        fear: 'rgba(201, 203, 207, 1)',
        disgust: 'rgba(75, 192, 192, 1)',
        neutral: 'rgba(100, 100, 100, 1)'
    };
    return colors[mood] || 'rgba(0,0,0,0.5)';
}

function deleteEntry(id) {
    if (!confirm('Delete this entry?')) return;
    fetch(`/admin/delete_mood/${id}`, { method: 'DELETE', credentials: 'include' })
        .then(res => {
            if (res.ok) location.reload();
            else alert('Delete failed');
        });
}
