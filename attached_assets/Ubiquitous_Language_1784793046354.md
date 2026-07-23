# SAS Platform — Ubiquitous Language

الإصدار: v1.0

الحالة: Living Document

آخر تحديث: 23 يوليو 2026

---

# مقدمة

هذه الوثيقة هي المرجع الرسمي لجميع المصطلحات المستخدمة داخل مشروع SAS Platform.

الغرض منها هو توحيد اللغة بين:

- فريق العمل
- الوثائق
- قاعدة البيانات
- الـ API
- الواجهة
- الكود
- وكلاء الذكاء الاصطناعي

أي مصطلح غير معرف هنا لا يجوز استخدامه داخل المشروع قبل إضافته لهذه الوثيقة.

---

# المبادئ العامة

1.

لكل مفهوم اسم رسمي واحد فقط.

ولا يسمح باستخدام مرادفات مختلفة له داخل الكود.

---

2.

أسماء الجداول والكلاسات والواجهات وواجهات البرمجة يجب أن تعتمد هذه الوثيقة.

---

3.

لا يسمح لوكلاء الذكاء الاصطناعي باختراع أسماء جديدة.

---

4.

لا يسمح بتغيير اسم مفهوم بعد اعتماده إلا عبر تحديث هذه الوثيقة.

---

# المصطلحات الأساسية

---

## User

يمثل أي شخص يستطيع تسجيل الدخول للنظام.

قد يكون

Admin

Carrier

Shipper

---

## Admin

موظف شركة SAS.

هو المسؤول عن إدارة النظام.

ليس Super Admin متعدد الشركات.

---

## Carrier

شركة نقل.

تمتلك شاحنات وسائقين.

تستقبل طلبات الشحن.

---

## Driver

سائق.

مرتبط دائماً بشاحنة واحدة.

لا يوجد Driver بدون Truck.

---

## Truck

وسيلة النقل.

مرتبطة دائماً بسائق واحد.

لا يوجد Truck بدون Driver.

---

## Vehicle Category

فئة المركبة.

مثل

دينة

تريلة

قاطرة

---

## Vehicle Type

نوع المركبة.

مثل

تبريد

سطحة

قفص

---

## Shipper

عميل شركة SAS.

هو من يطلب الشحن.

وليس المستلم النهائي.

---

## Shipper Customer

عميل الشاحن.

هو المستلم النهائي للبضاعة.

ليس مستخدم للنظام.

ليس له حساب دخول.

---

## Product

السلعة المطلوب شحنها.

---

## Product Type

نوع المنتج.

مثل

مواد غذائية

حديد

أدوية

...

---

## Product Category

تصنيف المنتج.

يستخدمه الشاحن لتنظيم منتجاته.

---

## Shipment

طلب شحن.

يمر بجميع مراحل سير العمل.

---

## Shipment Status

الحالة الحالية للشحنة.

هي المرجع الوحيد لتقدم الطلب.

---

## Waybill

بوليصة الشحن.

وثيقة رسمية.

تنشأ بعد قبول السعر.

يمكن طباعتها.

يمكن تنزيلها PDF.

ليست Invoice.

---

## Pricing

السعر المتوقع للشحنة.

يحسب بواسطة النظام.

---

## Distance

المسافة بالكيلومتر.

تحسب بواسطة مزود الخرائط.

---

## Notification

إشعار.

قد يكون

داخل التطبيق

أو بريد إلكتروني

أو Push Notification.

---

## Conversation

محادثة.

تربط أطراف الشحنة.

---

## Support Ticket

تذكرة دعم.

تنشأ للدعم الفني فقط.

---

## Profile

الملف الشخصي للمستخدم.

---

# المصطلحات الممنوعة

لا يستخدم

Order

بل

Shipment

----------------------------

لا يستخدم

Client

بل

Shipper Customer

----------------------------

لا يستخدم

Customer

عند الإشارة للشاحن.

Customer تعني فقط

Shipper Customer.

----------------------------

لا يستخدم

Vehicle

إذا كان المقصود Truck.

----------------------------

لا يستخدم

Employee

إذا كان المقصود Admin.

----------------------------

لا يستخدم

Invoice

إذا كان المقصود Waybill.

----------------------------

لا يستخدم

Delivery

إذا كان المقصود Shipment.

----------------------------

لا يستخدم

Company

إذا كان المقصود Carrier.

----------------------------

لا يستخدم

Vendor

إذا كان المقصود Carrier.

----------------------------

لا يستخدم

Member

إذا كان المقصود User.

---

# حالات الشحنة الرسمية

Requested

↓

Carrier Assigned

↓

Pricing Sent

↓

Pricing Approved

↓

Waybill Issued

↓

Shipment Started

↓

In Transit

↓

Delivered

الحالات السابقة هي المرجع الوحيد.

أي حالة جديدة يجب إضافتها هنا أولاً.

---

# الأدوار الرسمية

Admin

Carrier

Shipper

ولا يوجد أي Role آخر.

---

# وحدات النظام

Identity

Carrier

Driver

Truck

Product

Shipper

Shipment

Waybill

Notification

Conversation

Support

Profile

Settings

---

# قواعد التسمية

Database Tables

جمع

users

shipments

products

notifications

---

REST Endpoints

جمع

/api/shipments

/api/products

/api/carriers

---

Classes

PascalCase

ShipmentService

TruckRepository

NotificationManager

---

Interfaces

تبدأ بالحرف I

IShipmentRepository

INotificationProvider

---

Enums

تنتهي بكلمة Status أو Type

ShipmentStatus

VehicleType

UserRole

---

DTO

تنتهي بكلمة DTO

CreateShipmentDTO

ShipmentDetailsDTO

---

Validators

تنتهي بكلمة Validator

ShipmentValidator

LoginValidator

---

Services

تنتهي بكلمة Service

ShipmentService

NotificationService

---

Repositories

تنتهي بكلمة Repository

ShipmentRepository

CarrierRepository

---

Controllers

تنتهي بكلمة Controller

ShipmentController

CarrierController

---

# مصطلحات واجهة المستخدم

Dashboard

تعني الصفحة الرئيسية للدور الحالي.

---

Wizard

تعني نموذج متعدد الخطوات.

---

Dialog

نافذة منبثقة.

---

Drawer

لوحة جانبية.

---

Data Table

جدول بيانات.

---

Badge

شارة حالة.

---

Toast

رسالة مؤقتة.

---

Empty State

واجهة عدم وجود بيانات.

---

# مصطلحات قواعد البيانات

Primary Key

UUID.

---

Foreign Key

يشير دائماً إلى UUID.

---

Soft Delete

يعني IsDeleted.

---

Audit Fields

CreatedAt

UpdatedAt

DeletedAt

CreatedBy

UpdatedBy

---

# مصطلحات واجهات البرمجة

Endpoint

واجهة REST.

---

Payload

جسم الطلب.

---

Response

جسم الاستجابة.

---

Validation

التحقق من البيانات.

---

Pagination

تقسيم النتائج.

---

Filtering

التصفية.

---

Sorting

الترتيب.

---

# قواعد لوكلاء الذكاء الاصطناعي

إذا وجد الوكيل كلمة غير موجودة هنا:

1.

لا يخترع معناها.

2.

لا يستبدلها بمرادف.

3.

يسأل المستخدم.

4.

أو يقترح إضافتها لهذه الوثيقة أولاً.

---

إذا وجد الوكيل مصطلحين يؤديان نفس المعنى

يجب أن يستخدم الاسم الرسمي الموجود هنا.

ولا يستخدم أي اسم آخر.

---

أي تعديل على هذه الوثيقة

يعتبر قراراً معمارياً.

ويجب تحديث

ADR.md

إذا ترتب عليه تغيير في البنية أو التصميم.

---

# سجل التعديلات

| Version | Date | Notes |
|----------|------------|----------------|
| v1.0 | 2026-07-23 | الإصدار الأول |