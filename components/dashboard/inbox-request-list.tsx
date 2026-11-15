"use client"

import React, { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Request } from "@/types/schema"

interface InboxRequestListProps {
  requests: Request[]
  selectedRequestId?: string | null
  onSelectRequest: (request: Request) => void
  onViewHistory?: (applicantName: string) => void
  className?: string
}

export function InboxRequestList({
  requests,
  selectedRequestId,
  onSelectRequest,
  onViewHistory,
  className
}: InboxRequestListProps) {
  const [searchTerm, setSearchTerm] = useState("")

  const searchLower = (searchTerm || "").trim().toLowerCase()
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
      pending: { label: "قيد الانتظار", className: "bg-amber-100 text-amber-800 border-amber-200" },
      processing: { label: "قيد المراجعة", className: "bg-blue-100 text-blue-800 border-blue-200" },
      approved: { label: "موافق عليه", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
      rejected: { label: "مرفوض", className: "bg-rose-100 text-rose-800 border-rose-200" },
      returned: { label: "معاد للتعديل", className: "bg-orange-100 text-orange-800 border-orange-200" },
    }
    const config = statusMap[status] || statusMap.pending
    return (
      <Badge variant="outline" className={cn("text-[11px] font-semibold px-2 py-0.5", config.className)}>
        {config.label}
      </Badge>
    )
  }

  return (
    <div className={cn("w-full md:w-1/3 flex flex-col h-full", className)}>
      <div className="border border-slate-200 bg-white rounded-xl p-3 sm:p-4 flex flex-col h-full w-full shadow-2xs">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm sm:text-base text-slate-800">
            صندوق الوارد ({filteredRequests.length})
          </h3>
          <span className="text-[11px] text-slate-400 font-medium">بانتظار الإجراء</span>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder="بحث عن طلب (الاسم، الرقم، النوع)..."
            className="pr-9 pl-3 text-right bg-slate-50/70 border-slate-200 focus:bg-white focus:border-primary/50 focus:ring-primary/20 transition-all rounded-xl text-xs h-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Requests List */}
        <div className="overflow-y-auto custom-scrollbar flex-1 space-y-2 pl-1">
          {filteredRequests.length > 0 ? (
            filteredRequests.map((req) => {
              const isSelected = selectedRequestId === req.id
              return (
                <div
                  key={req.id}
                  onClick={() => onSelectRequest(req)}
                  className={cn(
                    "cursor-pointer transition-all rounded-xl p-3 text-right border select-none",
                    isSelected
                      ? "bg-[#0B2545]/5 border-[#0B2545] shadow-xs ring-1 ring-[#0B2545]/20"
                      : "bg-white border-slate-200 hover:border-[#C69214]/60 hover:bg-slate-50/70 shadow-2xs"
                  )}
                >
                  {/* Top row: Title + Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-800 leading-snug line-clamp-2">
                      {req.type}
                    </h4>
                    <div className="shrink-0 mt-0.5">
                      {getStatusBadge(req.status)}
                    </div>
                  </div>

                  {/* Bottom row: Applicant + Date */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2.5 pt-2 border-t border-slate-100/90">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-slate-400">مقدم من:</span>
                      {onViewHistory ? (
                        <span
                          className="font-semibold text-slate-700 hover:text-[#0B2545] hover:underline cursor-pointer truncate"
                          onClick={(e) => {
                            e.stopPropagation()
                            onViewHistory(req.applicant)
                          }}
                        >
                          {req.applicant}
                        </span>
                      ) : (
                        <span className="font-semibold text-slate-700 truncate">{req.applicant}</span>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-slate-400 shrink-0">
                      {req.date}
                    </span>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="text-center py-10 text-slate-400 text-xs">
              <p>لا توجد طلبات مطابقة للبحث</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
