# SAS Platform — Development Rules

الإصدار: v1.0

الحالة: Living Document

آخر تحديث: 23 يوليو 2026

---

# مقدمة

هذه الوثيقة تحدد القواعد الملزمة لتطوير منصة SAS.

تطبق على:

- المطورين
- وكلاء الذكاء الاصطناعي
- أي مساهم في المشروع

أي كود لا يلتزم بهذه الوثيقة يعتبر غير صالح للمراجعة.

---

# المبدأ الأول

## Production Ready Only

لا يسمح بكتابة أي كود غير صالح للإنتاج.

ممنوع

- Demo Code
- Prototype Code
- Temporary Code
- Experimental Code

---

# المبدأ الثاني

## Clean Architecture

يفصل المشروع إلى طبقات واضحة.

Presentation

↓

Application

↓

Domain

↓

Infrastructure

لا يسمح بتجاوز الطبقات.

---

# المبدأ الثالث

## Single Responsibility

كل ملف يؤدي مسؤولية واحدة فقط.

---

# المبدأ الرابع

## Dependency Direction

تعتمد الطبقات العليا على العقود (Interfaces) وليس على التنفيذ.

---

# المبدأ الخامس

## Don't Repeat Yourself (DRY)

أي منطق يتكرر أكثر من مرة يجب عزله.

---

# المبدأ السادس

## Keep It Simple (KISS)

اختر أبسط حل يحقق المتطلبات.

لا تضف تعقيدًا غير مطلوب.

---

# المبدأ السابع

## You Aren't Gonna Need It (YAGNI)

لا تنفذ ميزات مستقبلية قبل الحاجة إليها.

لكن صمم البنية بحيث تسمح بإضافتها.

---

# قواعد المشروع

## ممنوع إنشاء

TODO

FIXME

HACK

TEMP

DUMMY

PLACEHOLDER

FAKE

MOCK

STUB

داخل كود الإنتاج.

---

## ممنوع

ترك كود غير مستخدم.

---

## ممنوع

تعليق كود بدلاً من حذفه.

---

## ممنوع

وجود ملفات فارغة.

---

## ممنوع

إنشاء مجلدات بلا استخدام.

---

## ممنوع

نسخ الكود بين الملفات.

---

# قواعد Controllers

Controller مسؤول عن:

- استقبال الطلب
- التحقق الأولي
- استدعاء Service
- إعادة Response

ولا شيء غير ذلك.

---

ممنوع داخل Controller

Business Logic

Database Queries

Workflow Logic

Pricing Logic

Notification Logic

---

# قواعد Services

Service يحتوي

Business Logic فقط.

---

Service لا يعرف

HTTP

Request

Response

Express

React

DOM

---

# قواعد Repository

Repository مسؤول عن الوصول للبيانات فقط.

---

Repository لا يحتوي

Business Logic

Validation

Notifications

---

# قواعد Validation

كل عملية لها Validator مستقل.

---

لا يسمح

بالتحقق داخل Controller.

---

# قواعد DTO

كل Endpoint

له DTO خاص.

---

لا يسمح

بتمرير Entity مباشرة.

---

# قواعد الأخطاء

كل Error

يكون له

Code

Message

Details

Timestamp

CorrelationId

---

ممنوع

إرجاع Stack Trace للمستخدم.

---

# قواعد Logging

يسجل النظام

Errors

Warnings

Security Events

Authentication Events

Critical Operations

---

لا يسجل

Passwords

Tokens

Secrets

OTP

---

# قواعد الأمن

لا تحفظ كلمات المرور.

يعتمد Firebase Authentication.

---

لا تحفظ

JWT

داخل LocalStorage.

---

المفاتيح

داخل Environment Variables فقط.

---

لا يسمح

بإظهار أي Secret داخل الكود.

---

# قواعد قاعدة البيانات

UUID

لكل Primary Key.

---

كل جدول يحتوي

CreatedAt

UpdatedAt

CreatedBy

UpdatedBy

---

Soft Delete

عند الحاجة.

---

Foreign Keys

إلزامية.

---

Indexes

لكل عمليات البحث المتكررة.

---

# قواعد API

REST فقط.

---

Status Codes صحيحة.

---

JSON فقط.

---

Responses موحدة.

---

Pagination

Filtering

Sorting

تستخدم نفس النمط في جميع Endpoints.

---

# قواعد Frontend

React Components صغيرة.

---

يفضل

أقل من 250 سطرًا.

---

يفضل

استخراج Hooks.

---

يفضل

استخراج Helpers.

---

لا يسمح

بوضع Business Logic داخل Components.

---

# قواعد Styling

لا يسمح

Inline Styles

إلا للضرورة.

---

يعتمد Design Tokens.

---

# قواعد Forms

كل Form

له Validation.

---

كل Error

يعرض للمستخدم بشكل واضح.

---

# قواعد Notifications

كل Notification

تمر عبر Notification Service.

---

لا يرسل أي Module إشعارات مباشرة.

---

# قواعد Workflow

كل انتقال حالة

يمر عبر Workflow Service.

---

لا يسمح

بتغيير Status مباشرة.

---

# قواعد PDF

البوليصة

تبنى من Template.

---

لا يسمح

بكتابة HTML داخل Controller.

---

# قواعد Firebase

كل الخدمات

تغلف داخل Providers.

---

لا تستدعى Firebase مباشرة من Business Logic.

---

# قواعد الاختبارات

كل Business Service

يجب أن يكون قابلاً للاختبار.

---

الكود الجديد

يجب ألا يكسر الكود السابق.

---

# قواعد الأداء

لا تنفذ استعلامات داخل حلقات.

---

لا تحمل بيانات غير مستخدمة.

---

استخدم Pagination.

---

# قواعد إعادة الاستخدام

أي كود يتكرر

يعزل إلى

Shared

Core

Common

حسب طبيعته.

---

# قواعد الوكلاء

أي وكيل يجب أن يقرأ

1.

Product Constitution

↓

2.

Product Vision

↓

3.

Business Analysis

↓

4.

Functional Specification

↓

5.

API Specification

↓

6.

Backend Architecture

↓

7.

Frontend Architecture

↓

8.

ADR

↓

9.

Ubiquitous Language

↓

10.

Development Rules

---

إذا وجد تعارضًا

فالترتيب السابق هو المرجع.

---

إذا لم يجد معلومة

يتوقف

ولا يخترعها.

---

إذا أراد تحسينًا

يقترحه

ولا ينفذه مباشرة.

---

# Definition of Done

أي ميزة تعتبر مكتملة فقط إذا:

✅ تطابق Functional Specification

✅ تطابق ADR

✅ تطابق Ubiquitous Language

✅ لا تكسر Architecture

✅ لا تضيف Dependencies غير ضرورية

✅ لا تحتوي Dead Code

✅ لا تحتوي TODO

✅ لا تحتوي Mock

✅ لا تحتوي Placeholder

✅ جاهزة للإنتاج

---

# سجل التعديلات

| Version | Date | Notes |
|----------|------------|----------------|
| v1.0 | 2026-07-23 | الإصدار الأول |