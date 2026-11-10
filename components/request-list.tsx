"use client"

import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ListSkeleton } from "@/components/ui/loading-skeleton"
import { useState } from "react"

import { Request } from "@/types/schema"

interface RequestListProps {
  requests: Request[]
  selectedId?: string
  onSelect: (id: string) => void
  loading?: boolean
}

export default function RequestList({ requests, selectedId, onSelect, loading }: RequestListProps) {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredRequests = requests.filter(req =>
    (req.title || req.type).toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.id.includes(searchTerm) ||
    (req.applicant && req.applicant.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const statusColors: Record<string, string> = {
    pending: "bg-secondary/10 text-secondary",
    approved: "bg-primary/10 text-primary",
    rejected: "bg-red-100 text-red-800",
    processing: "bg-blue-100 text-blue-800",
    approved_with_changes: "bg-primary/10 text-primary",
    rejected_with_changes: "bg-secondary/10 text-secondary",
  }

  const statusLabels: Record<string, string> = {
    pending: "قيد الانتظار",
    approved: "موافق عليه",
    rejected: "مرفوض",
    processing: "قيد المراجعة",
    approved_with_changes: "موافق بتعديلات",
    rejected_with_changes: "معاد للتعديل",
  }

  return (
    <div className="p-3 sm:p-4 space-y-3">
      <h3 className="text-base sm:text-lg font-bold text-foreground mb-3">الطلبات ({filteredRequests.length})</h3>
      <div className="relative mb-3">
        <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="بحث عن طلب..."
          className="pr-9 bg-white border-slate-200 focus:border-primary/50 focus:ring-primary/20 transition-all rounded-xl shadow-sm text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      {filteredRequests.length > 0 ? (
        filteredRequests.map((request) => (
          <div
            key={request.id}
            onClick={() => onSelect(request.id)}
            className={`group p-3.5 sm:p-3 cursor-pointer transition-all rounded-xl border ${selectedId === request.id
              ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
              : "border-slate-200 bg-white shadow-sm hover:border-primary/30 hover:shadow active:scale-[0.99]"
              }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="font-bold text-foreground group-hover:text-primary transition-colors text-sm">{request.title || request.type}</h4>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[request.status] || "bg-slate-100 text-slate-700"}`}>
                {statusLabels[request.status] || request.status}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <p className="text-[10px] text-muted-foreground bg-slate-100 px-2 py-0.5 rounded-md inline-block">{request.type}</p>
              <p className="text-[10px] text-muted-foreground/70 font-mono">{request.date}</p>
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-8 text-muted-foreground text-sm">
          لا توجد طلبات مطابقة للبحث
        </div>
      )}
    </div>
  )
}

