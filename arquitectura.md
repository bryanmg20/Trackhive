backend/src/
├── domain/            # TypeScript puro, sin NestJS ni ORM
│   ├── entities/  value-objects/  errors/
│   └── repositories/  (interfaces: SolicitudRepository, CitaRepository...)
├── application/
│   ├── use-cases/     # uno por acción de negocio
│   ├── dto/
│   └── ports/         # NotificadorPort, RelojPort
├── infrastructure/
│   ├── persistence/   # TypeORM o Prisma, mappers, migraciones, seeds
│   ├── mail/          # implementación SMTP del NotificadorPort
│   └── config/
└── presentation/
    ├── controllers/  guards/  pipes/  filters/