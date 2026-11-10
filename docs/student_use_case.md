# Student Use Case Documentation - Masar System
# توثيق حالة استخدام الطالب - نظام مسار الجامعي

This document contains the complete Use Case specifications for the **Student** actor, matched **exactly** with the Student section of the UML Use Case Diagram (`media__1781281576027.png`).

---

## 🚀 1. Eraser.io AI Prompt (Student Side)
*Copy the prompt below and paste it into the **Eraser.io AI Diagram Generator** to automatically generate the visual Student Use Case diagram:*

```text
Generate a UML Use Case Diagram for the Student Actor in a University Request Management System.
The Student is the Actor on the left.
Inside the boundary box "Student Portal", show the following use cases:
1. "Login"
2. "View Academic Absences"
3. "Submit Request"
4. "Upload document" (Extends Submit Request)
5. "Absence Excuse Request" (Subtype of Submit Request)
6. "University Withdrawal Request" (Subtype of Submit Request)
7. "Re-enrollment Request" (Subtype of Submit Request)
8. "Major Transfer Request" (Subtype of Submit Request)
9. "Document Request" (Subtype of Submit Request)
10. "Track Request Status"
11. "Edit Request" (Extends Track Request Status, with note: Allowed only if request is Draft)
12. "Download Approved PDF"

Draw direct association lines between the Student actor and Login, View Academic Absences, Submit Request, Track Request Status, and Download Approved PDF. Use clean blue themes.
```

---

## 💻 2. Eraser.io Diagram-as-Code (Student Side)
*Paste this code in the **Diagram-as-Code** tab in Eraser.io to render the exact Student side diagram:*

```text
// Student Use Case Diagram (Masar System)
Student [icon: user, color: blue]

group Student_Portal {
  Login [label: "Login", shape: oval, color: blue]
  ViewAbsences [label: "View Academic Absences", shape: oval, color: blue]
  SubmitRequest [label: "Submit Request", shape: oval, color: blue]
  UploadDocument [label: "Upload document", shape: oval, color: blue]
  AbsenceExcuse [label: "Absence Excuse Request", shape: oval, color: blue]
  WithdrawalRequest [label: "University Withdrawal Request", shape: oval, color: blue]
  ReenrollmentRequest [label: "Re-enrollment Request", shape: oval, color: blue]
  MajorTransfer [label: "Major Transfer Request", shape: oval, color: blue]
  DocumentRequest [label: "Document Request", shape: oval, color: blue]
  TrackRequestStatus [label: "Track Request Status", shape: oval, color: blue]
  EditRequest [label: "Edit Request\n(Allowed only if request is Draft)", shape: oval, color: blue]
  DownloadPDF [label: "Download Approved PDF", shape: oval, color: blue]
}

Student > Login
Student > ViewAbsences
Student > SubmitRequest
Student > TrackRequestStatus
Student > DownloadPDF

UploadDocument > SubmitRequest [label: "<<extend>>"]
SubmitRequest > AbsenceExcuse
SubmitRequest > WithdrawalRequest
SubmitRequest > ReenrollmentRequest
SubmitRequest > MajorTransfer
SubmitRequest > DocumentRequest

EditRequest > TrackRequestStatus [label: "<<extend>>"]
```

---

## 📝 3. Codebase Alignment Note (تنبيه مواءمة الكود الفعلي)

> [!WARNING]
> **Status Mismatch / اختلاف حالة التعديل:**
> - **In the Diagram:** The diagram states that editing a request is: *"Allowed only if the request is Draft. Not allowed while Under Review."*
> - **In the Codebase (`student.ts` / `student-dashboard.tsx`):** The system does not support the "Save Draft" feature. A request goes directly to `pending` upon submission. A student is only allowed to edit and resubmit a request when its status is **`returned`** or **`rejected_with_changes`** (i.e., when an approver returns it back for corrections).

---

## 📝 4. Detailed Use Case Specifications (تفاصيل حالات الاستخدام)

### 📌 UC-01: Submit Request (تقديم الطلب)
* **Actor:** Student (الطالب)
* **Description:** Enables the student to log in, choose a request type, input details, optionally upload documents, and submit it.
* **Request Variants (أنواع الطلبات المتاحة):**
  1. **Absence Excuse Request (طلب عذر غياب):** Submitting a medical excuse for a specific course absence.
  2. **University Withdrawal Request (طلب انسحاب من الجامعة):** Requesting official withdrawal from the term/university.
  3. **Re-enrollment Request (طلب إعادة قيد):** Requesting re-activation of academic enrollment.
  4. **Major Transfer Request (طلب تغيير تخصص):** Requesting transfer to another academic department.
  5. **Document Request (طلب وثيقة):** Requesting academic transcripts or student certificates.
* **Preconditions:** Student is logged in and active.
* **Postconditions:** Request status is saved in database as `pending`, triggering the designated workflow.
* **Main Steps:**
  1. Student navigates to the request dashboard.
  2. Clicks "New Request" and selects the desired form template.
  3. Fills in form data and optionally uploads supporting documents (Extends UC-01).
  4. Clicks "Submit" to send it to the reviewer inbox.
