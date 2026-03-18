// Store user info locally
let currentUser = JSON.parse(localStorage.getItem('bubbly_user')) || null;
let isLoginMode = false;

// --- Initialize Page ---
updateUserUI();
loadPosts();

// Magic Polling! Checks the server every 10 seconds for new updates
setInterval(loadPosts, 10000);

// --- Authentication UI Logic ---
function updateUserUI() {
  const welcomeText = document.getElementById('welcome-text');
  const btnLogin = document.getElementById('btn-show-login');
  const btnLogout = document.getElementById('btn-logout');

  if (currentUser) {
    welcomeText.innerText = `Hello, ${currentUser.username}! ${currentUser.role === 'admin' ? '👑' : '🌟'}`;
    btnLogin.classList.add('hidden');
    btnLogout.classList.remove('hidden');
  } else {
    welcomeText.innerText = `Hello, Guest! 🌟`;
    btnLogin.classList.remove('hidden');
    btnLogout.classList.add('hidden');
  }
}

function openAuthModal() { document.getElementById('auth-modal').classList.remove('hidden'); }
function closeAuthModal() { document.getElementById('auth-modal').classList.add('hidden'); }

function toggleAuthMode() {
  isLoginMode = !isLoginMode;
  document.getElementById('auth-title').innerText = isLoginMode ? "✨ Welcome Back! ✨" : "✨ Join the Magic! ✨";
  document.getElementById('auth-toggle-link').innerText = isLoginMode ? "Need an account? Register!" : "Already a member? Log in!";
  
  if (isLoginMode) {
    document.getElementById('register-fields').classList.add('hidden');
  } else {
    document.getElementById('register-fields').classList.remove('hidden');
  }
}

// --- Authentication API Calls ---
async function submitAuth() {
  const username = document.getElementById('auth-username').value;
  const password = document.getElementById('auth-password').value;
  const email = document.getElementById('auth-email').value;
  const secretCode = document.getElementById('auth-secret').value;

  if (!username || !password) return alert("Username and Password are required! 🛑");

  const endpoint = isLoginMode ? 'api.php?action=login' : 'api.php?action=register';
  const body = isLoginMode ? { username, password } : { username, password, email, secretCode };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  alert(data.message);

  if (res.ok && isLoginMode) {
    currentUser = { username: data.username, role: data.role };
    localStorage.setItem('bubbly_user', JSON.stringify(currentUser));
    updateUserUI();
    closeAuthModal();
    loadPosts(); 
  } else if (res.ok && !isLoginMode) {
    toggleAuthMode(); 
  }
}

async function logoutUser() {
  await fetch('api.php?action=logout', { method: 'POST' });
  currentUser = null;
  localStorage.removeItem('bubbly_user');
  updateUserUI();
  loadPosts();
  alert("Logged out safely! 💨");
}

// --- Blog & Comment Logic ---
async function loadPosts() {
  const feed = document.getElementById('blog-feed');
  if (!feed) return; 

  const isHomePage = document.getElementById('home-feed-indicator') !== null;
  const apiEndpoint = isHomePage ? 'api.php?action=recent_posts' : 'api.php?action=posts';

  const res = await fetch(apiEndpoint);
  const posts = await res.json();
  
  // Only update the screen if the HTML needs it (prevents flickering during polling)
  let newHTML = '';
  posts.forEach(post => {
    let commentsHTML = post.comments.map(c => {
      const deleteBtn = (currentUser && currentUser.role === 'admin') 
        ? `<button class="delete-btn" onclick="deleteComment(${c.id})">Delete</button>` 
        : '';

      return `
      <div class="bubble" style="background-color: ${c.color}">
        ${deleteBtn}
        <strong>${c.username}:</strong> ${c.text}
      </div>`;
    }).join('');

    newHTML += `
    <article class="blog-card">
      <h2>${post.title}</h2>
      <p>${post.content}</p>
      <small>By ${post.author}</small>
      <div class="comment-section">
        <h4>✨ Comments ✨</h4>
        <div id="comments-${post.id}">${commentsHTML}</div>
        <div style="display: flex; gap: 10px; margin-top: 10px;">
          <input type="text" id="comment-text-${post.id}" placeholder="Say something nice...">
          <button onclick="postComment(${post.id})">Post</button>
        </div>
      </div>
    </article>`;
  });
  
  if (feed.innerHTML !== newHTML) {
      feed.innerHTML = newHTML;
  }
}

async function publishPost() {
  if (!currentUser || currentUser.role !== 'admin') return alert("Only admins can post updates! 🛑");
  
  const title = document.getElementById('new-post-title').value;
  const content = document.getElementById('new-post-content').value;
  if (!title || !content) return alert("Don't forget the title and content!");

  const res = await fetch('api.php?action=posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content })
  });

  if (res.ok) {
    document.getElementById('new-post-title').value = '';
    document.getElementById('new-post-content').value = '';
    loadPosts();
  }
}

async function postComment(postId) {
  if (!currentUser) return alert("Please log in to leave a friendly comment! 💖");

  const text = document.getElementById(`comment-text-${postId}`).value;
  if (!text) return;

  await fetch('api.php?action=comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postId, text })
  });
  loadPosts(); 
}

async function deleteComment(commentId) {
  if (!confirm("Are you sure you want to zap this comment? ⚡")) return;
  const res = await fetch(`api.php?action=comments&id=${commentId}`, { method: 'DELETE' });
  if (res.ok) loadPosts();
}