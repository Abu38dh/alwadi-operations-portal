"use client"

import { useState, useRef, useEffect, FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { Bold, Italic, AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Undo, Redo, Image as ImageIcon, Upload, Plus } from "lucide-react"

interface PdfTemplateEditorProps {
  template?: string | null
  onTemplateChange: (template: string) => void
  signatures?: Array<{ id: string, url: string, name: string }>
  stamps?: Array<{ id: string, url: string, name: string }>
  onSignaturesChange?: (signatures: Array<{ id: string, url: string, name: string }>) => void
  onStampsChange?: (stamps: Array<{ id: string, url: string, name: string }>) => void
}

export default function PdfTemplateEditor({ 
  template, 
  onTemplateChange,
  signatures = [],
  stamps = [],
  onSignaturesChange,
  onStampsChange
}: PdfTemplateEditorProps) {
  const [showPreview, setShowPreview] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const selectionRef = useRef<Range | null>(null)
  
  // Formatting state
  const [fontSize, setFontSize] = useState(16)
  const [fontFamily, setFontFamily] = useState("serif")
  const [textColor, setTextColor] = useState("#1e293b")
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)

  // Check active styles to update UI
  const checkActiveStyles = () => {
    if (!editorRef.current) return
    
    // Use setTimeout to allow the DOM to update after the command
    setTimeout(() => {
        setIsBold(document.queryCommandState('bold'))
        setIsItalic(document.queryCommandState('italic'))
        
        // Removed the automatic updating of color/font/size based on cursor position
        // as per user request to keep toolbar selections static.
    }, 0)
  }

  // Sync template prop with editor content
  useEffect(() => {
    if (editorRef.current && template !== editorRef.current.innerHTML && document.activeElement !== editorRef.current) {
      editorRef.current.innerHTML = template || ""
    }
      // If focused, we assume the local DOM is the source of truth and the prop change is just an echo.
      // This prevents cursor jumps and selection loss.
  }, [template])

  // Initial load
  useEffect(() => {
      // If editor is empty, and we have a template, load it.
      if (editorRef.current && !editorRef.current.innerHTML && template) {
          editorRef.current.innerHTML = template
      } 
      // If editor is empty, and template is falsy (undefined, null, or empty), load default
      else if (editorRef.current && !editorRef.current.innerHTML) {
          // Default placeholder
          const defaultContent = `<div>اكتب نص الخطاب الرسمي هنا...<br/><br/>مثال على صيغة الخطاب:<br/><br/>بسم الله الرحمن الرحيم<br/><br/>التاريخ: {RequestDate}<br/>رقم الوثيقة: {RequestID}<br/><br/>إلى من يهمه الأمر،<br/><br/>تحية طيبة وبعد،<br/><br/>تشهد الإدارة بأن الموظف/مقدم الطلب:<br/>الاسم: {StudentName}<br/>الرقم الوظيفي: {UniversityID}<br/>الإدارة / القسم: {Department}<br/><br/>مسجل لدى المنشأة بانتظام، وصدرت هذه الوثيقة بناءً على طلبه للاستخدام فيما يلزم.<br/><br/>وتفضلوا بقبول فائق الاحترام والتقدير،<br/><br/><br/>التوقيع: _______________&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;الختم الرسمي<br/>المدير العام</div>`
          editorRef.current.innerHTML = defaultContent
          // Update parent state so preview works immediately
          onTemplateChange(defaultContent)
      }
  }, [template])

  const saveSelection = () => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      // Verify range is inside editor
      if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
        selectionRef.current = range.cloneRange()
        return range
      }
    }
    return null
  }

  const restoreSelection = () => {
      if (editorRef.current && document.activeElement !== editorRef.current) {
          editorRef.current.focus()
      }
      const selection = window.getSelection()
      if (selection) {
          if (selectionRef.current) {
              selection.removeAllRanges()
              selection.addRange(selectionRef.current)
          } else if (editorRef.current) {
              const range = document.createRange()
              range.selectNodeContents(editorRef.current)
              range.collapse(false)
              selection.removeAllRanges()
              selection.addRange(range)
              selectionRef.current = range.cloneRange()
          }
      }
  }

  // Listen to selection changes to capture highlight range in real-time before focus leaves the editor
  useEffect(() => {
    const handleSelectionChange = () => {
      if (document.activeElement === editorRef.current) {
        saveSelection()
      }
    }
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [])

  // Force the browser's typing context to match the toolbar
  const enforceToolbarStyles = () => {
      const selection = window.getSelection()
      if (!selection || !selection.isCollapsed) return
      if (!editorRef.current || !editorRef.current.contains(selection.anchorNode)) return
      
      document.execCommand('foreColor', false, textColor)
      document.execCommand('fontName', false, fontFamily)
  }

  // Insert variable at cursor position
  const insertVariable = (variable: string) => {
    // 1. Restore selection/focus to editor
    restoreSelection()
    
    // 2. Ensure we have a valid selection inside the editor
    const selection = window.getSelection()
    let range: Range
    
    if (selection && selection.rangeCount > 0) {
        range = selection.getRangeAt(0)
         // Check if range is inside editor
        if (editorRef.current && !editorRef.current.contains(range.commonAncestorContainer)) {
             // If cursor is not in editor, move it to the end
             range = document.createRange()
             range.selectNodeContents(editorRef.current)
             range.collapse(false)
             selection.removeAllRanges()
             selection.addRange(range)
        }
    } else if (editorRef.current) {
         // No selection, create one at end of editor
         range = document.createRange()
         range.selectNodeContents(editorRef.current)
         range.collapse(false)
         const newSelection = window.getSelection()
         if (newSelection) {
             newSelection.removeAllRanges()
             newSelection.addRange(range)
         }
    } else {
         return
    }

    // 3. Insert text
    document.execCommand('insertText', false, variable)
    
    // 4. Update state
    if (editorRef.current) {
        onTemplateChange(editorRef.current.innerHTML)
    }
    
    // 5. Save new selection
    saveSelection()
    checkActiveStyles()
  }

  // Toggle style using execCommand (better for boolean states like bold/italic)
  const toggleStyle = (command: string) => {
    // Rely on onMouseDown={e => e.preventDefault()} to keep focus
    document.execCommand(command, false)
    
    if (editorRef.current) {
        onTemplateChange(editorRef.current.innerHTML)
    }
    // Update active styles immediately
    checkActiveStyles()
  }

  // Helper function to apply formatting to selected text or cursor
  const applyFormatting = (styleProp: string, styleValue: string) => {
    // Ensure editor has focus if it lost it (though preventDefault should handle it)
    if (document.activeElement !== editorRef.current) {
      restoreSelection()
    }
    
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    // Handle collapsed selection (cursor only) for ALL style properties
    if (selection.isCollapsed) {
      const span = document.createElement('span')
      if (styleProp === 'color') {
        span.style.color = styleValue
      } else if (styleProp === 'font-family') {
        span.style.fontFamily = styleValue
      } else {
        span.style.setProperty(styleProp, styleValue)
      }
      
      span.innerHTML = '&#8203;' // Zero width space
      const range = selection.getRangeAt(0)
      range.insertNode(span)
      
      // Move cursor inside the span after the ZWS
      range.selectNodeContents(span)
      range.collapse(false) 
      selection.removeAllRanges()
      selection.addRange(range)
      
      if (editorRef.current) onTemplateChange(editorRef.current.innerHTML)
      checkActiveStyles()
      return
    }

    // Handle normal selected text using native commands where possible
    if (styleProp === 'color') {
      document.execCommand('foreColor', false, styleValue)
      if (editorRef.current) onTemplateChange(editorRef.current.innerHTML)
      return
    }

    if (styleProp === 'font-family') {
      document.execCommand('fontName', false, styleValue)
      if (editorRef.current) onTemplateChange(editorRef.current.innerHTML)
      return
    }
    const range = selection.getRangeAt(0)
    
    // Check if we are inside the editor
    if (editorRef.current && !editorRef.current.contains(range.commonAncestorContainer)) {
        return
    }
    
    // Extract contents
    const fragment = range.extractContents()
    
    // Create span
    const span = document.createElement('span')
    span.style.setProperty(styleProp, styleValue)
    span.appendChild(fragment)
    
    // Insert
    range.insertNode(span)
    
    // Notify
    if (editorRef.current) {
        onTemplateChange(editorRef.current.innerHTML)
    }
    
    // Select new content
    selection.removeAllRanges()
    const newRange = document.createRange()
    newRange.selectNodeContents(span)
    selection.addRange(newRange)
    
    checkActiveStyles()
  }

  return (
    <div className="flex gap-6 h-full">
      {/* Variables Sidebar */}
      <div className="w-72 bg-white border-l border-slate-200 flex flex-col shadow-[rgba(0,0,0,0.05)_0px_0px_10px] z-10">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <span className="text-xl">📋</span>
            المتغيرات المتاحة
          </h3>
          <p className="text-xs text-slate-500 mt-1 opacity-80">اضغط على المتغير لإدراجه في المؤشر</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Applicant Info */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">معلومات مقدم الطلب</h4>
            <div className="grid grid-cols-1 gap-2">
              {[
                { label: "اسم مقدم الطلب", value: "{StudentName}" },
                { label: "الرقم الوظيفي", value: "{UniversityID}" },
                { label: "الإدارة / القسم", value: "{Department}" }
              ].map((v) => (
                <button
                  key={v.value}
                  onClick={() => insertVariable(v.value)}
                  onMouseDown={(e) => e.preventDefault()}
                  className="group flex flex-col items-start w-full p-2.5 bg-white rounded-lg border border-slate-200 hover:border-[#1b9d91] hover:shadow-md hover:shadow-[#1b9d91]/20 transition-all duration-200 active:scale-[0.98]"
                >
                  <span className="text-xs font-semibold text-slate-700 group-hover:text-[#1b9d91] transition-colors">{v.label}</span>
                  <code className="text-[10px] text-slate-400 mt-1 font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 group-hover:bg-[#1b9d91]/10 group-hover:text-[#1b9d91] group-hover:border-[#1b9d91]/30 transition-colors truncate w-full text-left" dir="ltr">{v.value}</code>
                </button>
              ))}
            </div>
          </div>

          {/* Request Info */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">معلومات الطلب</h4>
            <div className="grid grid-cols-1 gap-2">
              {[
                { label: "رقم الطلب", value: "{RequestID}" },
                { label: "تاريخ الطلب", value: "{RequestDate}" },
                { label: "نوع الطلب", value: "{RequestType}" }
              ].map((v) => (
                <button
                  key={v.value}
                  onClick={() => insertVariable(v.value)}
                  onMouseDown={(e) => e.preventDefault()}
                  className="group flex flex-col items-start w-full p-2.5 bg-white rounded-lg border border-slate-200 hover:border-orange-400 hover:shadow-md hover:shadow-orange-50 transition-all duration-200 active:scale-[0.98]"
                >
                  <span className="text-xs font-semibold text-slate-700 group-hover:text-orange-700 transition-colors">{v.label}</span>
                  <code className="text-[10px] text-slate-400 mt-1 font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 group-hover:bg-orange-50 group-hover:text-orange-600 group-hover:border-orange-100 transition-colors truncate w-full text-left" dir="ltr">{v.value}</code>
                </button>
              ))}
            </div>
          </div>

          <AssetsToolbar 
            signatures={signatures}
            stamps={stamps}
            onSignaturesChange={onSignaturesChange}
            onStampsChange={onStampsChange}
          />
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col">
        {/* Preview Button */}


        {/* Paper Container */}
        <div className="flex-1 overflow-auto bg-slate-100 p-8 rounded-lg">
          <div className="w-full max-w-[210mm] bg-white shadow-2xl rounded-sm border border-slate-300 min-h-[297mm]">
            {/* Paper Header */}
            <div className="p-8 bg-white border-b-4 border-[#C69214] pb-[15px] mb-[30px]" dir="rtl">
              <div className="flex justify-between items-center gap-6">
                <div className="shrink-0">
                  <img src="/company-logo.png" alt="شركة الوادي لقطع غيار السيارات" className="h-[55px] w-auto object-contain" />
                </div>
                <div className="text-left flex-1" dir="ltr">
                  <div className="font-bold text-[14px] text-[#0B2545]">INTERNAL CORRESPONDENCE</div>
                  <div className="text-[11px] text-slate-500">Official Approved Document</div>
                </div>
              </div>
            </div>

            {/* Editor Area */}
            <div className="p-8">
              {/* Formatting Toolbar */}
              <div className="mb-4 bg-white rounded-lg border-2 border-slate-200 shadow-sm">
                {/* Header Row */}
                <div className="px-4 py-2 bg-gradient-to-r from-[#1b9d91]/5 to-[#1b9d91]/10 border-b border-[#1b9d91]/20 flex items-center justify-between">
                  <div className="text-sm font-bold text-[#1b9d91] flex items-center gap-2">
                    <span>🎨</span>
                    تنسيق النص
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowPreview(true)}
                    className="text-slate-500 hover:text-[#1b9d91] hover:bg-[#1b9d91]/10 gap-2 h-8"
                  >
                    <span className="text-xs font-bold">معاينة الوثيقة</span>
                  </Button>
                </div>

                {/* Controls Row */}
                <div className="px-4 py-3 flex flex-wrap items-center gap-3">
                  {/* Font Size */}
                  <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-md border border-slate-200">
                    <label className="text-xs font-medium text-slate-600">الحجم:</label>
                    <Select
                      value={fontSize.toString()}
                      onValueChange={(value) => {
                        setFontSize(Number(value))
                        applyFormatting('font-size', value + 'px')
                      }}
                    >
                      <SelectTrigger className="w-[70px] h-7 text-xs border-slate-300 bg-white">
                        <SelectValue placeholder="16" />
                      </SelectTrigger>
                      <SelectContent>
                        {[12, 14, 16, 18, 20, 22, 24].map((size) => (
                          <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Font Family */}
                  <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-md border border-slate-200">
                    <label className="text-xs font-medium text-slate-600">نوع الخط:</label>
                    <Select
                      value={fontFamily}
                      onValueChange={(value) => {
                        setFontFamily(value)
                        applyFormatting('font-family', value)
                      }}
                    >
                      <SelectTrigger className="w-[140px] h-7 text-xs border-slate-300 bg-white">
                        <SelectValue placeholder="نوع الخط" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="serif">Serif (نسخ)</SelectItem>
                        <SelectItem value="sans-serif">Sans Serif (بسيط)</SelectItem>
                        <SelectItem value="Cairo, sans-serif">Cairo (كايرو)</SelectItem>
                        <SelectItem value="Times New Roman, serif">Times New Roman</SelectItem>
                        <SelectItem value="Arial, sans-serif">Arial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Separator */}
                  <div className="h-8 w-px bg-slate-300"></div>

                  {/* Bold */}
                  <button
                    onClick={() => toggleStyle('bold')}
                    onMouseDown={(e) => e.preventDefault()}
                    className={`w-9 h-9 flex items-center justify-center text-base font-bold rounded-md border-2 transition-all active:scale-95 ${
                      isBold 
                        ? 'bg-[#1b9d91] text-white border-[#1b9d91] shadow-inner' 
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-[#1b9d91] hover:text-white hover:border-[#1b9d91] hover:shadow-md'
                    }`}
                    title="عريض (Bold)"
                  >
                    B
                  </button>

                  {/* Italic */}
                  <button
                    onClick={() => toggleStyle('italic')}
                    onMouseDown={(e) => e.preventDefault()}
                    className={`w-9 h-9 flex items-center justify-center text-base italic rounded-md border-2 transition-all active:scale-95 ${
                      isItalic 
                        ? 'bg-[#1b9d91] text-white border-[#1b9d91] shadow-inner' 
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-[#1b9d91] hover:text-white hover:border-[#1b9d91] hover:shadow-md'
                    }`}
                    title="مائل (Italic)"
                  >
                    I
                  </button>

                  {/* Separator */}
                  <div className="h-8 w-px bg-slate-300"></div>

                  {/* Text Color */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-md border border-slate-200">
                    <label className="text-xs font-medium text-slate-600">اللون:</label>
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => {
                        const color = e.target.value
                        setTextColor(color)
                        applyFormatting('color', color)
                      }}
                      className="w-12 h-8 rounded border-2 border-slate-300 cursor-pointer"
                      title="اختر اللون"
                    />
                  </div>
                </div>
              </div>



              {/* Rich Text Editor */}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={(e: FormEvent<HTMLDivElement>) => {
                  const html = e.currentTarget.innerHTML
                  if (html !== template) {
                    onTemplateChange(html)
                  }
                  // Save selection on input
                  saveSelection()
                  checkActiveStyles()
                }}
                onMouseUp={() => {
                  saveSelection()
                  checkActiveStyles()
                  enforceToolbarStyles()
                }}
                onKeyUp={(e) => {
                  saveSelection()
                  checkActiveStyles()
                  // Only enforce if navigating, not while actively typing characters
                  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Enter'].includes(e.key)) {
                      enforceToolbarStyles()
                  }
                }}
                onFocus={() => {
                  saveSelection()
                  checkActiveStyles()
                }}
                onBlur={saveSelection}
                className="rich-text-editor w-full min-h-[500px] resize-none border-none focus:outline-none focus:ring-0 leading-loose p-4"
                style={{
                  fontSize: '18px',
                  fontFamily: 'serif',
                  color: '#1e293b',
                  caretColor: 'black'
                }}
                dir="rtl"
              />
            </div>
          </div>
        </div>
      </div>



      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0 bg-slate-50/50 backdrop-blur-sm">
          <DialogHeader className="p-4 border-b bg-white">
            <DialogTitle>معاينة الخطاب الرسمي</DialogTitle>
             <DialogDescription>
              هذا عرض تقريبي لشكل الملف بصيغة PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-slate-100/50">
             <div className="bg-white shadow-2xl w-[794px] min-h-[1123px] origin-top transform scale-90 flex flex-col">
                {/* Paper Header */}
                <div className="p-10 bg-white shrink-0 border-b-4 border-[#C69214] pb-[15px] mb-[30px]" dir="rtl">
                  <div className="flex justify-between items-center gap-6 relative z-10">
                    <div className="shrink-0">
                      <img src="/company-logo.png" alt="شركة الوادي لقطع غيار السيارات" className="h-[55px] w-auto object-contain" />
                    </div>
                    <div className="text-left flex-1" dir="ltr">
                      <div className="font-bold text-[14px] text-[#0B2545]">INTERNAL CORRESPONDENCE</div>
                      <div className="text-[11px] text-slate-500">Official Approved Document</div>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-12 flex-1 pdf-preview-content"
                     dangerouslySetInnerHTML={{ 
                        __html: (template || "")
                            .replace(/{StudentName}/g, 'أحمد محمد عبدالله')
                            .replace(/{UniversityID}/g, 'EMP-1024')
                            .replace(/{College}/g, 'الإدارة العامة')
                            .replace(/{Department}/g, 'إدارة تقنية المعلومات')
                            .replace(/{RequestID}/g, 'REQ-2024-001')
                            .replace(/{RequestDate}/g, new Date().toLocaleDateString('ar-SA'))
                            .replace(/{RequestType}/g, 'طلب إجازة / معاملة رسمية')
                    }}
                />
             </div>
          </div>
          <div className="p-4 border-t bg-white flex justify-end">
            <Button variant="outline" onClick={() => setShowPreview(false)}>إغلاق</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}



function AssetsToolbar({ 
  signatures, 
  stamps, 
  onSignaturesChange, 
  onStampsChange 
}: { 
  signatures: Array<{ id: string, url: string, name: string }>
  stamps: Array<{ id: string, url: string, name: string }>
  onSignaturesChange?: (signatures: Array<{ id: string, url: string, name: string }>) => void
  onStampsChange?: (stamps: Array<{ id: string, url: string, name: string }>) => void
}) {
  const [isUploadingSig, setIsUploadingSig] = useState(false);
  const [isUploadingStamp, setIsUploadingStamp] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'stamp' | 'signature') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      const formData = new FormData()
      formData.append('file', file)

      if (type === 'signature') setIsUploadingSig(true);
      else setIsUploadingStamp(true);

      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })

        const data = await response.json()

        if (data.success) {
          if (type === 'stamp' && onStampsChange) {
            const newStamps = [...stamps, { id: Date.now().toString(), url: data.url, name: `ختم ${stamps.length + 1}` }]
            onStampsChange(newStamps)
          }
          if (type === 'signature' && onSignaturesChange) {
            const newSignatures = [...signatures, { id: Date.now().toString(), url: data.url, name: `توقيع ${signatures.length + 1}` }]
            onSignaturesChange(newSignatures)
          }
        } else {
          alert("فشل رفع الملف: " + data.error)
        }
      } catch (err) {
        console.error("Upload failed", err)
        alert("حدث خطأ أثناء رفع الملف")
      } finally {
        e.target.value = ''
        if (type === 'signature') setIsUploadingSig(false);
        else setIsUploadingStamp(false);
      }
    }
  }

  const handleUpdateSignatureName = (id: string, newName: string) => {
    if (onSignaturesChange) {
      onSignaturesChange(signatures.map(s => s.id === id ? { ...s, name: newName } : s))
    }
  }

  const handleDeleteSignature = (id: string) => {
    if (onSignaturesChange) {
      onSignaturesChange(signatures.filter(s => s.id !== id))
    }
  }

  const handleUpdateStampName = (id: string, newName: string) => {
    if (onStampsChange) {
      onStampsChange(stamps.map(s => s.id === id ? { ...s, name: newName } : s))
    }
  }

  const handleDeleteStamp = (id: string) => {
    if (onStampsChange) {
      onStampsChange(stamps.filter(s => s.id !== id))
    }
  }

  return (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 shadow-sm">
      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 px-1 flex items-center gap-2">
        <span>📎</span>
        المرفقات الرسمية
      </h4>
      
      <div className="space-y-4">
        {/* Signatures */}
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
            <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-semibold text-slate-700">التوقيعات</span>
            </div>
            
            <div className="space-y-4">
               {signatures.map((sig) => (
                  <div key={sig.id} className="space-y-3 border border-slate-100 p-3 rounded-md bg-slate-50 relative group">
                      <div className="flex items-center justify-between gap-2">
                        <input 
                           value={sig.name}
                           onChange={(e) => handleUpdateSignatureName(sig.id, e.target.value)}
                           className="text-xs font-semibold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#1b9d91] focus:outline-none flex-1 px-1 py-0.5"
                           placeholder="اسم التوقيع"
                        />
                        <button 
                            onClick={() => handleDeleteSignature(sig.id)}
                            className="text-[10px] text-red-500 hover:text-white hover:bg-red-500 bg-red-50 px-2 py-1 rounded transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                            title="حذف هذا التوقيع"
                        >
                            حذف
                        </button>
                      </div>
                      <div className="h-20 bg-white rounded-md border border-slate-200 flex items-center justify-center overflow-hidden p-1">
                          <img src={sig.url} alt={sig.name} className="max-h-full max-w-full object-contain mix-blend-multiply" />
                      </div>
                      <button
                          onClick={() => document.execCommand('insertImage', false, sig.url)}
                          className="w-full text-xs flex items-center justify-center gap-1.5 bg-[#1b9d91] text-white hover:bg-[#15877c] py-2 rounded-md transition-colors font-medium cursor-pointer shadow-sm active:scale-[0.98]"
                          onMouseDown={(e) => e.preventDefault()}
                      >
                          <span></span>
                          إدراج في الخطاب
                      </button>
                  </div>
               ))}

               <label className="select-field">
                    <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                        {isUploadingSig ? <span className="animate-[spin_1s_linear_infinite]">⏳</span> : <Plus className="w-4 h-4 text-slate-400 group-hover:text-[#1b9d91]" />}
                    </div>
                    <span className="font-medium">{isUploadingSig ? "جارٍ الرفع..." : "إضافة توقيع جديد"}</span>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'signature')} disabled={isUploadingSig} />
                </label>
            </div>
        </div>

        {/* Stamps */}
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
            <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-semibold text-slate-700">الأختام</span>
            </div>
            
            <div className="space-y-4">
               {stamps.map((stamp) => (
                  <div key={stamp.id} className="space-y-3 border border-slate-100 p-3 rounded-md bg-slate-50 relative group">
                      <div className="flex items-center justify-between gap-2">
                        <input 
                           value={stamp.name}
                           onChange={(e) => handleUpdateStampName(stamp.id, e.target.value)}
                           className="text-xs font-semibold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#1b9d91] focus:outline-none flex-1 px-1 py-0.5"
                           placeholder="اسم الختم"
                        />
                        <button 
                            onClick={() => handleDeleteStamp(stamp.id)}
                            className="text-[10px] text-red-500 hover:text-white hover:bg-red-500 bg-red-50 px-2 py-1 rounded transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                            title="حذف هذا الختم"
                        >
                            حذف
                        </button>
                      </div>
                      <div className="h-24 bg-white rounded-md border border-slate-200 flex items-center justify-center overflow-hidden p-1">
                          <img src={stamp.url} alt={stamp.name} className="max-h-full max-w-full object-contain mix-blend-multiply" />
                      </div>
                      <button
                          onClick={() => document.execCommand('insertImage', false, stamp.url)}
                          className="w-full text-xs flex items-center justify-center gap-1.5 bg-[#1b9d91] text-white hover:bg-[#15877c] py-2 rounded-md transition-colors font-medium cursor-pointer shadow-sm active:scale-[0.98]"
                          onMouseDown={(e) => e.preventDefault()}
                      >
                          <span></span>
                          إدراج في الخطاب
                      </button>
                  </div>
               ))}

               <label htmlFor="stamp-upload" className="select-field">
                    <div className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                        {isUploadingStamp ? <span className="animate-[spin_1s_linear_infinite]">⏳</span> : <Upload className="w-5 h-5 text-slate-400 group-hover:text-[#1b9d91]" />}
                    </div>
                    <span className="font-medium">{isUploadingStamp ? "جارٍ الرفع..." : "إضافة ختم جديد"}</span>
                    <input id="stamp-upload" type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'stamp')} disabled={isUploadingStamp} />
                </label>
            </div>
        </div>
      </div>
    </div>
  )
}


