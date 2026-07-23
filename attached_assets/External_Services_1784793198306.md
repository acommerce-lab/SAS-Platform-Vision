# SAS Platform
# External Services Specification

Version: 1.0

Status: Living Document

Last Updated: 2026-07-23

---

# Purpose

This document defines every external service used by the SAS Platform.

It specifies:

- Service ownership
- Responsibilities
- SDKs
- Environment variables
- Failure handling
- Retry policies
- Timeouts
- Security requirements

No external service may be integrated unless documented here.

---

# Supported Providers

| Service | Provider |
|----------|----------|
| Authentication | Firebase Authentication |
| Push Notifications | Firebase Cloud Messaging |
| File Storage | Firebase Storage |
| Maps & Routing | OpenStreetMap + OSRM |
| Email | SMTP Provider |
| Database | PostgreSQL |
| PDF Generation | Puppeteer |

---

# Firebase

## Services Used

- Authentication
- Cloud Messaging
- Storage

---

## Required Environment Variables

FIREBASE_API_KEY

FIREBASE_AUTH_DOMAIN

FIREBASE_PROJECT_ID

FIREBASE_STORAGE_BUCKET

FIREBASE_MESSAGING_SENDER_ID

FIREBASE_APP_ID

FIREBASE_MEASUREMENT_ID

---

## Responsibilities

Authentication

Push Notifications

File Storage

---

## Must Not Be Used For

Business Logic

Shipment Workflow

Pricing Logic

---

## Retry Policy

Authentication

No Retry

---

Push Notification

Retry 3 times

Exponential Backoff

---

Storage Upload

Retry 2 times

---

Timeout

10 Seconds

---

# Maps Provider

Provider

OpenStreetMap

+

OSRM

---

## Responsibilities

Distance Calculation

Route Calculation

Estimated Distance

Estimated Duration

---

## Environment Variables

OSRM_BASE_URL

USER_AGENT

---

## API

GET

/route

---

## Retry

3

---

## Timeout

5 Seconds

---

## Failure

Return

SYSTEM_001

---

# Email Provider

Provider

SMTP

---

## Responsibilities

Account Verification

Password Reset

Shipment Notifications

Support Replies

---

## Environment Variables

SMTP_HOST

SMTP_PORT

SMTP_USER

SMTP_PASSWORD

SMTP_FROM

---

## Retry

3

---

## Timeout

15 Seconds

---

# Storage

Provider

Firebase Storage

---

## Stored Files

Waybill PDF

Support Attachments

User Avatars

---

## Forbidden

Executable Files

Archives

Scripts

---

## Maximum Upload Size

20 MB

---

## Allowed Types

PDF

PNG

JPG

JPEG

WEBP

---

# PDF Generator

Provider

Puppeteer

---

## Responsibilities

Generate Waybill

Render HTML

Create Printable PDF

---

## Output

PDF/A Compatible

---

## Failure

WAYBILL_004

---

# Database

Provider

PostgreSQL

---

## ORM

Prisma

---

## Connection Pool

Enabled

---

## Transactions

Required

---

## Retry

No Retry

---

# Logging

Every provider interaction logs

Timestamp

Provider

Request ID

Correlation ID

Duration

Result

---

Sensitive data

Must Never Be Logged

---

Passwords

Tokens

Secrets

Cookies

Authorization Headers

Firebase Credentials

---

# Monitoring

Track

Latency

Availability

Failures

Retries

Timeouts

---

# Health Checks

Every provider must expose

Healthy

Degraded

Unavailable

---

Health Endpoint

/api/v1/health

---

# Circuit Breaker Rules

If provider fails

More than 5 times

Within 60 seconds

↓

Open Circuit

↓

Wait 60 Seconds

↓

Half Open

↓

Retry

---

# Security

All communication

HTTPS Only

TLS 1.2+

---

Secrets

Environment Variables Only

---

Never Hardcode

API Keys

Tokens

Passwords

Secrets

---

# AI Agent Rules

Never replace providers.

Never add new providers.

Never hardcode credentials.

Never bypass retry policy.

Never ignore provider failures.

Always return official error codes.

---

# Future Providers

Reserved

Payment Gateway

SMS Gateway

ERP Integration

Accounting System

Government APIs

Customs APIs

Insurance APIs

---

# Definition of Done

External integration is complete only if

✓ Environment variables configured

✓ Health checks pass

✓ Retry policy implemented

✓ Timeout implemented

✓ Error mapping implemented

✓ Logging implemented

✓ Security requirements satisfied

---

# Changelog

| Version | Date | Notes |
|----------|------------|----------------|
| 1.0 | 2026-07-23 | Initial Release |