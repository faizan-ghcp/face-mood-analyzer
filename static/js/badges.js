// Badges page logic with timestamped history
window.addEventListener('DOMContentLoaded', function() {
  const badgeList = document.getElementById('badgeList');
  // Example badge storage: [{name: 'Mood Explorer', time: '2025-10-23 21:00'}, ...]
  let badges = JSON.parse(localStorage.getItem('badges') || '[]');
  if (!Array.isArray(badges)) badges = [];
  badgeList.innerHTML = badges.length ? badges.map(b =>
    `<div style='margin-bottom:12px;padding:10px 14px;background:gold;border-radius:8px;color:#222;font-weight:600;'>
      🏅 ${b.name} <span style='font-size:0.9em;color:#555;font-weight:400;'>(${b.time})</span>
    </div>`
  ).join('') : '<i>No badges earned yet.</i>';
});