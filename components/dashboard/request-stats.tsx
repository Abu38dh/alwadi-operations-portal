import React from "react"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface RequestStatsProps {
  stats: {
    returned: number
    approved: number
    rejected: number
    pending: number
  }
  onStatClick?: (type: 'pending' | 'approved' | 'rejected' | 'returned') => void
}

export function RequestStats({ stats, onStatClick }: RequestStatsProps) {
  return (
    <div className="grid grid-cols-4 gap-1.5 sm:gap-3">
      {/* Pending */}
      <div 
        className="cursor-pointer hover:shadow-sm hover:border-amber-300 transition-all rounded-lg sm:rounded-xl p-1.5 sm:p-3 bg-amber-50/80 border border-amber-200/90 text-center flex flex-col justify-center"
        onClick={() => onStatClick?.('pending')}
      >
        <p className="text-[10px] sm:text-xs text-amber-800 font-medium truncate leading-tight">الانتظار</p>
        <p className="text-base sm:text-2xl font-bold text-amber-600 leading-tight mt-0.5">{stats.pending}</p>
      </div>
      {/* Approved */}
      <div 
        className="cursor-pointer hover:shadow-sm hover:border-emerald-300 transition-all rounded-lg sm:rounded-xl p-1.5 sm:p-3 bg-emerald-50/80 border border-emerald-200/90 text-center flex flex-col justify-center"
        onClick={() => onStatClick?.('approved')}
      >
        <p className="text-[10px] sm:text-xs text-emerald-800 font-medium truncate leading-tight">المقبولة</p>
        <p className="text-base sm:text-2xl font-bold text-emerald-600 leading-tight mt-0.5">{stats.approved}</p>
      </div>
      {/* Returned */}
      <div 
        className="cursor-pointer hover:shadow-sm hover:border-orange-300 transition-all rounded-lg sm:rounded-xl p-1.5 sm:p-3 bg-orange-50/80 border border-orange-200/90 text-center flex flex-col justify-center"
        onClick={() => onStatClick?.('returned')}
      >
        <p className="text-[10px] sm:text-xs text-orange-800 font-medium truncate leading-tight">للتعديل</p>
        <p className="text-base sm:text-2xl font-bold text-orange-600 leading-tight mt-0.5">{stats.returned}</p>
      </div>
      {/* Rejected */}
      <div 
        className="cursor-pointer hover:shadow-sm hover:border-rose-300 transition-all rounded-lg sm:rounded-xl p-1.5 sm:p-3 bg-rose-50/80 border border-rose-200/90 text-center flex flex-col justify-center"
        onClick={() => onStatClick?.('rejected')}
      >
        <p className="text-[10px] sm:text-xs text-rose-800 font-medium truncate leading-tight">المرفوضة</p>
        <p className="text-base sm:text-2xl font-bold text-rose-600 leading-tight mt-0.5">{stats.rejected}</p>
      </div>
    </div>
  )
}

