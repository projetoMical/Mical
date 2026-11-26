/*
  MICAL - Monitoramento Inteligente de Consumo
  ESP32 + YF-S201 + SCT-013 + Supabase
*/

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <math.h>
#include <time.h>

#include "yfs201.h"
#include <SCT013.h>

// =====================================
// WI-FI
// =====================================

const char* ssid = "Redmi Note 12S";
const char* senha = "12345678910";

// =====================================
// SUPABASE
// =====================================

const char* SUPABASE_URL =
"https://pfzipxmlvjzynuwhnhwe.supabase.co";

const char* SUPABASE_KEY =
"sb_publishable_nD5iYfeiIAZF25R73pwkFA_CXqpMkn5";

const int APARELHO_ID = 3;

const char* ORIGEM = "esp32";

// =====================================
// SENSOR DE AGUA YF-S201
// =====================================

const int flowSensorPin = 17;

yfs201 flowSensor(flowSensorPin);

float totalVolume = 0.0;
float consumoAguaIntervalo = 0.0;
float vazaoAtual = 0.0;

// =====================================
// SENSOR DE ENERGIA SCT-013
// =====================================

#define ADC_PIN1 35

SCT013 sensor1(ADC_PIN1);

float corrente1 = 0.0;

float potenciaWatts = 0.0;
float energiaTotalKwh = 0.0;
float consumoEnergiaIntervalo = 0.0;

// =====================================
// CONFIGURACAO ELETRICA
// =====================================

const float TENSAO_REDE = 127.0;
const float FATOR_POTENCIA = 0.95;

// =====================================
// CONTROLE DE TEMPO
// =====================================

unsigned long ultimoTempoLeitura = 0;
unsigned long ultimoEnvio = 0;

const unsigned long INTERVALO_LEITURA = 1000;
const unsigned long INTERVALO_ENVIO = 1000;

// =====================================
// DATA E HORA
// =====================================

String obterDataHora() {

  time_t agora = time(nullptr);

  if (agora < 100000) {
    return "";
  }

  struct tm tempoUTC;

  gmtime_r(&agora, &tempoUTC);

  char dataHora[25];

  strftime(
    dataHora,
    sizeof(dataHora),
    "%Y-%m-%dT%H:%M:%SZ",
    &tempoUTC
  );

  return String(dataHora);
}

// =====================================
// CONEXAO WI-FI
// =====================================

void conectarWiFi() {

  Serial.println();
  Serial.println("Conectando ao Wi-Fi...");

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, senha);

  int tentativas = 0;

  while (WiFi.status() != WL_CONNECTED && tentativas < 40) {

    delay(500);
    Serial.print(".");
    tentativas++;

  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {

    Serial.println("================================");
    Serial.println("WI-FI CONECTADO COM SUCESSO!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    Serial.println("================================");

    Serial.println("Sincronizando horario...");

    configTime(0, 0, "pool.ntp.org", "time.nist.gov");

    struct tm timeinfo;

    if (getLocalTime(&timeinfo, 15000)) {

      Serial.println("Horario sincronizado com sucesso!");

      Serial.print("Data e hora UTC: ");
      Serial.println(obterDataHora());

    } else {

      Serial.println("Falha ao sincronizar o horario.");

    }

  } else {

    Serial.println("FALHA NA CONEXAO WI-FI!");
    Serial.println("Verifique o nome e a senha da rede.");

  }
}

// =====================================
// LEITURA DOS SENSORES
// =====================================

void lerSensores() {

  unsigned long tempoAtual = millis();

  unsigned long tempoDecorrido =
      tempoAtual - ultimoTempoLeitura;

  ultimoTempoLeitura = tempoAtual;

  // SENSOR DE AGUA

  vazaoAtual = flowSensor.getFlowRate();

  if (!isfinite(vazaoAtual) || vazaoAtual < 0) {
    vazaoAtual = 0;
  }

  float volumeIncremento =
      (vazaoAtual * tempoDecorrido) / 60000.0;

  totalVolume += volumeIncremento;
  consumoAguaIntervalo += volumeIncremento;

  // SENSOR DE ENERGIA

  corrente1 = sensor1.readAmps();

  if (!isfinite(corrente1) || corrente1 < 0) {
    corrente1 = 0;
  }

  // POTENCIA ESTIMADA

  potenciaWatts =
      TENSAO_REDE * corrente1 * FATOR_POTENCIA;

  // ENERGIA EM KWH

  float energiaIncremento =
      (potenciaWatts * tempoDecorrido) / 3600000000.0;

  energiaTotalKwh += energiaIncremento;

  consumoEnergiaIntervalo += energiaIncremento;

  // MONITOR SERIAL

  Serial.println();
  Serial.println("======= MICAL =======");

  Serial.print("Vazao de agua: ");
  Serial.print(vazaoAtual, 2);
  Serial.println(" L/min");

  Serial.print("Agua acumulada: ");
  Serial.print(totalVolume, 3);
  Serial.println(" L");

  Serial.print("Corrente eletrica: ");
  Serial.print(corrente1, 3);
  Serial.println(" A");

  Serial.print("Potencia estimada: ");
  Serial.print(potenciaWatts, 2);
  Serial.println(" W");

  Serial.print("Energia acumulada: ");
  Serial.print(energiaTotalKwh, 6);
  Serial.println(" kWh");

  Serial.println("=====================");
}

// =====================================
// ENVIO PARA O SUPABASE
// =====================================

void enviarMedicoes() {

  if (WiFi.status() != WL_CONNECTED) {

    Serial.println("Wi-Fi desconectado.");
    return;
  }

  WiFiClientSecure cliente;

  // Configuracao temporaria para testes
  cliente.setInsecure();

  HTTPClient http;

  String url = String(SUPABASE_URL) +
               "/rest/v1/medicoes";

  if (!http.begin(cliente, url)) {

    Serial.println("Erro ao iniciar conexao.");
    return;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Prefer", "return=minimal");

  // DATA E HORA

  String dataHora = obterDataHora();

  if (dataHora == "") {

    Serial.println("Aguardando sincronizacao do horario.");
    http.end();
    return;
  }

  // MONTAGEM DO JSON

  String json = "{";

  json += "\"aparelho_id\":";
  json += String(APARELHO_ID);
  json += ",";

  json += "\"consumo_agua_litros\":";
  json += String(consumoAguaIntervalo, 4);
  json += ",";

  json += "\"consumo_energia_kwh\":";
  json += String(consumoEnergiaIntervalo, 8);
  json += ",";

  json += "\"corrente_a\":";
  json += String(corrente1, 4);
  json += ",";

  json += "\"vazao_l_min\":";
  json += String(vazaoAtual, 4);
  json += ",";

  json += "\"potencia_w\":";
  json += String(potenciaWatts, 4);
  json += ",";

  json += "\"agua_total_litros\":";
  json += String(totalVolume, 4);
  json += ",";

  json += "\"energia_total_kwh\":";
  json += String(energiaTotalKwh, 8);
  json += ",";

  json += "\"medido_em\":\"";
  json += dataHora;
  json += "\",";

  json += "\"origem\":\"";
  json += ORIGEM;
  json += "\"";

  json += "}";

  Serial.println();
  Serial.println("Enviando medicoes ao Supabase...");

  Serial.println(json);

  // ENVIO POST

  int codigoHTTP = http.POST(json);

  Serial.print("Resposta HTTP: ");
  Serial.println(codigoHTTP);

  String resposta = http.getString();

  Serial.println("Resposta do Supabase:");
  Serial.println(resposta);

  if (codigoHTTP >= 200 && codigoHTTP < 300) {

    Serial.println("Medicoes salvas no Supabase!");

    consumoAguaIntervalo = 0.0;
    consumoEnergiaIntervalo = 0.0;

  } else {

    Serial.println("Erro ao salvar medicoes.");

  }

  http.end();
}

// =====================================
// SETUP
// =====================================

void setup() {

  Serial.begin(115200);

  delay(1500);

  Serial.println();
  Serial.println("INICIANDO SISTEMA MICAL");

  flowSensor.begin();

  sensor1.begin(2000, 18);

  Serial.println("Sensores inicializados!");

  conectarWiFi();

  ultimoTempoLeitura = millis();
  ultimoEnvio = millis();
}

// =====================================
// LOOP
// =====================================

void loop() {

  // LEITURA DOS SENSORES

  if (millis() - ultimoTempoLeitura >= INTERVALO_LEITURA) {

    lerSensores();
  }

  // ENVIO DAS MEDICOES

  if (millis() - ultimoEnvio >= INTERVALO_ENVIO) {

    ultimoEnvio = millis();

    enviarMedicoes();
  }
}