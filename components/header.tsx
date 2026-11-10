"use client"

import { useState, useEffect } from "react"
import { LogOut, User, Menu, Calendar } from "lucide-react"
import { translateRole } from "@/lib/translations"
import Image from "next/image"
import { getCurrentTerm } from "@/app/actions/terms"

interface HeaderProps {
  userType: string
  userName?: string
  userId: string
  onLogout: () => void
  onMenuClick?: () => void
}

export default function Header({
  userType,
  userName,
  userId,
  onLogout,
  onMenuClick,
}: HeaderProps) {
  const [mounted, setMounted] = useState(false)
  const [termName, setTermName] = useState<string>("الفترة التشغيلية الحالية")

  useEffect(() => {
    setMounted(true)
    getCurrentTerm().then((res) => {
      if (res.success && res.data?.name) {
        setTermName(res.data.name)
      }
    })
  }, [])

  return (
    <header
      dir="rtl"
      className="
        h-14 sm:h-14 md:h-16 px-3 sm:px-4 flex items-center justify-between
        bg-white border-b border-slate-200
        shadow-[0_1px_2px_rgba(11,37,69,0.05)]
        sticky top-0 z-30
      "
    >
      {/* Right: Logo + Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="
              md:hidden flex items-center justify-center
              w-8 h-8 rounded-lg
              text-slate-500 hover:bg-slate-100 hover:text-[#0B2545]
              transition-colors duration-150 shrink-0
            "
            aria-label="القائمة"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center h-8 sm:h-9 md:h-10 shrink-0">
          <Image
            src="/company-logo.png"
            alt="شركة الوادي لقطع غيار السيارات"
            width={160}
            height={32}
            style={{ width: "auto", height: "100%" }}
            className="h-full w-auto object-contain"
            priority
          />
        </div>
      </div>

      {/* Center: Date Badge */}
      {mounted && (
        <div className="hidden md:flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-medium shadow-sm">
          <span className="text-slate-600 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#C69214]" />
            {new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
      )}

      {/* Left: User info + Logout */}
      <div className="flex items-center gap-2">
        {/* User chip */}
        <div
          className="
            hidden sm:flex items-center gap-2
            px-3 py-1.5 rounded-xl
            bg-slate-50 border border-slate-200
          "
        >
          <div
            className="
              w-7 h-7 rounded-lg flex items-center justify-center
              bg-[#0B2545] text-white shrink-0 shadow-sm
            "
          >
            <User className="w-3.5 h-3.5" />
          </div>
          <div className="text-right leading-tight">
            {userName && (
              <p className="text-xs font-semibold text-slate-800 max-w-[140px] truncate">
                {userName}
              </p>
            )}
            <p className="text-[11px] text-slate-500">{translateRole(userType)}</p>
          </div>
        </div>

        {/* Logout button */}
        <button
          onClick={onLogout}
          className="
            flex items-center justify-center
            w-9 h-9 rounded-lg
            text-slate-400 hover:bg-red-50 hover:text-red-500
            border border-transparent hover:border-red-100
            transition-all duration-150
          "
          title="تسجيل الخروج"
          aria-label="تسجيل الخروج"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
