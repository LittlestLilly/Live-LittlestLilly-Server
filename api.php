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

// Read incoming JSON data from the frontend
$input = json_decode(file_get_contents('php://input'), true);

// --- 1. Authentication ---
if ($action === 'register' && $method === 'POST') {
    $users = readData($usersFile);
    foreach ($users as $u) {
        if ($u['username'] === $input['username']) {
            http_response_code(400);
            echo json_encode(["message" => "Username taken! Try another. 👯"]);
            exit;
        }
    }
    
    $newUser = [
        "id" => time(),
        "username" => $input['username'],
        "password" => password_hash($input['password'], PASSWORD_DEFAULT), // Native PHP secure hashing
        "role" => ($input['secretCode'] ?? '') === getAdminSecret() ? "admin" : "user",
        "color" => "#FFF380"
    ];
    
    $users[] = $newUser;
    writeData($usersFile, $users);
    http_response_code(201);
    echo json_encode(["message" => "Account created! Welcome! 🎉"]);
    exit;
}

if ($action === 'login' && $method === 'POST') {
    $users = readData($usersFile);
    foreach ($users as $user) {
        if ($user['username'] === $input['username'] && password_verify($input['password'], $user['password'])) {
            // Set the secure session
            $_SESSION['user'] = [
                "id" => $user['id'], 
                "username" => $user['username'], 
                "role" => $user['role'], 
                "color" => $user['color']
            ];
            echo json_encode(["message" => "Logged in successfully! 🌟", "role" => $user['role'], "username" => $user['username']]);
            exit;
        }
    }
    http_response_code(401);
    echo json_encode(["message" => "Incorrect username or password. 🕵️‍♀️"]);
    exit;
}

if ($action === 'logout' && $method === 'POST') {
    session_destroy();
    echo json_encode(["message" => "Logged out. See you next time! 👋"]);
    exit;
}

// --- 2. Blog Data ---
if ($action === 'posts' && $method === 'GET') {
    $posts = readData($postsFile);
    $comments = readData($commentsFile);
    $feed = [];
    
    foreach (array_reverse($posts) as $post) {
        $postComments = array_values(array_filter($comments, function($c) use ($post) { return $c['postId'] == $post['id']; }));
        $post['comments'] = $postComments;
        $feed[] = $post;
    }
    echo json_encode($feed);
    exit;
}

if ($action === 'recent_posts' && $method === 'GET') {
    $posts = readData($postsFile);
    $comments = readData($commentsFile);
    $feed = [];
    $recent = array_slice(array_reverse($posts), 0, 5);
    
    foreach ($recent as $post) {
        $postComments = array_values(array_filter($comments, function($c) use ($post) { return $c['postId'] == $post['id']; }));
        $post['comments'] = $postComments;
        $feed[] = $post;
    }
    echo json_encode($feed);
    exit;
}

if ($action === 'posts' && $method === 'POST') {
    if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'admin') {
        http_response_code(403); echo json_encode(["message" => "Only admins can use this magic! 🪄"]); exit;
    }
    $posts = readData($postsFile);
    $newPost = ["id" => time(), "title" => $input['title'], "content" => $input['content'], "author" => $_SESSION['user']['username']];
    $posts[] = $newPost;
    writeData($postsFile, $posts);
    http_response_code(201); echo json_encode($newPost); exit;
}

if ($action === 'comments' && $method === 'POST') {
    if (!isset($_SESSION['user'])) {
        http_response_code(401); echo json_encode(["message" => "Please log in first! 🛑"]); exit;
    }
    $comments = readData($commentsFile);
    $newComment = [
        "id" => time(), "postId" => (int)$input['postId'], 
        "username" => $_SESSION['user']['username'], "text" => $input['text'], "color" => $_SESSION['user']['color']
    ];
    $comments[] = $newComment;
    writeData($commentsFile, $comments);
    http_response_code(201); echo json_encode($newComment); exit;
}

if ($action === 'comments' && $method === 'DELETE') {
    if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'admin') {
        http_response_code(403); echo json_encode(["message" => "Only admins can use this magic! 🪄"]); exit;
    }
    $comments = readData($commentsFile);
    $idToDelete = (int)$_GET['id'];
    $comments = array_values(array_filter($comments, function($c) use ($idToDelete) { return $c['id'] !== $idToDelete; }));
    writeData($commentsFile, $comments);
    echo json_encode(["message" => "Comment vanished! 💨"]);
    exit;
}
?>