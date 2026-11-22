
<?php
require __DIR__ . '/conexao.php';

try {
    $resultado = $pdo->query("SELECT DATABASE() AS banco")->fetch();
    echo "Conexão funcionando! Banco: " . $resultado['banco'];

    $total = $pdo->query("SELECT COUNT(*) FROM aparelhos")->fetchColumn();
    echo "<br>Quantidade de aparelhos: " . $total;

} catch (PDOException $e) {
    echo "Erro: " . $e->getMessage();
}
?>
