# SAS Platform — Database Design
### تصميم قاعدة البيانات
**الإصدار:** v0.3
**الحالة:** جاهز للتنفيذ التجريبي — النقاط الحرجة السابقة محسومة، تبقى تفاصيل تصنيف محدودة
**آخر تحديث:** 23 يوليو 2026
**يعتمد على:** `Domain Model.md` (v0.4)

---

## 1. مخطط الجداول — التحديثات فقط (بقية الجداول بدون تغيير عن v0.2، راجع الإصدار السابق للكامل)

### 1.1 `carriers` — ⚠️ مُحدَّث: إزالة `vehicle_type`
```sql
CREATE TYPE account_status AS ENUM ('pending_activation', 'active', 'disabled');

CREATE TABLE carriers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(200) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone         VARCHAR(30),
    status        account_status NOT NULL DEFAULT 'pending_activation',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- تمت إزالة عمود vehicle_type من هنا — انتقل إلى جدول vehicles أدناه
```

### 1.2 `vehicles` — ⚠️ جدول جديد v0.3
```sql
CREATE TYPE vehicle_type AS ENUM (
    'flatbed', 'box_truck', 'refrigerated', 'tanker', 'other'
);
-- ⚠️ تقديرية، تحتاج تأكيد نهائي من صاحب المصلحة

CREATE TYPE vehicle_category AS ENUM (
    'light', 'medium', 'heavy'
);
-- ⚠️ افتراض مبدئي بالحمولة (خفيفة/متوسطة/ثقيلة) — القيم الفعلية غير مؤكدة بعد (راجع Domain Model، القسم 5)

CREATE TABLE vehicles (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carrier_id        UUID NOT NULL REFERENCES carriers(id) ON DELETE CASCADE,
    vehicle_type      vehicle_type NOT NULL,
    vehicle_category  vehicle_category NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vehicles_carrier_id ON vehicles(carrier_id);
CREATE INDEX idx_vehicles_type_category ON vehicles(vehicle_type, vehicle_category);
-- الفهرس المركّب يخدم استعلام المطابقة في F-006 (البحث عن ناقلين يملكون مركبة مطابقة)
```

### 1.3 `shipments` — ⚠️ مُحدَّث: إضافة `required_vehicle_category`
```sql
CREATE TYPE shipment_status AS ENUM (
    'requested', 'linked_to_carrier', 'pending_shipper_pricing_approval',
    'pricing_rejected', 'waybill_issued', 'shipment_started',
    'in_transit', 'delivered', 'cancelled'
);

CREATE TABLE shipments (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_number        VARCHAR(50) NOT NULL UNIQUE,
    pickup_location         TEXT NOT NULL,
    dropoff_location        TEXT NOT NULL,
    cargo_description       TEXT,
    required_vehicle_type      vehicle_type NOT NULL,
    required_vehicle_category  vehicle_category NOT NULL,
    shipper_id              UUID NOT NULL REFERENCES shippers(id),
    shipper_customer_id     UUID REFERENCES shipper_customers(id),
    carrier_id               UUID REFERENCES carriers(id),
    quoted_price              NUMERIC(12,2),
    currency                  CHAR(3) NOT NULL DEFAULT 'SAR',
    price_approved_at          TIMESTAMPTZ,
    status                     shipment_status NOT NULL DEFAULT 'requested',
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shipments_shipper_id ON shipments(shipper_id);
CREATE INDEX idx_shipments_carrier_id ON shipments(carrier_id);
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_required_vehicle ON shipments(required_vehicle_type, required_vehicle_category);
```

### 1.4 استعلام المطابقة المرجعي (لفهم استخدام الفهارس أعلاه)
```sql
-- الناقلون النشطون الذين يملكون مركبة مطابقة لشحنة معينة
SELECT DISTINCT c.*
FROM carriers c
JOIN vehicles v ON v.carrier_id = c.id
WHERE c.status = 'active'
  AND v.vehicle_type = :required_vehicle_type
  AND v.vehicle_category = :required_vehicle_category;
```
يُستخدَم هذا الاستعلام في F-006 لتزويد `Admin` بقائمة مفلترة تلقائيًا، مع إبقاء الخيار مفتوحًا لعرض كل الناقلين عند الحاجة لتجاوز استثنائي.

### 1.5 `waybills`
*(بدون تغيير عن v0.2 — راجع الإصدار السابق. تأكيد إضافي: لا عمود `issued_by` يدوي — `issued_at` يُملأ حصرًا من منطق تطبيق تلقائي)*

### 1.6 بقية الجداول
`shippers`, `shipper_customers`, `shipment_status_changes`, `notifications`, `conversations`, `messages`, `support_tickets` — **بدون تغيير عن v0.2**، راجع الإصدار السابق للتفاصيل الكاملة.

---

## 2. مخطط العلاقات الكامل — مُحدَّث

```
carriers ──< vehicles.carrier_id                          [جديد]
carriers ──< shipments.carrier_id
shippers ──< shipments.shipper_id
shippers ──< shipper_customers.shipper_id
shipper_customers ──< shipments.shipper_customer_id
shipments ──── waybills.shipment_id (1-إلى-1)
shipments ──< shipment_status_changes.shipment_id
shipments ──< notifications.related_shipment_id
```

---

## 3. نقاط متبقية قبل الإنتاج

| # | القرار |
|---|---|
| 1 | القيم النهائية لـ `vehicle_category` (القسم 1.2 افتراض مبدئي بالحمولة) |
| 2 | القيم النهائية لـ `vehicle_type` |

---

## سجل التحديثات

| الإصدار | التاريخ | التغييرات |
|---|---|---|
| v0.1–v0.2 | 2026-07-23 | راجع الإصدارات السابقة |
| v0.3 | 2026-07-23 | **تحديث جوهري**: إزالة `vehicle_type` من `carriers`، إضافة جدول `vehicles` جديد (نوع+فئة لكل مركبة) بفهرس مركّب لخدمة المطابقة، إضافة `required_vehicle_category` على `shipments`، توثيق استعلام المطابقة المرجعي |

---

*الملف السابق: `Domain Model.md`. الملف التالي المقترح: `Functional Specification.md`*
