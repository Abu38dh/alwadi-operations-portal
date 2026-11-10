import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Starting clean database initialization...')

    console.log('🧹 Clearing existing database tables...')
    // Order of deletion to avoid foreign key constraints:
    await prisma.absence_records.deleteMany()
    await prisma.absences.deleteMany()
    await prisma.attachments.deleteMany()
    await prisma.request_actions.deleteMany()
    await prisma.delegations.deleteMany()
    await prisma.requests.deleteMany()
    await prisma.audit_logs.deleteMany()
    await prisma.notifications.deleteMany()
    
    // Break circular references
    await prisma.users.updateMany({
        data: {
            department_id: null,
            level_id: null,
            current_term_id: null
        }
    })
    await prisma.colleges.updateMany({
        data: {
            dean_id: null
        }
    })
    await prisma.departments.updateMany({
        data: {
            manager_id: null
        }
    })

    // Delete workflow steps
    await prisma.workflow_steps.deleteMany()
    
    // Delete form templates and request types
    await prisma.form_templates.deleteMany()
    await prisma.request_types.deleteMany()
    
    // Delete workflows
    await prisma.workflows.deleteMany()

    // Delete subjects, level terms, levels
    await prisma.subjects.deleteMany()
    await prisma.level_terms.deleteMany()
    await prisma.levels.deleteMany()
    
    // Delete departments and colleges
    await prisma.departments.deleteMany()
    await prisma.colleges.deleteMany()
    
    // Delete users and terms
    await prisma.users.deleteMany()
    await prisma.terms.deleteMany()
    
    // Delete roles
    await prisma.roles.deleteMany()

    console.log('✨ Database cleared successfully.')

    // 1. Seed Core Roles
    console.log('1. Seeding system roles...')
    const rolesData = [
        { role_name: 'student', permissions: [] },
        { role_name: 'employee', permissions: ['view_requests', 'edit_requests', 'review_requests'] },
        { role_name: 'admin', permissions: ['all'] },
        { role_name: 'dean', permissions: ['approve_college_requests', 'view_reports'] },
        { role_name: 'head_of_department', permissions: ['approve_department_requests', 'view_reports'] },
    ]

    const roles: Record<string, any> = {}
    for (const role of rolesData) {
        const r = await prisma.roles.create({
            data: {
                role_name: role.role_name,
                permissions: role.permissions,
            },
        })
        roles[role.role_name] = r
        console.log(`- Created role: ${r.role_name}`)
    }

    // 2. Seed Admin User Only
    console.log('2. Seeding default admin user...')
    const passwordHash = await bcrypt.hash('123', 10)
    const adminUser = await prisma.users.create({
        data: {
            university_id: 'admin',
            password_hash: passwordHash,
            full_name: 'مدير النظام',
            role_id: roles.admin.role_id,
            email: 'admin@university.edu',
            phone: '0500000000',
            is_active: true,
            user_status: 'active',
            custom_permissions: JSON.stringify(['all'])
        }
    })
    console.log(`- Created admin user: ${adminUser.full_name} (${adminUser.university_id}) with password: 123`)

    console.log('\n🎉 Clean database setup completed successfully.')
    console.log('💡 The system is completely clean and ready for fresh configuration by the admin.')
}

main()
    .catch((e) => {
        console.error('❌ Error during seeding:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
