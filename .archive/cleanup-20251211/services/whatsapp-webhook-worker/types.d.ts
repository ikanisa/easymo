declare module "@easymo/messaging" {
  export const KafkaFactory: any;
  export const KafkaConsumer: any;
  export const KafkaProducer: any;
  export const IdempotencyStore: any;
}

declare module "ioredis" {
  const Redis: any;
  export default Redis;
}

declare module "pino" {
  const pino: any;
  export default pino;
}

declare module "pino-http" {
  const pinoHttp: any;
  export default pinoHttp;
}
