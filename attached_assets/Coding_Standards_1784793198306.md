# SAS Platform
# Coding Standards

Version: 1.0

Status: Living Document

Last Updated: 2026-07-23

---

# Purpose

This document defines the official coding standards for the SAS Platform.

Every contributor and AI Agent must follow these standards.

---

# General Principles

Follow:

- SOLID
- DRY
- KISS
- Clean Code
- Clean Architecture
- Single Responsibility Principle

---

# Language Standards

Backend

Node.js

JavaScript (ES2023)

Frontend

React

TypeScript

---

# Naming Conventions

Folders

kebab-case

Example

shipment-service

---

Files

kebab-case

shipment.controller.js

shipment.service.js

shipment.repository.js

---

Variables

camelCase

Example

shipmentPrice

carrierId

---

Functions

camelCase

calculateShipmentPrice()

---

Classes

PascalCase

ShipmentService

CarrierRepository

---

Constants

UPPER_SNAKE_CASE

MAX_UPLOAD_SIZE

DEFAULT_PAGE_SIZE

---

Enums

PascalCase

ShipmentStatus

---

Database Tables

snake_case

shipment_items

carrier_pricing

---

Database Columns

snake_case

created_at

updated_at

driver_id

---

API Routes

Plural nouns

/api/v1/carriers

/api/v1/shipments

---

HTTP Methods

GET

Read

POST

Create

PUT

Replace

PATCH

Partial Update

DELETE

Delete

---

Controllers

Controllers must:

- Receive Request
- Validate Input
- Call Service
- Return Response

Nothing else.

---

Services

Services contain:

Business Logic

Workflow

Calculations

Validation Rules

---

Repositories

Repositories only:

Read Data

Write Data

Transactions

No Business Logic.

---

Middleware

Used only for:

Authentication

Authorization

Validation

Logging

Rate Limiting

---

Validation

Centralized

Never duplicated.

---

Error Handling

Always use:

Error Catalog

Never throw raw strings.

---

Logging

Structured Logging

Include

Timestamp

Correlation ID

Module

User

Duration

---

Comments

Explain WHY

Never explain obvious code.

---

Functions

Maximum

40 lines

---

Controller Methods

Maximum

30 lines

---

Service Methods

Recommended

60 lines

Split if larger.

---

File Size

Recommended

Maximum

300 lines

Split large files.

---

Imports

Standard Library

↓

Third Party

↓

Internal Modules

↓

Local Files

---

Dependency Rules

Controllers

↓

Services

↓

Repositories

↓

Database

Never reverse dependency.

---

Async Code

Always use

async/await

Never use nested callbacks.

---

Magic Numbers

Forbidden.

Always use constants.

---

Environment Variables

Required for:

Secrets

URLs

Keys

Timeouts

Limits

---

Forbidden

Hardcoded Secrets

Console.log in production

Unused Code

Commented Dead Code

TODO in production

Mock Data

Duplicate Business Logic

Circular Dependencies

---

Git Commit Convention

feat:

fix:

refactor:

test:

docs:

style:

perf:

build:

ci:

chore:

---

Pull Request Rules

One feature

One purpose

One review

---

Formatting

Prettier

Mandatory

---

Linting

ESLint

Mandatory

---

Documentation

Public Services

Public APIs

Complex Business Rules

Must be documented.

---

AI Agent Rules

The AI Agent must:

- Follow these standards.
- Never invent naming conventions.
- Never violate dependency rules.
- Never duplicate business logic.
- Keep modules cohesive.
- Prefer readability over cleverness.

---

Definition of Done

Code is accepted only if:

✓ Lint passes.

✓ Formatting passes.

✓ No duplication.

✓ No circular dependency.

✓ Standards respected.

✓ Documentation updated.

---

Changelog

| Version | Date | Notes |
|----------|------------|----------------|
| 1.0 | 2026-07-23 | Initial Release |