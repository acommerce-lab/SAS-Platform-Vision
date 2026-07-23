# SAS Platform
# Architecture Decision Records (ADR)

Version: 2.0

Status: Living Document

Last Updated: 2026-07-23

---

# Purpose

This document records every architectural decision made during the lifetime of the SAS Platform.

Every decision includes:

- Context
- Decision
- Alternatives
- Consequences
- Status

No architectural decision may be changed without updating this document.

---

# Decision Status

Accepted

Proposed

Deprecated

Rejected

Superseded

---

# ADR-001
## Backend Framework

Status

Accepted

### Context

The platform requires a mature ecosystem, excellent AI-agent compatibility, high stability and a low learning curve.

### Decision

Use Express.js.

### Alternatives

- Fastify
- NestJS
- Koa

### Consequences

Pros

- Huge ecosystem
- Excellent documentation
- AI-friendly
- Easy onboarding

Cons

- Slightly lower performance than Fastify

---

# ADR-002
## Backend Language

Status

Accepted

### Decision

Node.js with JavaScript.

### Rationale

- Faster development
- Lower complexity
- Better compatibility with AI code generation

---

# ADR-003
## Frontend Stack

Status

Accepted

### Decision

React

TypeScript

Vite

### Alternatives

Next.js

Angular

Vue

---

# ADR-004
## Database

Status

Accepted

### Decision

PostgreSQL

### Alternatives

MySQL

MariaDB

MongoDB

SQLite

### Rationale

Relational business data.

Transactions.

Strong consistency.

---

# ADR-005
## ORM

Status

Accepted

### Decision

Prisma ORM

### Alternatives

TypeORM

Knex

Raw SQL

### Reason

Migration support.

Developer experience.

Excellent AI support.

---

# ADR-006
## Authentication

Status

Accepted

### Decision

Firebase Authentication

Email Verification

HttpOnly Cookies

Refresh Tokens

Short-lived Access Tokens

---

# ADR-007
## Notifications

Status

Accepted

### Decision

Firebase Cloud Messaging

### Alternatives

Socket.IO

Polling

SignalR

---

# ADR-008
## Storage

Status

Accepted

### Decision

Firebase Storage

### Used For

Waybills

Attachments

Profile Images

---

# ADR-009
## Maps

Status

Accepted

### Decision

OpenStreetMap

OSRM

### Alternatives

Google Maps

Mapbox

HERE Maps

### Reason

No licensing cost.

Production-ready.

---

# ADR-010
## PDF Engine

Status

Accepted

### Decision

Puppeteer

### Alternatives

PDFKit

wkhtmltopdf

Playwright

---

# ADR-011
## Architecture Style

Status

Accepted

### Decision

Modular Monolith

### Reason

Current project size.

Simple deployment.

Easy future migration.

### Future

Can evolve into Microservices.

---

# ADR-012
## Integration Style

Status

Accepted

### Decision

REST APIs

Domain Events

### Internal Communication

Service Layer

Repository Interfaces

---

# ADR-013
## Workflow Engine

Status

Accepted

### Decision

Finite State Machine

### Reason

Predictable transitions.

Business rule enforcement.

---

# ADR-014
## Business Logic

Status

Accepted

### Decision

Business logic belongs only inside Services.

Never inside

Controllers

Repositories

Routes

---

# ADR-015
## Repositories

Status

Accepted

### Decision

Repositories access data only.

No business rules.

---

# ADR-016
## Validation

Status

Accepted

### Decision

Centralized validation middleware.

---

# ADR-017
## Error Handling

Status

Accepted

### Decision

Centralized Error Handler.

Official Error Catalog only.

---

# ADR-018
## Logging

Status

Accepted

### Decision

Centralized structured logging.

Correlation IDs.

Audit logging.

---

# ADR-019
## Configuration

Status

Accepted

### Decision

Environment Variables only.

Never hardcode secrets.

---

# ADR-020
## Deployment Strategy

Status

Accepted

### Decision

Production-first.

No mock implementations.

No demo code.

No local-only features.

---

# ADR-021
## Notification Architecture

Status

Accepted

### Decision

Notification Module listens to Domain Events.

Business modules never send notifications directly.

---

# ADR-022
## Pricing Architecture

Status

Accepted

### Decision

Pricing is a Domain Service.

Not an independent business module.

---

# ADR-023
## Waybill Generation

Status

Accepted

### Decision

Waybill is generated automatically after pricing approval.

No manual generation.

---

# ADR-024
## Customer Entity

Status

Accepted

### Decision

Customer is a business contact.

Not a platform user.

No authentication.

---

# ADR-025
## Vehicle Assignment

Status

Accepted

### Decision

Every shipment must reference:

- Carrier
- Driver
- Truck

No shipment may exist with incomplete assignment after carrier allocation.

---

# ADR-026
## External Providers

Status

Accepted

### Decision

All providers must be abstracted behind Provider Interfaces.

Business modules never depend on SDKs directly.

---

# ADR-027
## Testing

Status

Accepted

### Backend

Jest

Supertest

### Frontend

Vitest

React Testing Library

---

# ADR-028
## Coding Style

Status

Accepted

### Decision

SOLID

DRY

KISS

Clean Architecture

Single Responsibility

Dependency Injection where appropriate.

---

# ADR-029
## Future Expansion

Status

Accepted

The architecture must support future modules without breaking existing ones.

Reserved Modules

- Marine Shipping
- Air Shipping
- Customs
- Insurance
- Financial Services
- Electronic Invoicing
- B2B Marketplace

---

# ADR-030
## AI Agent Governance

Status

Accepted

AI Agents must:

- Read documentation first.
- Never invent business rules.
- Never skip implementation phases.
- Never modify architecture without updating ADR.
- Stop after each approved phase.

---

# ADR Maintenance Rules

Every new architectural decision must:

1. Receive a new ADR number.
2. Include rationale.
3. Include alternatives.
4. Include consequences.
5. Update affected documents.

---

# Definition of Done

An architectural decision is complete only if:

✓ Context documented.

✓ Decision documented.

✓ Alternatives evaluated.

✓ Consequences identified.

✓ Status recorded.

✓ Related documents updated.

---

# Changelog

| Version | Date | Notes |
|----------|------------|----------------|
| 2.0 | 2026-07-23 | Complete rewrite and consolidation of all architecture decisions. |