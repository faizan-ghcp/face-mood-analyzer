document.getElementById('signupForm').onsubmit = async function(e) {
  e.preventDefault();
  const username = document.getElementById('signupUsername').value;
  const password = document.getElementById('signupPassword').value;
  const res = await fetch('/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (data.success) {
    document.getElementById('authMsg').textContent = 'Signup successful! Please login.';
  } else {
    document.getElementById('authMsg').textContent = data.error || 'Signup failed';
  }
};

document.getElementById('goLoginBtn').onclick = function() {
  window.location.href = '/login';
};
