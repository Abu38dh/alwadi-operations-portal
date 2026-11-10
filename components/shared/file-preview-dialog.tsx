"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FileText, Upload, X } from "lucide-react"
import NextImage from "next/image"

interface FilePreviewDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    file: {
        content: string
        type: 'image' | 'pdf' | 'other'
        name: string
    } | null
}

export function FilePreviewDialog({ open, onOpenChange, file }: FilePreviewDialogProps) {
    if (!file) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 py-4 border-b bg-background z-10">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="w-5 h-6 text-primary" />
                            {file.name || "معاينة الملف"}
                        </DialogTitle>
                        {/* Close button is handled by DialogPrimitive default, but we can add custom if needed */}
                    </div>
                </DialogHeader>

                <div className="flex-1 bg-slate-100 flex items-center justify-center p-4 overflow-hidden relative">
                    {file.type === 'pdf' ? (
                        <iframe
                            src={file.content}
                            className="w-full h-full rounded-md bg-white shadow-sm"
                            title="PDF Preview"
                        />
                    ) : file.type === 'image' ? (
                        <div className="relative w-full h-full">
                            <NextImage
                                src={file.content}
                                alt={file.name}
                                fill
                                className="object-contain"
                                unoptimized={true}
                            />
                        </div>
                    ) : (
                        <div className="text-center">
                            <p className="mb-4 text-muted-foreground">لا يمكن معاينة هذا النوع من الملفات مباشرة داخل النظام.</p>
                            <Button asChild>
                                <a href={file.content} download={file.name || "downloaded-file"}>
                                    <Upload className="w-4 h-4 me-2" />
                                    تحميل الملف
                                </a>
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

