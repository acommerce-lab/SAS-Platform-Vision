# SAS Platform
# Domain Boundaries & Responsibilities

الإصدار: v1.0

الحالة: Living Document

آخر تحديث: 23 يوليو 2026

---

# الهدف

تحدد هذه الوثيقة الحدود الرسمية (Bounded Contexts) بين وحدات النظام.

كل Module يمتلك بياناته ومنطقه التجاري ولا يجوز لوحدة أخرى تعديلها مباشرة.

يجب أن يتم التواصل بين الوحدات عبر Services أو Events أو APIs داخلية.

---

# المبادئ

1. لكل Module مسؤولية واحدة واضحة.
2. يمنع الوصول المباشر إلى بيانات Module آخر.
3. يمنع تكرار Business Logic بين الوحدات.
4. يمنع إنشاء God Module.
5. جميع العمليات التجارية يجب أن يكون لها مالك (Owner).

---

# High Level Domains

Identity

↓

Carrier

↓

Shipper

↓

Product

↓

Customer

↓

Shipment

↓

Pricing

↓

Waybill

↓

Notification

↓

Support

↓

Profile

---

# Identity Module

## المسؤولية

إدارة الهوية والمصادقة.

---

## يمتلك

Users

Roles

Permissions

Authentication

Email Verification

Password Reset

Sessions

---

## لا يمتلك

Carrier Data

Shipment Data

Products

Customers

Waybills

---

## يقدم الخدمات

Register User

Login

Logout

Refresh Token

Verify Email

Reset Password

Authorize Request

---

## يطلق الأحداث

UserRegistered

EmailVerified

UserLoggedIn

PasswordChanged

---

# Carrier Module

## المسؤولية

إدارة الناقل.

---

## يمتلك

Carrier

Truck

Driver

Carrier Pricing

---

## لا يمتلك

Shipments

Products

Customers

Waybills

Notifications

---

## يقدم الخدمات

Create Carrier

Update Carrier

Create Truck

Update Truck

Create Driver

Update Driver

Calculate Carrier Base Pricing

---

## يطلق الأحداث

CarrierCreated

TruckCreated

DriverCreated

CarrierUpdated

PricingUpdated

---

# Shipper Module

## المسؤولية

إدارة بيانات الشاحن.

---

## يمتلك

Shipper

---

## لا يمتلك

Products

Customers

Shipments

---

## يقدم الخدمات

Create Shipper

Update Shipper

Deactivate Shipper

---

## يطلق الأحداث

ShipperCreated

ShipperUpdated

---

# Product Module

## المسؤولية

إدارة المنتجات.

---

## يمتلك

Products

Product Types

Product Categories

---

## لا يمتلك

Shipments

Customers

Carrier

---

## يقدم الخدمات

Create Product

Update Product

Delete Product

Search Products

---

## يطلق الأحداث

ProductCreated

ProductUpdated

ProductDeleted

---

# Customer Module

## المسؤولية

إدارة عملاء الشاحن.

---

## يمتلك

Customer

Customer Address

Customer Contact

---

## ملاحظة

العميل ليس مستخدماً للنظام.

لا يملك حساب دخول.

---

## يقدم الخدمات

Create Customer

Update Customer

Search Customer

---

## يطلق الأحداث

CustomerCreated

CustomerUpdated

---

# Shipment Module

## المسؤولية

إدارة دورة حياة الشحنة.

---

## يمتلك

Shipment

Shipment Status

Shipment Timeline

Shipment Assignment

---

## لا يمتلك

Carrier Pricing

PDF

Notifications

Authentication

---

## يقدم الخدمات

Create Shipment

Assign Carrier

Start Shipment

Complete Shipment

Cancel Shipment

---

## يطلق الأحداث

ShipmentRequested

CarrierAssigned

ShipmentStarted

ShipmentDelivered

ShipmentCancelled

---

# Pricing Module

## المسؤولية

حساب تكلفة النقل.

---

## يمتلك

Pricing Calculation

Distance Calculation Result

Pricing Offer

---

## لا يمتلك

Shipments

Products

PDF

---

## يعتمد على

Carrier Pricing

OSRM

---

## يقدم الخدمات

Calculate Distance

Calculate Shipment Price

Create Pricing Offer

---

## يطلق الأحداث

DistanceCalculated

PricingCalculated

PricingSent

PricingApproved

PricingRejected

---

# Waybill Module

## المسؤولية

إصدار بوليصة الشحن.

---

## يمتلك

Waybill

Waybill Template

Generated PDF

---

## لا يمتلك

Shipment Workflow

Carrier

Pricing

---

## يقدم الخدمات

Generate Waybill

Generate PDF

Download PDF

View Waybill

---

## يطلق الأحداث

WaybillIssued

PDFGenerated

---

# Notification Module

## المسؤولية

إرسال جميع الإشعارات.

---

## يمتلك

Notification Queue

Push Notifications

Email Notifications

In-App Notifications

---

## لا يمتلك

Shipment

Carrier

Authentication

---

## يقدم الخدمات

Send Push

Send Email

Store Notification

Mark As Read

---

## يطلق الأحداث

NotificationSent

NotificationFailed

---

# Support Module

## المسؤولية

إدارة الدعم الفني.

---

## يمتلك

Tickets

Messages

Attachments

---

## يقدم الخدمات

Create Ticket

Reply Ticket

Close Ticket

Upload Attachment

---

## يطلق الأحداث

TicketCreated

TicketClosed

MessageSent

---

# Profile Module

## المسؤولية

إدارة الملف الشخصي.

---

## يمتلك

Profile

Preferences

Avatar

Language

---

## يقدم الخدمات

Update Profile

Update Preferences

Change Avatar

---

# Dependency Rules

يسمح

Shipment

↓

Pricing

---

Shipment

↓

Waybill

---

Shipment

↓

Notification

---

Identity

↓

جميع الوحدات

---

يجوز

Notification

الاستماع لجميع الأحداث.

---

يمنع

Carrier

↓

Shipment

---

Product

↓

Carrier

---

Waybill

↓

Shipment Database

---

Support

↓

Shipment Database

---

# Ownership Matrix

| البيانات | المالك |
|------------|----------------|
| Users | Identity |
| Roles | Identity |
| Permissions | Identity |
| Carrier | Carrier |
| Truck | Carrier |
| Driver | Carrier |
| Carrier Pricing | Carrier |
| Shipper | Shipper |
| Product | Product |
| Product Type | Product |
| Product Category | Product |
| Customer | Customer |
| Shipment | Shipment |
| Shipment Status | Shipment |
| Pricing Offer | Pricing |
| Waybill | Waybill |
| Notifications | Notification |
| Tickets | Support |
| Profile | Profile |

---

# Integration Rules

الوحدات لا تستدعي قواعد بيانات بعضها.

---

إذا احتاجت بيانات Module آخر

فتستخدم

Service

أو

Event

أو

Repository Interface

---

# Future Expansion

تم تصميم الحدود الحالية بحيث تسمح مستقبلاً بإضافة

Marine Shipping Module

Air Shipping Module

Customs Module

Insurance Module

Financial Module

Electronic Invoicing Module

دون تعديل الوحدات الحالية.

---

# AI Agent Rules

عند إنشاء كود جديد

يجب على الوكيل

1.

تحديد الـ Module المسؤول.

2.

التحقق من أن العملية ضمن مسؤولياته.

3.

إذا لم تكن كذلك

يستخدم Service أو Event.

4.

يمنع نقل Business Logic بين الوحدات.

---

# Definition of Done

أي ميزة جديدة تعتبر صحيحة فقط إذا

✅ وضعت داخل Module الصحيح.

✅ لم تضف اعتماداً دائرياً.

✅ لم تكرر Business Logic.

✅ لم تكسر الحدود المعرفة في هذه الوثيقة.

---

# سجل التعديلات

| Version | Date | Notes |
|----------|------------|----------------|
| v1.0 | 2026-07-23 | الإصدار الأول |