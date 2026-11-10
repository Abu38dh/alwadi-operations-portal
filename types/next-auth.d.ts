import NextAuth, { DefaultSession } from "next-auth"

declare module "next-auth" {
    /**
     * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
     */
    interface Session {
        user: {
            university_id: string
            role: string
            permissions: string[]
            department_id?: number
            user_status?: string
        } & DefaultSession["user"]
    }

    interface User {
        university_id: string
        role: string
        permissions: string[]
        department_id?: number | null
        user_status?: string
    }
}

declare module "next-auth/jwt" {
    /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
    interface JWT {
        university_id: string
        role: string
        permissions: string[]
        department_id?: number | null
        user_status?: string
    }
}

