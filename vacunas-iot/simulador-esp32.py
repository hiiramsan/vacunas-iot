import paho.mqtt.client as mqtt
import json
import time
import random

# Configuración MQTT
BROKER = "localhost"  # o la IP de tu servidor
PORT = 1883
TOPIC = "sensor/cargamento/001"
USERNAME = "guest"
PASSWORD = "guest"

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("Conectado a RabbitMQ MQTT")
    else:
        print(f"Error de conexión: {rc}")

def on_publish(client, userdata, mid):
    print(f"✓ Mensaje confirmado (ID: {mid})")

# Crear cliente MQTT
client = mqtt.Client()
client.username_pw_set(USERNAME, PASSWORD)
client.on_connect = on_connect
client.on_publish = on_publish

# Conectar a RabbitMQ
print("Conectando a RabbitMQ MQTT...")
client.connect(BROKER, PORT, 60)
client.loop_start()

# Enviar datos cada 5 segundos
try:
    contador = 0
    while True:
        contador += 1
        data = {
            "device": "sensor-001",
            "peso": round(random.uniform(20.0, 30.0), 2),
            "temperatura": round(random.uniform(2.0, 8.0), 2)
        }
        
        payload = json.dumps(data)
        result = client.publish(TOPIC, payload, qos=1)
        
        if result.rc == 0:
            print(f"[{contador}] Enviado: {payload}")
        else:
            print(f"Error al enviar (rc={result.rc})")
        
        time.sleep(5)

except KeyboardInterrupt:
    print("\nDeteniendo publicación...")
    client.loop_stop()
    client.disconnect()
