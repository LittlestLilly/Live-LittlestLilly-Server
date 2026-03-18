require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs').promises;
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(cookieParser()); // This lets the server read the secure ID badges
app.use(express.static(path.join(__dirname, 'public')));

// File paths
const postsFile = path.join(__dirname, 'data', 'posts.json');
const commentsFile = path.join(__dirname, 'data', 'comments.json');
const usersFile = path.join(__dirname, 'data', 'users.json');

// The secret key used to stamp the digital ID badges (JWTs)
const SECRET_KEY = process.env.JWT_SECRET;

// --- Helper Functions ---
async function readData(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) { return []; }
}
async function writeData(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// --- Security Middleware ---
// 1. Checks if a user has a valid login cookie
const requireLogin = (req, res, next) => {
  const token = req.cookies.auth_token;
  if (!token) return res.status(401).json({ message: "Please log in first! 🛑" });

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded; // Attaches the user's info to the request
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid or expired session. 🛑" });
  }
};

// 2. Checks if the logged-in user is an Admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: "Only admins can use this magic! 🪄" });
  }
  next();
};

// --- Authentication Routes ---
// Register a new account
app.post('/api/register', async (req, res) => {
  const { username, password, email, secretCode } = req.body;
  const users = await readData(usersFile);

  // Check if username already exists
  if (users.find(u => u.username === username)) {
    return res.status(400).json({ message: "Username taken! Try another. 👯" });
  }

  // Hash the password for safety
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // Create the user. If they know the secret code, make them an Admin!
  const newUser = {
    id: Date.now(),
    username,
    email,
    password: hashedPassword,
    role: secretCode === process.env.ADMIN_SECRET_CODE ? "admin" : "user",
    color: "#FFF380" // Default bubbly color
  };

  users.push(newUser);
  await writeData(usersFile, users);
  res.status(201).json({ message: "Account created! Welcome! 🎉" });
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const users = await readData(usersFile);
  const user = users.find(u => u.username === username);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: "Incorrect username or password. 🕵️‍♀️" });
  }

  // Create a secure token (digital badge) that expires in 24 hours
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, color: user.color }, 
    SECRET_KEY, 
    { expiresIn: '24h' }
  );

  // Send the badge to the user's browser as an invisible, secure cookie
  res.cookie('auth_token', token, { httpOnly: true });
  res.json({ message: "Logged in successfully! 🌟", role: user.role, username: user.username });
});

// Logout
app.post('/api/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ message: "Logged out. See you next time! 👋" });
});

// --- Blog Data Routes ---
app.get('/api/posts', async (req, res) => { /* ... Keep your existing GET /api/posts code ... */ 
  const posts = await readData(postsFile);
  const comments = await readData(commentsFile);
  const feed = [...posts].reverse().map(post => ({
    ...post,
    comments: comments.filter(c => c.postId === post.id)
  }));
  res.json(feed);
});

app.get('/api/posts/recent', async (req, res) => { /* ... Keep your existing GET /api/posts/recent code ... */ 
  const posts = await readData(postsFile);
  const comments = await readData(commentsFile);
  const recentPosts = [...posts].reverse().slice(0, 5);
  const feed = recentPosts.map(post => ({
    ...post,
    comments: comments.filter(c => c.postId === post.id)
  }));
  res.json(feed);
});

// Create Post (Protected by requireAdmin)
app.post('/api/posts', requireLogin, requireAdmin, async (req, res) => {
  const posts = await readData(postsFile);
  const newPost = { id: Date.now(), title: req.body.title, content: req.body.content, author: req.user.username };
  posts.push(newPost);
  await writeData(postsFile, posts);
  io.emit('new_update', newPost);
  res.status(201).json(newPost);
});

// Create Comment (Protected by requireLogin)
app.post('/api/comments', requireLogin, async (req, res) => {
  const comments = await readData(commentsFile);
  const newComment = {
    id: Date.now(),
    postId: parseInt(req.body.postId),
    username: req.user.username, // Pulled securely from their login badge!
    text: req.body.text,
    color: req.user.color
  };
  comments.push(newComment);
  await writeData(commentsFile, comments);
  res.status(201).json(newComment);
});

// Delete Comment (Protected by requireAdmin)
app.delete('/api/comments/:id', requireLogin, requireAdmin, async (req, res) => {
  let comments = await readData(commentsFile);
  const commentIdToDelete = parseInt(req.params.id);
  
  // Filter out the comment we want to delete
  comments = comments.filter(c => c.id !== commentIdToDelete);
  await writeData(commentsFile, comments);
  
  res.json({ message: "Comment vanished! 💨" });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✨ Server running at http://localhost:${PORT} ✨`);
});