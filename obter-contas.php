<?php
declare(strict_types=1);
$isHttps = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>$isHttps,'httponly'=>true,'samesite'=>'Lax']);
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function respond(int $status, array $data): never { http_response_code($status); echo json_encode($data, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES); exit; }
if (empty($_SESSION['usuario_id'])) respond(401, ['ok'=>false,'message'=>'Entre novamente na sua conta.']);
$aparelhoId = filter_input(INPUT_GET, 'aparelho_id', FILTER_VALIDATE_INT);
if (!$aparelhoId || $aparelhoId < 1) respond(422, ['ok'=>false,'message'=>'Aparelho não identificado.']);
try {
    require __DIR__ . '/conexao.php';
    $owner = $pdo->prepare('SELECT id, tipo FROM aparelhos WHERE id = :id AND usuario_id = :usuario_id LIMIT 1');
    $owner->execute(['id'=>$aparelhoId, 'usuario_id'=>(int)$_SESSION['usuario_id']]);
    $device = $owner->fetch();
    if (!$device) respond(404, ['ok'=>false,'message'=>'Aparelho não encontrado nesta conta.']);
    $stmt = $pdo->prepare('SELECT recurso, valor_pago, consumo, unidade, referencia FROM contas WHERE aparelho_id = :id ORDER BY referencia DESC');
    $stmt->execute(['id'=>$aparelhoId]);
    respond(200, ['ok'=>true,'tipo'=>$device['tipo'],'contas'=>$stmt->fetchAll()]);
} catch (Throwable $e) {
    error_log('MICAL obter-contas: '.$e->getMessage());
    respond(500, ['ok'=>false,'message'=>'Não foi possível consultar as contas cadastradas.']);
}
