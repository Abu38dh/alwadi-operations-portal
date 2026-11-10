"use client"

import { useActionState, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Eye, EyeOff, Lock, User } from "lucide-react"
import { authenticate } from "@/app/actions/login"

export default function LoginPage() {
  const [errorMessage, dispatch, isPending] = useActionState(authenticate, undefined)
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 via-slate-50/80 to-slate-100/70 p-4 relative overflow-hidden" dir="rtl">
      {/* Subtle top ambient glow matching company gold */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[220px] bg-gradient-to-b from-[#C69214]/8 to-transparent blur-3xl pointer-events-none" />

      <div className="w-full max-w-[420px] relative z-10">
        {/* Logo Section */}
        <div className="text-center mb-7">
          <div className="flex justify-center mb-3">
            <Image
              src="/company-logo.png"
              alt="شركة الوادي لقطع غيار السيارات"
              width={320}
              height={70}
              className="h-16 md:h-18 w-auto object-contain drop-shadow-sm"
              priority
            />
          </div>
          <h1 className="text-2xl font-extrabold text-[#0B2545] tracking-tight">نظام إدارة المعاملات</h1>
          <p className="text-slate-500 text-xs md:text-sm mt-1 font-medium">بوابة العمليات والمراسلات الإدارية الموحدة</p>
        </div>

        {/* Login Card */}
        <Card className="shadow-xl shadow-slate-200/70 border border-slate-200/70 rounded-2xl overflow-hidden bg-white/95 backdrop-blur-sm">
          {/* Subtle gold brand accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-[#0B2545] via-[#C69214] to-[#0B2545]" />

          <CardHeader className="text-center pt-7 pb-3 px-8">
            <CardTitle className="text-[#0B2545] text-2xl font-bold tracking-tight">تسجيل الدخول</CardTitle>
            <CardDescription className="text-slate-500 text-xs md:text-sm mt-1">قم بتسجيل الدخول لمتابعة عملك</CardDescription>
          </CardHeader>

          <CardContent className="pt-2 pb-8 px-8">
            <form action={dispatch} className="space-y-4">
              {/* Username Input */}
              <div className="space-y-1.5 text-right">
                <Label htmlFor="username" className="text-slate-700 font-semibold text-xs">
                  اسم المستخدم أو الرقم الوظيفي
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    placeholder="مثال: admin أو 101"
                    className="border-slate-200 h-11 pr-10 pl-3 text-right focus-visible:ring-2 focus-visible:ring-[#0B2545]/20 focus-visible:border-[#0B2545] bg-slate-50/60 hover:bg-slate-50 focus:bg-white rounded-xl text-sm transition-colors"
                    required
                    autoComplete="off"
                    dir="rtl"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5 text-right">
                <Label htmlFor="password" className="text-slate-700 font-semibold text-xs">
                  كلمة المرور
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="border-slate-200 h-11 pr-10 pl-10 text-left focus-visible:ring-2 focus-visible:ring-[#0B2545]/20 focus-visible:border-[#0B2545] bg-slate-50/60 hover:bg-slate-50 focus:bg-white rounded-xl text-sm transition-colors"
                    required
                    autoComplete="off"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-700 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {errorMessage && (
                <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-1 text-right py-2 px-3 rounded-xl border-red-200 bg-red-50 text-red-700" dir="rtl">
                  <AlertCircle className="h-4 w-4 ml-2 flex-shrink-0" />
                  <AlertDescription className="text-xs font-medium">{errorMessage}</AlertDescription>
                </Alert>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full h-11 bg-[#0B2545] hover:bg-[#133762] text-white font-bold text-sm rounded-xl transition-all duration-200 shadow-md shadow-[#0B2545]/15 hover:shadow-lg hover:shadow-[#0B2545]/20 active:scale-[0.99]"
                  disabled={isPending}
                >
                  {isPending ? "جاري الدخول..." : "دخول"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-slate-400">
          <p>© 2025 شركة الوادي لقطع غيار السيارات • جميع الحقوق محفوظة</p>
        </div>
      </div>
    </div>
  )
}

