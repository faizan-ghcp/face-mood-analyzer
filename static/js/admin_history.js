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
            renderTable(data);
            renderChart(data);
        });

    document.getElementById('logoutBtn').onclick = function() {
        fetch('/admin/logout', { method: 'POST', credentials: 'include' })
            .then(() => window.location.href = '/admin/login');
    };
});

function renderTable(data) {
    const tbody = document.querySelector('#moodTable tbody');
    tbody.innerHTML = '';
    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.id}</td>
            <td>${row.username}</td>
            <td>${row.mood}</td>
            <td>${row.date}</td>
            <td><button onclick="deleteEntry(${row.id})">Delete</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function renderChart(data) {
    const ctx = document.getElementById('moodChart').getContext('2d');
    if (!data.length) return;
    // Get all unique moods
    const moods = Array.from(new Set(data.map(row => row.mood)));
    // Prepare datasets: one line per mood, y = intensity
    const datasets = moods.map(mood => ({
        label: mood,
        data: data.map(row => row.mood === mood ? row.intensity : null),
        borderColor: getColorForMood(mood),
        fill: false,
        spanGaps: true
    }));
    const labels = data.map(row => row.date);
    if (window.moodChart) window.moodChart.destroy();
    window.moodChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
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
