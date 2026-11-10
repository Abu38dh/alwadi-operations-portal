"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"

interface User {
    university_id: string
    full_name: string
    role: "student" | "employee" | "admin"
    permissions?: string[]
    department_id?: number | null
}

interface UserContextType {
    user: User | null
    setUser: (user: User | null) => void
    isLoading: boolean
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        // For now, we'll use session storage to persist user across page reloads
        // In production, this should use NextAuth.js or similar
        const storedUser = sessionStorage.getItem("current_user")
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser))
            } catch (e) {
                console.error("Failed to parse stored user:", e)
            }
        }
        setIsLoading(false)
    }, [])

    const updateUser = (newUser: User | null) => {
        setUser(newUser)
        if (newUser) {
            sessionStorage.setItem("current_user", JSON.stringify(newUser))
        } else {
            sessionStorage.removeItem("current_user")
        }
    }

    return (
        <UserContext.Provider value={{ user, setUser: updateUser, isLoading }}>
            {children}
        </UserContext.Provider>
    )
}

export function useUser() {
    const context = useContext(UserContext)
    if (context === undefined) {
        throw new Error("useUser must be used within a UserProvider")
    }
    return context
}

