<?php
// API de cadastro, login, consulta e encerramento de sessão do MICAL.
declare(strict_types=1);

$isHttps = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => $isHttps,
    'httponly' => true,
    'samesite' => 'Lax'
]);
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond(int $status, array $data): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function inputData(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '', true);
    return is_array($data) ? $data : $_POST;
}

$action = $_GET['action'] ?? '';
if ($action === 'logout') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
    respond(200, ['ok' => true]);
}
if ($action === 'me') {
    if (empty($_SESSION['usuario_id'])) respond(401, ['ok' => false, 'message' => 'Não autenticado.']);
    respond(200, ['ok' => true, 'user' => [
        'id' => (int) $_SESSION['usuario_id'],
        'nome' => $_SESSION['usuario_nome'],
        'email' => $_SESSION['usuario_email'],
        'telefone' => $_SESSION['usuario_telefone'],
        'nascimento' => $_SESSION['usuario_nascimento']
    ]]);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(405, ['ok' => false, 'message' => 'Método não permitido.']);

$data = inputData();
try {
    require __DIR__ . '/conexao.php';
    if ($action === 'register') {
        $nome = trim((string)($data['nome'] ?? ''));
        $email = mb_strtolower(trim((string)($data['email'] ?? '')), 'UTF-8');
        $telefone = trim((string)($data['telefone'] ?? ''));
        $nascimento = trim((string)($data['nascimento'] ?? ''));
        $senha = (string)($data['senha'] ?? '');
        $aceitouTermos = !empty($data['acceptTerms']);

        if ($nome === '' || mb_strlen($nome) < 3) respond(422, ['ok' => false, 'message' => 'Informe seu nome completo.']);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) respond(422, ['ok' => false, 'message' => 'Informe um e-mail válido.']);
        $digits = preg_replace('/\D/', '', $telefone);
        if (strlen($digits) < 10 || strlen($digits) > 11) respond(422, ['ok' => false, 'message' => 'Informe um telefone válido com DDD.']);
        $birth = DateTime::createFromFormat('!Y-m-d', $nascimento);
        $today = new DateTime('today');
        if (!$birth || $birth->format('Y-m-d') !== $nascimento || $birth > $today) respond(422, ['ok' => false, 'message' => 'Informe uma data de nascimento válida.']);
        if ($birth->diff($today)->y < 18) respond(422, ['ok' => false, 'message' => 'O MICAL permite contas somente para maiores de 18 anos.']);
        if (!preg_match('/[A-Z]/', $senha) || !preg_match('/[a-z]/', $senha) || !preg_match('/[0-9]/', $senha) || !preg_match('/[^A-Za-z0-9]/', $senha)) respond(422, ['ok' => false, 'message' => 'A senha deve conter letra maiúscula, minúscula, número e caractere especial.']);
        if (!$aceitouTermos) respond(422, ['ok' => false, 'message' => 'É necessário aceitar a Política de Privacidade e os Termos de Uso.']);

        $check = $pdo->prepare('SELECT id FROM usuarios WHERE email = :email LIMIT 1');
        $check->execute(['email' => $email]);
        if ($check->fetch()) respond(409, ['ok' => false, 'message' => 'Já existe uma conta cadastrada com este e-mail.']);

        $hash = password_hash($senha, PASSWORD_DEFAULT);
        $insert = $pdo->prepare('INSERT INTO usuarios (nome, email, telefone, nascimento, senha_hash) VALUES (:nome, :email, :telefone, :nascimento, :senha_hash)');
        $insert->execute(['nome' => $nome, 'email' => $email, 'telefone' => $telefone, 'nascimento' => $nascimento, 'senha_hash' => $hash]);
        $id = (int)$pdo->lastInsertId();
        session_regenerate_id(true);
        $_SESSION['usuario_id'] = $id;
        $_SESSION['usuario_nome'] = $nome;
        $_SESSION['usuario_email'] = $email;
        $_SESSION['usuario_telefone'] = $telefone;
        $_SESSION['usuario_nascimento'] = $nascimento;
        respond(201, ['ok' => true, 'message' => 'Cadastro realizado com sucesso!', 'user' => ['id' => $id, 'nome' => $nome, 'email' => $email, 'telefone' => $telefone, 'nascimento' => $nascimento]]);
    }

    if ($action === 'login') {
        $email = mb_strtolower(trim((string)($data['email'] ?? '')), 'UTF-8');
        $senha = (string)($data['senha'] ?? '');
        $query = $pdo->prepare('SELECT id, nome, email, telefone, nascimento, senha_hash FROM usuarios WHERE email = :email LIMIT 1');
        $query->execute(['email' => $email]);
        $user = $query->fetch();
        if (!$user || !password_verify($senha, $user['senha_hash'])) respond(401, ['ok' => false, 'message' => 'E-mail ou senha incorretos.']);
        session_regenerate_id(true);
        $_SESSION['usuario_id'] = (int)$user['id'];
        $_SESSION['usuario_nome'] = $user['nome'];
        $_SESSION['usuario_email'] = $user['email'];
        $_SESSION['usuario_telefone'] = $user['telefone'];
        $_SESSION['usuario_nascimento'] = $user['nascimento'];
        unset($user['senha_hash']);
        $user['id'] = (int)$user['id'];
        respond(200, ['ok' => true, 'message' => 'Login realizado com sucesso.', 'user' => $user]);
    }
    respond(400, ['ok' => false, 'message' => 'Ação inválida.']);
} catch (PDOException $e) {
    error_log('MICAL auth: ' . $e->getMessage());
    if ($e->getCode() === '23000') respond(409, ['ok' => false, 'message' => 'Este e-mail já está cadastrado.']);
    respond(500, ['ok' => false, 'message' => 'Não foi possível concluir a operação. Verifique a conexão com o banco de dados.']);
} catch (Throwable $e) {
    error_log('MICAL auth: ' . $e->getMessage());
    respond(500, ['ok' => false, 'message' => 'Ocorreu um erro interno.']);
}
