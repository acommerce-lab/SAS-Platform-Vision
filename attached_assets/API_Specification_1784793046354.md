# SAS Platform — API Specification
### مواصفة واجهة برمجة التطبيقات
**الإصدار:** v0.1
**الحالة:** مسودة أولى — مبنية مباشرة على Functional Specification v0.2 وDatabase Design v0.2
**آخر تحديث:** 23 يوليو 2026

---

## 1. مبادئ عامة

- **النمط:** REST عبر JSON، مصادقة بـ Bearer Token (JWT أو ما يعادله — وفق ADR-003 في Product Constitution).
- **الترميز الموحّد للأخطاء:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "رسالة واضحة للمستخدم",
    "details": {}
  }
}
```
- **الترقيم (Versioning):** كل مسارات الـ API تحت `/api/v1/...` (وفق مبدأ 4.1 في Product Constitution — Semantic Versioning).
- **التفويض:** كل Endpoint يوثّق صراحة الأدوار المسموح لها الوصول إليه. أي دور غير مذكور يحصل على `403 Forbidden`.

---

## 2. الهوية والحسابات

| Method | Endpoint | الوصف | الأدوار |
|---|---|---|---|
| POST | `/api/v1/auth/register/carrier` | تسجيل ذاتي لناقل جديد + مركبة واحدة على الأقل (F-001) | عام |
| POST | `/api/v1/auth/register/shipper` | تسجيل ذاتي لشاحن جديد (F-001) | عام |
| POST | `/api/v1/auth/login` | تسجيل دخول موحّد — ⚠️ حساب `pending_activation` يُسمَح له بالدخول لكن يُعاد توجيهه حصرًا لصفحة الانتظار (F-002) | عام |
| POST | `/api/v1/auth/logout` | إنهاء الجلسة | أي مستخدم مسجَّل |
| GET | `/api/v1/carriers` | قائمة الناقلين (فلاتر: status, vehicle_type, vehicle_category) | Admin |
| GET | `/api/v1/carriers/{id}` | تفاصيل ناقل (تتضمن قائمة مركباته) | Admin, Carrier (نفسه فقط) |
| PATCH | `/api/v1/carriers/{id}/activate` | تفعيل حساب ناقل (F-002) | Admin |
| PATCH | `/api/v1/carriers/{id}/disable` | تعطيل حساب ناقل (F-002) | Admin |
| POST | `/api/v1/carriers/{id}/vehicles` | إضافة مركبة جديدة (F-001-B) | Carrier (نفسه فقط) |
| GET | `/api/v1/carriers/{id}/vehicles` | قائمة مركبات الناقل | Admin, Carrier (نفسه فقط) |
| DELETE | `/api/v1/carriers/{id}/vehicles/{vehicle_id}` | حذف مركبة (F-001-B) | Carrier (نفسه فقط) |
| GET | `/api/v1/shippers` | قائمة الشاحنين | Admin |
| GET | `/api/v1/shippers/{id}` | تفاصيل شاحن | Admin, Shipper (نفسه فقط) |
| PATCH | `/api/v1/shippers/{id}/activate` | تفعيل حساب شاحن | Admin |
| PATCH | `/api/v1/shippers/{id}/disable` | تعطيل حساب شاحن | Admin |
| POST | `/api/v1/shippers/{id}/customers` | إضافة عميل للشاحن | Admin, Shipper (نفسه فقط) |
| GET | `/api/v1/shippers/{id}/customers` | قائمة عملاء الشاحن | Admin, Shipper (نفسه فقط) |

**مثال — تسجيل ناقل (طلب):**
```json
POST /api/v1/auth/register/carrier
{
  "name": "شركة النقل السريع",
  "email": "info@example.com",
  "password": "********",
  "phone": "+9665xxxxxxx",
  "vehicles": [
    { "vehicle_type": "flatbed", "vehicle_category": "heavy" },
    { "vehicle_type": "box_truck", "vehicle_category": "medium" }
  ]
}
```
**استجابة (201):**
```json
{
  "id": "uuid",
  "status": "pending_activation",
  "message": "تم استلام طلبك، بانتظار مراجعة الإدارة."
}
```

---

## 3. دورة حياة الشحنة (الوحدة الأكثر أهمية)

| Method | Endpoint | الوصف | الأدوار | يرتبط بـ |
|---|---|---|---|---|
| POST | `/api/v1/shipments` | تقديم طلب شحن جديد | Shipper | F-005 |
| GET | `/api/v1/shipments` | قائمة الشحنات (مفلترة تلقائيًا حسب نطاق الطرف) | Admin, Carrier, Shipper | F-012 |
| GET | `/api/v1/shipments/{id}` | تفاصيل شحنة | Admin, Carrier (إن مرتبطة), Shipper (إن صاحبها) | F-012 |
| PATCH | `/api/v1/shipments/{id}/link-carrier` | ربط الطلب بناقل مناسب — ✅ يُستخدَم من `requested` **و** من `pricing_rejected` (إعادة ربط) | Admin | F-006 |
| PATCH | `/api/v1/shipments/{id}/quote-price` | إدخال السعر المُقترَح | Admin | F-007 |
| PATCH | `/api/v1/shipments/{id}/approve-pricing` | موافقة الشاحن — ✅ تُطلق تلقائيًا إصدار البوليصة بلا أي Endpoint منفصل | Shipper (صاحب الطلب) | F-008, F-009 |
| PATCH | `/api/v1/shipments/{id}/reject-pricing` | رفض الشاحن — ✅ الحالة الناتجة `pricing_rejected` تنتظر إعادة ربط يدوية من Admin | Shipper (صاحب الطلب) | F-008 |
| PATCH | `/api/v1/shipments/{id}/start` | بدء الشحن الفعلي | Carrier (المرتبط) | F-010 |
| PATCH | `/api/v1/shipments/{id}/in-transit` | تحديث: في الطريق | Carrier (المرتبط) | F-010 |
| PATCH | `/api/v1/shipments/{id}/deliver` | تحديث: تم التسليم | Carrier (المرتبط) | F-010 |
| PATCH | `/api/v1/shipments/{id}/cancel` | إلغاء الطلب | Admin, Shipper (صاحبه) | F-011 |
| GET | `/api/v1/shipments/{id}/waybill` | عرض بيانات البوليصة | Admin, Carrier (المرتبط), Shipper (صاحبه) | F-009 |
| GET | `/api/v1/shipments/{id}/status-history` | سجل تغييرات الحالة | Admin, Carrier (المرتبط), Shipper (صاحبه) | — |

**⚠️ ملاحظة تصميم إلزامية (ADR-007):** كل Endpoint من نوع `PATCH .../shipments/{id}/...` أعلاه **لا يُنفَّذ منطقه مباشرة داخل الـ Controller**. بل يستدعي وحدة تحقق مركزية واحدة (مثال: `ShipmentWorkflowService.transition(shipment, action, actor)`) تتحقق من: (أ) هل الحالة الحالية تسمح بهذا الانتقال، (ب) هل هذا الطرف مخوَّل بتنفيذه. أي محاولة تعديل تدفق العمل مستقبلاً تُنفَّذ بتعديل هذه الوحدة فقط.

**مثال — رفض التسعير (طلب):**
```json
PATCH /api/v1/shipments/{id}/reject-pricing
```
**استجابة (200):**
```json
{
  "id": "uuid",
  "status": "pricing_rejected",
  "reference_number": "SAS-2026-000123"
}
```
**استجابة عند محاولة غير مصرَّح بها (403):**
```json
{
  "error": {
    "code": "FORBIDDEN_TRANSITION",
    "message": "غير مصرَّح لك بتغيير حالة هذه الشحنة"
  }
}
```

---

## 4. الإشعارات، الدردشة، والدعم

| Method | Endpoint | الوصف | الأدوار |
|---|---|---|---|
| GET | `/api/v1/notifications` | إشعارات الطرف الحالي | أي مستخدم مسجَّل |
| PATCH | `/api/v1/notifications/{id}/read` | تعليم إشعار كمقروء | صاحب الإشعار |
| POST | `/api/v1/conversations` | بدء محادثة جديدة (مرتبطة بشحنة أو عامة) | Admin, Carrier, Shipper |
| GET | `/api/v1/conversations/{id}/messages` | رسائل محادثة | أطراف المحادثة فقط |
| POST | `/api/v1/conversations/{id}/messages` | إرسال رسالة | أطراف المحادثة فقط |
| POST | `/api/v1/support-tickets` | فتح تذكرة دعم | Carrier, Shipper |
| GET | `/api/v1/support-tickets` | قائمة التذاكر (مفلترة حسب النطاق) | Admin (الكل), Carrier/Shipper (تذاكرهم) |
| PATCH | `/api/v1/support-tickets/{id}` | تحديث حالة/تعيين تذكرة | Admin |

---

## 5. رموز الأخطاء الموحّدة (Error Codes)

| الرمز | الحالة HTTP | الوصف |
|---|---|---|
| `VALIDATION_ERROR` | 400 | بيانات مدخلة غير صالحة |
| `UNAUTHORIZED` | 401 | لا يوجد Token صالح |
| `FORBIDDEN` | 403 | الطرف غير مخوَّل لهذا المورد |
| `FORBIDDEN_TRANSITION` | 403 | محاولة انتقال حالة غير مسموح بها لهذا الطرف |
| `NOT_FOUND` | 404 | المورد غير موجود أو خارج نطاق الطرف |
| `ACCOUNT_NOT_ACTIVE` | 403 | الحساب بحالة `pending_activation` أو `disabled` |
| `CONFLICT` | 409 | تعارض حالة (مثال: محاولة إصدار بوليصة لطلب بلا موافقة تسعير) |

---

## سجل التحديثات

| الإصدار | التاريخ | التغييرات |
|---|---|---|
| v0.1 | 2026-07-23 | الإصدار الأول — مبني مباشرة على Functional Specification v0.2؛ يغطي الهوية، دورة حياة الشحنة الكاملة، والخدمات المشتركة |
| v0.2 | 2026-07-23 | إضافة مسارات إدارة مركبات الناقل (F-001-B)، تحديث تسجيل الناقل ليشمل مصفوفة مركبات، تأكيد أن `link-carrier` يُعاد استخدامه لإعادة الربط بعد رفض التسعير، تأكيد أن `approve-pricing` يُطلق إصدار البوليصة تلقائيًا بلا Endpoint منفصل، تأكيد سلوك دخول الحساب غير المُفعَّل |

---

*الملف السابق: `Functional Specification.md`. الملف التالي المقترح: `UX/UI Specification.md`*
