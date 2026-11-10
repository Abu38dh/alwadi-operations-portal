export interface User {
    id: string
    university_id: string
    full_name: string
    role: "student" | "employee" | "admin"
    department_id?: string
    permissions?: string[]
}

export type RequestStatus = "pending" | "approved" | "rejected" | "processing" | "returned"

export interface WorkflowStep {
    step: number
    department: string
    role: string
    status: "pending" | "approved" | "rejected" | "processing" | "returned"
}

export interface Attachment {
    file_id?: number
    storage_location: string
    uploaded_at?: string
    uploader_name?: string
    file_type?: string
}

export interface Request {
    id: string
    type: string
    title?: string // Added for compatibility
    status: RequestStatus
    applicant: string
    date: string
    description?: string
    submissionData?: Record<string, any>
    formSchema?: any[]
    requestId?: number // Sometimes used
    requestType?: string // Sometimes used
    timestamp?: string // For history
    action?: string // For history
    comment?: string // For history
    submitted_at?: string
    workflow?: WorkflowStep[]
    attachments?: Attachment[] | any[]
    pdfTemplate?: string
    reference_no?: string
    users?: any
    formId?: string
    college?: string // Applicant's college name
    department?: string // Applicant's department name
    generateDocument?: boolean
}

export interface RequestStats {
    returned: number
    approved: number
    rejected: number
    pending: number
}

