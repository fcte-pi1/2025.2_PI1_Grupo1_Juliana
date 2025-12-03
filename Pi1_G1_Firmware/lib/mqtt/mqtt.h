#pragma once
#include <stdint.h>
#include <PubSubClient.h>
#include <WiFiClient.h>

using PublishFn = bool (*)(const char* topic, const char* payloadJson);

void mqtt_init();

void mqtt_loop();

bool mqtt_send_telemetry(const char* topic, const char* jsonPayload);

bool mqtt_send_telemetry_kv(const char* topic, const char* key, const char* value);

bool mqtt_send_pos(const char* topic, const char* key1,const char* key2, int value_x, int value_y);

template <typename T>
bool mqtt_send_telemetry_kv_num(const char* topic, const char* key, T value) {
  if (!topic || !key) return false;

  String json;
  json.reserve(32 + strlen(key) + 16);

  json += "{\"";
  json += key;
  json += "\":";
  json += String(value);
  json += "}";

  return mqtt_send_telemetry(topic, json.c_str());
}

WiFiClient&   mqtt_net();
PubSubClient& mqtt_client();

using MqttMsgCb = void (*)(const char* topic, const char* payload, unsigned int len);
void mqtt_on_message(MqttMsgCb cb);
bool mqtt_subscribe(const char* topic, uint8_t qos = 0);

void my_led_bind_cmd_topic(const char* topic);