"use client"
// Force rebuild

import { useState, useEffect, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit2, Trash2, Search, UserCheck, UserX, ArrowRight, ChevronDown, ChevronUp, Save, X, Shield, CheckCircle, XCircle, FileText, Building2, BarChart3, Workflow, BookOpen, CalendarDays, CalendarCheck, UploadCloud } from "lucide-react"
import { TableSkeleton } from "@/components/ui/loading-skeleton"
import { ErrorMessage } from "@/components/ui/error-message"
import { getUsers, createUser, updateUser, deleteUser, getAllRoles } from "@/app/actions/admin"
import { importUsersFromCSV } from "@/app/actions/admin-import"
import Papa from "papaparse"
import { getAllColleges } from "@/app/actions/organizations"
import { useToast } from "@/hooks/use-toast"
import { translateRole } from "@/lib/translations"
import { ArrowRightLeft } from "lucide-react"
import { AdminDelegationsDialog } from "./admin-delegations-dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"

interface AdminUserPageProps {
  onBack?: () => void
  currentUserId?: string
  canManageUsers?: boolean
  canDelegate?: boolean
}

export default function AdminUsersPage({
  onBack,
  currentUserId,
  canManageUsers = true,
  canDelegate = true,
}: AdminUserPageProps) {
  const { toast } = useToast()
  const [users, setUsers] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [colleges, setColleges] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [levels, setLevels] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserScope, setCurrentUserScope] = useState<any>({})
  const [selectedCollegeId, setSelectedCollegeId] = useState("")
  const [isCollegeDisabled, setIsCollegeDisabled] = useState(false)
  const [selectedDeptId, setSelectedDeptId] = useState("")
  const [isDeptDisabled, setIsDeptDisabled] = useState(false)
  const [showGraduated, setShowGraduated] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUserName, setNewUserName] = useState("")
  const [newUserEmail, setNewUserEmail] = useState("")
  const [newUserUniversityId, setNewUserUniversityId] = useState("")
  const [newUserPhone, setNewUserPhone] = useState("")
  const [newUserPassword, setNewUserPassword] = useState("")
  const [newUserRoleId, setNewUserRoleId] = useState<number>(3)
  const [newUserDeptId, setNewUserDeptId] = useState("")
  const [newUserCollegeId, setNewUserCollegeId] = useState("")
  const [newUserLevelId, setNewUserLevelId] = useState("")
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null)
  const [expandedUserData, setExpandedUserData] = useState<any>({})
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<number | null>(null)
  const [delegationsUser, setDelegationsUser] = useState<any>(null)
  const [delegationsDialogOpen, setDelegationsDialogOpen] = useState(false)
  const [activeDelegations, setActiveDelegations] = useState<any[]>([])
  const [userRequestsDialog, setUserRequestsDialog] = useState<any>({
    open: false, loading: false, user: null, data: [],
    requesterBio: null, selectedRequestType: null, textSearch: ""
  })
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [staticDataLoaded, setStaticDataLoaded] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const observerTarget = useRef(null)

  useEffect(() => {
    const loadStaticData = async () => {
      try {
        const [rolesResult, orgResult, deptsResult] = await Promise.all([
          getAllRoles(),
          import("@/app/actions/organizations").then(m => m.getOrganizationStructure()),
          import("@/app/actions/organizations").then(m => m.getAllDepartments())
        ])
        if (rolesResult.success) setRoles(rolesResult.data as any[])
        if (orgResult.success) setColleges(orgResult.data || [])
        if (deptsResult.success && deptsResult.data) {
          setDepartments(deptsResult.data)
          const orgDepts = (orgResult.success ? orgResult.data || [] : []).flatMap((c: any) =>
            (c.departments || []).map((d: any) => ({ ...d, college_id: c.college_id }))
          )
          const allLevels = orgDepts.flatMap((d: any) =>
            (d.levels || []).map((l: any) => ({ ...l, department_id: d.department_id, dept_name: d.dept_name }))
          )
          setLevels(allLevels)
        }
        setStaticDataLoaded(true)
      } catch (e) {
        console.error("Failed to load static data", e)
      }
    }
    loadStaticData()
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [currentUserId])

  const fetchUsers = async () => {
    setError(null)
    setLoading(true)

    try {
      // Determine scope if needed (only on first load or if currentUserId changes)
      if (currentUserId && !currentUserScope.role) {
        try {
          const { getCurrentUserScope } = await import("@/app/actions/admin")
          const scopeResult = await getCurrentUserScope(currentUserId)

          if (scopeResult.success && scopeResult.data) {
            setCurrentUserScope(scopeResult.data)
            const { role, collegeId, departmentId } = scopeResult.data

            if (role === 'dean' && collegeId) {
              if (!selectedCollegeId) setSelectedCollegeId(collegeId.toString())
              setIsCollegeDisabled(true)
            }
            else if ((role === 'head' || role === 'manager' || role === 'head_of_department') && departmentId && collegeId) {
              if (!selectedCollegeId) setSelectedCollegeId(collegeId.toString())
              setIsCollegeDisabled(true)
              if (!selectedDeptId) setSelectedDeptId(departmentId.toString())
              setIsDeptDisabled(true)
            }
          }
        } catch (e) {
          console.error("Error fetching scope:", e)
        }
      }

      // Fetch ALL users once — filtering is done client-side
      const [usersResult, activeDelResult] = await Promise.all([
        getUsers(1, 1000, currentUserId, "", "", ""),
        import("@/app/actions/admin").then(m => m.getAllActiveDelegations()),
      ])

      if (activeDelResult?.success && activeDelResult.data) {
        setActiveDelegations(activeDelResult.data)
      }

      if (usersResult.success && usersResult.data) {
        if (page === 1) {
          setUsers(usersResult.data)
        } else {
          setUsers(prev => [...prev, ...usersResult.data])
        }

        if (usersResult.pagination) {
          setTotalPages(usersResult.pagination.totalPages)
        }
      } else {
        setError(usersResult.error || "فشل في تحميل المستخدمين")
      }

    } catch (err) {
      console.error("Failed to fetch users:", err)
      setError("فشل في تحميل البيانات")
    } finally {
      setLoading(false)
    }
  }

  const filteredDepartments = selectedCollegeId
    ? departments.filter((d: any) => d.college_id === parseInt(selectedCollegeId))
    : departments

  const availableColleges = isCollegeDisabled 
    ? colleges.filter((c: any) => c.college_id.toString() === selectedCollegeId)
    : colleges

  const availableDepartments = isDeptDisabled
    ? filteredDepartments.filter((d: any) => d.department_id.toString() === selectedDeptId)
    : filteredDepartments

  // ── Client-side filtering (instant, no loading) ──────────────────────
  const filteredUsers = useMemo(() => {
    let result = users

    // Filter by department
    if (selectedDeptId && selectedDeptId !== "__all__") {
      result = result.filter((u: any) => u.department_id?.toString() === selectedDeptId)
    }

    // Search by name, university_id, or email
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase()
      result = (result || []).filter((u: any) =>
        (u?.full_name || "").toLowerCase().includes(term) ||
        (u?.university_id || "").toLowerCase().includes(term) ||
        (u?.email || "").toLowerCase().includes(term)
      )
    }

    return result
  }, [users, selectedDeptId, searchTerm])

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          if (results.errors && results.errors.length > 0) {
            console.error("CSV Parse Errors:", results.errors)
            toast({ title: " خطأ في قراءة الملف", description: "تأكد من تنسيق الملف", variant: "destructive" })
            setIsImporting(false)
            return
          }
          
          if (!currentUserId) {
            toast({ title: " خطأ", description: "الرقم التعريفي غير متوفر", variant: "destructive" })
            setIsImporting(false)
            return
          }
          
          const importResult = await importUsersFromCSV(results.data, currentUserId)
          
          if (importResult.success) {
            toast({ 
              title: " تم الاستيراد بنجاح", 
              description: `تم استيراد ${importResult.count} موظف من أصل ${importResult.totalProcessed} صف.` 
            })
            setPage(1)
            fetchUsers()
          } else {
            toast({ title: " فشل الاستيراد", description: importResult.error, variant: "destructive" })
          }
        } catch (error) {
          toast({ title: " خطأ", description: "حدث خطأ غير متوقع", variant: "destructive" })
        } finally {
          setIsImporting(false)
          if (fileInputRef.current) {
            fileInputRef.current.value = ""
          }
        }
      },
      error: (error: any) => {
        toast({ title: " خطأ في قراءة الملف", description: error.message, variant: "destructive" })
        setIsImporting(false)
      }
    })
  }

  const addNewUser = async () => {
    if (!newUserName || !newUserUniversityId || !newUserRoleId) {
      toast({ title: " خطأ", description: "يرجى ملء جميع الحقول المطلوبة", variant: "destructive" })
      return
    }

    const selectedRoleName = roles.find(r => r.role_id === newUserRoleId)?.role_name?.toLowerCase();
    const isStudent = selectedRoleName === 'student';

    if (isStudent && !newUserDeptId && !currentUserScope.departmentId) {
      toast({ title: " خطأ", description: "يرجى اختيار القسم للموظف", variant: "destructive" })
      return
    }

    try {
      // تحديد القسم بناءً على نوع المستخدم
      // تحديد القسم
      let departmentId = undefined

      if (currentUserScope.departmentId) {
        departmentId = currentUserScope.departmentId
      } else if (newUserDeptId) {
        departmentId = parseInt(newUserDeptId)
      }

      const newUser = {
        university_id: newUserUniversityId,
        full_name: newUserName,
        email: newUserEmail || null,
        password: newUserPassword,
        phone: newUserPhone,
        role_id: newUserRoleId,
        department_id: departmentId,
        level_id: newUserLevelId ? parseInt(newUserLevelId) : undefined
      }
      const result = await createUser(newUser, currentUserId)

      if (result.success) {
        toast({ title: " تم إضافة المستخدم بنجاح" })
        setNewUserName("")
        setNewUserEmail("")
        setNewUserUniversityId("")
        setNewUserPhone("")
        setNewUserPassword("")
        setNewUserRoleId(3)
        setNewUserDeptId("")
        setNewUserCollegeId("") // إعادة تعيين الفرع
        setNewUserLevelId("") // إعادة تعيين المستوى
        setShowAddUser(false)

        // PERSISTENCE: Prepend new user instead of full reload
        // We might not have the full user object with joined tables perfectly, calls for a reload mostly
        // BUT to keep scroll, we could just reload page 1 or insert a mock.
        // For "Add", it's usually acceptable to reload or just prepend.
        // Let's reset to Page 1 to show the new user at top.
        setPage(1)
        fetchUsers()
      } else {
        toast({ title: " فشل الإضافة", description: result.error, variant: "destructive" })
      }
    } catch (err) {
      toast({ title: " خطأ", description: "حدث خطأ غير متوقع", variant: "destructive" })
    }
  }

  const handleDeleteUser = (userId: number) => {
    setItemToDelete(userId)
    setDeleteDialogOpen(true)
  }

  const executeDelete = async () => {
    if (!itemToDelete) return

    try {
      const result = await deleteUser(itemToDelete, currentUserId)

      if (result.success) {
        toast({ title: " تم تعطيل الحساب بنجاح", description: "لم يتم حذف المستخدم نهائياً للحفاظ على السجلات" })

        // PERSISTENCE: Update local state to reflect deactivation instead of removing
        setUsers(prev => prev.map(u => 
          u.user_id === itemToDelete ? { ...u, is_active: false } : u
        ))

        if (expandedUserId === itemToDelete) {
          setExpandedUserId(null)
        }
        setDeleteDialogOpen(false)
        setItemToDelete(null)
      } else {
        toast({ title: " فشل الحذف", description: result.error, variant: "destructive" })
      }
    } catch (err) {
      toast({ title: " خطأ", description: "حدث خطأ غير متوقع", variant: "destructive" })
    }
  }

  const saveExpandedEdit = async () => {
    if (!expandedUserId || !expandedUserData) return

    const selectedRole = roles.find(r => r.role_id === expandedUserData.role_id);
    const isStudent = selectedRole?.role_name?.toLowerCase() === 'student';
    if (isStudent && !expandedUserData.department_id) {
      toast({ title: " خطأ", description: "يرجى اختيار القسم للموظف", variant: "destructive" })
      return
    }

    try {
      const isExpandedAdmin = selectedRole?.role_name?.toLowerCase() === 'admin';
      const cleanPerms = isExpandedAdmin
        ? (expandedUserData.permissions || [])
        : (expandedUserData.permissions || []).filter((p: string) => p !== 'all');

      const result = await updateUser(expandedUserId, {
        full_name: expandedUserData.full_name,
        email: expandedUserData.email,
        phone: expandedUserData.phone,
        role_id: expandedUserData.role_id,
        department_id: expandedUserData.department_id,
        level_id: expandedUserData.level_id ?? null,
        is_active: expandedUserData.is_active,
        permissions: cleanPerms,
        password: expandedUserData.password
      }, currentUserId)

      if (result.success) {
        toast({ title: " تم التحديث بنجاح" })

        // PERSISTENCE: Update local state without fetching
        setUsers(prev => prev.map(u =>
          u.user_id === expandedUserId
            ? { ...u, ...expandedUserData, roles: roles.find(r => r.role_id === expandedUserData.role_id), departments_users_department_idTodepartments: departments.find(d => d.department_id == expandedUserData.department_id) }
            : u
        ))

        setExpandedUserId(null)
        setExpandedUserData({})
      } else {
        toast({ title: " فشل التحديث", description: result.error, variant: "destructive" })
      }
    } catch (err) {
      toast({ title: " خطأ", description: "حدث خطأ غير متوقع", variant: "destructive" })
    }
  }

  const handleToggleUserStatus = async (userId: number, currentStatus: boolean, e: any) => {
    e.stopPropagation();
    try {
      const result = await updateUser(userId, { is_active: !currentStatus }, currentUserId)
      if (result.success) {
        toast({ title: currentStatus ? " تم تعطيل المستخدم" : " تم تفعيل المستخدم" })

        // PERSISTENCE: Update local state
        setUsers(prev => prev.map(u =>
          u.user_id === userId ? { ...u, is_active: !currentStatus } : u
        ))

      } else {
        toast({ title: " فشل التحديث", description: result.error, variant: "destructive" })
      }
    } catch (err) {
      toast({ title: " خطأ", description: "حدث خطأ غير متوقع", variant: "destructive" })
    }
  }

  const handleViewUserRequests = async (user: any) => {
    setUserRequestsDialog({ open: true, loading: true, user, data: [], requesterBio: null, selectedRequestType: null, textSearch: "" });
    try {
      const { adminGetUserRequests } = await import("@/app/actions/admin");
      const result = await adminGetUserRequests(currentUserId || "", user.user_id);
      if (result.success && result.interactions) {
         setUserRequestsDialog((prev: any) => ({ ...prev, loading: false, data: result.interactions, requesterBio: result.requesterBio }));
      } else {
         toast({ title: "خطأ", description: result.error || "فشل تحميل الطلبات", variant: "destructive" });
         setUserRequestsDialog((prev: any) => ({ ...prev, loading: false }));
      }
    } catch (e) {
      console.error("Failed to load user requests", e);
      setUserRequestsDialog((prev: any) => ({ ...prev, loading: false }));
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 p-6" dir="rtl">
        <h1 className="text-3xl font-bold">إدارة المستخدمين</h1>
        <TableSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6 p-6" dir="rtl">
        <h1 className="text-3xl font-bold">إدارة المستخدمين</h1>
        <ErrorMessage error={error} onRetry={fetchUsers} />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            {canManageUsers ? "إدارة المستخدمين" : "الموظفين وتفويض الصلاحيات"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {canManageUsers
              ? (filteredUsers.length !== users.length
                ? `عرض ${filteredUsers.length} من ${users.length} مستخدم`
                : `${users.length} مستخدمين في النظام`)
              : "قائمة الموظفين للاطلاع وتفويض الصلاحيات والمهام عند الغياب والإجازات"
            }
          </p>
        </div>
        {canManageUsers && (
          <div className="flex gap-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              hidden 
              accept=".csv" 
              onChange={handleFileUpload} 
            />
            <Button 
              onClick={() => fileInputRef.current?.click()} 
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
              disabled={isImporting}
            >
              <UploadCloud className="w-4 h-4" />
              {isImporting ? "جاري الاستيراد..." : "استيراد موظفين (CSV)"}
            </Button>
            <Button onClick={() => setShowAddUser(true)} className="bg-primary hover:bg-primary/90 gap-2">
              <Plus className="w-4 h-4" />
              مستخدم جديد
            </Button>
          </div>
        )}
      </div>

      {/* Active Delegations Hub for Executive/Manager */}
      {activeDelegations.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <h3 className="font-bold text-sm sm:text-base text-slate-800">
                الموظفون المفوضون حالياً ({activeDelegations.length})
              </h3>
            </div>
            <span className="text-xs text-slate-500">ينوب عنهم زملاؤهم في مراجعة واعتماد المعاملات</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {activeDelegations.map((del: any) => (
              <div key={del.delegation_id} className="bg-white p-3 rounded-xl border border-amber-200/70 shadow-xs flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800 truncate">
                    <span className="text-rose-600">المجاز:</span> {del.users_delegations_grantor_user_idTousers?.full_name}
                  </div>
                  <div className="text-xs font-bold text-slate-800 truncate mt-0.5">
                    <span className="text-emerald-600">البديل:</span> {del.users_delegations_grantee_user_idTousers?.full_name}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    ينتهي في: {new Date(del.ends_at).toLocaleDateString('ar-SA')}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const { adminRevokeDelegation } = await import("@/app/actions/admin")
                    const res = await adminRevokeDelegation(del.delegation_id, currentUserId || "")
                    if (res.success) {
                      toast({ title: "تم إلغاء التفويض وعودة المهام للموظف الأصلي" })
                      fetchUsers()
                    }
                  }}
                  className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50 h-8 px-2.5 shrink-0"
                >
                  إلغاء التفويض
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              value={selectedDeptId === "" ? "__all__" : selectedDeptId}
              onValueChange={(val) => setSelectedDeptId(val === "__all__" ? "" : val)}
              disabled={isDeptDisabled}
              dir="rtl"
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="جميع الأقسام" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {!isDeptDisabled && <SelectItem value="__all__">جميع الأقسام</SelectItem>}
                {availableDepartments.map((dept: any) => (
                  <SelectItem key={`dept-${dept.department_id}`} value={dept.department_id.toString()}>{dept.dept_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3 top-3 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم أو الرقم الوظيفي..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add User Form */}
      {showAddUser && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle>إضافة مستخدم جديد</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block" required>الاسم الكامل</Label>
                <Input className="bg-transparent" placeholder="أدخل الاسم الكامل" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block" required>الرقم الوظيفي / اسم المستخدم</Label>
                <Input className="bg-transparent" placeholder="أدخل الرقم الوظيفي أو اسم المستخدم" value={newUserUniversityId} onChange={(e) => setNewUserUniversityId(e.target.value)} />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">البريد الإلكتروني</Label>
                <Input className="bg-transparent" type="email" placeholder="أدخل البريد الإلكتروني (اختياري)" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">رقم الجوال</Label>
                <Input className="bg-transparent text-right" dir="ltr" placeholder="أدخل رقم الجوال (اختياري)" value={newUserPhone} onChange={(e) => setNewUserPhone(e.target.value)} />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block" required>كلمة المرور</Label>
                <Input
                  className="bg-transparent"
                  type="password"
                  placeholder="أدخل كلمة المرور"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block" required>نوع المستخدم (الدور)</Label>
                <Select
                  value={newUserRoleId?.toString() ?? ""}
                  onValueChange={(val) => setNewUserRoleId(parseInt(val))}
                  dir="rtl"
                >
                  <SelectTrigger className="w-full bg-transparent">
                    <SelectValue placeholder="اختر الدور" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {roles
                      .filter(role => {
                        if (!role || !role.role_name) return false;
                        if (!currentUserScope.role || currentUserScope.role === 'admin') return true;
                        const rName = (role.role_name || "").toLowerCase();
                        if (currentUserScope.role === 'dean') return ['head', 'manager', 'head_of_department', 'employee', 'student'].includes(rName);
                        if (['head', 'manager', 'head_of_department'].includes(currentUserScope.role)) return rName === 'student';
                        return false;
                      })
                      .map((role: any) => (
                        <SelectItem key={role.role_id} value={role.role_id.toString()}>{translateRole(role.role_name)}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">القسم / الإدارة</Label>
                <Select
                  value={newUserDeptId === "" ? "__none__" : newUserDeptId}
                  onValueChange={(val) => setNewUserDeptId(val === "__none__" ? "" : val)}
                  dir="rtl"
                >
                  <SelectTrigger className="w-full bg-transparent">
                    <SelectValue placeholder="اختر القسم (اختياري)" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="__none__">بدون قسم (اختياري)</SelectItem>
                    {departments.map((dept: any) => (
                      <SelectItem key={dept.department_id} value={dept.department_id.toString()}>{dept.dept_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAddUser(false)}>إلغاء</Button>
              <Button onClick={addNewUser}>إضافة</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>قائمة المستخدمين</CardTitle>
          <CardDescription>{filteredUsers.length} من {users.length} مستخدمين</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredUsers.map((user: any) => {
              const activeDel = activeDelegations.find((d: any) => d.grantor_user_id === user.user_id);

              if (!canManageUsers) {
                return (
                  <div
                    key={user.user_id}
                    className="p-3.5 sm:p-4 border border-slate-200 rounded-xl bg-white hover:border-[#C69214]/60 hover:shadow-xs transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#0B2545]/5 text-[#0B2545] font-bold flex items-center justify-center shrink-0 border border-[#0B2545]/10 text-sm">
                        {user.full_name ? user.full_name.charAt(0) : "م"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-sm sm:text-base text-slate-800 truncate">{user.full_name}</p>
                          {activeDel && (
                            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold py-0.5">
                              🟢 ينوب عنه: {activeDel.users_delegations_grantee_user_idTousers?.full_name}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          <span className="font-medium text-slate-700">{translateRole(user.roles?.role_name)}</span> • {user.departments_users_department_idTodepartments?.dept_name || "بدون قسم"} • الرقم الوظيفي: {user.university_id}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <Button
                        onClick={() => {
                          setDelegationsUser(user)
                          setDelegationsDialogOpen(true)
                        }}
                        className="bg-[#C69214] hover:bg-[#B58210] text-white font-bold text-xs sm:text-sm h-10 px-4 gap-2 rounded-xl shadow-xs w-full sm:w-auto"
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                        <span>تفويض بديل</span>
                      </Button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={user.user_id}>
                  <div className="p-4 border rounded-lg hover:bg-slate-50 flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (expandedUserId === user.user_id) {
                        setExpandedUserId(null)
                      } else {
                        setExpandedUserId(user.user_id)
                        const allAdminPerms = ['review_requests', 'manage_forms', 'manage_users', 'manage_departments', 'view_reports', 'manage_workflows', 'grant_delegations', 'audit_access', 'can_manage_absences', 'manage_terms', 'manage_levels']
                        const isAdmin = roles.find((r: any) => r.role_id === user.role_id)?.role_name?.toLowerCase() === 'admin'
                        const storedPerms = (user.permissions || []).filter((p: string) => p !== 'all')
                        // Default to all if empty/corrupted (< 5) for admin role.
                        const isFullAccess = isAdmin && (storedPerms.length === 0 || storedPerms.length < 5)
                        const initializedUser = isAdmin
                          ? { ...user, permissions: isFullAccess ? allAdminPerms : storedPerms }
                          : { ...user, permissions: storedPerms }
                        setExpandedUserData(initializedUser)

                      }
                    }}
                    className="text-primary p-1 rounded"
                  >
                    {expandedUserId === user.user_id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>

                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{user.full_name}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">{user.university_id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">الدور</p>
                      <p className="font-medium">{translateRole(user.roles?.role_name)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">القسم</p>
                      <p className="font-medium">{user.departments_users_department_idTodepartments?.dept_name || "-"}</p>
                    </div>
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        {canManageUsers && (
                          <div className="flex items-center gap-2 ml-2">
                            <span className={`text-xs ${user.is_active ? "text-primary" : "text-muted-foreground"}`}>
                              {user.is_active ? "نشط" : "معطّل"}
                            </span>
                            <Switch
                              checked={user.is_active}
                              onCheckedChange={(checked) => {
                                handleToggleUserStatus(user.user_id, user.is_active, { stopPropagation: () => { } } as any)
                              }}
                              dir="ltr"
                            />
                          </div>
                        )}
                        <Button variant="ghost" size="icon" title="سجل الطلبات" onClick={(e) => {
                            e.stopPropagation();
                            handleViewUserRequests(user);
                          }} className="text-muted-foreground hover:text-primary">
                          <FileText className="w-4 h-4" />
                        </Button>
                        {user.roles?.role_name?.toLowerCase() !== 'student' && canDelegate && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="تفويض موظف بديل عند الغياب"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDelegationsUser(user);
                              setDelegationsDialogOpen(true);
                            }}
                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                          </Button>
                        )}
                        {canManageUsers && (
                          <Button variant="ghost" size="icon" title="حذف" onClick={(e) => { e.stopPropagation(); handleDeleteUser(user.user_id); }} className="text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                  </div>
                </div>

                {expandedUserId === user.user_id && (
                  <div className="p-6 bg-primary/5 border rounded-b-lg space-y-4">
                    <h3 className="font-semibold">تعديل بيانات المستخدم</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">الاسم الكامل</Label>
                        <Input
                          value={expandedUserData.full_name || ""}
                          onChange={(e) => setExpandedUserData({ ...expandedUserData, full_name: e.target.value })}
                          className="mt-1 bg-transparent"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium">البريد الإلكتروني</Label>
                        <Input
                          type="email"
                          value={expandedUserData.email || ""}
                          onChange={(e) => setExpandedUserData({ ...expandedUserData, email: e.target.value })}
                          className="mt-1 bg-transparent"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium">رقم الجوال</Label>
                        <Input
                          type="tel"
                          value={expandedUserData.phone || ""}
                          onChange={(e) => setExpandedUserData({ ...expandedUserData, phone: e.target.value })}
                          className="mt-1 bg-transparent text-right"
                          dir="ltr"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium">الدور</Label>
                        <Select
                          value={expandedUserData.role_id?.toString() ?? ""}
                          onValueChange={(val) => setExpandedUserData({ ...expandedUserData, role_id: parseInt(val) })}
                          dir="rtl"
                        >
                          <SelectTrigger className="w-full mt-1 bg-transparent">
                            <SelectValue placeholder="اختر الدور" />
                          </SelectTrigger>
                          <SelectContent dir="rtl">
                            {roles.map((role: any) => (
                              <SelectItem key={role.role_id} value={role.role_id.toString()}>{translateRole(role.role_name)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">القسم</Label>
                        <Select
                          value={expandedUserData.department_id != null ? expandedUserData.department_id.toString() : "__none__"}
                          onValueChange={(val) => setExpandedUserData({ ...expandedUserData, department_id: val === "__none__" ? null : parseInt(val) })}
                          dir="rtl"
                        >
                          <SelectTrigger className="w-full mt-1 bg-transparent">
                            <SelectValue placeholder="بدون قسم" />
                          </SelectTrigger>
                          <SelectContent dir="rtl">
                            <SelectItem value="__none__">بدون قسم</SelectItem>
                            {departments.map((dept: any) => (
                              <SelectItem key={dept.department_id} value={dept.department_id.toString()}>{dept.dept_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>



                      <div>
                        <Label className="text-sm font-medium">تغيير كلمة المرور</Label>
                        <Input
                          type="password"
                          placeholder="اتركه فارغاً للإبقاء على الحالية"
                          className="mt-1 bg-transparent"
                          onChange={(e) => setExpandedUserData({ ...expandedUserData, password: e.target.value })}
                        />
                      </div>

                      {/* Permissions Section - For all except students */}
                      {(() => {
                        const expandedUserRole = roles.find(r => r.role_id === expandedUserData.role_id)?.role_name?.toLowerCase();
                        const isExpandedUserAdmin = expandedUserRole === 'admin';
                        const allAdminPerms = ['review_requests', 'manage_forms', 'manage_users', 'manage_departments', 'view_reports', 'manage_workflows', 'grant_delegations', 'audit_access', 'can_manage_absences', 'manage_terms', 'manage_levels'];
                        // Use the current expandedUserData.permissions (already initialized correctly on expand)
                        const activePermissions = expandedUserData.permissions || [];

                        
                        if (expandedUserRole === 'student') return null;
                        
                        return (
                          <div className="space-y-3 border-t pt-4 col-span-full">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <Shield className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <Label className="text-base font-semibold">صلاحيات النظام</Label>
                              <p className="text-xs text-muted-foreground">حدد الصلاحيات التي تريد منحها لهذا الموظف</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Review Requests */}
                            <div
                              onClick={() => {
                                const perms = (isExpandedUserAdmin && (!expandedUserData.permissions || expandedUserData.permissions.length === 0)) ? allAdminPerms : (expandedUserData.permissions || [])
                                const hasPermission = perms.includes('review_requests')
                                const newPerms = hasPermission
                                  ? perms.filter((p: string) => p !== 'review_requests')
                                  : [...perms, 'review_requests']
                                setExpandedUserData({ ...expandedUserData, permissions: newPerms })
                              }}
                              className={`p-4 border-2 rounded-lg transition-all duration-200 cursor-pointer ${activePermissions.includes('review_requests')
                                ? 'border-secondary bg-secondary/10 shadow-sm'
                                : 'border-gray-200 hover:border-secondary/30 hover:bg-gray-50'
                                }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-lg ${activePermissions.includes('review_requests')
                                  ? 'bg-secondary text-white'
                                  : 'bg-gray-100 text-gray-600'
                                  }`}>
                                  <CheckCircle className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-sm">مراجعة الطلبات</p>
                                  <p className="text-xs text-muted-foreground mt-1">الموافقة، الرفض، تعديل طلبات الموظفين</p>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={activePermissions.includes('review_requests') || false}
                                  onChange={() => { }}
                                  className="w-5 h-5 rounded border-gray-300 text-secondary focus:ring-secondary"
                                />
                              </div>
                            </div>

                            {/* Manage Forms */}
                            <div
                              onClick={() => {
                                const perms = (isExpandedUserAdmin && (!expandedUserData.permissions || expandedUserData.permissions.length === 0)) ? allAdminPerms : (expandedUserData.permissions || [])
                                const hasPermission = perms.includes('manage_forms')
                                const newPerms = hasPermission
                                  ? perms.filter((p: string) => p !== 'manage_forms')
                                  : [...perms, 'manage_forms']
                                setExpandedUserData({ ...expandedUserData, permissions: newPerms })
                              }}
                              className={`p-4 border-2 rounded-lg transition-all duration-200 cursor-pointer ${activePermissions.includes('manage_forms')
                                ? 'border-secondary bg-secondary/10 shadow-sm'
                                : 'border-gray-200 hover:border-secondary/30 hover:bg-gray-50'
                                }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-lg ${activePermissions.includes('manage_forms')
                                  ? 'bg-secondary text-white'
                                  : 'bg-gray-100 text-gray-600'
                                  }`}>
                                  <FileText className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-sm">إدارة النماذج</p>
                                  <p className="text-xs text-muted-foreground mt-1">إنشاء وتعديل ونشر نماذج الطلبات</p>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={activePermissions.includes('manage_forms') || false}
                                  onChange={() => { }}
                                  className="w-5 h-5 rounded border-gray-300 text-secondary focus:ring-secondary"
                                />
                              </div>
                            </div>

                            {/* Manage Users */}
                            <div
                              onClick={() => {
                                const perms = (isExpandedUserAdmin && (!expandedUserData.permissions || expandedUserData.permissions.length === 0)) ? allAdminPerms : (expandedUserData.permissions || [])
                                const hasPermission = perms.includes('manage_users')
                                const newPerms = hasPermission
                                  ? perms.filter((p: string) => p !== 'manage_users')
                                  : [...perms, 'manage_users']
                                setExpandedUserData({ ...expandedUserData, permissions: newPerms })
                              }}
                              className={`p-4 border-2 rounded-lg transition-all duration-200 cursor-pointer ${activePermissions.includes('manage_users')
                                ? 'border-secondary bg-secondary/10 shadow-sm'
                                : 'border-gray-200 hover:border-secondary/30 hover:bg-gray-50'
                                }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-lg ${activePermissions.includes('manage_users')
                                  ? 'bg-secondary text-white'
                                  : 'bg-gray-100 text-gray-600'
                                  }`}>
                                  <UserCheck className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-sm">إدارة المستخدمين</p>
                                  <p className="text-xs text-muted-foreground mt-1">إضافة، تعديل، حذف المستخدمين</p>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={activePermissions.includes('manage_users') || false}
                                  onChange={() => { }}
                                  className="w-5 h-5 rounded border-gray-300 text-secondary focus:ring-secondary"
                                />
                              </div>
                            </div>

                            {/* Manage Departments */}
                            <div
                              onClick={() => {
                                const perms = (isExpandedUserAdmin && (!expandedUserData.permissions || expandedUserData.permissions.length === 0)) ? allAdminPerms : (expandedUserData.permissions || [])
                                const hasPermission = perms.includes('manage_departments')
                                const newPerms = hasPermission
                                  ? perms.filter((p: string) => p !== 'manage_departments')
                                  : [...perms, 'manage_departments']
                                setExpandedUserData({ ...expandedUserData, permissions: newPerms })
                              }}
                              className={`p-4 border-2 rounded-lg transition-all duration-200 cursor-pointer ${activePermissions.includes('manage_departments')
                                ? 'border-secondary bg-secondary/10 shadow-sm'
                                : 'border-gray-200 hover:border-secondary/30 hover:bg-gray-50'
                                }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-lg ${activePermissions.includes('manage_departments')
                                  ? 'bg-secondary text-white'
                                  : 'bg-gray-100 text-gray-600'
                                  }`}>
                                  <Building2 className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-sm">إدارة الأقسام والإدارات</p>
                                  <p className="text-xs text-muted-foreground mt-1">إضافة وتعديل الأقسام والإدارات والفروع</p>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={activePermissions.includes('manage_departments') || false}
                                  onChange={() => { }}
                                  className="w-5 h-5 rounded border-gray-300 text-secondary focus:ring-secondary"
                                />
                              </div>
                            </div>

                            {/* View Reports */}
                            <div
                              onClick={() => {
                                const perms = (isExpandedUserAdmin && (!expandedUserData.permissions || expandedUserData.permissions.length === 0)) ? allAdminPerms : (expandedUserData.permissions || [])
                                const hasPermission = perms.includes('view_reports')
                                const newPerms = hasPermission
                                  ? perms.filter((p: string) => p !== 'view_reports')
                                  : [...perms, 'view_reports']
                                setExpandedUserData({ ...expandedUserData, permissions: newPerms })
                              }}
                              className={`p-4 border-2 rounded-lg transition-all duration-200 cursor-pointer ${activePermissions.includes('view_reports')
                                ? 'border-secondary bg-secondary/10 shadow-sm'
                                : 'border-gray-200 hover:border-secondary/30 hover:bg-gray-50'
                                }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-lg ${activePermissions.includes('view_reports')
                                  ? 'bg-secondary text-white'
                                  : 'bg-gray-100 text-gray-600'
                                  }`}>
                                  <BarChart3 className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-sm">عرض التقارير</p>
                                  <p className="text-xs text-muted-foreground mt-1">الوصول للتقارير والإحصائيات</p>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={activePermissions.includes('view_reports') || false}
                                  onChange={() => { }}
                                  className="w-5 h-5 rounded border-gray-300 text-secondary focus:ring-secondary"
                                />
                              </div>
                            </div>

                            {/* Manage Workflows */}
                            <div
                              onClick={() => {
                                const perms = (isExpandedUserAdmin && (!expandedUserData.permissions || expandedUserData.permissions.length === 0)) ? allAdminPerms : (expandedUserData.permissions || [])
                                const hasPermission = perms.includes('manage_workflows')
                                const newPerms = hasPermission
                                  ? perms.filter((p: string) => p !== 'manage_workflows')
                                  : [...perms, 'manage_workflows']
                                setExpandedUserData({ ...expandedUserData, permissions: newPerms })
                              }}
                              className={`p-4 border-2 rounded-lg transition-all duration-200 cursor-pointer ${activePermissions.includes('manage_workflows')
                                ? 'border-secondary bg-secondary/10 shadow-sm'
                                : 'border-gray-200 hover:border-secondary/30 hover:bg-gray-50'
                                }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-lg ${activePermissions.includes('manage_workflows')
                                  ? 'bg-secondary text-white'
                                  : 'bg-gray-100 text-gray-600'
                                  }`}>
                                  <Workflow className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-sm">إدارة مسارات العمل</p>
                                  <p className="text-xs text-muted-foreground mt-1">إنشاء وتعديل مسارات اعتماد الطلبات</p>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={activePermissions.includes('manage_workflows') || false}
                                  onChange={() => { }}
                                  className="w-5 h-5 rounded border-gray-300 text-secondary focus:ring-secondary"
                                />
                              </div>
                            </div>

                            {/* Grant Delegations */}
                            <div
                              onClick={() => {
                                const perms = (isExpandedUserAdmin && (!expandedUserData.permissions || expandedUserData.permissions.length === 0)) ? allAdminPerms : (expandedUserData.permissions || [])
                                const hasPermission = perms.includes('grant_delegations')
                                const newPerms = hasPermission
                                  ? perms.filter((p: string) => p !== 'grant_delegations')
                                  : [...perms, 'grant_delegations']
                                setExpandedUserData({ ...expandedUserData, permissions: newPerms })
                              }}
                              className={`p-4 border-2 rounded-lg transition-all duration-200 cursor-pointer ${activePermissions.includes('grant_delegations')
                                ? 'border-secondary bg-secondary/10 shadow-sm'
                                : 'border-gray-200 hover:border-secondary/30 hover:bg-gray-50'
                                }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-lg ${activePermissions.includes('grant_delegations')
                                  ? 'bg-secondary text-white'
                                  : 'bg-gray-100 text-gray-600'
                                  }`}>
                                  <ArrowRightLeft className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-sm">تفويض صلاحيات الموظفين (عند الغياب)</p>
                                  <p className="text-xs text-muted-foreground mt-1">الاطلاع على قائمة الموظفين وتفويض مهام وصلاحيات أي موظف غائب إلى زميل بديل</p>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={activePermissions.includes('grant_delegations') || false}
                                  onChange={() => { }}
                                  className="w-5 h-5 rounded border-gray-300 text-secondary focus:ring-secondary"
                                />
                              </div>
                            </div>

                            {/* Audit Access */}
                            <div
                              onClick={() => {
                                const perms = (isExpandedUserAdmin && (!expandedUserData.permissions || expandedUserData.permissions.length === 0)) ? allAdminPerms : (expandedUserData.permissions || [])
                                const hasPermission = perms.includes('audit_access')
                                const newPerms = hasPermission
                                  ? perms.filter((p: string) => p !== 'audit_access')
                                  : [...perms, 'audit_access']
                                setExpandedUserData({ ...expandedUserData, permissions: newPerms })
                              }}
                              className={`p-4 border-2 rounded-lg transition-all duration-200 cursor-pointer ${activePermissions.includes('audit_access')
                                ? 'border-secondary bg-secondary/10 shadow-sm'
                                : 'border-gray-200 hover:border-secondary/30 hover:bg-gray-50'
                                }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-lg ${activePermissions.includes('audit_access')
                                  ? 'bg-secondary text-white'
                                  : 'bg-gray-100 text-gray-600'
                                  }`}>
                                  <Search className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-sm">سجل التدقيق</p>
                                  <p className="text-xs text-muted-foreground mt-1">الوصول لسجل الأحداث والتدقيق</p>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={activePermissions.includes('audit_access') || false}
                                  onChange={() => { }}
                                  className="w-5 h-5 rounded border-gray-300 text-secondary focus:ring-secondary"
                                />
                              </div>
                            </div>

                            {/* Can Manage Absences */}
                            <div
                              onClick={() => {
                                const perms = (isExpandedUserAdmin && (!expandedUserData.permissions || expandedUserData.permissions.length === 0)) ? allAdminPerms : (expandedUserData.permissions || [])
                                const hasPerm = perms.includes('can_manage_absences')
                                const newPerms = hasPerm
                                  ? perms.filter((p: string) => p !== 'can_manage_absences')
                                  : [...perms, 'can_manage_absences']
                                setExpandedUserData({ ...expandedUserData, permissions: newPerms })
                              }}
                              className={`p-4 border-2 rounded-lg transition-all duration-200 cursor-pointer ${activePermissions.includes('can_manage_absences')
                                ? 'border-secondary bg-secondary/10 shadow-sm'
                                : 'border-gray-200 hover:border-secondary/30 hover:bg-gray-50'
                                }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-lg ${activePermissions.includes('can_manage_absences')
                                  ? 'bg-secondary text-white'
                                  : 'bg-gray-100 text-gray-600'
                                  }`}>
                                  <CalendarCheck className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-sm">إدارة الحضور والانصراف</p>
                                  <p className="text-xs text-muted-foreground mt-1">تسجيل وتعديل سجلات حضور وانصراف الموظفين</p>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={activePermissions.includes('can_manage_absences') || false}
                                  onChange={() => { }}
                                  className="w-5 h-5 rounded border-gray-300 text-secondary focus:ring-secondary"
                                />
                              </div>
                            </div>

                            {/* Manage Terms */}
                            <div
                              onClick={() => {
                                const perms = (isExpandedUserAdmin && (!expandedUserData.permissions || expandedUserData.permissions.length === 0)) ? allAdminPerms : (expandedUserData.permissions || [])
                                const hasPerm = perms.includes('manage_terms')
                                const newPerms = hasPerm
                                  ? perms.filter((p: string) => p !== 'manage_terms')
                                  : [...perms, 'manage_terms']
                                setExpandedUserData({ ...expandedUserData, permissions: newPerms })
                              }}
                              className={`p-4 border-2 rounded-lg transition-all duration-200 cursor-pointer ${activePermissions.includes('manage_terms')
                                ? 'border-secondary bg-secondary/10 shadow-sm'
                                : 'border-gray-200 hover:border-secondary/30 hover:bg-gray-50'
                                }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-lg ${activePermissions.includes('manage_terms')
                                  ? 'bg-secondary text-white'
                                  : 'bg-gray-100 text-gray-600'
                                  }`}>
                                  <CalendarDays className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-sm">إدارة الفترات التشغيلية</p>
                                  <p className="text-xs text-muted-foreground mt-1">إضافة وتعديل الفترات والدورات التشغيلية في النظام</p>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={activePermissions.includes('manage_terms') || false}
                                  onChange={() => { }}
                                  className="w-5 h-5 rounded border-gray-300 text-secondary focus:ring-secondary"
                                />
                              </div>
                            </div>

                            {/* Manage Levels & Subjects */}
                            <div
                              onClick={() => {
                                const perms = (isExpandedUserAdmin && (!expandedUserData.permissions || expandedUserData.permissions.length === 0)) ? allAdminPerms : (expandedUserData.permissions || [])
                                const hasPerm = perms.includes('manage_levels')
                                const newPerms = hasPerm
                                  ? perms.filter((p: string) => p !== 'manage_levels')
                                  : [...perms, 'manage_levels']
                                setExpandedUserData({ ...expandedUserData, permissions: newPerms })
                              }}
                              className={`p-4 border-2 rounded-lg transition-all duration-200 cursor-pointer ${activePermissions.includes('manage_levels')
                                ? 'border-secondary bg-secondary/10 shadow-sm'
                                : 'border-gray-200 hover:border-secondary/30 hover:bg-gray-50'
                                }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-lg ${activePermissions.includes('manage_levels')
                                  ? 'bg-secondary text-white'
                                  : 'bg-gray-100 text-gray-600'
                                  }`}>
                                  <BookOpen className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-sm">إدارة الدرجات والتصنيفات</p>
                                  <p className="text-xs text-muted-foreground mt-1">إضافة وتعديل الدرجات الوظيفية وتصنيفات المواد</p>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={activePermissions.includes('manage_levels') || false}
                                  onChange={() => { }}
                                  className="w-5 h-5 rounded border-gray-300 text-secondary focus:ring-secondary"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        );
                      })()}

                      {/* Permissions Section - For all except students */}
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setExpandedUserId(null)}>
                        <X className="w-4 h-4 mr-2" />
                        إلغاء
                      </Button>
                      <Button onClick={saveExpandedEdit}>
                        <Save className="w-4 h-4 mr-2" />
                        حفظ التعديلات
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          </div>

          {/* Delegations Dialog */}
      {delegationsDialogOpen && delegationsUser && currentUserId && (
        <AdminDelegationsDialog
          user={delegationsUser}
          currentUserId={currentUserId}
          isOpen={delegationsDialogOpen}
          onClose={() => setDelegationsDialogOpen(false)}
        />
      )}

      {/* User Requests Dialog */}
      <Dialog open={userRequestsDialog.open} onOpenChange={(open) => !open && setUserRequestsDialog((prev: any) => ({ ...prev, open: false }))}>
        <DialogContent dir="rtl" className="max-w-3xl w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تفاصيل المستخدم وسجل الطلبات</DialogTitle>
          </DialogHeader>

          {userRequestsDialog.user && (
            <div className="bg-muted/30 p-4 rounded-lg flex items-start gap-4 border mb-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                {userRequestsDialog.user.full_name.charAt(0)}
              </div>
              <div>
                <h4 className="font-bold text-foreground">{userRequestsDialog.user.full_name}</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>الرقم: {userRequestsDialog.user.university_id}</p>
                  <p>الدور: {translateRole(userRequestsDialog.user.roles?.role_name)}</p>
                  <p>القسم: {userRequestsDialog.user.departments_users_department_idTodepartments?.dept_name || "-"}</p>
                  <p>البريد الإلكتروني: {userRequestsDialog.user.email || "-"}</p>
                  <p>الهاتف: <span dir="ltr">{userRequestsDialog.user.phone || "-"}</span></p>
                </div>
              </div>
            </div>
          )}

          {!userRequestsDialog.loading && userRequestsDialog.data.length > 0 && (() => {
            const grouped = userRequestsDialog.data.reduce((acc: any, r: any) => {
              const type = r.requestType || "طلب عام"
              if (!acc[type]) acc[type] = { total: 0, approved: 0, rejected: 0, returned: 0, pending: 0 }
              acc[type].total++
              if (r.originalStatus === 'approved') acc[type].approved++
              else if (r.originalStatus === 'rejected') acc[type].rejected++
              else if (r.originalStatus === 'returned') acc[type].returned++
              else acc[type].pending++
              return acc
            }, {})
            return (
              <div className="border rounded-lg p-3 bg-muted/10 mb-2">
                <p className="font-semibold text-sm mb-3">إحصائيات الطلبات</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(Object.entries(grouped) as [string, any][]).map(([type, stats]) => (
                    <div key={type} className="p-2.5 border rounded-xl bg-card hover:bg-muted/30 transition-all">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-sm flex-1 leading-snug">{type}</h4>
                        <span className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0 ml-1">
                          الكل: {stats.total}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <div className="flex flex-col items-center p-1 rounded-md bg-green-500/10 text-green-700">
                          <span className="font-bold text-sm">{stats.approved}</span>
                          <span className="text-[9px]">موافق</span>
                        </div>
                        <div className="flex flex-col items-center p-1 rounded-md bg-red-500/10 text-red-700">
                          <span className="font-bold text-sm">{stats.rejected}</span>
                          <span className="text-[9px]">مرفوض</span>
                        </div>
                        <div className="flex flex-col items-center p-1 rounded-md bg-blue-500/10 text-blue-700">
                          <span className="font-bold text-sm">{stats.returned + stats.pending}</span>
                          <span className="text-[9px]">تعديل</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          <div className="space-y-3">
            <h3 className="font-semibold border-b pb-2">الطلبات السابقة ({userRequestsDialog.data.length})</h3>

            {userRequestsDialog.loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse"></div>
                ))}
              </div>
            ) : userRequestsDialog.data.length > 0 ? (
              <div className="space-y-3">
                {userRequestsDialog.data.map((req: any, i: number) => (
                  <div key={i} className="p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{req.requestType || "طلب عام"}</p>
                        <p className="text-xs text-muted-foreground mt-1">رقم الطلب: #{req.requestId}</p>
                        {req.latestActor && (
                          <div className="mt-2 text-xs bg-slate-50 p-2 rounded border">
                            <span className="font-medium">آخر إجراء: </span>
                            {req.action === 'approve' ? 'موافقة' :
                             req.action === 'reject' ? 'رفض' :
                             req.action === 'approve_with_changes' ? 'موافقة بتعديلات' :
                             req.action === 'reject_with_changes' ? 'إعادة للتعديل' : req.action}
                            {` من قبل ${req.latestActor}`}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          req.originalStatus === 'approved' ? 'bg-green-100 text-green-800' :
                          req.originalStatus === 'rejected' ? 'bg-red-100 text-red-800' :
                          req.originalStatus === 'returned' ? 'bg-orange-100 text-orange-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {req.originalStatus === 'approved' ? 'موافق عليه' :
                           req.originalStatus === 'rejected' ? 'مرفوض' :
                           req.originalStatus === 'returned' ? 'معاد للتعديل' :
                           req.originalStatus === 'pending' ? 'قيد الانتظار' :
                           req.originalStatus === 'processing' ? 'قيد المراجعة' : req.originalStatus}
                        </span>
                        <span className="text-xs text-muted-foreground">{req.date || "-"}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
                لا توجد طلبات سابقة لهذا المستخدم
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Infinite Scroll Sentinel */}
      <div ref={observerTarget} className="h-10 flex items-center justify-center mt-4">
        {loading && page > 1 && <span className="custom-loader"></span>}
      </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد من تعطيل هذا الحساب؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم إيقاف حساب المستخدم ولن يتمكن من الدخول للنظام. مع ذلك، ستبقى جميع سجلاته وطلباته السابقة محفوظة، ويمكنك إعادة تفعيله لاحقاً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} className="bg-amber-600 hover:bg-amber-700">
              تعطيل الحساب
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div >
  )
}

