/*
  Robotic Gripper ESP32 Firmware
  Bridge: Arduino IDE -> Supabase
  
  REQUIRED LIBRARIES:
  - Supabase-Arduino (by mrfaptastic)
  - ArduinoJson
  - HTTPClient
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// --- CONFIGURATION ---
const char* ssid = "ENTER_WIFI_SSID";
const char* password = "ENTER_WIFI_PASSWORD";

const String supabaseUrl = "https://bjfamnxlqhjftrasqvpr.supabase.co";
const String supabaseKey = "sb_publishable_2JzXr_bXZv83mynrDL_wKw_vsYtUo0h";

// --- PIN DEFINITIONS ---
const int MOTOR_PWM = 12;
const int MOTOR_IN1 = 13;
const int MOTOR_IN2 = 14;
const int FSR_PIN = 34; // Analog
const int CURRENT_PIN = 35; // Analog (ACS712)

void setup() {
  Serial.begin(115200);
  
  pinMode(MOTOR_PWM, OUTPUT);
  pinMode(MOTOR_IN1, OUTPUT);
  pinMode(MOTOR_IN2, OUTPUT);
  
  connectWiFi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();

  // 1. Read Sensors
  int fsrRaw = analogRead(FSR_PIN);
  int fsrPercent = map(fsrRaw, 0, 4095, 0, 100);
  
  int currentRaw = analogRead(CURRENT_PIN);
  float motorCurrent = (currentRaw * 3.3 / 4095.0 - 2.5) / 0.185; // Example ACS712 calculation

  // 2. Push Telemetry to Supabase
  pushTelemetry(fsrPercent, motorCurrent);

  // 3. Check for New Commands
  checkCommands();

  delay(1000); // 1-second interval
}

void pushTelemetry(int fsr, float current) {
  HTTPClient http;
  String url = supabaseUrl + "/rest/v1/telemetry";
  
  http.begin(url);
  http.addHeader("apikey", supabaseKey);
  http.addHeader("Authorization", "Bearer " + supabaseKey);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Prefer", "return=minimal");

  StaticJsonDocument<200> doc;
  doc["fsr_value"] = fsr;
  doc["motor_current"] = current;
  doc["temperature"] = 24.5; // Mock data
  doc["humidity"] = 45;      // Mock data
  doc["battery_pct"] = 85;

  String json;
  serializeJson(doc, json);

  int httpCode = http.POST(json);
  if (httpCode > 0) Serial.println("Telemetry pushed: " + String(httpCode));
  http.end();
}

void checkCommands() {
  HTTPClient http;
  // Get the latest PENDING command
  String url = supabaseUrl + "/rest/v1/commands?status=eq.PENDING&order=created_at.desc&limit=1";
  
  http.begin(url);
  http.addHeader("apikey", supabaseKey);
  http.addHeader("Authorization", "Bearer " + supabaseKey);
  
  int httpCode = http.GET();
  if (httpCode == 200) {
    String payload = http.getString();
    StaticJsonDocument<500> doc;
    deserializeJson(doc, payload);
    
    if (doc.size() > 0) {
      String type = doc[0]["type"];
      int id = doc[0]["id"];
      
      Serial.println("Command Received: " + type);
      
      if (type == "GRIP") {
        digitalWrite(MOTOR_IN1, HIGH);
        digitalWrite(MOTOR_IN2, LOW);
        analogWrite(MOTOR_PWM, 200);
      } else if (type == "RELEASE") {
        digitalWrite(MOTOR_IN1, LOW);
        digitalWrite(MOTOR_IN2, HIGH);
        analogWrite(MOTOR_PWM, 200);
      } else if (type == "STEP_GRIP") {
        Serial.println("Tightening step (200ms)...");
        digitalWrite(MOTOR_IN1, HIGH);
        digitalWrite(MOTOR_IN2, LOW);
        analogWrite(MOTOR_PWM, 200);
        delay(200); // 200ms pulse for small movement
        digitalWrite(MOTOR_IN1, LOW);
        digitalWrite(MOTOR_IN2, LOW);
      } else if (type == "STEP_RELEASE") {
        Serial.println("Loosening step (200ms)...");
        digitalWrite(MOTOR_IN1, LOW);
        digitalWrite(MOTOR_IN2, HIGH);
        analogWrite(MOTOR_PWM, 200);
        delay(200); // 200ms pulse for small movement
        digitalWrite(MOTOR_IN1, LOW);
        digitalWrite(MOTOR_IN2, LOW);
      }
      
      // Mark command as EXECUTED
      updateCommandStatus(id);
    }
  }
  http.end();
}

void updateCommandStatus(int id) {
  HTTPClient http;
  String url = supabaseUrl + "/rest/v1/commands?id=eq." + String(id);
  
  http.begin(url);
  http.addHeader("apikey", supabaseKey);
  http.addHeader("Authorization", "Bearer " + supabaseKey);
  http.addHeader("Content-Type", "application/json");
  
  int httpCode = http.PATCH("{\"status\":\"EXECUTED\"}");
  http.end();
}

void connectWiFi() {
  Serial.print("Connecting to: "); Serial.println(ssid);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected");
}
