// Store user info locally
let currentUser = JSON.parse(localStorage.getItem('bubbly_user')) || null;
let isLoginMode = false;
let editingPostId = null;

// New Forum State Variables
let currentThreadsData = [];
let editingThreadId = null;
let editingReplyId = null;
let currentForumView = 'categories'; 
let currentCategory = null;
let viewingThreadId = null;

// --- Theme Logic ---
function initTheme() {
  const savedTheme = localStorage.getItem('bubbly_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeButton(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('bubbly_theme', newTheme);
  updateThemeButton(newTheme);
}

function updateThemeButton(theme) {
  const themeBtn = document.getElementById('btn-theme');
  if (themeBtn) themeBtn.innerText = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
}

initTheme();

// --- Initialize Page ---
updateUserUI();
loadPosts();
loadThreads();

// Magic Polling! 
setInterval(() => {
  loadPosts();
  const searchInput = document.getElementById('forum-search-input');
  loadThreads(searchInput ? searchInput.value : '');
}, 10000);

// --- Authentication UI Logic ---
function updateUserUI() {
  const welcomeText = document.getElementById('welcome-text');
  const btnLogin = document.getElementById('btn-show-login');
  const btnProfile = document.getElementById('btn-profile');
  const btnLogout = document.getElementById('btn-logout');
  const colorPicker = document.getElementById('profile-color-picker');

  if (currentUser) {
    welcomeText.innerText = `Hello, ${currentUser.username}! ${currentUser.role === 'admin' ? '(Admin)' : ''}`;
    btnLogin.classList.add('hidden');
    btnProfile.classList.remove('hidden');
    btnLogout.classList.remove('hidden');
    if (colorPicker && currentUser.color) colorPicker.value = currentUser.color;
  } else {
    welcomeText.innerText = `Hello, Guest!`;
    btnLogin.classList.remove('hidden');
    btnProfile.classList.add('hidden');
    btnLogout.classList.add('hidden');
  }
}

// Modal Toggles
function openAuthModal() { document.getElementById('auth-modal').classList.remove('hidden'); }
function closeAuthModal() { document.getElementById('auth-modal').classList.add('hidden'); }
function openProfileModal() { document.getElementById('profile-modal').classList.remove('hidden'); }
function closeProfileModal() { document.getElementById('profile-modal').classList.add('hidden'); }

function toggleAuthMode() {
  isLoginMode = !isLoginMode;
  document.getElementById('auth-title').innerText = isLoginMode ? "Welcome Back!" : "Join the Magic!";
  document.getElementById('auth-toggle-link').innerText = isLoginMode ? "Need an account? Register!" : "Already a member? Log in!";
  if (isLoginMode) document.getElementById('register-fields').classList.add('hidden');
  else document.getElementById('register-fields').classList.remove('hidden');
}

// --- Authentication API Calls ---
async function submitAuth() {
  const username = document.getElementById('auth-username').value;
  const password = document.getElementById('auth-password').value;
  const email = document.getElementById('auth-email').value;
  const secretCode = document.getElementById('auth-secret').value;

  if (!username || !password) return alert("Username and Password are required!");

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
    currentUser = { username: data.username, role: data.role, color: data.color || '#FFF380' };
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
  alert("Logged out safely!");
}

async function saveProfileColor() {
  const newColor = document.getElementById('profile-color-picker').value;
  const res = await fetch('api.php?action=users', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ color: newColor })
  });
  if (res.ok) {
    currentUser.color = newColor;
    localStorage.setItem('bubbly_user', JSON.stringify(currentUser));
    closeProfileModal();
    loadPosts();
    loadThreads();
    alert("Profile Color Updated!");
  }
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
      const deleteBtn = (currentUser && currentUser.role === 'admin') ? `<button class="delete-btn" onclick="deleteComment(${c.id})">Delete</button>` : '';
      return `<div class="bubble" style="background-color: ${c.color}">${deleteBtn}<strong>${c.username}:</strong> ${c.text}</div>`;
    }).join('');

    let adminControls = '';
    const isHidden = post.isHidden || false;
    if (currentUser && currentUser.role === 'admin') {
      const hideBtnText = isHidden ? 'Unhide' : 'Hide';
      adminControls = `
      <div style="background: rgba(255,172,209,0.2); padding: 8px; border-radius: 15px; margin-bottom: 10px; display: flex; gap: 10px;">
        <button onclick="editPost(${post.id})" class="tiny-btn">Edit</button>
        <button onclick="toggleHidePost(${post.id}, ${isHidden})" class="tiny-btn">${hideBtnText}</button>
        <button onclick="deletePost(${post.id})" class="tiny-btn delete-btn" style="float:none;">Delete</button>
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
        <h4>Comments</h4>
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
  document.getElementById('publish-btn').innerText = "Update Magic!";
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function toggleHidePost(postId, currentStatus) {
  await fetch('api.php?action=posts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: postId, isHidden: !currentStatus }) });
  loadPosts();
}

async function deletePost(postId) {
  if (!confirm("Are you sure you want to zap this post entirely?")) return;
  await fetch(`api.php?action=posts&id=${postId}`, { method: 'DELETE' });
  loadPosts();
}

async function publishPost() {
  if (!currentUser || currentUser.role !== 'admin') return alert("Only admins can post updates!");
  const title = document.getElementById('new-post-title').value;
  const content = document.getElementById('new-post-content').value;
  if (!title || !content) return alert("Don't forget the title and content!");

  if (editingPostId) {
    await fetch('api.php?action=posts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingPostId, title, content }) });
    editingPostId = null;
    const pubBtn = document.getElementById('publish-btn');
    if(pubBtn) pubBtn.innerText = "Publish Magic!";
  } else {
    await fetch('api.php?action=posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content }) });
  }
  document.getElementById('new-post-title').value = '';
  document.getElementById('new-post-content').value = '';
  loadPosts();
}

async function postComment(postId) {
  if (!currentUser) return alert("Please log in to leave a friendly comment!");
  const text = document.getElementById(`comment-text-${postId}`).value;
  if (!text) return;
  await fetch('api.php?action=comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId, text }) });
  loadPosts(); 
}

async function deleteComment(commentId) {
  if (!confirm("Are you sure you want to zap this comment?")) return;
  await fetch(`api.php?action=comments&id=${commentId}`, { method: 'DELETE' });
  loadPosts();
}

// --- NEW: Forum SPA Navigation & Logic ---
function showForumHome() {
  currentForumView = 'categories';
  currentCategory = null;
  viewingThreadId = null;
  document.getElementById('forum-search-input').value = '';
  loadThreads();
}

function showCategory(category) {
  currentForumView = 'subforum';
  currentCategory = category;
  viewingThreadId = null;
  document.getElementById('forum-search-input').value = '';
  document.getElementById('new-thread-category').value = category; // Pre-lock the category
  loadThreads();
}

function showThreadView(threadId) {
  currentForumView = 'thread';
  viewingThreadId = threadId;
  loadThreads();
}

function handleForumSearch() {
  const query = document.getElementById('forum-search-input').value;
  loadThreads(query);
}

// Render the list of threads in a subforum
function renderThreadList(threadArray, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  if (threadArray.length === 0) {
      container.innerHTML = '<p style="text-align: center; font-weight: bold; font-size: 1.2em;">No threads yet! Be the first to post!</p>';
      return;
  }
  
  let html = '';
  threadArray.forEach(thread => {
      const replyCount = thread.replies ? thread.replies.length : 0;
      html += `
      <div class="forum-category" onclick="showThreadView(${thread.id})" style="justify-content: space-between; cursor: pointer; border-color: var(--sky-blue);">
          <div class="category-info">
              <h3 style="margin-bottom: 5px; color: var(--accent-pink);">${thread.title}</h3>
              <p style="font-size: 0.85em;">Started by ${thread.author} in ${thread.category}</p>
          </div>
          <div class="category-stats">${replyCount} Replies</div>
      </div>`;
  });
  container.innerHTML = html;
}

// Render a specific thread and its replies
function renderSingleThread(thread, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  let repliesHTML = thread.replies.map(r => {
    const canEditReply = currentUser && (currentUser.role === 'admin' || currentUser.username === r.username);
    const replyControls = canEditReply ? `
      <button class="delete-btn" onclick="deleteThreadReply(${r.id})" style="margin-left: 5px;">Delete</button>
      <button class="delete-btn" onclick="editThreadReply(${r.id}, ${thread.id}, '${r.text.replace(/'/g, "\\'")}')" style="background-color: var(--sky-blue); color: #555;">Edit</button>
    ` : '';
    return `<div class="bubble" style="background-color: ${r.color}">${replyControls}<strong>${r.username}:</strong> ${r.text}</div>`;
  }).join('');

  const canEditThread = currentUser && (currentUser.role === 'admin' || currentUser.username === thread.author);
  const threadControls = canEditThread ? `
    <div style="float: right;">
      <button class="tiny-btn" onclick="editThread(${thread.id})">Edit Thread</button>
      <button class="tiny-btn delete-btn" onclick="deleteThread(${thread.id})" style="float: none;">Delete</button>
    </div>
  ` : '';

  container.innerHTML = `
  <article class="blog-card" style="border-color: var(--sky-blue);">
    ${threadControls}
    <small style="color: var(--accent-pink); font-weight: bold; font-size: 1.1em;">${thread.category}</small>
    <h2 style="margin-top: 5px;">${thread.title}</h2>
    <p>${thread.content}</p>
    <small>Started by ${thread.author}</small>
    
    <div class="comment-section">
      <h4>Replies</h4>
      <div id="thread-replies-${thread.id}">${repliesHTML}</div>
      <div style="display: flex; gap: 10px; margin-top: 10px;">
        <input type="text" id="thread-reply-text-${thread.id}" placeholder="Join the conversation...">
        <button id="thread-reply-btn-${thread.id}" onclick="postThreadReply(${thread.id})">Reply</button>
      </div>
    </div>
  </article>`;
}

async function loadThreads(searchQuery = '') {
  const catView = document.getElementById('forum-categories-view');
  const subView = document.getElementById('forum-threads-view');
  const threadView = document.getElementById('forum-single-thread-view');
  const recentBox = document.getElementById('recent-threads-list');
  
  if (!catView) return; // Exit if not on the forums page

  const res = await fetch('api.php?action=threads');
  let threads = await res.json();
  currentThreadsData = threads; 
  
  // Populate the Sidebar
  if (recentBox) {
    let recentHTML = '';
    const top5 = threads.slice(0, 5);
    if (top5.length === 0) recentHTML = '<p>No threads yet!</p>';
    top5.forEach(t => {
      recentHTML += `
      <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 2px dashed var(--sky-blue);">
        <a href="#" onclick="showThreadView(${t.id}); return false;" style="text-decoration: none; color: var(--dark-text); font-weight: bold; font-size: 1.1em;">${t.title}</a>
        <br><small style="color: var(--accent-pink);">By ${t.author}</small>
      </div>`;
    });
    recentBox.innerHTML = recentHTML;
  }

  // Handle Search View Overlay
  if (searchQuery) {
    catView.classList.add('hidden');
    subView.classList.remove('hidden');
    threadView.classList.add('hidden');
    
    document.getElementById('subforum-title').innerText = "Search Results";
    document.getElementById('thread-creation-box').classList.add('hidden');
    document.getElementById('back-to-subforum-btn').onclick = showForumHome;
    
    const lowerQ = searchQuery.toLowerCase();
    const filtered = threads.filter(t => t.title.toLowerCase().includes(lowerQ) || t.content.toLowerCase().includes(lowerQ) || t.category.toLowerCase().includes(lowerQ));
    renderThreadList(filtered, 'subforum-feed');
    return;
  }

  // Handle Standard Routing
  if (currentForumView === 'categories') {
    catView.classList.remove('hidden');
    subView.classList.add('hidden');
    threadView.classList.add('hidden');
    
    // Update category numbers dynamically
    const counts = {};
    threads.forEach(t => counts[t.category] = (counts[t.category] || 0) + 1);
    document.querySelectorAll('.forum-category').forEach(el => {
        const catName = el.getAttribute('data-category');
        const statEl = el.querySelector('.category-stats');
        if (statEl && catName) statEl.innerText = (counts[catName] || 0) + " Topics";
    });

  } else if (currentForumView === 'subforum') {
    catView.classList.add('hidden');
    subView.classList.remove('hidden');
    threadView.classList.add('hidden');
    
    document.getElementById('subforum-title').innerText = currentCategory;
    
    if (currentUser) document.getElementById('thread-creation-box').classList.remove('hidden');
    else document.getElementById('thread-creation-box').classList.add('hidden');
    
    const filtered = threads.filter(t => t.category === currentCategory);
    renderThreadList(filtered, 'subforum-feed');

  } else if (currentForumView === 'thread') {
    catView.classList.add('hidden');
    subView.classList.add('hidden');
    threadView.classList.remove('hidden');
    
    const thread = threads.find(t => t.id === viewingThreadId);
    if (thread) {
        currentCategory = thread.category; // Ensure back button knows where to go
        document.getElementById('back-to-subforum-btn').onclick = () => showCategory(currentCategory);
        renderSingleThread(thread, 'single-thread-content');
    } else {
        showForumHome(); // Failsafe if thread was deleted
    }
  }
}

function editThread(threadId) {
  const t = currentThreadsData.find(x => x.id === threadId);
  if (!t) return;
  
  // Jump back to the subforum view to show the editor box
  showCategory(t.category); 
  
  document.getElementById('new-thread-title').value = t.title;
  document.getElementById('new-thread-content').value = t.content;
  
  editingThreadId = threadId;
  document.getElementById('thread-submit-btn').innerText = "Update Thread!";
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function createThread() {
  if (!currentUser) return alert("Please log in to participate!");
  const category = document.getElementById('new-thread-category').value;
  const title = document.getElementById('new-thread-title').value;
  const content = document.getElementById('new-thread-content').value;
  if (!title || !content) return alert("Don't forget the title and content!");

  if (editingThreadId) {
    await fetch('api.php?action=threads', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingThreadId, category, title, content }) });
    editingThreadId = null;
    const btn = document.getElementById('thread-submit-btn');
    if(btn) btn.innerText = "Post Thread!";
  } else {
    await fetch('api.php?action=threads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category, title, content }) });
  }

  document.getElementById('new-thread-title').value = '';
  document.getElementById('new-thread-content').value = '';
  
  const searchBox = document.getElementById('forum-search-input');
  if(searchBox) searchBox.value = ''; // Clear search when posting
  loadThreads();
}

async function deleteThread(threadId) {
  if (!confirm("Are you sure you want to delete this entire thread?")) return;
  await fetch(`api.php?action=threads&id=${threadId}`, { method: 'DELETE' });
  showForumHome(); // Kick back to categories safely
}

function editThreadReply(replyId, threadId, currentText) {
  document.getElementById(`thread-reply-text-${threadId}`).value = currentText;
  document.getElementById(`thread-reply-btn-${threadId}`).innerText = 'Update';
  editingReplyId = replyId;
}

async function postThreadReply(threadId) {
  if (!currentUser) return alert("Please log in to reply!");
  const text = document.getElementById(`thread-reply-text-${threadId}`).value;
  if (!text) return;

  if (editingReplyId) {
      await fetch('api.php?action=thread_replies', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingReplyId, text }) });
      editingReplyId = null;
  } else {
      await fetch('api.php?action=thread_replies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ threadId, text }) });
  }

  const query = document.getElementById('forum-search-input') ? document.getElementById('forum-search-input').value : '';
  loadThreads(query); 
}

async function deleteThreadReply(replyId) {
  if (!confirm("Are you sure you want to zap this reply?")) return;
  await fetch(`api.php?action=thread_replies&id=${replyId}`, { method: 'DELETE' });
  const query = document.getElementById('forum-search-input') ? document.getElementById('forum-search-input').value : '';
  loadThreads(query);
}