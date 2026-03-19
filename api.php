<?php
// Start a secure session to remember who is logged in
session_start();
header('Content-Type: application/json');

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// File Paths
$postsFile = __DIR__ . '/data/posts.json';
$commentsFile = __DIR__ . '/data/comments.json';
$usersFile = __DIR__ . '/data/users.json';
$threadsFile = __DIR__ . '/data/threads.json'; 
$threadRepliesFile = __DIR__ . '/data/thread_replies.json'; 
$envFile = __DIR__ . '/.env';

// Helper to read JSON files
function readData($filePath) {
    if (!file_exists($filePath)) return [];
    return json_decode(file_get_contents($filePath), true) ?: [];
}

// Helper to write JSON files
function writeData($filePath, $data) {
    file_put_contents($filePath, json_encode($data, JSON_PRETTY_PRINT));
}

// Helper to read the .env file for your secret code
function getAdminSecret() {
    global $envFile;
    if (!file_exists($envFile)) return 'LillyIsTheBoss'; 
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        list($name, $value) = explode('=', $line, 2);
        if (trim($name) === 'ADMIN_SECRET_CODE') return trim($value);
    }
    return 'LillyIsTheBoss';
}

$input = json_decode(file_get_contents('php://input'), true);

// --- 1. Authentication & Users ---
if ($action === 'register' && $method === 'POST') {
    $users = readData($usersFile);
    foreach ($users as $u) {
        if ($u['username'] === $input['username']) {
            http_response_code(400); echo json_encode(["message" => "Username taken! Try another."]); exit;
        }
    }
    
    $newUser = [
        "id" => time(),
        "username" => $input['username'],
        "password" => password_hash($input['password'], PASSWORD_DEFAULT),
        "role" => ($input['secretCode'] ?? '') === getAdminSecret() ? "admin" : "user",
        "color" => "#FFF380"
    ];
    
    $users[] = $newUser;
    writeData($usersFile, $users);
    http_response_code(201); echo json_encode(["message" => "Account created! Welcome!"]); exit;
}

if ($action === 'login' && $method === 'POST') {
    $users = readData($usersFile);
    foreach ($users as $user) {
        if ($user['username'] === $input['username'] && password_verify($input['password'], $user['password'])) {
            $_SESSION['user'] = [
                "id" => $user['id'], "username" => $user['username'], 
                "role" => $user['role'], "color" => $user['color']
            ];
            echo json_encode(["message" => "Logged in successfully!", "role" => $user['role'], "username" => $user['username'], "color" => $user['color']]);
            exit;
        }
    }
    http_response_code(401); echo json_encode(["message" => "Incorrect username or password."]); exit;
}

if ($action === 'logout' && $method === 'POST') {
    session_destroy(); echo json_encode(["message" => "Logged out. See you next time!"]); exit;
}

if ($action === 'users' && $method === 'PUT') {
    if (!isset($_SESSION['user'])) { http_response_code(401); exit; }
    $users = readData($usersFile);
    $newColor = $input['color'];
    
    foreach ($users as &$u) {
        if ($u['username'] === $_SESSION['user']['username']) {
            $u['color'] = $newColor;
            $_SESSION['user']['color'] = $newColor;
            break;
        }
    }
    writeData($usersFile, $users);
    
    $comments = readData($commentsFile);
    foreach ($comments as &$c) { if ($c['username'] === $_SESSION['user']['username']) $c['color'] = $newColor; }
    writeData($commentsFile, $comments);

    $replies = readData($threadRepliesFile);
    foreach ($replies as &$r) { if ($r['username'] === $_SESSION['user']['username']) $r['color'] = $newColor; }
    writeData($threadRepliesFile, $replies);

    echo json_encode(["message" => "Color updated!", "color" => $newColor]); exit;
}

// --- 2. Blog Data ---
if ($action === 'posts' && $method === 'GET') {
    $posts = readData($postsFile);
    $comments = readData($commentsFile);
    $feed = [];
    $isAdmin = isset($_SESSION['user']) && $_SESSION['user']['role'] === 'admin';
    
    foreach (array_reverse($posts) as $post) {
        if (isset($post['isHidden']) && $post['isHidden'] && !$isAdmin) continue;
        $post['comments'] = array_values(array_filter($comments, function($c) use ($post) { return $c['postId'] == $post['id']; }));
        $feed[] = $post;
    }
    echo json_encode($feed); exit;
}

if ($action === 'recent_posts' && $method === 'GET') {
    $posts = readData($postsFile);
    $comments = readData($commentsFile);
    $feed = [];
    $isAdmin = isset($_SESSION['user']) && $_SESSION['user']['role'] === 'admin';
    
    $visiblePosts = array_filter(array_reverse($posts), function($post) use ($isAdmin) {
        return !(isset($post['isHidden']) && $post['isHidden'] && !$isAdmin);
    });
    $recent = array_slice($visiblePosts, 0, 5);
    
    foreach ($recent as $post) {
        $post['comments'] = array_values(array_filter($comments, function($c) use ($post) { return $c['postId'] == $post['id']; }));
        $feed[] = $post;
    }
    echo json_encode($feed); exit;
}

if ($action === 'posts' && $method === 'POST') {
    if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'admin') { http_response_code(403); exit; }
    $posts = readData($postsFile);
    $newPost = [ "id" => time(), "title" => $input['title'], "content" => $input['content'], "author" => $_SESSION['user']['username'], "isHidden" => false ];
    $posts[] = $newPost;
    writeData($postsFile, $posts);
    http_response_code(201); echo json_encode($newPost); exit;
}

if ($action === 'posts' && $method === 'PUT') {
    if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'admin') { http_response_code(403); exit; }
    $posts = readData($postsFile);
    $postId = (int)$input['id'];
    foreach ($posts as &$post) {
        if ($post['id'] === $postId) {
            if (isset($input['title'])) $post['title'] = $input['title'];
            if (isset($input['content'])) $post['content'] = $input['content'];
            if (isset($input['isHidden'])) $post['isHidden'] = $input['isHidden'];
            break;
        }
    }
    writeData($postsFile, $posts); echo json_encode(["message" => "Post updated!"]); exit;
}

if ($action === 'posts' && $method === 'DELETE') {
    if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'admin') { http_response_code(403); exit; }
    $posts = readData($postsFile);
    $idToDelete = (int)$_GET['id'];
    $posts = array_values(array_filter($posts, function($p) use ($idToDelete) { return $p['id'] !== $idToDelete; }));
    writeData($postsFile, $posts);
    
    $comments = readData($commentsFile);
    $comments = array_values(array_filter($comments, function($c) use ($idToDelete) { return $c['postId'] !== $idToDelete; }));
    writeData($commentsFile, $comments);
    echo json_encode(["message" => "Post vanished!"]); exit;
}

if ($action === 'comments' && $method === 'POST') {
    if (!isset($_SESSION['user'])) { http_response_code(401); exit; }
    $comments = readData($commentsFile);
    $newComment = [
        "id" => time(), "postId" => (int)$input['postId'], 
        "username" => $_SESSION['user']['username'], "text" => $input['text'], "color" => $_SESSION['user']['color']
    ];
    $comments[] = $newComment;
    writeData($commentsFile, $comments); http_response_code(201); echo json_encode($newComment); exit;
}

if ($action === 'comments' && $method === 'DELETE') {
    if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'admin') { http_response_code(403); exit; }
    $comments = readData($commentsFile);
    $idToDelete = (int)$_GET['id'];
    $comments = array_values(array_filter($comments, function($c) use ($idToDelete) { return $c['id'] !== $idToDelete; }));
    writeData($commentsFile, $comments); echo json_encode(["message" => "Comment vanished!"]); exit;
}

// --- 3. Forum Data (UPDATED FOR USERS) ---
if ($action === 'threads' && $method === 'GET') {
    $threads = readData($threadsFile);
    $replies = readData($threadRepliesFile);
    $feed = [];
    
    foreach (array_reverse($threads) as $thread) {
        $thread['replies'] = array_values(array_filter($replies, function($r) use ($thread) { return $r['threadId'] == $thread['id']; }));
        $feed[] = $thread;
    }
    echo json_encode($feed); exit;
}

// Any logged in user can now POST a thread
if ($action === 'threads' && $method === 'POST') {
    if (!isset($_SESSION['user'])) { http_response_code(401); exit; }
    $threads = readData($threadsFile);
    $newThread = [ "id" => time(), "category" => $input['category'], "title" => $input['title'], "content" => $input['content'], "author" => $_SESSION['user']['username'] ];
    $threads[] = $newThread;
    writeData($threadsFile, $threads); http_response_code(201); echo json_encode($newThread); exit;
}

// Admins OR Authors can EDIT threads
if ($action === 'threads' && $method === 'PUT') {
    if (!isset($_SESSION['user'])) { http_response_code(401); exit; }
    $threads = readData($threadsFile);
    $threadId = (int)$input['id'];
    
    foreach ($threads as &$t) {
        if ($t['id'] === $threadId) {
            if ($_SESSION['user']['role'] !== 'admin' && $t['author'] !== $_SESSION['user']['username']) {
                http_response_code(403); exit; 
            }
            if (isset($input['title'])) $t['title'] = $input['title'];
            if (isset($input['content'])) $t['content'] = $input['content'];
            if (isset($input['category'])) $t['category'] = $input['category'];
            break;
        }
    }
    writeData($threadsFile, $threads); echo json_encode(["message" => "Thread updated!"]); exit;
}

// Admins OR Authors can DELETE threads
if ($action === 'threads' && $method === 'DELETE') {
    if (!isset($_SESSION['user'])) { http_response_code(401); exit; }
    $threads = readData($threadsFile);
    $idToDelete = (int)$_GET['id'];
    
    $canDelete = false;
    foreach ($threads as $t) {
        if ($t['id'] === $idToDelete && ($_SESSION['user']['role'] === 'admin' || $t['author'] === $_SESSION['user']['username'])) {
            $canDelete = true; break;
        }
    }
    if (!$canDelete) { http_response_code(403); exit; }

    $threads = array_values(array_filter($threads, function($t) use ($idToDelete) { return $t['id'] !== $idToDelete; }));
    writeData($threadsFile, $threads);
    
    $replies = readData($threadRepliesFile);
    $replies = array_values(array_filter($replies, function($r) use ($idToDelete) { return $r['threadId'] !== $idToDelete; }));
    writeData($threadRepliesFile, $replies);
    echo json_encode(["message" => "Thread vanished!"]); exit;
}

if ($action === 'thread_replies' && $method === 'POST') {
    if (!isset($_SESSION['user'])) { http_response_code(401); exit; }
    $replies = readData($threadRepliesFile);
    $newReply = [
        "id" => time(), "threadId" => (int)$input['threadId'], 
        "username" => $_SESSION['user']['username'], "text" => $input['text'], "color" => $_SESSION['user']['color']
    ];
    $replies[] = $newReply;
    writeData($threadRepliesFile, $replies); http_response_code(201); echo json_encode($newReply); exit;
}

// Admins OR Authors can EDIT replies
if ($action === 'thread_replies' && $method === 'PUT') {
    if (!isset($_SESSION['user'])) { http_response_code(401); exit; }
    $replies = readData($threadRepliesFile);
    $replyId = (int)$input['id'];
    
    foreach ($replies as &$r) {
        if ($r['id'] === $replyId) {
            if ($_SESSION['user']['role'] !== 'admin' && $r['username'] !== $_SESSION['user']['username']) {
                http_response_code(403); exit;
            }
            if (isset($input['text'])) $r['text'] = $input['text'];
            break;
        }
    }
    writeData($threadRepliesFile, $replies); echo json_encode(["message" => "Reply updated!"]); exit;
}

// Admins OR Authors can DELETE replies
if ($action === 'thread_replies' && $method === 'DELETE') {
    if (!isset($_SESSION['user'])) { http_response_code(401); exit; }
    $replies = readData($threadRepliesFile);
    $idToDelete = (int)$_GET['id'];
    
    $canDelete = false;
    foreach ($replies as $r) {
        if ($r['id'] === $idToDelete && ($_SESSION['user']['role'] === 'admin' || $r['username'] === $_SESSION['user']['username'])) {
            $canDelete = true; break;
        }
    }
    if (!$canDelete) { http_response_code(403); exit; }

    $replies = array_values(array_filter($replies, function($r) use ($idToDelete) { return $r['id'] !== $idToDelete; }));
    writeData($threadRepliesFile, $replies); echo json_encode(["message" => "Reply vanished!"]); exit;
}
?>