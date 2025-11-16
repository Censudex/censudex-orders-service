# Censudex-Orders-Service

Sistema de creacion y gestion de ordenes para la plataforma de retail Censudex. Este servicio esta implementado como un microservicio que ofrece endpoints que seran consumido por una API Gateway, formando parte de la arquitectura distribuida del sistema censudex.

### 1) Arquitectura, Patron de diseño y Tecnologias

Para cumplir con los requisitos solicitados para este servicio se implementaron las siguientes tecnologias:

* Next.js + express.js: para la creacion del sistema
* MySQL: base de datos para las ordenes de los clientes
* RabbitMQ: message broker que se encarga de la comunicación entre los microservicios.
* Sendgrid: para el envio de correos a los clientes.
* Docker: herramienta usada para levantar rabbidmq, la base de datos y el servicio, con el fin de facilitar el funcionamiento y testeo de la aplicacion
* gRPC: para la comunicación con la API Gateway.

La arquitectura que sigue este servicio puede verse reflejada a continuación:

```mermaid
flowchart TD
    A[API Gateway
    NGINX + gRPC]
    
    subgraph Orders_Service
        B1[gRPC] --> B2[Service Layer]
        B3[HTTP Controller] --> B2
     
    end
    
    subgraph Message_Broker
        C[RabbitMQ]
    end
    subgraph Email sender
        D[Sendgrid]
    end
    
    A --> B1
    B2 --> C
    C --> B2
    B2 --> E[MySQL]
    B2 --> D
```

El patron de diseño seguido para este servicio obede a una arquitectura en capas.

### 2) Metodos disponibles

1_ crearpedido[POST]
2_ consultarEstadoPedidos[GET]
3_ actualizarEstadoPedido[PATCH]
4_ cancelarPedidos[PATCH]
5_ verHistorialPedidos[GET]
6_ verPedidos[GET]

### 3) Instalación y configuración

Requerimientos previos:

  -Docker Dekstop: Debe estar instalado y abierto a la hora de probar el proyecto
  -Node.js: version recomendada 18+
  -Visual studio code: IDE usada para abrir y ejecutar el proyecto. Puede usarse otra IDE que cumpla con la misma funcion que visual studio code.

Archivo .env de prueba: 
```env
PORT=3000

# Base de datos MySQL
DB_HOST=orders-db
DB_NAME=censudex_orders
DB_USER=root
DB_PASSWORD=root

# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672


# SendGrid
SENDGRID_API_KEY=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
FROM_EMAIL=censudex.orderservices@gmail.com

```

Paso 1: copiar el proyecto usando el comando:

  git clone https://github.com/Censudex/censudex-orders-service.git

Paso 2: Ingresar a la carpeta del proyecto, abriendo visual studio desde la carpeta descargada o en el mismo proyecto usar el comando:

  cd .\censudex-orders-service\

Paso 3: Instalamos las dependencias, para ello ejecutamos el siguiente comando: 

  npm install

Paso 4: Configar las varibles de entorno, para esto debmos crear un archi .env en la raiz del proyecto, a la misma altura que la carpeta src. Es posible usar los datos del .env.example de este mismo readme para el .env del proyecto.

Paso 5: Levantamos la base de datos, el servicio orders y el servicio de rabbitmq mediante docker, usando el siguiente comnado:

  docker compose up --build

Nota: si queremos detener el proyecto podemos usar la combinacion de teclas ctrl + c, si queremos bajar el docker usamos el comando *docker compose down*, para levantar el proyecto de nuevo podemos usar el comando *docker compose up*.

Nota2: al exponer la api key de sengrid en este readme automaticamente la pagina de sengrid elimino esta api key, por lo que para usar las funciones de sengrid haria falta crear una cuenta y reemplazar la api key del .env con una propia.

Con estos pasos el proyecto ya esta listo para ser usado por la api getaway o ser probado de forma local mediante postman, como el objetivo del taller es probarlo mediante llamadas gRPC desde la apigetaway sera en la documentacion de esta en donde se definan las llamadas a este y los otros servicios. Por ultimo reiterar en que para el fucnionamiento de este servicio es neceario levantar servicios por medio de docker y estos deben seguir corriendo al momento de usar la api gateway.



