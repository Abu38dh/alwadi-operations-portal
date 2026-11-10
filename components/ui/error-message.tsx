import { AlertCircle, WifiOff, ServerCrash, RefreshCw } from "lucide-react"
import { Button } from "./button"
import { Alert, AlertDescription, AlertTitle } from "./alert"
import { Card, CardContent } from "./card"

interface ErrorMessageProps {
    error?: string | null
    title?: string
    onRetry?: () => void
    variant?: "alert" | "card" | "inline"
}

/**
 * Reusable error display component
 */
export function ErrorMessage({
    error = "حدث خطأ غير متوقع",
    title = "خطأ",
    onRetry,
    variant = "alert"
}: ErrorMessageProps) {
    // Determine icon based on error message
    const getIcon = () => {
        const errorLower = error?.toLowerCase() || ""
        if (errorLower.includes("connection") || errorLower.includes("network")) {
            return <WifiOff className="h-5 w-5" />
        }
        if (errorLower.includes("server") || errorLower.includes("database")) {
            return <ServerCrash className="h-5 w-5" />
        }
        return <AlertCircle className="h-5 w-5" />
    }

    if (variant === "card") {
        return (
            <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="pt-6">
                    <div className="flex flex-col items-center justify-center text-center space-y-4">
                        <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                            {getIcon()}
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground mb-1">{title}</h3>
                            <p className="text-sm text-muted-foreground">{error}</p>
                        </div>
                        {onRetry && (
                            <Button onClick={onRetry} variant="outline" size="sm">
                                <RefreshCw className="h-4 w-4 me-2" />
                                إعادة المحاولة
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (variant === "inline") {
        return (
            <div className="flex items-center gap-3 text-destructive text-sm p-3 bg-destructive/5 rounded-md">
                {getIcon()}
                <p className="flex-1">{error}</p>
                {onRetry && (
                    <Button onClick={onRetry} variant="ghost" size="sm">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                )}
            </div>
        )
    }

    return (
        <Alert variant="destructive">
            {getIcon()}
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription className="mt-2">
                {error}
                {onRetry && (
                    <div className="mt-3">
                        <Button onClick={onRetry} variant="outline" size="sm">
                            <RefreshCw className="h-4 w-4 me-2" />
                            إعادة المحاولة
                        </Button>
                    </div>
                )}
            </AlertDescription>
        </Alert>
    )
}

