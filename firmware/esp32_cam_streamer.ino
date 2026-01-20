/*
  ESP32-CAM MJPEG Video Streamer
  Use this for the Visual Monitoring section of your dashboard.
  
  REQUIRED LIBRARIES:
  - esp_camera
*/

#include "esp_camera.h"
#include <WiFi.h>

// --- CONFIGURATION ---
const char* ssid = "YOUR_WIFI_NAME";
const char* password = "YOUR_WIFI_PASSWORD";

// Select camera model
#define CAMERA_MODEL_AI_THINKER
#include "camera_pins.h"

void startCameraServer();

void setup() {
  Serial.begin(115200);
  
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");

  camera_config_t config;
  // (Standard camera initialization code goes here)
  // ...
  
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed");
    return;
  }

  startCameraServer();
  Serial.print("Camera Ready! Use this URL in your dashboard: ");
  Serial.print("http://");
  Serial.print(WiFi.localIP());
  Serial.println(":81/stream");
}

void loop() {
  delay(10000);
}
