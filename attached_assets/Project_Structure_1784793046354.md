# SAS Platform — Project Structure

الإصدار: v1.0

الحالة: Living Document

آخر تحديث: 23 يوليو 2026

---

# الهدف

تحدد هذه الوثيقة الهيكل الرسمي للمشروع.

أي ملف جديد يجب أن يوضع في مكانه الصحيح.

أي مجلد جديد يجب أن يكون له سبب واضح.

لا يسمح بإنشاء مجلدات عشوائية.

---

# المبادئ

- المشروع عبارة عن Monorepo.
- Backend و Frontend منفصلان.
- كل جزء قابل للتطوير بشكل مستقل.
- جميع Modules مستقلة منطقياً.
- يمنع الاعتماد الدائري (Circular Dependency).

---

# الهيكل العام

```
sas-platform/

├── backend/
├── frontend/
├── docs/
├── scripts/
├── docker/
├── .github/
├── .env.example
├── docker-compose.yml
└── README.md
```

---

# backend

```
backend/

src/

config/

modules/

shared/

providers/

middleware/

routes/

database/

tests/

app.js
```

---

# config

يحتوي فقط على

- Environment
- Database
- Firebase
- Mail
- Logger

ممنوع وضع Business Logic.

---

# modules

كل وحدة أعمال داخل مجلد مستقل.

```
modules/

identity/

carrier/

driver/

truck/

shipper/

product/

shipment/

waybill/

notification/

conversation/

support/

profile/

settings/
```

---

# هيكل كل Module

```
shipment/

controllers/

services/

repositories/

validators/

dto/

entities/

routes/

events/

tests/

index.js
```

---

## controllers

مسؤول عن HTTP فقط.

---

## services

Business Logic.

---

## repositories

الوصول إلى قاعدة البيانات.

---

## validators

التحقق من البيانات.

---

## dto

نماذج الإدخال والإخراج.

---

## entities

نماذج البيانات.

---

## events

الأحداث الداخلية.

---

## tests

اختبارات الوحدة.

---

# shared

يحتوي الأشياء المشتركة.

```
shared/

errors/

utils/

constants/

enums/

interfaces/

types/

helpers/
```

---

## errors

جميع Exceptions.

---

## utils

دوال عامة فقط.

---

## constants

الثوابت.

---

## enums

جميع Enums.

---

## interfaces

العقود المشتركة.

---

## helpers

دوال مساعدة لا تحتوي Business Logic.

---

# providers

تكامل الخدمات الخارجية.

```
providers/

firebase/

mail/

maps/

pdf/

storage/
```

---

لا يسمح باستدعاء الخدمات الخارجية مباشرة من Modules.

تمر جميعها عبر Providers.

---

# middleware

Authentication

Authorization

Validation

Logging

Rate Limiting

Error Handling

---

# routes

تجميع Routes فقط.

---

# database

```
database/

migrations/

seeders/

factories/

schema/
```

---

## migrations

ترحيل قاعدة البيانات.

---

## seeders

بيانات أساسية فقط.

ممنوع بيانات تجريبية.

---

# tests

اختبارات المشروع العامة.

---

# frontend

```
frontend/

src/

assets/

components/

pages/

layouts/

modules/

hooks/

services/

providers/

routes/

store/

theme/

utils/

tests/
```

---

# components

Reusable Components.

---

# pages

صفحات كاملة.

---

# layouts

Layouts الرئيسية.

---

# modules

تقسيم الواجهة بنفس تقسيم Backend.

مثال

Shipment Module

Carrier Module

Identity Module

---

# hooks

Custom React Hooks.

---

# services

استدعاء REST APIs فقط.

---

# providers

Context Providers.

---

# routes

React Router.

---

# store

إدارة الحالة العامة.

---

# theme

ألوان.

Typography.

Spacing.

Icons.

Tokens.

---

# utils

Helpers.

Formatters.

Converters.

---

# assets

```
images/

icons/

fonts/

logos/
```

---

# docs

جميع وثائق المشروع.

```
docs/

00 Product Constitution.md

01 Product Vision.md

02 Business Analysis.md

03 Domain Model.md

04 Database Design.md

05 Functional Specification.md

06 API Specification.md

07 Backend Architecture.md

08 Frontend Architecture.md

09 Deployment.md

10 ADR.md

11 Ubiquitous Language.md

12 Development Rules.md

13 Project Structure.md

14 AI Agent Instructions.md
```

---

# scripts

أدوات المشروع.

مثل

Build

Backup

Deployment

Maintenance

---

# docker

Dockerfiles

Compose

NGINX

---

# .github

GitHub Actions.

Templates.

Issue Forms.

---

# قواعد إنشاء الملفات

أي ملف جديد يجب أن:

- ينتمي إلى Module.
- يحمل اسماً واضحاً.
- يؤدي مسؤولية واحدة.

---

# قواعد الاستيراد

يسمح

Module → Shared

Module → Providers

Module → Config

---

يمنع

Module → Module

إلا عبر واجهات (Interfaces) أو Services معتمدة.

---

# قواعد المجلدات

ممنوع

misc

other

temp

new

old

backup

copy

test2

final

latest

---

# قواعد التسمية

Directories

lowercase

مثال

shipment

carrier

notification

---

Files

PascalCase

إذا كانت Class.

camelCase

إذا كانت Utility.

---

# الأصول

الصور

داخل assets/images

---

الأيقونات

داخل assets/icons

---

الشعارات

داخل assets/logos

---

الخطوط

داخل assets/fonts

---

# ملفات البيئة

يسمح فقط

.env

.env.local

.env.production

.env.example

---

يمنع

رفع ملفات البيئة إلى Git.

---

# ملفات يمنع إنشاؤها

debug.js

temp.js

backup.js

copy.js

old.js

test-final.js

new-version.js

---

# قواعد الذكاء الاصطناعي

إذا احتاج الوكيل إنشاء ملف جديد

يجب أن:

1.

يبحث أولاً عن المكان الصحيح.

2.

إذا وجد مجلد مناسب

يضع الملف داخله.

3.

إذا لم يجد

يتوقف ويقترح إنشاء مجلد جديد.

---

لا يسمح للوكيل

بإنشاء مجلدات من عنده.

---

# Definition of Done

أي تغيير في الهيكل يعتبر مكتملاً فقط إذا:

✅ تم تحديث هذه الوثيقة.

✅ لم يكسر الهيكل الحالي.

✅ لم ينشئ مجلدات عشوائية.

✅ لم يكرر ملفات موجودة.

---

# سجل التعديلات

| Version | Date | Notes |
|---------|------------|----------------|
| v1.0 | 2026-07-23 | الإصدار الأول |