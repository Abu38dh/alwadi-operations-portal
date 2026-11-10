import jsPDF from "jspdf"
import html2canvas from "html2canvas"

interface GeneratePDFProps {
  template: string
  data: Record<string, any>
  logoUrl?: string
  signatureUrl?: string
  stampUrl?: string
}

export const generateOfficialPDF = async ({
  template,
  data,
  logoUrl = "/Layer-11.png", 
  signatureUrl,
  stampUrl
}: GeneratePDFProps): Promise<Blob> => {
  // 1. Prepare Content and Replace Placeholders
  let content = template
  
  // Create a normalized map for case-insensitive lookup
  // We want to replace {Key} regardless of casing in the template
  // But we need to match the keys available in data.
  // Actually, better approach: Iterate over data keys, build regex with 'gi' flag
  
  Object.keys(data).forEach(key => {
    // Escape special regex chars in key just in case
    const safeKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`{${safeKey}}`, 'gi') // Global, Case-insensitive
    content = content.replace(regex, data[key] !== null && data[key] !== undefined ? String(data[key]) : "---")
  })

  // 2. Create a hidden container to render HTML
  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '-9999px'
  container.style.top = '0'
  container.style.width = '210mm' // A4 Width
  // container.style.height = '297mm' // A4 Height (min-height to allow content to flow if needed, but for single page ideally fixed)
  container.style.minHeight = '297mm'
  container.style.backgroundColor = 'white'
  container.style.direction = 'rtl' // Arabic support
  container.style.fontFamily = 'Arial, sans-serif' // Fallback font
  
  // OVERRIDE CSS VARIABLES TO SAFE HEX VALUES
  // html2canvas fails with 'oklch' or 'lab' colors, so we force standard hex/rgb here
  container.style.setProperty('--background', '#ffffff');
  container.style.setProperty('--foreground', '#0f172a');
  container.style.setProperty('--card', '#ffffff');
  container.style.setProperty('--card-foreground', '#0f172a');
  container.style.setProperty('--popover', '#ffffff');
  container.style.setProperty('--popover-foreground', '#0f172a');
  container.style.setProperty('--primary', '#1b9d91');
  container.style.setProperty('--primary-foreground', '#ffffff');
  container.style.setProperty('--secondary', '#F7941D');
  container.style.setProperty('--secondary-foreground', '#ffffff');
  container.style.setProperty('--muted', '#f1f5f9');
  container.style.setProperty('--muted-foreground', '#64748b');
  container.style.setProperty('--accent', '#f1f5f9');
  container.style.setProperty('--accent-foreground', '#0f172a');
  container.style.setProperty('--destructive', '#ef4444');
  container.style.setProperty('--destructive-foreground', '#ffffff');
  container.style.setProperty('--border', '#e2e8f0');
  container.style.setProperty('--input', '#e2e8f0');
  container.style.setProperty('--ring', '#1b9d91');



  // Reconstruct the official header structure (similar to editor preview)
  // Inline styles are critical here for html2canvas to pick them up correctly
  container.innerHTML = `
    <style>
      img:not([src*="logo"]) {
        mix-blend-mode: multiply !important;
        filter: contrast(250%) brightness(125%) grayscale(100%) !important;
      }
      img[src*="logo"] {
        mix-blend-mode: multiply !important;
      }
    </style>
    <div style="width: 210mm; min-height: 297mm; padding: 20mm; background: white; box-sizing: border-box; display: flex; flex-direction: column;">
      
      <!-- Header Section -->
      <div style="border-bottom: 4px solid #C69214; padding-bottom: 15px; margin-bottom: 30px;">
         <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            
            <!-- Right Side (Arabic) -->
            <div style="text-align: right; flex: 1;">
               <div style="font-weight: bold; font-size: 16px; color: #0B2545; margin-bottom: 4px;">شركة الوادي لقطع غيار السيارات</div>
               <div style="font-size: 12px; color: #334155; line-height: 1.4;">إدارة العمليات والموارد البشرية</div>
               <div style="font-size: 12px; color: #64748b; line-height: 1.4;">نظام إدارة المعاملات الموحد</div>
            </div>

            <!-- Center (Logo) -->
            <div style="flex-shrink: 0; margin: 0 20px;">
               <img src="${logoUrl}" style="width: 120px; height: auto; object-fit: contain;" crossorigin="anonymous" />
            </div>

            <!-- Left Side (English) -->
            <div style="text-align: left; flex: 1; direction: ltr;">
               <div style="font-weight: bold; font-size: 16px; color: #0B2545; margin-bottom: 4px;">AL WADI AUTO SPARE PARTS CO.</div>
               <div style="font-size: 12px; color: #334155; line-height: 1.4;">Operations & HR Department</div>
               <div style="font-size: 12px; color: #64748b; line-height: 1.4;">Process Management System</div>
            </div>

         </div>
      </div>
      
      <!-- Content Body -->
      <div style="flex: 1; line-height: 2; font-size: 18px; color: #1e293b; text-align: right; white-space: normal;">
        ${content}
      </div>



    </div>
  `

  document.body.appendChild(container)

  // 3. Wait for images to load (crucial for html2canvas)
  const images = container.querySelectorAll('img')
  const promises = Array.from(images).map(img => {
      if (img.complete) return Promise.resolve()
      return new Promise(resolve => {
          img.onload = resolve
          img.onerror = resolve // Resolve anyway to avoid hanging
      })
  })
  
  if (promises.length > 0) {
      await Promise.all(promises)
      // Extra small delay to ensure rendering
      await new Promise(r => setTimeout(r, 200)) // Increased delay slightly
  }

  // 4. Render to Canvas
  try {
    const canvas = await html2canvas(container, {
      scale: 2, // Higher scale for better quality
      useCORS: true, 
      logging: true,
      windowWidth: container.scrollWidth,
      windowHeight: container.scrollHeight,
      backgroundColor: '#ffffff',
      onclone: (clonedDoc) => {
          // Inject a style tag to override ALL variables to safe hex values in the cloned context
          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            :root, .dark, body, * {
              --background: #ffffff !important;
              --foreground: #0f172a !important;
              --card: #ffffff !important;
              --card-foreground: #0f172a !important;
              --popover: #ffffff !important;
              --popover-foreground: #0f172a !important;
              --primary: #1b9d91 !important;
              --primary-foreground: #ffffff !important;
              --secondary: #F7941D !important;
              --secondary-foreground: #ffffff !important;
              --muted: #f1f5f9 !important;
              --muted-foreground: #64748b !important;
              --accent: #f1f5f9 !important;
              --accent-foreground: #0f172a !important;
              --destructive: #ef4444 !important;
              --destructive-foreground: #ffffff !important;
              --border: #e2e8f0 !important;
              --input: #e2e8f0 !important;
              --ring: #1b9d91 !important;
              --radius: 0.5rem !important;
            }
          `;
          clonedDoc.head.appendChild(style);
          
          // Force text colors on body as fallback
          clonedDoc.body.style.color = '#0f172a';
          clonedDoc.body.style.background = '#ffffff';
      }
    })

    // 4. Generate PDF
    const imgData = canvas.toDataURL('image/jpeg', 0.90) // JPEG is faster and smaller
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    })

    const pdfWidth = doc.internal.pageSize.getWidth()
    const pdfHeight = doc.internal.pageSize.getHeight()
    
    const imgProps = doc.getImageProperties(imgData)
    const imgWidth = imgProps.width
    const imgHeight = imgProps.height
    
    // Scale to fit width
    const ratio = imgWidth / imgHeight
    let renderHeight = pdfWidth / ratio
    
    // If height exceeds A4, we simply scale it down to fit on one page (Certificate style)
    // or we can crop. For certificates, fitting single page is usually better.
    renderHeight = Math.min(renderHeight, pdfHeight);

    doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, renderHeight)
    
    // Clean up
    if (document.body.contains(container)) {
      document.body.removeChild(container)
    }

    return doc.output('blob')

  } catch (error) {
    console.error("Error generating PDF:", error)
    if (document.body.contains(container)) {
      document.body.removeChild(container)
    }
    throw error
  }
}

