
export const roleTranslations: Record<string, string> = {
    admin: "مسؤول النظام",
    dean: "المدير العام",
    head: "مدير قسم / إدارة",
    head_of_department: "مدير قسم / إدارة",
    manager: "مدير مباشر",
    employee: "موظف",
    student: "موظف",
    vice_dean: "نائب المدير العام",
    hr: "الموارد البشرية",
    security: "الأمن والسلامة",
    reviewer: "مراجع إداري",
}

export function translateRole(roleName: string | undefined | null): string {
    if (!roleName) return "غير محدد"
    const lowerRole = roleName.toLowerCase()
    return roleTranslations[lowerRole] || roleName
}

