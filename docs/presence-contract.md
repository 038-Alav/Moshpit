# Presence Contract — propuesta para Demo 1

## Principio

La presencia de Pit se deriva de leases por instancia de aplicación. No se deriva directamente del número de conexiones que Centrifugo informa ni del número de dispositivos físicos.

## PresenceLease

Campos propuestos:

- `id`
- `pit_id`
- `identity_id`
- `client_instance_id`
- `created_at`
- `last_heartbeat_at`
- `expires_at`
- `released_at`

El servidor deriva `identity_id` desde la autenticación. `client_instance_id` es un identificador opaco por instancia de aplicación, no un identificador de hardware ni una credencial.

## Ciclo

1. La instancia solicita una lease después de validar la membresía y establecer la suscripción realtime.
2. Envía heartbeat HTTP cada 15 segundos.
3. El servidor calcula `expires_at` usando el reloj de PostgreSQL.
4. La lease deja de contar cuando expira.
5. La salida explícita intenta liberar la lease, pero no es necesaria para garantizar corrección.

TTL inicial propuesto: 45 segundos. Ambos intervalos son configurables y deben probarse con suspensión de pestañas, pérdida de red y reconexión.

## Agregación por identidad

Una identidad está conectada a un Pit cuando existe al menos una lease vigente para esa combinación `pit_id` + `identity_id`.

Varias pestañas/dispositivos no multiplican la membresía, el peso de voto ni la antigüedad.

## Sucesión de Admin

- La sucesión comienza cuando no queda ningún Admin conectado.
- La gracia acordada permanece en 180 segundos.
- Si un Admin vuelve antes de la promoción, se cancela la espera.
- Si vuelve después de la promoción, no se revierte la promoción.
- La promoción se realiza sobre Crowd conectado más antiguo por `joined_at`.
- Empates se resuelven aleatoriamente en el servidor.
- Si no existe Crowd conectado cuando corresponde, el Pit termina.
- `Skip wait` usa la misma operación transaccional que la promoción.

## Concurrencia

La renovación de lease, la evaluación de sucesión, `Skip wait` y la promoción deben serializarse por Pit (por ejemplo, `SELECT ... FOR UPDATE` sobre la fila del Pit). Las decisiones se toman contra el estado vigente en PostgreSQL.

## Separación

- Expirar/liberar una lease no elimina `PitMembership`.
- Rejoin conserva la membresía y su `joined_at` original.
- La presencia de Centrifugo puede usarse para diagnóstico, no como fuente de verdad de las reglas de Pit.
