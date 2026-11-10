"use server"

import { db } from "@/lib/db"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"

export async function importUsersFromCSV(usersData: any[], currentUserId: string) {
  try {
    // 1. Basic authorization check
    const currentUser = await db.users.findUnique({
      where: { university_id: currentUserId },
      include: { roles: true }
    })
    
    if (!currentUser || !['admin', 'manager', 'dean'].includes(currentUser.roles.role_name)) {
       return { success: false, error: "غير مصرح لك بإجراء هذه العملية" }
    }

    // 2. Fetch dependencies for mapping
    const departments = await db.departments.findMany()
    const defaultRole = await db.roles.findFirst({ 
      where: { role_name: { in: ['employee', 'student'] } } 
    })
    
    if (!defaultRole) {
      return { success: false, error: "دور الموظف غير موجود في النظام" }
    }

    const formattedUsers = []
    
    for (const row of usersData) {
      const universityId = (
        row['الرقم_الوظيفي'] || 
        row['كود_الموظف'] || 
        row['اسم_المستخدم'] || 
        row['university_id'] || 
        row['id']
      )?.toString()?.trim()

      const fullName = (
        row['اسم_الموظف'] || 
        row['اسم_المستخدم'] || 
        row['الاسم_الكامل'] || 
        row['الاسم'] || 
        row['full_name'] || 
        row['name']
      )?.trim()

      const passVal = (
        row['كلمة_المرور'] || 
        row['رقم_الهوية'] || 
        row['رقمها'] || 
        row['id_number'] || 
        row['password'] || 
        '123'
      )?.toString()?.trim()

      const phone = (row['جوال'] || row['الهاتف'] || row['phone'])?.toString()?.trim()
      const email = (row['بريد'] || row['بريد_الكتروني'] || row['email'])?.toString()?.trim()
      const deptNameStr = (row['القسم'] || row['اسم_القسم_ع'] || row['department'])?.trim()
      
      // Skip if required fields are missing
      if (!universityId || !fullName) {
        continue
      }
      
      // 3. Match Department
      let matchedDeptId = null
      if (deptNameStr) {
        const cleanDeptName = deptNameStr.replace(/^قسم\s+/i, '').trim()
        const foundDept = departments.find((d: any) => 
          d.dept_name.includes(cleanDeptName) || cleanDeptName.includes(d.dept_name)
        )
        if (foundDept) {
          matchedDeptId = foundDept.department_id
        }
      }
      
      // 4. Hash Password (defaults to 123 if not provided)
      const hashedPassword = await bcrypt.hash(passVal || '123', 10)
      
      formattedUsers.push({
        university_id: universityId,
        full_name: fullName,
        password_hash: hashedPassword,
        phone: phone || null,
        email: email || null,
        role_id: defaultRole.role_id,
        department_id: matchedDeptId,
        level_id: null,
        is_active: true,
        user_status: 'active'
      })
    }
    
    if (formattedUsers.length === 0) {
      return { success: false, error: "لم يتم العثور على بيانات موظفين صالحة أو ينقصها أعمدة أساسية (الرقم الوظيفي، الاسم)" }
    }
    
    // 5. Batch Insert
    const result = await db.users.createMany({
      data: formattedUsers,
      skipDuplicates: true
    })
    
    revalidatePath('/admin/users')
    
    return { 
      success: true, 
      count: result.count,
      totalProcessed: formattedUsers.length 
    }
    
  } catch (error: any) {
    console.error("CSV Import Error:", error)
    return { success: false, error: error.message || "حدث خطأ داخلي أثناء استيراد البيانات" }
  }
}
