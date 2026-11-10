import type React from "react"
import { Card, CardContent } from "./card"
import { Button } from "./button"

interface EmptyStateProps {
    icon?: React.ReactNode | string
    title: string
    description?: string
    action?: {
        label: string
        onClick: () => void
    }
}

/**
 * Empty state component for when no data exists
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    return (
        <Card className="border-slate-200">
            <CardContent className="py-6 sm:py-12 px-4">
                <div className="flex flex-col items-center justify-center text-center space-y-2.5">
                    {/* Icon */}
                    <div className="h-10 w-10 sm:h-14 sm:w-14 rounded-full bg-muted/60 flex items-center justify-center text-xl sm:text-3xl">
                        {typeof icon === "string" ? icon : icon || "📭"}
                    </div>

                    {/* Title */}
                    <div>
                        <h3 className="font-bold text-foreground text-sm sm:text-base mb-1">{title}</h3>
                        {description && (
                            <p className="text-xs sm:text-sm text-muted-foreground max-w-md">{description}</p>
                        )}
                    </div>

                    {/* Action Button */}
                    {action && (
                        <Button onClick={action.onClick} size="sm" className="mt-2 text-xs sm:text-sm">
                            {action.label}
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

