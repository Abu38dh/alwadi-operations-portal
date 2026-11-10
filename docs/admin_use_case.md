# Admin Use Case Documentation - Masar System
# توثيق جميع حالات استخدام مدير النظام - نظام مسار الجامعي

This document contains the complete, detailed Use Case specifications for the **Admin** (Administrator) actor in the Masar System, covering every administrative feature available in the system, along with the ready-to-use **Eraser.io AI Prompt** and **Diagram-as-Code** syntax.

---

## 🚀 1. Eraser.io AI Prompt (English)
*Copy the prompt below and paste it into the **Eraser.io AI Diagram Generator** to automatically generate the complete Use Case diagram:*

```text
Generate a comprehensive UML Use Case Diagram for the Admin Actor in a University Student Request Management System (Masar).
The Admin is the primary Actor located on the left side.
Inside the system boundary box (labeled "Admin System Portal"), show all the use cases representing everything the Admin can do:
1. "Create & Edit Users" (Add accounts, update details, or archive users).
2. "Bulk Import Users via CSV" (Extends Create & Edit Users to upload student/employee sheets in bulk).
3. "Manage System Delegations" (Extends Create & Edit Users to assign surrogate approvers during leaves).
4. "Assign Roles & Custom Permissions" (Change user roles and set individual page access rules).
5. "Manage Academic Structure" (Create Colleges and Departments, and assign Deans and HODs).
6. "Manage Academic Tree" (Build levels and subjects, and map courses to specific semesters).
7. "Bulk Promote Students" (Extends Manage Academic Tree to promote students in bulk from level to level).
8. "Design Dynamic Form Templates" (Add fields and design student/employee request forms).
9. "Configure Approval Workflows" (Design sequential approval steps, HOD/Dean chains, timers, and SLA escalation rules).
10. "Design PDF Print Templates" (Configure official document print templates with signature tags and stamps).
11. "Track System Audit Logs" (Monitor system activities, administrative actions, and IP logs).
12. "Monitor Employee Performance KPIs" (Track request processing times, SLA adherence, and approval metrics).

Draw direct association lines between the Admin actor and primary use cases (Manage Users, Assign Permissions, Manage Structure, Manage Academic Tree, Design Forms, Configure Workflows, Design PDF, Track Audit Logs, Monitor KPIs). Use orange themes. Show <<extend>> dashed lines for CSV import, system delegations, and bulk student promotion.
```

---

## 💻 2. Eraser.io Diagram-as-Code (Syntax)
*If you prefer using the **Diagram-as-Code** tab in Eraser.io, paste this code:*

```text
// Admin Use Case Diagram (Complete Masar System)
Admin [icon: user-cog, color: orange]

group Admin_System_Portal {
  // User & Structure Management
  ManageUsers [label: "Create & Edit Users", shape: oval, color: orange]
  ImportCSV [label: "Bulk Import Users via CSV", shape: oval, color: orange]
  ManageDelegations [label: "Manage System Delegations", shape: oval, color: orange]
  AssignPermissions [label: "Assign Roles & Custom Permissions", shape: oval, color: orange]
  ManageStructure [label: "Manage Academic Structure (Colleges/Depts)", shape: oval, color: orange]
  
  // Forms & Workflows
  DesignForms [label: "Design Dynamic Form Templates", shape: oval, color: orange]
  ConfigureWorkflows [label: "Configure Approval Workflows", shape: oval, color: orange]
  DefineSLAs [label: "Define SLAs & Escalation Rules", shape: oval, color: orange]
  
  // Academic Setup
  ManageAcademicTree [label: "Manage Levels, Terms & Subjects", shape: oval, color: orange]
  BulkPromote [label: "Bulk Promote Students", shape: oval, color: orange]
  DesignPDF [label: "Design PDF Print Templates (Signatures/Stamps)", shape: oval, color: orange]
  
  // Monitoring & Auditing
  ViewLogs [label: "Track System Audit Logs", shape: oval, color: orange]
  MonitorKPIs [label: "Monitor Employee Performance KPIs", shape: oval, color: orange]
}

Admin > ManageUsers
Admin > AssignPermissions
Admin > ManageStructure
Admin > DesignForms
Admin > ConfigureWorkflows
Admin > ManageAcademicTree
Admin > DesignPDF
Admin > ViewLogs
Admin > MonitorKPIs

ManageUsers > ImportCSV [label: "<<extend>>"]
ManageUsers > ManageDelegations [label: "<<extend>>"]
ManageAcademicTree > BulkPromote [label: "<<extend>>"]
ConfigureWorkflows > DefineSLAs [label: "<<include>>"]
```

---

## 📝 3. Detailed Use Case Specifications (تفاصيل حالات الاستخدام)

### 📌 UC-02-A: Identity & Permission Management (إدارة الحسابات والصلاحيات)

* **Actor:** Admin (System Administrator)
* **Description:** Adding/editing accounts, toggling status (active, graduated, suspended), assigning roles (Dean, HOD, Employee, Student), and customizing granular permissions (e.g. `can_manage_absences`, `view_reports`).
* **Preconditions:** Admin must be authenticated.
* **Postconditions:** User accounts are updated in the database (`users` and `roles` tables).
* **Main Steps:**
  1. Admin opens "Users Management".
  2. Creates a user or expands an existing user.
  3. Modifies information or toggles custom privilege switches.
  4. Saves changes to database.

#### ⚠️ Extensions (امتدادات الحالات)
* **UC-02-A1: Bulk Import Users via CSV (استيراد المستخدمين من ملف CSV) `<<extend>>`:**
  - Admin clicks "Import Users" and uploads a CSV file containing columns: `university_id`, `full_name`, `email`, `role`, `department`. The system parses it using `Papa.parse` and calls the server action `importUsersFromCSV` to create all accounts in bulk.
* **UC-02-A2: Manage System Delegations (إدارة تفويض الصلاحيات للمراجعين) `<<extend>>`:**
  - Admin clicks "Manage Delegations" on an employee's card. Admin sets start date, end date, reason, and selects which request templates to delegate to a colleague. Activates surrogate authority during leaves.

---

### 📌 UC-02-B: Academic Tree Management (إدارة الهيكل الأكاديمي والترقيات)

* **Actor:** Admin
* **Description:** Managing colleges, departments, levels, semesters/terms, and mapping subjects/courses to levels.
* **Preconditions:** Admin must be authenticated.
* **Postconditions:** Academic tree structure is committed to the database.
* **Main Steps:**
  1. Admin goes to "Colleges & Departments" or "Levels & Subjects Manager".
  2. Registers colleges (e.g., Computer Science College) and binds Deans.
  3. Registers departments (e.g., Software Engineering Department) and binds HODs.
  4. Manages levels (e.g., Level 1, Level 2) and attaches specific subjects/courses.

#### ⚠️ Extensions (امتدادات الحالات)
* **UC-02-B1: Bulk Promote Students (ترقية الطلاب الأكاديمية دفعة واحدة) `<<extend>>`:**
  - Admin goes to "Levels & Subjects Manager" and clicks "Promote Students". Admin filters by college, department, source level (e.g., Level 1), and target level (e.g., Level 2). Selects eligible students and clicks "Promote" to execute a bulk academic level promotion.

---

### 📌 UC-02-C: Dynamic Form & Workflow Builder (منشئ النماذج ومسارات العمل)

* **Actor:** Admin
* **Description:** Designing dynamic form templates via drag-and-drop, establishing the sequential reviewer roles, and setting SLA deadlines and timers.
* **Preconditions:** Admin must be authenticated.
* **Postconditions:** Form JSON schemas and workflow steps are saved.
* **Main Steps:**
  1. Admin opens the "Form Builder", adds/removes fields (Text, Select, File Upload, Absence Picker) and previews.
  2. Admin defines the target audience constraints (e.g. CS Level 2 only).
  3. Admin goes to "Workflows Editor" and designs the approval sequence card layout (Step 1: Department Head -> Step 2: Dean).
  4. Admin sets SLA limits in hours (e.g., 48 hours for review) and configures Escalation Rules (e.g., escalate to Dean if HOD doesn't respond) (Includes UC-02-C1).
  5. Publishes the template.

---

### 📌 UC-02-D: PDF template Configuration (إعداد قوالب طباعة الـ PDF)

* **Actor:** Admin / Dean
* **Description:** Styling and configuring the headers, footers, digital stamps, and dynamic signature fields for official document generation.
* **Preconditions:** Admin must be authenticated.
* **Postconditions:** PDF templates are styled and saved.
* **Main Steps:**
  1. Admin opens "PDF Template Editor" for a published request type.
  2. Formats layout tags (e.g., student name, college stamp, Dean signature).
  3. Uploads college seal/stamp image and binds it to the accepted decision letter layout.
  4. Saves configurations.

---

### 📌 UC-02-E: Monitoring & Auditing (التدقيق ومراقبة الأداء)

* **Actor:** Admin
* **Description:** Reviewing administrative activity audit logs, IP logins, and monitoring reviewer performance metrics.
* **Preconditions:** Admin must be authenticated.
* **Postconditions:** System audit transparency and KPI reports.
* **Main Steps:**
  1. Admin goes to "Reports & Audit Logs".
  2. Filters logs by username, action type, or date to track administrative changes.
  3. Navigates to "Employee KPIs" to evaluate employee response speed, SLA violation rates, and active/completed requests count.
