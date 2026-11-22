<?php
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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['ok' => false, 'message' => 'Método não permitido.']);
}
if (empty($_SESSION['usuario_id'])) {
    respond(401, ['ok' => false, 'message' => 'Sua sessão expirou. Entre novamente na sua conta.']);
}

$raw = file_get_contents('php://input');
$data = json_decode($raw ?: '', true);
if (!is_array($data)) {
    respond(400, ['ok' => false, 'message' => 'Os dados enviados são inválidos.']);
}

$tipo = (string)($data['tipo'] ?? '');
$codigo = trim((string)($data['codigo'] ?? ''));
$moradores = filter_var($data['moradores'] ?? null, FILTER_VALIDATE_INT);
$horario = trim((string)($data['horario'] ?? ''));

if (!in_array($tipo, ['agua', 'energia', 'ambos'], true)) respond(422, ['ok' => false, 'message' => 'Selecione um tipo de monitoramento válido.']);
if ($codigo === '' || mb_strlen($codigo) > 80) respond(422, ['ok' => false, 'message' => 'Informe um código de aparelho com até 80 caracteres.']);
if ($moradores === false || $moradores < 1) respond(422, ['ok' => false, 'message' => 'Informe uma quantidade válida de moradores.']);
if ($horario === '' || mb_strlen($horario) > 100) respond(422, ['ok' => false, 'message' => 'Informe uma faixa de horário válida.']);

function validBill(array $data, string $valueKey, string $consumptionKey, string $referenceKey): ?array {
    $valueRaw = $data[$valueKey] ?? null;
    $consumptionRaw = $data[$consumptionKey] ?? null;
    $reference = (string)($data[$referenceKey] ?? '');
    if (!is_numeric($valueRaw) || (float)$valueRaw < 0 || !is_numeric($consumptionRaw) || (float)$consumptionRaw < 0) return null;
    if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $reference)) return null;
    return ['valor' => (float)$valueRaw, 'consumo' => (float)$consumptionRaw, 'referencia' => $reference . '-01'];
}

$waterBill = null;
$energyBill = null;
if ($tipo === 'agua' || $tipo === 'ambos') {
    $waterBill = validBill($data, 'valorAgua', 'consumoAgua', 'referenciaAgua');
    if ($waterBill === null) respond(422, ['ok' => false, 'message' => 'Confira o valor, o consumo e a referência mensal da conta de água.']);
}
if ($tipo === 'energia' || $tipo === 'ambos') {
    $energyBill = validBill($data, 'valorEnergia', 'consumoEnergia', 'referenciaEnergia');
    if ($energyBill === null) respond(422, ['ok' => false, 'message' => 'Confira o valor, o consumo e a referência mensal da conta de energia.']);
}

try {
    require __DIR__ . '/conexao.php';

    // Gerar token exclusivo para o ESP32
    $token = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $token);

    $pdo->beginTransaction();

    $insertDevice = $pdo->prepare('INSERT INTO aparelhos (usuario_id, codigo, tipo, moradores, horario_uso, token_hash) VALUES (:usuario_id, :codigo, :tipo, :moradores, :horario_uso, :token_hash)');
    $insertDevice->execute([
        'usuario_id' => (int)$_SESSION['usuario_id'],
        'codigo' => $codigo,
        'tipo' => $tipo,
        'moradores' => $moradores,
        'horario_uso' => $horario,
        'token_hash' => $tokenHash
    ]);
    $aparelhoId = (int)$pdo->lastInsertId();

    $insertBill = $pdo->prepare('INSERT INTO contas (aparelho_id, recurso, valor_pago, consumo, unidade, referencia) VALUES (:aparelho_id, :recurso, :valor_pago, :consumo, :unidade, :referencia)');
    if ($waterBill !== null) {
        $insertBill->execute([
            'aparelho_id' => $aparelhoId,
            'recurso' => 'agua',
            'valor_pago' => $waterBill['valor'],
            'consumo' => $waterBill['consumo'],
            'unidade' => 'm³',
            'referencia' => $waterBill['referencia']
        ]);
    }
    if ($energyBill !== null) {
        $insertBill->execute([
            'aparelho_id' => $aparelhoId,
            'recurso' => 'energia',
            'valor_pago' => $energyBill['valor'],
            'consumo' => $energyBill['consumo'],
            'unidade' => 'kWh',
            'referencia' => $energyBill['referencia']
        ]);
    }

    $pdo->commit();
    respond(201, [
    'ok' => true,
    'message' => 'Aparelho e contas salvos com sucesso.',
    'aparelho_id' => $aparelhoId,
    'token' => $token
]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack();
    error_log('MICAL salvar-aparelho: ' . $e->getMessage());
    respond(500, ['ok' => false, 'message' => 'Não foi possível salvar os dados no banco. Verifique a conexão e tente novamente.']);
}
