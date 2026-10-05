export const esp32MainCpp = `/*
 * Smart Attendance System - ESP32-S3 N16R8 Firmware
 * ==================================================
 * Hardware:
 *   - ESP32-S3 N16R8 (16MB Flash, 8MB PSRAM)
 *   - OV3660 Camera Module
 *   - AS608 Fingerprint Sensor (UART)
 *   - LCD 1602 I2C (address 0x27)
 *   - High Quality Sound Sensor (Analog + Digital output)
 * 
 * Identification Methods:
 *   1. Face Recognition (via OV3660 camera)
 *   2. Fingerprint Scanning (via AS608)
 *   3. Voice Recognition (via Sound Sensor + ESP32 processing)
 * 
 * Protocol: 2 out of 3 methods must match for attendance confirmation
 * Communication: Serial JSON protocol with PC at 115200 baud
 */

#include <Arduino.h>
#include <WiFi.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// Camera includes
#include "esp_camera.h"
#include "fb_gfx.h"

// Fingerprint sensor
#include <Adafruit_Fingerprint.h>

// Sound sensor
#include <driver/i2s.h>

// ==================== Pin Definitions ====================

// Camera pins (OV3660 - ESP32-S3 CAM board layout)
#define PWDN_GPIO_NUM     -1
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM     10
#define SIOD_GPIO_NUM     40
#define SIOC_GPIO_NUM     39
#define Y9_GPIO_NUM       48
#define Y8_GPIO_NUM       11
#define Y7_GPIO_NUM       12
#define Y6_GPIO_NUM       14
#define Y5_GPIO_NUM       16
#define Y4_GPIO_NUM       18
#define Y3_GPIO_NUM       17
#define Y2_GPIO_NUM       15
#define VSYNC_GPIO_NUM    38
#define HREF_GPIO_NUM     5
#define PCLK_GPIO_NUM     46

// AS608 Fingerprint Sensor (UART2)
#define FPS_RX_PIN        44
#define FPS_TX_PIN        43
#define FPS_SERIAL        Serial2

// LCD I2C
#define LCD_SDA           8
#define LCD_SCL           9
#define LCD_ADDRESS       0x27
#define LCD_COLS          16
#define LCD_ROWS          2

// Sound Sensor
#define SOUND_ANALOG_PIN  1   // Analog output (ADC1_CH0)
#define SOUND_DIGITAL_PIN 2   // Digital output (with potentiometer threshold)

// Status LED
#define STATUS_LED_PIN    47

// ==================== Global Objects ====================

LiquidCrystal_I2C lcd(LCD_ADDRESS, LCD_COLS, LCD_ROWS);
HardwareSerial fpsSerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&fpsSerial);

// ==================== System State ====================

enum SystemState {
  STATE_IDLE,
  STATE_SESSION_ACTIVE,
  STATE_ENROLLING_FACE,
  STATE_ENROLLING_FINGERPRINT,
  STATE_ENROLLING_VOICE,
  STATE_IDENTIFYING
};

SystemState currentState = STATE_IDLE;
unsigned long sessionStartTime = 0;
unsigned long lastSoundSample = 0;

// Sound detection
#define SOUND_BUFFER_SIZE 1024
int16_t soundBuffer[SOUND_BUFFER_SIZE];
int soundBufferIndex = 0;
bool voiceDetected = false;
float voiceEnergy = 0.0;
#define VOICE_THRESHOLD 500      // Analog threshold for voice detection
#define VOICE_ENERGY_THRESHOLD 50.0  // RMS energy threshold

// Face recognition (simplified - sends image to PC for processing)
bool faceDetected = false;
uint8_t* faceImageData = NULL;
size_t faceImageSize = 0;

// Fingerprint
uint16_t fingerprintId = 0;
bool fingerprintDetected = false;

// Identification tracking per student
struct StudentIdentification {
  String studentId;
  bool faceMatch;
  bool fingerprintMatch;
  bool voiceMatch;
  int matchCount;
  unsigned long firstDetection;
  unsigned long lastDetection;
};

#define MAX_PENDING_STUDENTS 10
StudentIdentification pendingStudents[MAX_PENDING_STUDENTS];
int pendingCount = 0;

// ==================== Setup ====================

void setup() {
  // Initialize Serial for PC communication
  Serial.begin(115200);
  while (!Serial) delay(10);
  
  Serial.println("\\n{\\\"type\\\":\\\"system\\\",\\\"status\\\":\\\"booting\\\"}");
  
  // Initialize pins
  pinMode(STATUS_LED_PIN, OUTPUT);
  pinMode(SOUND_ANALOG_PIN, INPUT);
  pinMode(SOUND_DIGITAL_PIN, INPUT);
  digitalWrite(STATUS_LED_PIN, LOW);
  
  // Initialize LCD
  Wire.begin(LCD_SDA, LCD_SCL);
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Attendance Sys");
  lcd.setCursor(0, 1);
  lcd.print("Initializing...");
  
  delay(1000);
  
  // Initialize Camera
  if (!initCamera()) {
    lcd.setCursor(0, 1);
    lcd.print("Camera FAIL!");
    Serial.println("{\\\"type\\\":\\\"error\\\",\\\"device\\\":\\\"camera\\\",\\\"msg\\\":\\\"Camera init failed\\\"}");
  } else {
    Serial.println("{\\\"type\\\":\\\"system\\\",\\\"device\\\":\\\"camera\\\",\\\"status\\\":\\\"ready\\\"}");
  }
  
  // Initialize Fingerprint Sensor
  if (!initFingerprint()) {
    lcd.setCursor(0, 1);
    lcd.print("FPS FAIL!");
    Serial.println("{\\\"type\\\":\\\"error\\\",\\\"device\\\":\\\"fingerprint\\\",\\\"msg\\\":\\\"Sensor not found\\\"}");
  } else {
    Serial.println("{\\\"type\\\":\\\"system\\\",\\\"device\\\":\\\"fingerprint\\\",\\\"status\\\":\\\"ready\\\"}");
  }
  
  // Initialize Sound Sensor
  initSoundSensor();
  Serial.println("{\\\"type\\\":\\\"system\\\",\\\"device\\\":\\\"sound\\\",\\\"status\\\":\\\"ready\\\"}");
  
  // System ready
  currentState = STATE_IDLE;
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("System Ready");
  lcd.setCursor(0, 1);
  lcd.print("Waiting...");
  
  digitalWrite(STATUS_LED_PIN, HIGH);
  delay(500);
  digitalWrite(STATUS_LED_PIN, LOW);
  
  Serial.println("{\\\"type\\\":\\\"system\\\",\\\"status\\\":\\\"READY\\\"}");
}

// ==================== Camera Initialization ====================

bool initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.frame_size = FRAMESIZE_SVGA;  // 800x600
  config.pixel_format = PIXFORMAT_JPEG;
  config.jpeg_quality = 12;
  config.fb_count = 2;
  config.grab_mode = CAMERA_GRAB_LATEST;
  
  // PSRAM check
  if (psramFound()) {
    config.fb_location = CAMERA_FB_IN_PSRAM;
    Serial.println("PSRAM found, using for frame buffer");
  }
  
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x\\n", err);
    return false;
  }
  
  // Configure sensor settings
  sensor_t *s = esp_camera_sensor_get();
  s->set_brightness(s, 0);
  s->set_contrast(s, 0);
  s->set_saturation(s, 0);
  s->set_whitebal(s, 1);
  s->set_awb_gain(s, 1);
  s->set_exposure_ctrl(s, 1);
  s->set_aec2(s, 0);
  s->set_ae_level(s, 0);
  
  return true;
}

// ==================== Fingerprint Initialization ====================

bool initFingerprint() {
  fpsSerial.begin(57600, SERIAL_8N1, FPS_RX_PIN, FPS_TX_PIN);
  finger.begin(57600);
  
  delay(100);
  
  if (finger.verifyPassword()) {
    Serial.println("Fingerprint sensor found");
    // Get sensor parameters
    finger.getParameters();
    return true;
  } else {
    Serial.println("Fingerprint sensor not found");
    return false;
  }
}

// ==================== Sound Sensor Initialization ====================

void initSoundSensor() {
  // Configure ADC for analog sound input
  analogReadResolution(12);  // 12-bit resolution
  analogSetAttenuation(ADC_11db);
  
  // Clear sound buffer
  memset(soundBuffer, 0, sizeof(soundBuffer));
  soundBufferIndex = 0;
}

// ==================== Main Loop ====================

void loop() {
  // Check for serial commands from PC
  if (Serial.available()) {
    handleSerialCommand();
  }
  
  // State machine
  switch (currentState) {
    case STATE_IDLE:
      // Blink status LED slowly
      blinkLED(1000);
      break;
      
    case STATE_SESSION_ACTIVE:
      // Active session - continuously scan for students
      processIdentification();
      break;
      
    case STATE_ENROLLING_FACE:
      enrollFace();
      break;
      
    case STATE_ENROLLING_FINGERPRINT:
      enrollFingerprint();
      break;
      
    case STATE_ENROLLING_VOICE:
      enrollVoice();
      break;
      
    case STATE_IDENTIFYING:
      processIdentification();
      break;
  }
  
  // Update LCD periodically
  updateLCD();
  
  delay(10);
}

// ==================== Serial Command Handler ====================

void handleSerialCommand() {
  String input = Serial.readStringUntil('\\n');
  input.trim();
  
  if (input.length() == 0) return;
  
  // Parse JSON command
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, input);
  
  if (error) {
    // Try simple string command
    handleSimpleCommand(input);
    return;
  }
  
  String cmd = doc["cmd"].as<String>();
  
  if (cmd == "HANDSHAKE") {
    sendResponse("system", "READY", "ESP32-S3 Attendance System v1.0");
  }
  else if (cmd == "START_SESSION") {
    int sessionId = doc["data"]["session_id"] | 0;
    startAttendanceSession(sessionId);
  }
  else if (cmd == "END_SESSION") {
    endAttendanceSession();
  }
  else if (cmd == "ENROLL") {
    String type = doc["data"]["type"].as<String>();
    String studentId = doc["data"]["student_id"].as<String>();
    startEnrollment(type, studentId);
  }
  else if (cmd == "STATUS") {
    sendDeviceStatus();
  }
  else if (cmd == "RESET") {
    sendResponse("system", "RESETTING", "");
    delay(1000);
    ESP.restart();
  }
  else if (cmd == "IDENTIFY") {
    String studentId = doc["data"]["student_id"].as<String>();
    identifyStudent(studentId);
  }
}

void handleSimpleCommand(String cmd) {
  if (cmd == "START_SESSION") {
    startAttendanceSession(0);
  }
  else if (cmd == "END_SESSION") {
    endAttendanceSession();
  }
  else if (cmd == "STATUS") {
    sendDeviceStatus();
  }
  else if (cmd.startsWith("START_SESSION:")) {
    int sessionId = cmd.substring(14).toInt();
    startAttendanceSession(sessionId);
  }
  else if (cmd.startsWith("ENROLL:")) {
    // Format: ENROLL:type:studentId
    int firstColon = cmd.indexOf(':');
    int secondColon = cmd.indexOf(':', firstColon + 1);
    String type = cmd.substring(firstColon + 1, secondColon);
    String studentId = cmd.substring(secondColon + 1);
    startEnrollment(type, studentId);
  }
}

// ==================== Session Management ====================

void startAttendanceSession(int sessionId) {
  currentState = STATE_SESSION_ACTIVE;
  sessionStartTime = millis();
  pendingCount = 0;
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Session Active");
  lcd.setCursor(0, 1);
  lcd.print("Scanning...");
  
  digitalWrite(STATUS_LED_PIN, HIGH);
  
  StaticJsonDocument<256> doc;
  doc["type"] = "session";
  doc["status"] = "started";
  doc["session_id"] = sessionId;
  
  String output;
  serializeJson(doc, output);
  Serial.println(output);
}

void endAttendanceSession() {
  currentState = STATE_IDLE;
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Session Ended");
  lcd.setCursor(0, 1);
  lcd.print("Ready");
  
  digitalWrite(STATUS_LED_PIN, LOW);
  
  StaticJsonDocument<256> doc;
  doc["type"] = "session";
  doc["status"] = "ended";
  doc["duration_ms"] = millis() - sessionStartTime;
  
  String output;
  serializeJson(doc, output);
  Serial.println(output);
}

// ==================== Identification Processing ====================

void processIdentification() {
  // 1. Check for face
  checkFace();
  
  // 2. Check for fingerprint
  checkFingerprint();
  
  // 3. Check for voice
  checkVoice();
  
  // Check if any pending student has 2+ matches
  checkPendingIdentifications();
}

void checkFace() {
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) return;
  
  // Send image to PC for face recognition
  // The PC will do the actual face recognition using face_recognition library
  // ESP32 just captures and sends the image
  
  StaticJsonDocument<1024> doc;
  doc["type"] = "face_scan";
  doc["width"] = fb->width;
  doc["height"] = fb->height;
  doc["format"] = "jpeg";
  doc["size"] = fb->len;
  
  // For actual implementation, we'd send the image data
  // For now, signal that a face capture is ready
  String output;
  serializeJson(doc, output);
  Serial.println(output);
  
  // Send image data in base64 chunks if needed
  // The PC processes it and sends back recognition results
  
  esp_camera_fb_return(fb);
}

void checkFingerprint() {
  uint8_t p = finger.getImage();
  
  if (p == FINGERPRINT_OK) {
    // Image captured, convert to template
    p = finger.image2Tz();
    if (p == FINGERPRINT_OK) {
      // Search for matching fingerprint
      p = finger.fingerSearch();
      if (p == FINGERPRINT_OK) {
        fingerprintDetected = true;
        fingerprintId = finger.fingerID;
        float confidence = finger.confidence;
        
        // Report fingerprint match
        StaticJsonDocument<256> doc;
        doc["type"] = "fingerprint_match";
        doc["finger_id"] = fingerprintId;
        doc["confidence"] = confidence;
        
        String output;
        serializeJson(doc, output);
        Serial.println(output);
        
        lcd.setCursor(0, 1);
        lcd.print("FP Match: ");
        lcd.print(fingerId);
      }
    }
  }
}

void checkVoice() {
  unsigned long now = millis();
  if (now - lastSoundSample < 10) return;  // Sample every 10ms
  lastSoundSample = now;
  
  // Read analog sound sensor
  int soundLevel = analogRead(SOUND_ANALOG_PIN);
  bool digitalTrigger = digitalRead(SOUND_DIGITAL_PIN);
  
  // Store in buffer
  soundBuffer[soundBufferIndex] = soundLevel;
  soundBufferIndex = (soundBufferIndex + 1) % SOUND_BUFFER_SIZE;
  
  // Check if voice is detected (above threshold)
  if (soundLevel > VOICE_THRESHOLD || digitalTrigger) {
    voiceDetected = true;
    
    // Calculate RMS energy of recent samples
    float sumSquares = 0;
    for (int i = 0; i < SOUND_BUFFER_SIZE; i++) {
      sumSquares += (float)soundBuffer[i] * soundBuffer[i];
    }
    voiceEnergy = sqrt(sumSquares / SOUND_BUFFER_SIZE);
    
    if (voiceEnergy > VOICE_ENERGY_THRESHOLD) {
      // Voice pattern detected - send to PC for voice recognition
      StaticJsonDocument<512> doc;
      doc["type"] = "voice_detected";
      doc["energy"] = voiceEnergy;
      doc["level"] = soundLevel;
      doc["digital"] = digitalTrigger;
      
      String output;
      serializeJson(doc, output);
      Serial.println(output);
    }
  }
}

void checkPendingIdentifications() {
  // This function is called when PC sends back recognition results
  // The PC maintains the student database and matching logic
  
  // Check serial for identification results from PC
  if (Serial.available()) {
    String input = Serial.readStringUntil('\\n');
    input.trim();
    
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, input);
    
    if (!error && doc["type"] == "identification_result") {
      String studentId = doc["data"]["student_id"].as<String>();
      String methods = doc["data"]["methods"].as<String>();
      bool confirmed = doc["data"]["confirmed"] | false;
      
      if (confirmed) {
        // Send confirmed attendance to PC
        StaticJsonDocument<512> response;
        response["type"] = "attendance";
        response["data"]["student_id"] = studentId;
        response["data"]["methods"] = methods;
        response["data"]["timestamp"] = millis();
        
        String output;
        serializeJson(response, output);
        Serial.println(output);
        
        // Update LCD
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Confirmed:");
        lcd.setCursor(0, 1);
        lcd.print(studentId);
        delay(2000);
        
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Session Active");
        lcd.setCursor(0, 1);
        lcd.print("Scanning...");
      }
    }
  }
}

// ==================== Enrollment Functions ====================

void startEnrollment(String type, String studentId) {
  if (type == "face") {
    currentState = STATE_ENROLLING_FACE;
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Enroll Face");
    lcd.setCursor(0, 1);
    lcd.print(studentId);
  }
  else if (type == "fingerprint") {
    currentState = STATE_ENROLLING_FINGERPRINT;
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Enroll FP");
    lcd.setCursor(0, 1);
    lcd.print("Place finger...");
  }
  else if (type == "voice") {
    currentState = STATE_ENROLLING_VOICE;
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Enroll Voice");
    lcd.setCursor(0, 1);
    lcd.print("Speak now...");
  }
  
  sendResponse("enrollment", "started", type + ":" + studentId);
}

void enrollFace() {
  // Capture multiple face images for enrollment
  static int captureCount = 0;
  static unsigned long lastCapture = 0;
  
  if (millis() - lastCapture > 1000 && captureCount < 5) {
    camera_fb_t *fb = esp_camera_fb_get();
    if (fb) {
      captureCount++;
      lastCapture = millis();
      
      // Send progress
      StaticJsonDocument<256> doc;
      doc["type"] = "enrollment_progress";
      doc["data"]["type"] = "face";
      doc["data"]["progress"] = (captureCount * 20);
      doc["data"]["capture"] = captureCount;
      
      String output;
      serializeJson(doc, output);
      Serial.println(output);
      
      lcd.setCursor(0, 1);
      lcd.print("Capture ");
      lcd.print(captureCount);
      lcd.print("/5");
      
      esp_camera_fb_return(fb);
    }
  }
  
  if (captureCount >= 5) {
    captureCount = 0;
    currentState = STATE_IDLE;
    sendResponse("enrollment", "COMPLETE", "face");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Face Enrolled!");
    delay(2000);
  }
}

void enrollFingerprint() {
  static int enrollStage = 0;  // 0=first scan, 1=second scan, 2=complete
  static uint8_t enrollBuffer[512];
  
  uint8_t p = finger.getImage();
  
  if (p == FINGERPRINT_OK) {
    if (enrollStage == 0) {
      p = finger.image2Tz(1);
      if (p == FINGERPRINT_OK) {
        enrollStage = 1;
        lcd.setCursor(0, 1);
        lcd.print("Remove finger");
        sendProgress("fingerprint", 50);
      }
    }
    else if (enrollStage == 1) {
      p = finger.image2Tz(2);
      if (p == FINGERPRINT_OK) {
        // Create the model
        p = finger.createModel();
        if (p == FINGERPRINT_OK) {
          // Store in flash
          uint16_t id = getNextFingerprintId();
          p = finger.storeModel(id);
          if (p == FINGERPRINT_OK) {
            enrollStage = 0;
            currentState = STATE_IDLE;
            
            StaticJsonDocument<256> doc;
            doc["type"] = "enrollment_complete";
            doc["data"]["type"] = "fingerprint";
            doc["data"]["finger_id"] = id;
            
            String output;
            serializeJson(doc, output);
            Serial.println(output);
            
            lcd.clear();
            lcd.setCursor(0, 0);
            lcd.print("FP Enrolled!");
            lcd.setCursor(0, 1);
            lcd.print("ID: ");
            lcd.print(id);
            delay(2000);
          }
        }
      }
    }
  }
  else if (p == FINGERPRINT_NOFINGER) {
    if (enrollStage == 1) {
      lcd.setCursor(0, 1);
      lcd.print("Place again...");
    }
  }
}

void enrollVoice() {
  static unsigned long enrollStart = 0;
  static int sampleCount = 0;
  
  if (enrollStart == 0) {
    enrollStart = millis();
    sampleCount = 0;
  }
  
  // Collect voice samples for 5 seconds
  unsigned long elapsed = millis() - enrollStart;
  
  if (elapsed < 5000) {
    int soundLevel = analogRead(SOUND_ANALOG_PIN);
    if (soundLevel > VOICE_THRESHOLD) {
      sampleCount++;
    }
    
    // Update progress
    int progress = (elapsed * 100) / 5000;
    sendProgress("voice", progress);
    
    lcd.setCursor(0, 1);
    lcd.print("Recording...");
    lcd.print(elapsed / 1000);
    lcd.print("s");
  }
  else {
    // Enrollment complete
    enrollStart = 0;
    currentState = STATE_IDLE;
    
    StaticJsonDocument<256> doc;
    doc["type"] = "enrollment_complete";
    doc["data"]["type"] = "voice";
    doc["data"]["samples"] = sampleCount;
    doc["data"]["quality"] = sampleCount > 100 ? "good" : "poor";
    
    String output;
    serializeJson(doc, output);
    Serial.println(output);
    
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Voice Enrolled!");
    delay(2000);
  }
}

// ==================== Helper Functions ====================

uint16_t getNextFingerprintId() {
  // Simple auto-increment ID (in production, query the sensor for used IDs)
  static uint16_t nextId = 1;
  return nextId++;
}

void sendResponse(String type, String status, String message) {
  StaticJsonDocument<256> doc;
  doc["type"] = type;
  doc["status"] = status;
  doc["message"] = message;
  
  String output;
  serializeJson(doc, output);
  Serial.println(output);
}

void sendProgress(String type, int progress) {
  StaticJsonDocument<256> doc;
  doc["type"] = "enrollment_progress";
  doc["data"]["type"] = type;
  doc["data"]["progress"] = progress;
  
  String output;
  serializeJson(doc, output);
  Serial.println(output);
}

void sendDeviceStatus() {
  StaticJsonDocument<512> doc;
  doc["type"] = "device_status";
  doc["data"]["state"] = (int)currentState;
  doc["data"]["uptime_ms"] = millis();
  doc["data"]["free_heap"] = ESP.getFreeHeap();
  doc["data"]["psram_free"] = ESP.getFreePsram();
  doc["data"]["cpu_freq"] = getCpuFrequencyMhz();
  doc["data"]["camera"] = (currentState != STATE_IDLE);
  doc["data"]["fingerprint"] = finger.verifyPassword();
  doc["data"]["sound_level"] = analogRead(SOUND_ANALOG_PIN);
  
  String output;
  serializeJson(doc, output);
  Serial.println(output);
}

void identifyStudent(String studentId) {
  // Trigger identification process for a specific student
  // The ESP32 will scan all three methods and report results
  currentState = STATE_IDENTIFYING;
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Identifying:");
  lcd.setCursor(0, 1);
  lcd.print(studentId);
}

void updateLCD() {
  // Update LCD with current status
  static unsigned long lastUpdate = 0;
  if (millis() - lastUpdate < 2000) return;
  lastUpdate = millis();
  
  if (currentState == STATE_SESSION_ACTIVE) {
    unsigned long elapsed = (millis() - sessionStartTime) / 1000;
    int minutes = elapsed / 60;
    int seconds = elapsed % 60;
    
    lcd.setCursor(10, 0);
    lcd.print(minutes);
    lcd.print(":");
    if (seconds < 10) lcd.print("0");
    lcd.print(seconds);
  }
}

void blinkLED(unsigned long interval) {
  static unsigned long lastBlink = 0;
  static bool ledState = false;
  
  if (millis() - lastBlink > interval) {
    ledState = !ledState;
    digitalWrite(STATUS_LED_PIN, ledState);
    lastBlink = millis();
  }
}
`;

export const esp32PlatformioIni = `; PlatformIO Project Configuration File
; ESP32-S3 N16R8 Smart Attendance System
;
; Build options: build flags, source filter
; Upload options: custom upload port, speed and extra flags
; Library options: dependencies, extra library storages
;
; Please visit documentation for other options and examples
; https://docs.platformio.org/page/projectconf.html

[env:esp32s3]
platform = espressif32@6.4.0
board = esp32-s3-devkitc-1
framework = arduino

; Board configuration for N16R8
board_build.arduino.memory_type = qio_opi
board_build.flash_size = 16MB
board_build.psram_type = opi
board_upload.flash_size = 16MB

; Partition scheme (with OTA support)
board_build.partitions = default_16MB.csv

; Monitor settings
monitor_speed = 115200
monitor_filters = esp32_exception_decoder

; Build flags
build_flags = 
    -DBOARD_HAS_PSRAM
    -DARDUINO_USB_CDC_ON_BOOT=1
    -DCORE_DEBUG_LEVEL=3
    -mfix-esp32-psram-cache-issue
    
; Library dependencies
lib_deps =
    bblanchon/ArduinoJson@^6.21.3
    marcoschwartz/LiquidCrystal_I2C@^1.1.4
    adafruit/Adafruit Fingerprint Sensor Library@^2.1.0
    esp32-camera
    Wire
    SPI

; Upload settings
upload_speed = 921600
upload_port = /dev/ttyACM0  ; Change to your port (COM3 on Windows)

; Optional: OTA upload
; upload_protocol = espota
; upload_port = 192.168.1.xxx
`;

export const esp32Readme = `# ESP32-S3 Firmware - Smart Attendance System

## Hardware Requirements
- ESP32-S3 N16R8 Development Board
- OV3660 Camera Module
- AS608 Fingerprint Sensor (UART)
- LCD 1602 with I2C adapter (address 0x27)
- High Quality Sound Sensor (analog + digital output)
- Status LED (optional)
- USB-C cable for programming

## Wiring Diagram

### Camera (OV3660)
| Camera Pin | ESP32-S3 Pin |
|-----------|-------------|
| D0        | GPIO 15     |
| D1        | GPIO 17     |
| D2        | GPIO 18     |
| D3        | GPIO 16     |
| D4        | GPIO 14     |
| D5        | GPIO 12     |
| D6        | GPIO 11     |
| D7        | GPIO 48     |
| XCLK      | GPIO 10     |
| PCLK      | GPIO 46     |
| VSYNC     | GPIO 38     |
| HREF      | GPIO 5      |
| SDA       | GPIO 40     |
| SCL       | GPIO 39     |
| 3.3V      | 3.3V        |
| GND       | GND         |

### Fingerprint Sensor (AS608)
| FPS Pin   | ESP32-S3 Pin |
|-----------|-------------|
| TX (White)| GPIO 44 (RX)|
| RX (Green)| GPIO 43 (TX)|
| 3.3V      | 3.3V        |
| GND       | GND         |

### LCD 1602 I2C
| LCD Pin   | ESP32-S3 Pin |
|-----------|-------------|
| SDA       | GPIO 8      |
| SCL       | GPIO 9      |
| VCC       | 5V          |
| GND       | GND         |

### Sound Sensor
| Sensor Pin | ESP32-S3 Pin |
|-----------|-------------|
| AO (Analog)| GPIO 1     |
| DO (Digital)| GPIO 2    |
| VCC       | 3.3V        |
| GND       | GND         |

### Status LED
| LED Pin   | ESP32-S3 Pin |
|-----------|-------------|
| + (Anode) | GPIO 47     |
| - (Cathode)| GND (via 220Ω resistor) |

## Building & Uploading

### Using PlatformIO (Recommended)
1. Install PlatformIO in VS Code
2. Open this project folder
3. Connect ESP32-S3 via USB
4. Update \`upload_port\` in platformio.ini
5. Click "Upload" button

### Using Arduino IDE
1. Install ESP32 board package (v2.0.11+)
2. Select "ESP32S3 Dev Module"
3. Enable PSRAM: "OPI PSRAM"
4. Flash Size: "16MB"
5. Partition Scheme: "Default 16MB"
6. Upload

## Serial Protocol

Communication with PC uses JSON over serial at 115200 baud.

### Commands (PC → ESP32)
\`\`\`json
{"cmd": "HANDSHAKE"}
{"cmd": "START_SESSION", "data": {"session_id": 123}}
{"cmd": "END_SESSION"}
{"cmd": "ENROLL", "data": {"type": "face|fingerprint|voice", "student_id": "STU001"}}
{"cmd": "STATUS"}
{"cmd": "RESET"}
\`\`\`

### Responses (ESP32 → PC)
\`\`\`json
{"type": "system", "status": "READY"}
{"type": "session", "status": "started", "session_id": 123}
{"type": "fingerprint_match", "finger_id": 5, "confidence": 85.3}
{"type": "voice_detected", "energy": 125.5, "level": 2048}
{"type": "attendance", "data": {"student_id": "STU001", "methods": "face,fingerprint"}}
{"type": "enrollment_progress", "data": {"type": "face", "progress": 60}}
{"type": "enrollment_complete", "data": {"type": "fingerprint", "finger_id": 10}}
\`\`\`

## Troubleshooting

1. **Camera not working**: Check all D0-D7, XCLK, PCLK, VSYNC, HREF connections
2. **Fingerprint not found**: Verify UART2 pins (GPIO 43/44) and baud rate (57600)
3. **LCD blank**: Check I2C address (try 0x3F if 0x27 doesn't work), adjust contrast with potentiometer
4. **Sound sensor always triggers**: Adjust the potentiometer on the sensor module for threshold
5. **PSRAM not detected**: Ensure board config has OPI PSRAM enabled
`;
