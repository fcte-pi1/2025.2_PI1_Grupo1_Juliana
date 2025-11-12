#include "mqtt.h"
#include <Arduino.h>
#include <WiFi.h>

#define MQTT_HOST   "test.mosquitto.org"
#define MQTT_PORT   1883

static WiFiClient    s_net;
static PubSubClient  s_mqtt(s_net);

static const char*   s_host   = nullptr;
static uint16_t      s_port   = 1883;
static String        s_clientId;

static unsigned long s_lastAttemptMs = 0;
static const unsigned RETRY_MS = 3000;

static MqttMsgCb     s_userCb = nullptr;

static const size_t  MAX_SUBS = 8;
static String        s_subTopics[MAX_SUBS];
static uint8_t       s_subQos[MAX_SUBS];
static size_t        s_subCount = 0;
static String  s_cmd_topic;

static void resubscribe_all() {
  for (size_t i = 0; i < s_subCount; ++i) {
    if (s_subTopics[i].length() == 0) continue;
    bool ok = s_mqtt.subscribe(s_subTopics[i].c_str(), s_subQos[i]);
  }
}

static bool ensure_connected_once() {
  if (s_mqtt.connected()) return true;

  const unsigned long now = millis();
  if (now - s_lastAttemptMs < RETRY_MS) return false;
  s_lastAttemptMs = now;

  if (!s_host) return false;
  if (s_clientId.isEmpty()) s_clientId = "ESP32-main";

  Serial.print("[MQTT] connecting to "); Serial.print(s_host);
  Serial.print(":"); Serial.print(s_port);
  Serial.print(" as "); Serial.println(s_clientId);

  if (s_mqtt.connect(s_clientId.c_str())) {
    Serial.println("[MQTT] connected");
    resubscribe_all();
    return true;
  }
  Serial.print("[MQTT] connect failed, state="); Serial.println(s_mqtt.state());
  return false;
}

static bool publish_impl(const char* topic, const char* payloadJson) {
  if (!topic || !payloadJson) return false;
  if (!s_mqtt.connected()) {
    if (!ensure_connected_once()) return false;
  }
  return s_mqtt.publish(topic, payloadJson);
}

static void internal_mqtt_cb(char* topic, uint8_t* payload, unsigned int len) {
  if (!s_userCb) return;

  String tmp; tmp.reserve(len + 1);
  for (unsigned int i = 0; i < len; ++i) tmp += (char)payload[i];
  s_userCb(topic, tmp.c_str(), len);
}

void mqtt_init() {
  s_host     = MQTT_HOST;
  s_port     = MQTT_PORT;
  s_clientId = "ESP32-main";

  s_mqtt.setServer(s_host, s_port);
  s_mqtt.setKeepAlive(60);
  s_mqtt.setSocketTimeout(120);
  s_mqtt.setCallback(internal_mqtt_cb);

  ensure_connected_once();
}

void mqtt_loop() {
  if (!s_mqtt.connected()) {
    ensure_connected_once();
  }
  s_mqtt.loop();
}

bool mqtt_send_telemetry(const char* topic, const char* jsonPayload) {
  return publish_impl(topic, jsonPayload);
}

bool mqtt_send_telemetry_kv(const char* topic, const char* key, const char* value) {
  if (!topic || !key || !value) return false;
  String json; json.reserve(32 + strlen(key) + strlen(value));
  json += "{\""; json += key; json += "\":\""; json += value; json += "\"}";
  return publish_impl(topic, json.c_str());
}

bool mqtt_send_telemetry_kv_num(const char* topic, const char* key, long value) {
  if (!topic || !key) return false;
  String json; json.reserve(32 + strlen(key) + 16);
  json += "{\""; json += key; json += "\":"; json += value; json += "}";
  return publish_impl(topic, json.c_str());
}

WiFiClient&   mqtt_net()    { return s_net;  }
PubSubClient& mqtt_client() { return s_mqtt; }

void mqtt_on_message(MqttMsgCb cb) {
  s_userCb = cb;
}

bool mqtt_subscribe(const char* topic, uint8_t qos) {
  if (!topic || !*topic) return false;

  size_t idx = SIZE_MAX;
  for (size_t i=0;i<s_subCount;i++) {
    if (s_subTopics[i] == topic) { idx = i; break; }
  }
  if (idx == SIZE_MAX) {
    if (s_subCount < MAX_SUBS) {
      idx = s_subCount++;
    } else {
      return false;
    }
  }
  s_subTopics[idx] = topic;
  s_subQos[idx]    = qos;

  if (!s_mqtt.connected()) {
    return true;
  }

  bool ok = s_mqtt.subscribe(topic, qos);
  Serial.print("[MQTT] subscribe "); Serial.print(topic);
  Serial.print(" => "); Serial.println(ok ? "OK" : "FAIL");
  return ok;
}

static void led_cmd_handler(const char* topic, const char* payload, unsigned int len) {
  if (s_cmd_topic.length() == 0) return;
  if (!topic || strcmp(topic, s_cmd_topic.c_str()) != 0) return;
  if (!payload) return;
  Serial.println(payload);
}

void my_led_bind_cmd_topic(const char* topic) {
  if (!topic) return;
  s_cmd_topic = topic;
  mqtt_on_message(led_cmd_handler);
  mqtt_subscribe(s_cmd_topic.c_str(), 0);
  Serial.print("[LED] bind cmd topic = "); Serial.println(s_cmd_topic);
}
