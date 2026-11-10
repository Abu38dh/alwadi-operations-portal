import puppeteer from 'puppeteer';

interface GeneratePdfOptions {
  htmlContent: string;
  landscape?: boolean;
}

export async function generatePdfServer({ htmlContent, landscape = false }: GeneratePdfOptions): Promise<Buffer> {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
    });
    
    const page = await browser.newPage();
    
    // Set viewport to A4 dimensions (approx)
    await page.setViewport({
      width: 794,
      height: 1123,
      deviceScaleFactor: 2, // Higher scale for better quality
    });

    // Wrap content with full HTML structure and inject Tailwind + Fonts
    const fullContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Cairo', sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          img:not([src*="logo"]) {
            mix-blend-mode: multiply !important;
            filter: contrast(250%) brightness(125%) grayscale(100%) !important;
          }
          img[src*="logo"] {
            mix-blend-mode: multiply !important;
          }
          @page {
            size: A4;
            margin: 0;
          }
        </style>
      </head>
      <body class="bg-white text-slate-900">
        ${htmlContent}
      </body>
      </html>
    `;

    await page.setContent(fullContent, {
      waitUntil: 'load', // Wait for load event (faster and less strict than networkidle)
      timeout: 60000, 
    });
    
    // Give Tailwind a moment to process classes after load
    await new Promise(r => setTimeout(r, 2000));

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      landscape: landscape,
      margin: {
        top: '0px',
        right: '0px',
        bottom: '0px',
        left: '0px',
      },
    });

    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF with Puppeteer:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}


