# Employee & Approver Use Case Documentation - Masar System
# توثيق حالة استخدام الموظف والمراجع - نظام مسار الجامعي

This document contains the complete Use Case specifications for the **Employee** (as a requester) and **Approver** (reviewer) actors, matched **exactly** with the Employee/Approver section of the UML Use Case Diagram (`media__1781281577908.png`).

---

## 🚀 1. Eraser.io AI Prompt (Employee/Approver Side)
*Copy the prompt below and paste it into the **Eraser.io AI Diagram Generator** to automatically generate the visual diagram:*

```text
Generate a UML Use Case Diagram for the Employee and Approver Actors in a University Request Management System.
Actors:
- "Employee" (on the left)
- "Approver" (at the bottom, representing reviewer roles)
- "Notification Gateway (whatsapp/SMS)" (on the right)

Approver has subtypes (generalizations shown below it):
1. "HR department"
2. "Procurement"
3. "Dean (College)"
4. "Vice President"
5. "Financial"
6. "University Secretary"
7. "College Secretary"
8. "Service Worker"

Inside the boundary box "Paperless Process Automation", show the following use cases:
1. "Login" (Directly associated with Employee)
2. "Upload Document" (Directly associated with Employee)
3. "Submit Request" (Directly associated with Employee)
4. "Submit Delegation Request" (Subtype of Submit Request)
5. "Leave Request" (Subtype of Submit Request)
6. "Maintenance Request" (Subtype of Submit Request)
7. "Equipment Request" (Subtype of Submit Request)
8. "Track Request Status" (Directly associated with Employee)
9. "Edit Request" (Extends Track Request Status, with note: Allowed only if request is Returned)
10. "Review Request" (Directly associated with Approver, with note: max 48 hours SLA)
11. "Policy Check" (Included in Review Request)
12. "Escalation on SLA Breach" (Extends Review Request)
13. "Add Comment / Attachment For Next Approver" (Extends Review Request)
14. "Request Corrections (Return)" (Extends Review Request, with note: Auto-close if no action within 30 days)
15. "Reject Request" (Extends Review Request)
16. "Approve Request" (Extends Review Request, with note: All approvals are Sequential)
17. "Add Comment / Attachment" (Included in Request Corrections)
18. "Generate Approval PDF" (Extends Approve Request)
19. "Send Notification" (Included in Request Corrections, Reject Request, and Generate Approval PDF. Associated with Notification Gateway on the right)

Use green/dark themes for rendering.
```

---

## 💻 2. Eraser.io Diagram-as-Code (Employee/Approver Side)
*Paste this code in the **Diagram-as-Code** tab in Eraser.io to render the exact diagram:*

```text
// Employee & Approver Use Case Diagram (Masar System)
Employee [icon: user, color: green]
Approver [icon: user-check, color: green]
NotificationGateway [label: "Notification Gateway\n(whatsapp/SMS)", icon: mail, color: gray]

// Approver Subtypes
HR_Dept [label: "HR department", shape: actor, color: green]
Procurement [label: "Procurement", shape: actor, color: green]
Dean [label: "Dean (College)", shape: actor, color: green]
VP [label: "Vice President", shape: actor, color: green]
Financial [label: "Financial", shape: actor, color: green]
Univ_Sec [label: "University Secretary", shape: actor, color: green]
Coll_Sec [label: "College Secretary", shape: actor, color: green]
Service_Worker [label: "Service Worker", shape: actor, color: green]

Approver > HR_Dept
Approver > Procurement
Approver > Dean
Approver > VP
Approver > Financial
Approver > Univ_Sec
Approver > Coll_Sec
Approver > Service_Worker

group Paperless_Process_Automation {
  Login [label: "Login", shape: oval, color: green]
  UploadDocument [label: "Upload Document", shape: oval, color: green]
  SubmitRequest [label: "Submit Request", shape: oval, color: green]
  DelegationRequest [label: "Submit Delegation Request", shape: oval, color: green]
  LeaveRequest [label: "Leave Request", shape: oval, color: green]
  MaintenanceRequest [label: "Maintenance Request", shape: oval, color: green]
  EquipmentRequest [label: "Equipment Request", shape: oval, color: green]
  
  TrackRequestStatus [label: "Track Request Status", shape: oval, color: green]
  EditRequest [label: "Edit Request\n(Allowed only if Returned)", shape: oval, color: green]
  
  ReviewRequest [label: "Review Request\n(max 48 hours SLA)", shape: oval, color: green]
  PolicyCheck [label: "Policy Check", shape: oval, color: green]
  EscalationSLA [label: "Escalation on SLA Breach", shape: oval, color: green]
  AddCommentNext [label: "Add Comment / Attachment\nFor Next Approver", shape: oval, color: green]
  
  RequestCorrections [label: "Request Corrections (Return)\n(Auto-close if no action in 30d)", shape: oval, color: green]
  AddComment [label: "Add Comment / Attachment", shape: oval, color: green]
  RejectRequest [label: "Reject Request", shape: oval, color: green]
  ApproveRequest [label: "Approve Request\n(All approvals Sequential)", shape: oval, color: green]
  GeneratePDF [label: "Generate Approval PDF", shape: oval, color: green]
  SendNotification [label: "Send Notification", shape: oval, color: green]
}

Employee > Login
Employee > UploadDocument
Employee > SubmitRequest
Employee > TrackRequestStatus

SubmitRequest > DelegationRequest
SubmitRequest > LeaveRequest
SubmitRequest > MaintenanceRequest
SubmitRequest > EquipmentRequest

EditRequest > TrackRequestStatus [label: "<<extend>>"]

Approver > ReviewRequest

PolicyCheck > ReviewRequest [label: "<<include>>"]
EscalationSLA > ReviewRequest [label: "<<extend>>"]
AddCommentNext > ReviewRequest [label: "<<extend>>"]
RequestCorrections > ReviewRequest [label: "<<extend>>"]
RejectRequest > ReviewRequest [label: "<<extend>>"]
ApproveRequest > ReviewRequest [label: "<<extend>>"]

AddComment > RequestCorrections [label: "<<include>>"]
SendNotification > RequestCorrections [label: "<<include>>"]
SendNotification > RejectRequest [label: "<<include>>"]
GeneratePDF > ApproveRequest [label: "<<extend>>"]
SendNotification > GeneratePDF [label: "<<include>>"]

SendNotification > NotificationGateway
```

---

## 📝 3. Codebase Alignment Verification (تحقق مواءمة الكود الفعلي)

> [!NOTE]
> **Complete Match Verification / تأكيد التطابق الكامل للكود:**
> - **Submit Request & Subtypes (تقديم الطلبات):** The codebase supports general request submission through forms. Crucially, the **Submit Delegation Request** is explicitly implemented via `submitDelegationRequest` in `employee.ts` and allows employees to delegate their approvals during leaves. Other subtypes (Leave, Maintenance, Equipment) are supported as dynamic form templates.
> - **SLA Breach & Escalation (التصعيد التلقائي):** Codebase implements this fully in `app/api/cron/escalate/route.ts` via an automated cron check. It reads the `sla_hours` for the active step and escalates the request if exceeded.
> - **Auto-Close Rule (الإغلاق التلقائي 30 يوماً):** Implemented in the same cron route (`route.ts:L144-189`). If a request is in the `returned` (corrections) state and has had no action for **30 days**, it is automatically updated to `rejected` with a system action log.
> - **Sequential Approvals (الاعتمادات المتتالية):** Supported through workflow steps linked in order (`order` field in database).
> - **Notifications & WhatsApp:** Implemented via the Notification subsystem (`notifications.ts`) and linked to WhatsApp/SMS message sending.

---

## 📝 4. Detailed Use Case Specifications (تفاصيل حالات الاستخدام)

### 📌 UC-03: Process/Review Request (مراجعة الطلب واعتماده)
* **Actor:** Approver (e.g. Dean, HOD, HR, Procurement, Financial)
* **Description:** Allows the reviewer to view pending requests, verify policies, write notes, upload files, and take action (Approve, Reject, or Return for Corrections).
* **Main Steps:**
  1. Approver opens "Inbox".
  2. Selects a pending request.
  3. Evaluates details (Policy Check is done automatically by matching roles/departments, and manually by verifying attachments).
  4. Takes action:
     - **Approve:** Moves request to next step. If it's the final step, updates status to `approved`, generates PDF, and sends WhatsApp notification.
     - **Reject:** Sets status to `rejected` and sends notification.
     - **Return:** Sets status to `returned` (corrections), attaches comment/attachment, and sends notification.
