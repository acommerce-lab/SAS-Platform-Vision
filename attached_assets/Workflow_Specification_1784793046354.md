# SAS Platform
# Workflow Specification

الإصدار: v1.0

الحالة: Living Document

آخر تحديث: 23 يوليو 2026

---

# الهدف

تحدد هذه الوثيقة دورة حياة جميع الكيانات الديناميكية داخل النظام، وعلى رأسها الشحنات (Shipments).

تعرف الوثيقة:

- الحالات (States)
- الانتقالات (Transitions)
- شروط الانتقال
- الصلاحيات
- الأحداث الناتجة
- الخدمات المستدعاة
- الآثار الجانبية (Side Effects)

ولا يسمح بتغيير أي حالة خارج هذه الوثيقة.

---

# المبادئ

- كل Workflow عبارة عن Finite State Machine (FSM).
- لا توجد انتقالات غير معرفة.
- لا يسمح بتجاوز حالة.
- كل انتقال يولد حدثاً (Domain Event).
- كل انتقال يسجل في سجل التدقيق (Audit Log).

---

# Shipment Workflow

## الحالات الرسمية

Requested

CarrierAssigned

PricingCalculated

PricingSent

PricingApproved

PricingRejected

WaybillIssued

InTransit

Delivered

Cancelled

---

# الحالة الابتدائية

Requested

---

# الحالات النهائية

Delivered

Cancelled

---

# مخطط الانتقال

Requested

↓

CarrierAssigned

↓

PricingCalculated

↓

PricingSent

↓

PricingApproved

↓

WaybillIssued

↓

InTransit

↓

Delivered

---

PricingSent

↓

PricingRejected

↓

CarrierAssigned

---

أي حالة

↓

Cancelled

(إذا سمحت قواعد العمل)

---

# Transition Specification

---

## Requested → CarrierAssigned

### المنفذ

Admin

### الشروط

- الشحنة موجودة.
- الناقل نشط.
- السائق نشط.
- الشاحنة متاحة.

### الأحداث

CarrierAssigned

### الخدمات

Shipment Service

Notification Service

Audit Service

---

## CarrierAssigned → PricingCalculated

### المنفذ

System

### الشروط

- يوجد ناقل.
- توجد شاحنة.
- يوجد سائق.

### الخدمات

Pricing Service

Maps Provider

### الأحداث

PricingCalculated

---

## PricingCalculated → PricingSent

### المنفذ

Admin

### الشروط

- السعر محسوب.
- الشحنة ما زالت نشطة.

### الأحداث

PricingSent

### الخدمات

Notification Service

Email Service

---

## PricingSent → PricingApproved

### المنفذ

Shipper

### الشروط

- العرض صالح.
- لم تنته مدة العرض.

### الأحداث

PricingApproved

### الخدمات

Shipment Workflow

Waybill Service

Notification Service

Audit Service

---

## PricingSent → PricingRejected

### المنفذ

Shipper

### الأحداث

PricingRejected

### الخدمات

Notification Service

Audit Service

---

## PricingRejected → CarrierAssigned

### المنفذ

Admin

### الشروط

- تم اختيار ناقل جديد.

### الأحداث

CarrierAssigned

---

## PricingApproved → WaybillIssued

### المنفذ

System

### الشروط

- السعر معتمد.

### الأحداث

WaybillIssued

### الخدمات

Waybill Service

PDF Provider

Notification Service

Audit Service

---

## WaybillIssued → InTransit

### المنفذ

Carrier

### الشروط

- البوليصة صادرة.

### الأحداث

ShipmentStarted

---

## InTransit → Delivered

### المنفذ

Carrier

### الشروط

- تم التسليم.

### الأحداث

ShipmentDelivered

NotificationSent

---

# Cancellation Rules

يمكن الإلغاء فقط إذا كانت الحالة

Requested

CarrierAssigned

PricingCalculated

PricingSent

PricingRejected

---

لا يسمح بالإلغاء بعد

WaybillIssued

إلا بواسطة Admin.

---

# Permission Matrix

| Transition | Carrier | Shipper | Admin | System |
|------------|---------|----------|--------|---------|
| Request Shipment | ❌ | ✅ | ❌ | ❌ |
| Assign Carrier | ❌ | ❌ | ✅ | ❌ |
| Calculate Pricing | ❌ | ❌ | ❌ | ✅ |
| Send Pricing | ❌ | ❌ | ✅ | ❌ |
| Approve Pricing | ❌ | ✅ | ❌ | ❌ |
| Reject Pricing | ❌ | ✅ | ❌ | ❌ |
| Generate Waybill | ❌ | ❌ | ❌ | ✅ |
| Start Shipment | ✅ | ❌ | ❌ | ❌ |
| Complete Shipment | ✅ | ❌ | ❌ | ❌ |
| Cancel Shipment | ❌ | ❌ | ✅ | ❌ |

---

# Workflow Events

ShipmentRequested

CarrierAssigned

PricingCalculated

PricingSent

PricingApproved

PricingRejected

WaybillIssued

ShipmentStarted

ShipmentDelivered

ShipmentCancelled

---

# Notifications

| Event | Recipient |
|--------|-----------|
| ShipmentRequested | Admin |
| CarrierAssigned | Carrier |
| PricingSent | Shipper |
| PricingApproved | Carrier + Admin |
| PricingRejected | Admin |
| WaybillIssued | Carrier + Shipper |
| ShipmentStarted | Shipper |
| ShipmentDelivered | Shipper + Admin |

---

# Audit Logging

كل انتقال يسجل:

- Workflow Name
- Previous State
- New State
- User
- Role
- Timestamp
- IP Address
- Correlation ID

---

# Error Conditions

إذا حاول المستخدم تنفيذ Transition غير مسموح:

Error Code

WORKFLOW_001

HTTP

409 Conflict

---

إذا كانت الحالة الحالية مختلفة:

WORKFLOW_002

---

إذا كانت الصلاحية غير كافية:

AUTH_403

---

إذا فشل أحد الخدمات الخارجية:

WORKFLOW_005

---

# AI Agent Rules

لا يسمح للوكيل:

- بتغيير ترتيب الحالات.
- بإضافة حالات جديدة.
- بحذف حالات.
- بتجاوز Transition.
- بتعديل شروط الانتقال.

أي تعديل يجب أن يبدأ من هذه الوثيقة أولاً.

---

# Future Extensions

تم تصميم الـ Workflow بحيث يسمح بإضافة:

- Marine Shipment Workflow
- Air Shipment Workflow
- Customs Workflow
- Insurance Workflow

دون تعديل دورة حياة الشحن البري الأساسية.

---

# Definition of Done

أي Workflow يعتبر صحيحاً إذا:

✅ جميع الحالات معرفة.

✅ جميع الانتقالات معرفة.

✅ جميع الأحداث معرفة.

✅ جميع الصلاحيات معرفة.

✅ جميع الخدمات معرفة.

✅ جميع الإشعارات معرفة.

✅ جميع الأخطاء معرفة.

---

# سجل التعديلات

| Version | Date | Notes |
|---------|------------|----------------|
| v1.0 | 2026-07-23 | الإصدار الأول |