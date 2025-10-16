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
    const labels = data.map(row => row.date);
    const moods = data.map(row => row.mood);
    if (window.moodChart) window.moodChart.destroy();
    window.moodChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Mood',
                data: moods,
                borderColor: 'rgba(75, 192, 192, 1)',
                fill: false
            }]
        }
    });
}

function deleteEntry(id) {
    if (!confirm('Delete this entry?')) return;
    fetch(`/admin/delete_mood/${id}`, { method: 'DELETE', credentials: 'include' })
        .then(res => {
            if (res.ok) location.reload();
            else alert('Delete failed');
        });
}
