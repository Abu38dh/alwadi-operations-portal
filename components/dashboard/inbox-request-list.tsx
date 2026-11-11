
import React from "react"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import { Request } from "@/types/schema"

interface InboxRequestListProps {
    requests: Request[]
    selectedRequestId?: string | null
    onSelectRequest: (request: Request) => void
    onViewHistory?: (applicantName: string) => void
    className?: string
}

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

export function InboxRequestList({ requests, selectedRequestId, onSelectRequest, onViewHistory, className }: InboxRequestListProps) {
    const [searchTerm, setSearchTerm] = useState("")

    const searchLower = searchTerm.trim().toLowerCase()
    const filteredRequests = (requests || []).filter(req => {
        if (!req) return false
        const title = (req.title || req.type || "").toLowerCase()
        const id = String(req.id || "")
        const applicant = (req.applicant || "").toLowerCase()
        const refNo = String(req.reference_no || "")
        return title.includes(searchLower) || id.includes(searchLower) || applicant.includes(searchLower) || refNo.includes(searchLower)
    })

    const getStatusBadge = (status: string) => {
        const statusMap: Record<string, { label: string; className: string }> = {
            pending: { label: "قيد الانتظار", className: "bg-yellow-100 text-yellow-800" },
            processing: { label: "قيد المراجعة", className: "bg-blue-100 text-blue-800" },
            approved: { label: "موافق عليه", className: "bg-green-100 text-green-800" },
            rejected: { label: "مرفوض", className: "bg-red-100 text-red-800" },
            returned: { label: "معاد للتعديل", className: "bg-orange-100 text-orange-800" },
        }
        const config = statusMap[status] || statusMap.pending
        return <Badge className={config.className}>{config.label}</Badge>
    }

    return (
        <div className={cn("w-full md:w-1/3 relative md:min-h-0", className)}>
            <div className="md:absolute md:inset-0 border border-border bg-card rounded-xl p-3 sm:p-4 flex flex-col h-full w-full">
            <h3 className="font-semibold mb-4">صندوق الوارد ({filteredRequests.length})</h3>

            <div className="relative mb-4">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="بحث عن طلب (الاسم، الرقم، النوع)..."
                    className="pr-9 bg-white border-slate-200 focus:border-primary/50 focus:ring-primary/20 transition-all rounded-xl shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="overflow-y-auto flex-1 space-y-1.5 pr-1">
            {filteredRequests.length > 0 ? (
                filteredRequests.map((req) => (
                    <Card
                        key={req.id}
                        className={`cursor-pointer hover:bg-muted/50 transition-colors border-slate-200 shadow-xs ${selectedRequestId === req.id ? "border-primary bg-primary/5 ring-1 ring-primary/20" : ""
                            }`}
                        onClick={() => onSelectRequest(req)}
                    >
                        <CardHeader className="p-2.5 sm:p-3 space-y-1">
                            <div className="flex justify-between items-center gap-2">
                                <CardTitle className="text-xs sm:text-sm font-bold truncate">{req.type}</CardTitle>
                                {getStatusBadge(req.status)}
                            </div>
                            <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                                <div className="flex items-center gap-1 truncate">
                                    <span>مقدم من:</span>
                                    {onViewHistory ? (
                                        <span
                                            className="font-semibold text-foreground hover:text-primary hover:underline cursor-pointer truncate"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onViewHistory(req.applicant)
                                            }}
                                        >
                                            {req.applicant}
                                        </span>
                                    ) : (
                                        <span className="font-semibold text-foreground truncate">{req.applicant}</span>
                                    )}
                                </div>
                                <span className="font-mono text-[10px] text-muted-foreground/70 shrink-0 mr-1">{req.date}</span>
                            </div>
                        </CardHeader>
                    </Card>
                ))
            ) : (
                <div className="text-center py-6 text-muted-foreground text-xs">
                    <p>لا توجد نتائج مطابقة للبحث</p>
                </div>
            )}
            </div>
        </div>
        </div>
    )
}

