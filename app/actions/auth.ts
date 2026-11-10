"use server"

import { db } from "@/lib/db"
import * as bcrypt from "bcryptjs"

export type LoginResult = {
  success: boolean
  error?: string
  user?: {
    full_name: string
    role: "student" | "employee" | "admin"
    permissions: string[]
    university_id: string
    department_id?: number | null
  }
}

export async function loginUser(username: string, password: string): Promise<LoginResult> {
  if (!username || !password) {
    return { success: false, error: "يرجى إدخال البيانات المطلوبة" }
  }

  try {
    const user = await db.users.findUnique({
      where: { university_id: username },
      include: {
        roles: true,
      },
    })

    if (!user) {
      return { success: false, error: "بيانات الدخول غير صحيحة" }
    }

    if (!user.is_active) {
      return { success: false, error: "تم تعطيل حسابك. يرجى مراجعة المسؤول." }
    }

    const isValid = await bcrypt.compare(password, user.password_hash)

    if (!isValid) {
      return { success: false, error: "بيانات الدخول غير صحيحة" }
    }

    // Get permissions - prioritize custom_permissions over role permissions
    let permissions: string[] = []
    const customPerms = (user as { custom_permissions?: string }).custom_permissions
    if (customPerms) {
      try {
        permissions = JSON.parse(customPerms)
      } catch (e) {
        console.error("Error parsing custom_permissions:", e)
      }
    }

    // Fallback to role permissions if no custom permissions
    if (permissions.length === 0 && user.roles.permissions) {
      permissions = user.roles.permissions as string[]
    }

    return {
      success: true,
      user: {
        full_name: user.full_name,
        role: user.roles.role_name as "student" | "employee" | "admin",
        permissions: permissions,
        university_id: user.university_id,
        department_id: user.department_id,
      },
    }
  } catch (error) {
    console.error("Login Error:", error)
    return { success: false, error: "حدث خطأ في النظام" }
  }
}

