/*
 * ==========================================
 *   ROBOTIC GRIPPER: IoT FIRMWARE (ESP32)
 * ==========================================
 * Project: Robotic Gripper for Emergency Assistance
 * 
 * REQUIRED LIBRARIES (Install via Library Manager):
 * 1. ArduinoJson (by Benoit Blanchon)
 * 2. HTTPClient (Built-in)
 * 
 * HARDWARE CONNECTIONS:
 * - L298N/BTS7960 PWM -> Pin 12
 * - L298N/BTS7960 IN1 -> Pin 13
 * - L298N/BTS7960 IN2 -> Pin 14
 * - FSR Sensor (Grip) -> Pin 34 (Analog)
 * - Current Sensor    -> Pin 35 (Analog)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ==========================================
// 1. ADD YOUR CREDENTIALS HERE
// ==========================================
const char* wifi_ssid     = "YOUR_WIFI_NAME";         // <--- Replace with your WiFi SSID
const char* wifi_password = "YOUR_WIFI_PASSWORD";     // <--- Replace with your WiFi Password

const String supabase_url = "https://bjfamnxlqhjftrasqvpr.supabase.co"; // <--- Already configured
const String supabase_key = "sb_publishable_2JzXr_bXZv83mynrDL_wKw_vsYtUo0h"; // <--- Already configured

// ==========================================
// 2. PIN CONFIGURATION
// ==========================================
const int PIN_MOTOR_PWM = 12;
const int PIN_MOTOR_IN1 = 13;
const int PIN_MOTOR_IN2 = 14;
const int PIN_FSR_SENSE = 34; 
const int PIN_AMP_SENSE = 35;

void setup() {
  Serial.begin(115200);
  
  // Setup Motor Pins
  pinMode(PIN_MOTOR_PWM, OUTPUT);
  pinMode(PIN_MOTOR_IN1, OUTPUT);
  pinMode(PIN_MOTOR_IN2, OUTPUT);
  
  // Initial Stop
  stopMotor();
  
  // Connect to WiFi
  connectToWiFi();
}

void loop() {
  // Ensure we stay connected to WiFi
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
  }

  // A. READ SENSORS
  int fsr_raw = analogRead(PIN_FSR_SENSE);
  int grip_pressure = map(fsr_raw, 0, 4095, 0, 100); // 0-100%
  
  int amp_raw = analogRead(PIN_AMP_SENSE);
  float motor_current = (amp_raw * 3.3 / 4095.0); // Simplified for now
  
  // B. PUSH DATA TO DASHBOARD (Every 1 second)
  sendTelemetry(grip_pressure, motor_current);

  // C. CHECK FOR COMMANDS FROM WEB UI
  checkRemoteCommands();

  delay(1000); 
}

// --- NETWORK FUNCTIONS ---

void connectToWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(wifi_ssid);
  WiFi.begin(wifi_ssid, wifi_password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected!");
  } else {
    Serial.println("\nWiFi Failed (Check credentials).");
  }
}

// --- SUPABASE API FUNCTIONS ---

void sendTelemetry(int pressure, float current) {
  HTTPClient http;
  String url = supabase_url + "/rest/v1/telemetry";
  
  http.begin(url);
  http.addHeader("apikey", supabase_key);
  http.addHeader("Authorization", "Bearer " + supabase_key);
  http.addHeader("Content-Type", "application/json");

  // Create JSON Payload
  StaticJsonDocument<200> body;
  body["fsr_value"] = pressure;
  body["motor_current"] = current;
  body["temperature"] = 26; // Static example, can add sensors later
  body["humidity"] = 55;
  body["battery_pct"] = 92;

  String json_str;
  serializeJson(body, json_str);

  int http_code = http.POST(json_str);
  if (http_code > 0) {
    Serial.printf("[IOT] Telemetry Sent. Response: %d\n", http_code);
  }
  http.end();
}

void checkRemoteCommands() {
  HTTPClient http;
  // Fetch the latest "PENDING" command
  String query = supabase_url + "/rest/v1/commands?status=eq.PENDING&order=created_at.desc&limit=1";
  
  http.begin(query);
  http.addHeader("apikey", supabase_key);
  http.addHeader("Authorization", "Bearer " + supabase_key);
  
  int http_code = http.GET();
  if (http_code == 200) {
    String payload = http.getString();
    StaticJsonDocument<500> doc;
    deserializeJson(doc, payload);

    if (doc.size() > 0) {
      String command_type = doc[0]["type"];
      int command_id = doc[0]["id"];
      
      executeCommand(command_type, command_id);
    }
  }
  http.end();
}

void executeCommand(String type, int id) {
  Serial.print("Executing: "); Serial.println(type);
  
  if (type == "GRIP") {
    digitalWrite(PIN_MOTOR_IN1, HIGH);
    digitalWrite(PIN_MOTOR_IN2, LOW);
    analogWrite(PIN_MOTOR_PWM, 220); // Grip with power
    delay(2000); // Hold for 2 seconds to engage
    stopMotor();
  } 
  else if (type == "RELEASE") {
    digitalWrite(PIN_MOTOR_IN1, LOW);
    digitalWrite(PIN_MOTOR_IN2, HIGH);
    analogWrite(PIN_MOTOR_PWM, 220);
    delay(2000); 
    stopMotor();
  }
  else if (type == "STEP_GRIP") {
    digitalWrite(PIN_MOTOR_IN1, HIGH);
    digitalWrite(PIN_MOTOR_IN2, LOW);
    analogWrite(PIN_MOTOR_PWM, 200);
    delay(250); // Small pulse
    stopMotor();
  }
  else if (type == "STEP_RELEASE") {
    digitalWrite(PIN_MOTOR_IN1, LOW);
    digitalWrite(PIN_MOTOR_IN2, HIGH);
    analogWrite(PIN_MOTOR_PWM, 200);
    delay(250); // Small pulse
    stopMotor();
  }
  else if (type == "RESET") {
    stopMotor();
    Serial.println("System Reset");
  }

  // IMPORTANT: Tell Supabase we are DONE with this command
  acknowledgeCommand(id);
}

void acknowledgeCommand(int id) {
  HTTPClient http;
  String url = supabase_url + "/rest/v1/commands?id=eq." + String(id);
  
  http.begin(url);
  http.addHeader("apikey", supabase_key);
  http.addHeader("Authorization", "Bearer " + supabase_key);
  http.addHeader("Content-Type", "application/json");

  int http_code = http.PATCH("{\"status\":\"EXECUTED\"}");
  http.end();
}

void stopMotor() {
  digitalWrite(PIN_MOTOR_IN1, LOW);
  digitalWrite(PIN_MOTOR_IN2, LOW);
  analogWrite(PIN_MOTOR_PWM, 0);
}
