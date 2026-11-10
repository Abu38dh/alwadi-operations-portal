# Master Prompt: Student Request Management System

## English Version
**Project Title:** Unified Academic Request System

**Role:** Expert Full-Stack Developer (Next.js/React) & UI/UX Designer.

**Objective:**
Build a comprehensive, modern web application for managing academic and administrative requests within a university environment. The system manages the flow of requests from students and employees through a dynamic hierarchy of approvals (Departments -> Colleges -> Deans).

**Core Modules:**

1.  **Organization Structure (Hierarchy):**
    *   **Colleges:** Manage colleges (e.g., College of Computer Science), assign Deans.
    *   **Departments:** Manage departments within colleges, assign Department Managers.
    *   **Users:** Manage Students, Employees, and Admins. Support hierarchical attributes (User belongs to a Dept, which belongs to a College).

2.  **Dynamic Form Builder:**
    *   Drag-and-drop interface to create forms (Text, Date, File Upload, Dropdowns).
    *   **Audience Targeting:** Configure forms to be visible only to specific roles (Students/Employees) or specific Colleges/Departments.

3.  **Workflow Engine:**
    *   Define approval chains for each request type (e.g., Dept Manager -> Dean -> Admin).
    *   Support dynamic routing based on the requester's hierarchy.

4.  **Request Lifecycle:**
    *   **Submission:** Users submit requests based on available forms.
    *   **Tracking:** Real-time status tracking with visual timeline.
    *   **Approvals:** Reviewers (Deans/Managers) view an inbox of pending requests to Approve, Reject, or Return for modification.
    *   **Delegation:** Allow managers to delegate their approval authority to other users for a specific period.

5.  **Notifications:**
    *   System alerts for status changes and pending actions.

**Technical Stack:**
*   **Framework:** Next.js (App Router), TypeScript.
*   **UI Library:** Shadcn UI, Tailwind CSS, Lucide Icons.
*   **Language:** Bi-directional support (LTR/RTL), primarily Arabic interface.
*   **Design:** Professional, clean, academic aesthetic (Teal/White/Gray palette).

---

## النسخة العربية
**عنوان المشروع:** نظام الطلبات الأكاديمي الموحد

**الدور:** مطور خبير (Next.js/React) ومصمم تجربة مستخدم (UI/UX).

**الهدف:**
بناء تطبيق ويب شامل وعصري لإدارة الطلبات الأكاديمية والإدارية داخل البيئة الجامعية. يدير النظام تدفق الطلبات من الطلاب والموظفين عبر تسلسل هرمي ديناميكي للموافقات (الأقسام -> الكليات -> العمداء).

**الوحدات الأساسية:**

1.  **الهيكل التنظيمي (الشجري):**
    *   **الكليات:** إدارة الكليات (مثلاً: كلية الحاسبات)، وتعيين العمداء.
    *   **الأقسام:** إدارة الأقسام داخل الكليات، وتعيين مدراء الأقسام.
    *   **المستخدمين:** إدارة الطلاب، الموظفين، والمسؤولين. دعم السمات الهرمية (المستخدم ينتمي لقسم، والقسم ينتمي لكلية).

2.  **باني النماذج الديناميكي (Form Builder):**
    *   واجهة سحب وإفلات لإنشاء النماذج (نص، تاريخ، رفع ملفات، قوائم منسدلة).
    *   **استهداف الجمهور:** تخصيص ظهور النماذج لأدوار محددة (طلاب/موظفين) أو كليات/أقسام معينة.

3.  **محرك مسارات العمل (Workflow Engine):**
    *   تعريف سلاسل الموافقات لكل نوع طلب (مثلاً: مدير القسم -> العميد -> المسؤول).
    *   دعم التوجيه الديناميكي بناءً على مكانة مقدم الطلب في الهيكل التنظيمي.

4.  **دورة حياة الطلب:**
    *   **التقديم:** يقوم المستخدمون بتقديم الطلبات بناءً على النماذج المتاحة.
    *   **التتبع:** تتبع حالة الطلب في الوقت الفعلي مع جدول زمني مرئي (Timeline).
    *   **الموافقات:** واجهة للمراجعين (العمداء/المدراء) لعراض الطلبات المعلقة للموافقة، الرفض، أو الإعادة للتعديل.
    *   **التفويض:** السماح للمدراء بتفويض صلاحياتهم لمستخدمين آخرين لفترة محددة.

5.  **الإشعارات:**
    *   تنبيهات النظام عند تغير الحالة أو وجود إجراءات معلقة.

**التقنيات المستخدمة:**
*   **إطار العمل:** Next.js (App Router), TypeScript.
*   **واجهة المستخدم:** Shadcn UI, Tailwind CSS, Lucide Icons.
*   **اللفة:** دعم ثنائي الاتجاه (LTR/RTL)، مع واجهة عربية أساسية.
*   **التصميم:** احترافي، نظيف، بلمسة أكاديمية (ألوان التيل/الأبيض/الرمادي).
