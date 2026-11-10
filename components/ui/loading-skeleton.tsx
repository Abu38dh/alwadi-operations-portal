import { Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader } from "./card"
import { Skeleton } from "./skeleton"

/**
 * Shared Centered Spinner
 */
function CenteredSpinner() {
    return (
        <div className="flex items-center justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
        </div>
    )
}

/**
 * Dashboard skeleton - Replaced with Spinner
 */
export function DashboardSkeleton() {
    return <CenteredSpinner />
}

/**
 * Table skeleton - Replaced with Spinner
 */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
    return <CenteredSpinner />
}

/**
 * Form skeleton - Replaced with Spinner
 */
export function FormSkeleton({ fields = 5 }: { fields?: number }) {
    return <CenteredSpinner />
}

/**
 * List skeleton - Replaced with Spinner
 */
export function ListSkeleton({ items = 5 }: { items?: number }) {
    return <CenteredSpinner />
}

/**
 * Card skeleton - Replaced with Spinner
 */
export function CardSkelet() {
    return <CenteredSpinner />
}

