"use client"

import { createContext, useContext, useState, ReactNode } from "react"
import { Request, RequestStatus } from "@/types/schema"

interface RequestContextType {
    requests: Request[]
    addRequest: (request: Omit<Request, "id" | "date" | "status">) => void
    updateRequestStatus: (id: string, status: RequestStatus, notes?: string) => void
}

const RequestContext = createContext<RequestContextType | undefined>(undefined)

export const useRequests = () => {
    const context = useContext(RequestContext)
    if (!context) {
        throw new Error("useRequests must be used within a RequestProvider")
    }
    return context
}

const initialRequests: Request[] = []

export const RequestProvider = ({ children }: { children: ReactNode }) => {
    const [requests, setRequests] = useState<Request[]>(initialRequests)

    const addRequest = (newRequestData: Omit<Request, "id" | "date" | "status">) => {
        const newRequest: Request = {
            ...newRequestData,
            id: Date.now().toString(),
            date: new Date().toISOString().split("T")[0],
            status: "pending",
        }
        setRequests([newRequest, ...requests])
    }

    const updateRequestStatus = (id: string, status: RequestStatus, notes?: string) => {
        setRequests(
            requests.map((req) =>
                req.id === id ? { ...req, status } : req
            )
        )
    }

    return (
        <RequestContext.Provider value={{ requests, addRequest, updateRequestStatus }}>
            {children}
        </RequestContext.Provider>
    )
}

