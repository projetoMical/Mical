
<?php

$host = "sql208.infinityfree.com";
$banco = "if0_43414757_mical";
$usuario = "if0_43414757";
$senha = "mical242";

try {
    $pdo = new PDO(
        "mysql:host=$host;dbname=$banco;charset=utf8mb4",
        $usuario,
        $senha,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]
    );

} catch (PDOException $e) {
    error_log($e->getMessage());
    http_response_code(500);
    exit("Não foi possível conectar ao banco de dados.");
}
?>
