// Store user info locally
let currentUser = JSON.parse(localStorage.getItem('bubbly_user')) || null;
let isLoginMode = false;
let editingPostId = null;

// --- Initialize Page ---
updateUserUI();
loadPosts();
loadThreads();

// Magic Polling! Checks the server every 10 seconds for both feeds
setInterval(() => {
  loadPosts();
  loadThreads();
}, 10000);

// --- Authentication UI Logic ---
function updateUserUI() {
  const welcomeText = document.getElementById('welcome-text');
  const btnLogin = document.getElementById('btn-show-login');
  const btnLogout = document.getElementById('btn-logout');
  const adminThreadBox = document.getElementById('admin-thread-box');

  if (currentUser) {
    welcomeText.innerText = `Hello, ${currentUser.username}! ${currentUser.role === 'admin' ? '👑' : '🌟'}`;
    btnLogin.classList.add('hidden');
    btnLogout.classList.remove('hidden');
    
    // Un-hide the forum thread creation box if admin!
    if (adminThreadBox) {
        if (currentUser.role === 'admin') adminThreadBox.classList.remove('hidden');
        else adminThreadBox.classList.add('hidden');
    }
  } else {
    welcomeText.innerText = `Hello, Guest! 🌟`;
    btnLogin.classList.remove('hidden');
    btnLogout.classList.add('hidden');
    if (adminThreadBox) adminThreadBox.classList.add('hidden');
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
    loadThreads(); 
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
  loadThreads();
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
  
  let newHTML = '';
  posts.forEach(post => {
    let commentsHTML = post.comments.map(c => {
      const deleteBtn = (currentUser && currentUser.role === 'admin') 
        ? `<button class="delete-btn" onclick="deleteComment(${c.id})">Delete</button>` : '';

      return `
      <div class="bubble" style="background-color: ${c.color}">
        ${deleteBtn}
        <strong>${c.username}:</strong> ${c.text}
      </div>`;
    }).join('');

    let adminControls = '';
    const isHidden = post.isHidden || false;
    if (currentUser && currentUser.role === 'admin') {
      const hideBtnText = isHidden ? '👁️ Unhide' : '👻 Hide';
      adminControls = `
      <div style="background: rgba(255,172,209,0.2); padding: 8px; border-radius: 15px; margin-bottom: 10px; display: flex; gap: 10px;">
        <button onclick="editPost(${post.id})" class="tiny-btn">✏️ Edit</button>
        <button onclick="toggleHidePost(${post.id}, ${isHidden})" class="tiny-btn">${hideBtnText}</button>
        <button onclick="deletePost(${post.id})" class="tiny-btn delete-btn" style="float:none;">🗑️ Delete</button>
      </div>`;
    }

    const draftTag = isHidden ? '<span style="color: red;">[DRAFT]</span> ' : '';

    newHTML += `
    <article class="blog-card" id="post-${post.id}">
      ${adminControls}
      <h2 id="title-${post.id}">${draftTag}${post.title}</h2>
      <p id="content-${post.id}">${post.content}</p>
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
  
  if (feed.innerHTML !== newHTML) feed.innerHTML = newHTML;
}

function editPost(postId) {
  const titleText = document.getElementById(`title-${postId}`).innerText.replace('[DRAFT] ', '');
  const contentText = document.getElementById(`content-${postId}`).innerText;
  
  document.getElementById('new-post-title').value = titleText;
  document.getElementById('new-post-content').value = contentText;
  
  editingPostId = postId;
  document.getElementById('publish-btn').innerText = "Update Magic! ✨";
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function toggleHidePost(postId, currentStatus) {
  await fetch('api.php?action=posts', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: postId, isHidden: !currentStatus })
  });
  loadPosts();
}

async function deletePost(postId) {
  if (!confirm("Are you sure you want to zap this post entirely? ⚡")) return;
  await fetch(`api.php?action=posts&id=${postId}`, { method: 'DELETE' });
  loadPosts();
}

async function publishPost() {
  if (!currentUser || currentUser.role !== 'admin') return alert("Only admins can post updates! 🛑");
  
  const title = document.getElementById('new-post-title').value;
  const content = document.getElementById('new-post-content').value;
  if (!title || !content) return alert("Don't forget the title and content!");

  if (editingPostId) {
    await fetch('api.php?action=posts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingPostId, title, content })
    });
    editingPostId = null;
    const pubBtn = document.getElementById('publish-btn');
    if(pubBtn) pubBtn.innerText = "Publish Magic! 🪄";
  } else {
    await fetch('api.php?action=posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content })
    });
  }

  document.getElementById('new-post-title').value = '';
  document.getElementById('new-post-content').value = '';
  loadPosts();
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

// --- NEW: Forum Thread Logic ---
async function loadThreads() {
  const feed = document.getElementById('forum-feed');
  if (!feed) return; 

  const res = await fetch('api.php?action=threads');
  const threads = await res.json();
  
  let newHTML = '';
  threads.forEach(thread => {
    const deleteBtn = (currentUser && currentUser.role === 'admin') 
      ? `<button class="delete-btn" onclick="deleteThread(${thread.id})">🗑️ Delete</button>` : '';

    newHTML += `
    <article class="blog-card" style="border-color: var(--sky-blue);">
      ${deleteBtn}
      <small style="color: var(--accent-pink); font-weight: bold; font-size: 1.1em;">${thread.category}</small>
      <h2 style="margin-top: 5px;">${thread.title}</h2>
      <p>${thread.content}</p>
      <small>Started by ${thread.author}</small>
    </article>`;
  });
  
  if (feed.innerHTML !== newHTML) feed.innerHTML = newHTML;
}

async function createThread() {
  if (!currentUser || currentUser.role !== 'admin') return alert("Only admins can create threads! 🛑");
  
  const category = document.getElementById('new-thread-category').value;
  const title = document.getElementById('new-thread-title').value;
  const content = document.getElementById('new-thread-content').value;
  
  if (!title || !content) return alert("Don't forget the title and content!");

  await fetch('api.php?action=threads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, title, content })
  });

  document.getElementById('new-thread-title').value = '';
  document.getElementById('new-thread-content').value = '';
  loadThreads();
}

async function deleteThread(threadId) {
  if (!confirm("Are you sure you want to delete this entire thread? ⚡")) return;
  await fetch(`api.php?action=threads&id=${threadId}`, { method: 'DELETE' });
  loadThreads();
}