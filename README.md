# vacunas-iot
Proyecto IoT: Empresa Repartidora de Vacunas

## Arquitectura del Sistema

```
ESP32 Simulator → MQTT (1883) → RabbitMQ → AMQP Queue → Microservicio NestJS → InfluxDB
```

### Componentes:
- **Simulador ESP32**: Script Python que simula dispositivos IoT enviando datos de sensores
- **RabbitMQ**: Broker de mensajes con plugin MQTT habilitado
- **Cargamento Service**: Microservicio NestJS que consume mensajes y almacena datos
- **InfluxDB**: Base de datos de series temporales para almacenar métricas de sensores
- **API Gateway**: Gateway para la aplicación web
- **Web App**: Interfaz Next.js para visualización

## Inicio Rápido

### Prerequisitos

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose
- Python 3.8+ (para el simulador ESP32)

### 1. Instalar Dependencias

```bash
# Instalar dependencias del workspace
pnpm install

# Instalar dependencias de Python para el simulador
pip install paho-mqtt
```

### 2. Construir Imágenes Docker

```bash
# Construir la imagen del microservicio de cargamento
docker-compose build cargamento-service
```

### 3. Levantar Servicios con Docker Compose

```bash
# Levantar todos los servicios (RabbitMQ, InfluxDB, Cargamento Service)
docker-compose up -d

# Ver logs de todos los servicios
docker-compose logs -f

# Ver logs de un servicio específico
docker logs cargamento-service -f
```

### 4. Configurar RabbitMQ

El sistema requiere configurar una cola y un binding en RabbitMQ para enrutar mensajes MQTT:

```bash
# Crear la cola 'cargamento_queue'
docker exec rabbitmq rabbitmqadmin declare queue name=cargamento_queue durable=true

# Crear el binding desde el exchange MQTT a la cola
docker exec rabbitmq rabbitmqadmin declare binding source=amq.topic destination=cargamento_queue routing_key='sensor.#'
```

### 5. Ejecutar el Simulador ESP32

```bash
# Ejecutar el simulador (envía datos cada 5 segundos)
python simulador-esp32.py
```

El simulador comenzará a enviar datos JSON con el siguiente formato:
```json
{
  "device": "sensor-001",
  "peso": 25.5,
  "temperatura": 4.2
}
```

## Acceso a Interfaces Web

| Servicio | URL | Credenciales |
|----------|-----|--------------|
| RabbitMQ Management | http://localhost:15672 | guest / guest |
| InfluxDB | http://localhost:8086 | admin / admin123 |
| API Gateway | http://localhost:3000/api | - |

## Desarrollo

### Ejecutar Aplicaciones en Modo Desarrollo

```bash
# Web app (Next.js)
pnpm nx dev vacunas-iot

# API Gateway
pnpm nx serve api-gateway

# Reporte de Envíos
pnpm nx serve reporte-envios
```

### Construir para Producción

```bash
# Construir todas las aplicaciones
pnpm nx build vacunas-iot
pnpm nx build api-gateway
pnpm nx build cargamento-service
pnpm nx build reporte-envios
```

## 📦 Estructura del Proyecto

```
vacunas-iot/
├── apps/
│   ├── api/
│   │   ├── api-gateway/           # Gateway API principal
│   │   ├── cargamento-service/    # Microservicio de procesamiento IoT
│   │   └── reporte-envios/        # Servicio de reportes
│   └── web/
│       └── vacunas-iot/           # Aplicación web Next.js
├── libs/
│   ├── shared-dtos/               # DTOs compartidos
│   └── shared-entities/           # Entidades compartidas
├── docker-compose.yaml            # Configuración de servicios
├── rabbitmq-enabled-plugins       # Configuración de plugins RabbitMQ
└── simulador-esp32.py             # Simulador de dispositivo IoT
```

## Configuración de RabbitMQ

### Puertos:
- **1883**: MQTT (protocolo IoT)
- **5672**: AMQP (protocolo de mensajería)
- **15672**: Management UI (interfaz web)

### Cola y Bindings:
- **Cola**: `cargamento_queue` (durable)
- **Exchange**: `amq.topic` (MQTT default)
- **Routing Key**: `sensor.#` (todos los mensajes que empiecen con "sensor/")

### Verificar Mensajes en RabbitMQ:
1. Acceder a http://localhost:15672
2. Login con `guest` / `guest`
3. Ir a la pestaña "Queues"
4. Hacer clic en `cargamento_queue`
5. Ver mensajes en "Get messages"

## Configuración de InfluxDB

### Credenciales:
- **Usuario**: admin
- **Password**: admin123
- **Organization**: myorg
- **Bucket**: cargamentos
- **Token**: mytoken

### Verificar Datos:
1. Acceder a http://localhost:8086
2. Login con admin / admin123
3. Ir a "Data Explorer"
4. Seleccionar bucket "cargamentos"
5. Ver measurement "sensor_data"

## Comandos Útiles

### Docker

```bash
# Ver estado de contenedores
docker-compose ps

# Detener todos los servicios
docker-compose down

# Ver logs en tiempo real
docker-compose logs -f

# Reiniciar un servicio específico
docker-compose restart cargamento-service

# Limpiar todo (contenedores, volúmenes, imágenes)
docker-compose down -v
docker system prune -a
```

### Debugging

```bash
# Ver logs del microservicio
docker logs cargamento-service --tail=50

# Ver logs de RabbitMQ
docker logs rabbitmq --tail=50

# Ver logs de InfluxDB
docker logs influxdb --tail=50

# Inspeccionar la cola de RabbitMQ
docker exec rabbitmq rabbitmqadmin list queues

# Inspeccionar bindings
docker exec rabbitmq rabbitmqadmin list bindings
```

### Simulador ESP32

```bash
# Ejecutar simulador con logs detallados
python simulador-esp32.py

# Modificar frecuencia de envío (editar línea en simulador-esp32.py):
# time.sleep(5)  # Cambiar a los segundos deseados
```
## Flujo de Datos Completo

1. **Simulador ESP32** genera datos de sensores (peso y temperatura)
2. **Publicación MQTT** al tópico `sensor/cargamento/001` en el puerto 1883
3. **RabbitMQ** recibe el mensaje y lo enruta a través del exchange `amq.topic`
4. **Binding** dirige mensajes con routing key `sensor.#` a `cargamento_queue`
5. **Cargamento Service** consume mensajes de la cola usando AMQP
6. **Procesamiento** parsea JSON y valida datos
7. **Almacenamiento** guarda en InfluxDB en el bucket `cargamentos`
8. **Visualización** disponible en InfluxDB UI o a través de la API

## Tecnologías Utilizadas

- **Nx**: Monorepo toolkit v22.0.2
- **NestJS**: Framework de Node.js para microservicios
- **Next.js**: Framework de React para la web app
- **RabbitMQ**: Message broker con plugin MQTT
- **InfluxDB**: Base de datos de series temporales
- **Docker & Docker Compose**: Containerización
- **TypeScript**: Lenguaje de programación
- **pnpm**: Package manager
- **Python paho-mqtt**: Librería MQTT para el simulador