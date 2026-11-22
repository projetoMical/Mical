<?php

header('Content-Type: application/json; charset=utf-8');

function responder($sucesso, $mensagem, $codigo = 200) {
    http_response_code($codigo);

    echo json_encode([
        'sucesso' => $sucesso,
        'mensagem' => $mensagem
    ]);

    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    responder(false, 'Método não permitido.', 405);
}

try {

    require_once __DIR__ . '/conexao.php';
    require_once __DIR__ . '/supabase-config.php';

    $dados = json_decode(file_get_contents('php://input'), true);

    if (!is_array($dados)) {
        responder(false, 'Dados JSON inválidos.', 400);
    }

    // Identificar o aparelho pelo token
    $token = trim($dados['token'] ?? '');

    if ($token === '') {
        responder(false, 'Token não informado.', 401);
    }

    $tokenHash = hash('sha256', $token);

    $consulta = $pdo->prepare(
        "SELECT id, tipo
         FROM aparelhos
         WHERE token_hash = :token_hash
         LIMIT 1"
    );

    $consulta->execute([
        ':token_hash' => $tokenHash
    ]);

    $aparelho = $consulta->fetch(PDO::FETCH_ASSOC);

    if (!$aparelho) {
        responder(false, 'Dispositivo não autorizado.', 401);
    }

    // Validar os dados recebidos
    $campos = [
        'consumo_agua_litros',
        'consumo_energia_kwh',
        'corrente_a',
        'vazao_l_min',
        'potencia_w',
        'agua_total_litros',
        'energia_total_kwh'
    ];

    $valores = [];

    foreach ($campos as $campo) {

        if (!isset($dados[$campo]) || !is_numeric($dados[$campo])) {
            responder(false, "Campo inválido: $campo", 400);
        }

        $valor = (float) $dados[$campo];

        if (!is_finite($valor) || $valor < 0) {
            responder(false, "Valor inválido: $campo", 400);
        }

        $valores[$campo] = $valor;
    }

    // Respeitar o tipo de monitoramento
    if ($aparelho['tipo'] === 'agua') {

        $valores['consumo_energia_kwh'] = 0;
        $valores['corrente_a'] = 0;
        $valores['potencia_w'] = 0;
        $valores['energia_total_kwh'] = 0;

    } elseif ($aparelho['tipo'] === 'energia') {

        $valores['consumo_agua_litros'] = 0;
        $valores['vazao_l_min'] = 0;
        $valores['agua_total_litros'] = 0;
    }

    // Preparar medição para o Supabase
    $medicao = [
        'aparelho_id' => (int) $aparelho['id'],
        'consumo_agua_litros' => $valores['consumo_agua_litros'],
        'vazao_l_min' => $valores['vazao_l_min'],
        'agua_total_litros' => $valores['agua_total_litros'],
        'consumo_energia_kwh' => $valores['consumo_energia_kwh'],
        'energia_total_kwh' => $valores['energia_total_kwh'],
        'corrente_a' => $valores['corrente_a'],
        'potencia_w' => $valores['potencia_w'],
        'medido_em' => gmdate('Y-m-d\TH:i:s\Z'),
        'origem' => 'esp32'
    ];

    // Enviar ao Supabase
    $url = rtrim(SUPABASE_URL, '/') . '/rest/v1/medicoes';

    $ch = curl_init($url);

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($medicao),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'apikey: ' . SUPABASE_SECRET_KEY,
            'Prefer: return=minimal'
        ],
        CURLOPT_TIMEOUT => 20
    ]);

    $resposta = curl_exec($ch);

    $erroCurl = curl_error($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    curl_close($ch);

    if ($resposta === false || $erroCurl !== '') {
        error_log('Erro Supabase: ' . $erroCurl);
        responder(false, 'Não foi possível conectar ao Supabase.', 502);
    }

    if ($status < 200 || $status >= 300) {
        error_log('Erro Supabase HTTP ' . $status . ': ' . $resposta);
        responder(false, 'O Supabase não conseguiu salvar a medição.', 502);
    }

    responder(true, 'Medição enviada ao Supabase com sucesso.');

} catch (Throwable $e) {

    error_log('Erro MICAL: ' . $e->getMessage());

    responder(false, 'Erro interno ao processar a medição.', 500);
}