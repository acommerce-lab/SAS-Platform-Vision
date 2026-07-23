# SAS Platform — Backend Architecture
### بنية الخلفية
**الإصدار:** v0.1
**الحالة:** مسودة أولى
**آخر تحديث:** 23 يوليو 2026
**يعتمد على:** `Product Constitution.md` (ADR-001, ADR-002, ADR-003, ADR-007)، `API Specification.md`، `Database Design.md`

---

## 1. النمط المعماري العام

وفق ADR-001 في Product Constitution: **Modular Monolith**. تطبيق واحد منظَّم في وحدات منطقية مستقلة داخليًا (Modules)، لا Microservices منفصلة، مع حدود واضحة بين الوحدات تسمح بفصلها لاحقًا إن استدعت الحاجة.

### 1.1 الوحدات المقترحة (Modules)

```
/src
  /identity        ← تسجيل، تفعيل، مصادقة، تفويض (خدمة مشتركة عبر البوابة — ADR-006)
  /carriers         ← إدارة الناقلين
  /shippers         ← إدارة الشاحنين وعملائهم
  /shipments        ← دورة حياة الشحنة الكاملة (الوحدة الأكثر أهمية)
    /workflow       ← ⚠️ الوحدة المركزية لمنطق السير (ADR-007) — معزولة تمامًا
  /waybills         ← إصدار وإدارة البوليصات
  /notifications    ← خدمة مشتركة (ADR-006)
  /conversations    ← الدردشة (خدمة مشتركة)
  /support-tickets  ← تذاكر الدعم (خدمة مشتركة)
```

---

## 2. وحدة السير المركزية (Workflow Module) — الأهم معماريًا

**السبب:** ADR-007 يفرض أن منطق "من يملك صلاحية أي انتقال حالة" يُكتب في **مكان واحد فقط**. هذا القسم يوضح كيف يُنفَّذ ذلك عمليًا.

### 2.1 بنية مقترحة (توضيحية، بأي لغة/إطار عمل)

```
shipments/workflow/
  ├── states.ts          ← تعريف كل قيم الحالة (Enum)
  ├── transitions.ts     ← جدول التحويلات المسموحة: { from, to, allowed_roles }
  └── workflow_service.ts ← الدالة الوحيدة: canTransition(shipment, action, actor) → boolean
```

**مثال مفاهيمي لجدول التحويلات (`transitions.ts`):**
```javascript
export const TRANSITIONS = [
  { from: 'requested',                          to: 'linked_to_carrier',                  allowedRoles: ['admin'] },
  { from: 'linked_to_carrier',                  to: 'pending_shipper_pricing_approval',   allowedRoles: ['admin'] },
  { from: 'pending_shipper_pricing_approval',   to: 'waybill_issued',                     allowedRoles: ['shipper'] },
  { from: 'pending_shipper_pricing_approval',   to: 'pricing_rejected',                   allowedRoles: ['shipper'] },
  { from: 'waybill_issued',                     to: 'shipment_started',                   allowedRoles: ['carrier'] },
  { from: 'shipment_started',                   to: 'in_transit',                         allowedRoles: ['carrier'] },
  { from: 'in_transit',                         to: 'delivered',                          allowedRoles: ['carrier'] },
  // حالات الإلغاء تُضاف بشكل عام لكل حالة غير نهائية
];
```

**لماذا هذا التصميم يحقق ADR-007:**
- تعديل التدفق (إضافة مرحلة، حذف مرحلة، تغيير من يملك الصلاحية) = تعديل هذا الملف فقط.
- كل Endpoint في `API Specification.md` يستدعي `workflow_service.canTransition(...)` قبل أي تنفيذ — لا يُعيد كتابة الشرط بنفسه.
- إضافة قيمة حالة جديدة مستقبلاً (مثلاً مرحلة إضافية في الشحن الفعلي) = سطر واحد في `states.ts` + سطر في `transitions.ts`، بلا لمس بقية النظام.

---

## 3. طبقات التطبيق (Layered Architecture)

```
[ HTTP Layer / Controllers ]     ← استقبال الطلب، التحقق من الشكل (Validation)، لا منطق عمل
        │
[ Service Layer ]                ← المنطق التجاري (يستدعي Workflow Module عند الحاجة)
        │
[ Repository Layer ]             ← الوصول لقاعدة البيانات فقط، لا منطق عمل
        │
[ PostgreSQL ]
```

**قاعدة صارمة:** لا يُسمح لـ Controller باستدعاء Repository مباشرة، ولا لـ Service بكتابة SQL خام متناثر — كل وصول لقاعدة البيانات عبر Repository موثَّق.

---

## 4. المصادقة والتفويض

وفق ADR-003 (Token-based Authentication + RBAC):
- عند تسجيل الدخول (F-003)، يُصدَر Token يحمل: `user_id`, `role` (`admin`/`carrier`/`shipper`), `status`.
- Middleware مركزي واحد يتحقق من صلاحية Token على كل طلب محمي، ويرفض فورًا أي طلب من حساب `status != active` (باستثناء الوصول لشاشة "بانتظار التفعيل" نفسها).
- التفويض الدقيق (مثال: هل هذا الناقل صاحب هذه الشحنة تحديدًا؟) يُنفَّذ في Service Layer، لا في Middleware العام.

---

## 5. الإشعارات — التنفيذ التقني

عند نجاح أي `PATCH .../shipments/{id}/...` في Service Layer:
1. يُحفَظ `StatusChange` جديد.
2. تُستدعى `NotificationService.notifyStakeholders(shipment, newStatus)` التي تحدد تلقائيًا كل الأطراف المعنية (شاحن، ناقل إن مرتبط، إدارة، عميل شاحن إن مرتبط) وتُنشئ سجل `Notification` لكل طرف.
3. ⚠️ **قرار مستقبلي (خارج MVP):** قناة توصيل فعلية للإشعار (بريد إلكتروني، SMS، إشعار داخل التطبيق فقط) غير محددة بعد — MVP يكتفي بإشعار داخل التطبيق (In-app) يظهر في `GET /api/v1/notifications`.

---

## 6. التعامل مع الأخطاء والتسجيل (Logging)

- كل خطأ متوقع (Validation، Forbidden Transition) يُعاد بصيغة موحّدة (راجع API Specification، القسم 5) — لا استثناءات غير مُعالجة تصل للمستخدم.
- Logging لكل عملية حساسة: تسجيل دخول، تفعيل/تعطيل حساب، أي تغيير حالة شحنة — بدون تسجيل كلمات المرور أو التوكنات (مبدأ 1.3 في Product Constitution).

---

## 7. نقاط تحتاج قرارًا

| # | القرار |
|---|---|
| 1 | لغة/إطار العمل المحدد للـ Backend (Node.js/Express؟ Python/FastAPI؟ غيره؟) — لم يُحدَّد بعد |
| 2 | مزود الاستضافة (راجع Deployment Guide) |
| 3 | آلية إرسال الإشعارات خارج التطبيق (بريد/SMS) إن احتيجت لاحقًا |

---

## سجل التحديثات

| الإصدار | التاريخ | التغييرات |
|---|---|---|
| v0.1 | 2026-07-23 | الإصدار الأول — بنية Modular Monolith، تفصيل وحدة السير المركزية تطبيقًا لـADR-007، طبقات التطبيق، المصادقة، والإشعارات |

---

*الملف السابق: `UX/UI Specification.md`. الملف التالي المقترح: `Frontend Architecture.md`*
