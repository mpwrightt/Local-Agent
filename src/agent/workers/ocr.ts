import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import crypto from 'node:crypto'
import { db } from '../../db'
import Tesseract from 'tesseract.js'

interface Ctx {
  runId: string
  sessionId: string
  task: { id: string; title: string; description: string }
  signal?: AbortSignal
}

interface OCRResult {
  filePath: string
  text: string
  confidence: number
  error?: string
}

// Selectable OCR backend
let OCR_BACKEND: 'vision' | 'tesseract' = 'vision'

// Cache directory for OCR results
const OCR_CACHE_DIR = path.join(os.homedir(), '.local-agent', 'ocr-cache')

// Ensure cache directory exists
function ensureCacheDir() {
  if (!fs.existsSync(OCR_CACHE_DIR)) {
    fs.mkdirSync(OCR_CACHE_DIR, { recursive: true })
  }
}

// Generate cache key for file
function getCacheKey(filePath: string): string {
  const stats = fs.statSync(filePath)
  const content = `${filePath}:${stats.mtime.getTime()}:${stats.size}`
  return crypto.createHash('sha256').update(content).digest('hex')
}

// Get cached OCR result
function getCachedResult(filePath: string): OCRResult | null {
  try {
    ensureCacheDir()
    const cacheKey = getCacheKey(filePath)
    const cachePath = path.join(OCR_CACHE_DIR, `${cacheKey}.json`)
    
    if (fs.existsSync(cachePath)) {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'))
      return cached
    }
  } catch (error) {
    console.warn('Failed to read OCR cache:', error)
  }
  return null
}

// Save OCR result to cache
function saveCachedResult(filePath: string, result: OCRResult) {
  try {
    ensureCacheDir()
    const cacheKey = getCacheKey(filePath)
    const cachePath = path.join(OCR_CACHE_DIR, `${cacheKey}.json`)
    
    fs.writeFileSync(cachePath, JSON.stringify(result, null, 2))
  } catch (error) {
    console.warn('Failed to save OCR cache:', error)
  }
}

// Test if Swift is available and working
async function testSwiftAvailability(): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(`[OCR] Testing Swift availability...`)
    // Prefer xcrun to ensure correct SDK resolution
    const child = spawn('xcrun', ['swift', '--version'], { stdio: ['ignore', 'pipe', 'pipe'] })
    
    let output = ''
    child.stdout.on('data', (data) => {
      output += data.toString()
    })
    
    child.on('close', (code) => {
      console.log(`[OCR] Swift version check exit code: ${code}`)
      console.log(`[OCR] Swift version output: ${output}`)
      resolve(code === 0)
    })
    
    child.on('error', (error) => {
      console.log(`[OCR] Swift not available: ${error.message}`)
      resolve(false)
    })
  })
}

// Test Vision framework specifically
async function testVisionFramework(ctx?: { runId: string; task: { id: string } }): Promise<boolean> {
  return new Promise((resolve) => {
    if (ctx) {
      db.addRunEvent(ctx.runId, {
        type: 'ocr_debug',
        taskId: ctx.task.id,
        message: `[OCR] Testing Vision framework...`
      })
    }
    
    const visionTestScript = `
import Foundation
import Vision

// Simple test to see if Vision framework loads
print("Vision framework test started")
let request = VNRecognizeTextRequest()
print("Vision framework test completed successfully")
`
    
    const tempDir = os.tmpdir()
    const testScriptPath = path.join(tempDir, `vision-test-${Date.now()}.swift`)
    
    try {
      fs.writeFileSync(testScriptPath, visionTestScript)
      
      // Use xcrun to run swift with the proper SDK
      const child = spawn('xcrun', ['swift', testScriptPath], { stdio: ['ignore', 'pipe', 'pipe'] })
      
      let stdout = ''
      let stderr = ''
      
      child.stdout.on('data', (data) => {
        stdout += data.toString()
      })
      
      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })
      
      const timeout = setTimeout(() => {
        child.kill('SIGKILL')
        if (ctx) {
          db.addRunEvent(ctx.runId, {
            type: 'ocr_debug',
            taskId: ctx.task.id,
            message: `[OCR] Vision framework test timed out`
          })
        }
        resolve(false)
      }, 5000) // 5 second timeout for test
      
      child.on('close', (code) => {
        clearTimeout(timeout)
        
        // Clean up
        try { fs.unlinkSync(testScriptPath) } catch {}
        
        if (ctx) {
          db.addRunEvent(ctx.runId, {
            type: 'ocr_debug',
            taskId: ctx.task.id,
            message: `[OCR] Vision test result: code=${code}, stdout="${stdout.trim()}", stderr="${stderr.trim()}"`
          })
        }
        
        resolve(code === 0 && stdout.includes('Vision framework test completed'))
      })
      
      child.on('error', (error) => {
        clearTimeout(timeout)
        try { fs.unlinkSync(testScriptPath) } catch {}
        
        if (ctx) {
          db.addRunEvent(ctx.runId, {
            type: 'ocr_debug',
            taskId: ctx.task.id,
            message: `[OCR] Vision test error: ${error.message}`
          })
        }
        
        resolve(false)
      })
      
    } catch (error) {
      if (ctx) {
        db.addRunEvent(ctx.runId, {
          type: 'ocr_debug',
          taskId: ctx.task.id,
          message: `[OCR] Vision test setup failed: ${error}`
        })
      }
      resolve(false)
    }
  })
}

// Extract text using Tesseract.js (WASM) as a fallback when Vision is unavailable
async function extractTextWithTesseract(imagePath: string, ctx?: { runId: string; task: { id: string } }): Promise<OCRResult> {
  if (ctx) {
    db.addRunEvent(ctx.runId, {
      type: 'ocr_debug',
      taskId: ctx.task.id,
      message: `[OCR] Using Tesseract.js fallback for ${path.basename(imagePath)}`
    })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000) // 20s timeout
  try {
    const { data } = await Tesseract.recognize(imagePath, 'eng', {
      logger: (m: any) => {
        if (ctx && m?.status) {
          db.addRunEvent(ctx.runId, {
            type: 'ocr_debug',
            taskId: ctx.task.id,
            message: `[OCR/Tesseract] ${m.status}${m.progress ? ` ${Math.round(m.progress * 100)}%` : ''}`
          })
        }
      }
    })

    const text: string = (data as any)?.text || ''
    const confidence: number = Math.max(0, Math.min(1, (((data as any)?.confidence ?? 50) as number) / 100))

    return {
      filePath: imagePath,
      text,
      confidence,
    }
  } catch (error: any) {
    if (controller.signal.aborted) {
      return {
        filePath: imagePath,
        text: '',
        confidence: 0,
        error: 'OCR timeout (tesseract)'
      }
    }
    return {
      filePath: imagePath,
      text: '',
      confidence: 0,
      error: `Tesseract error: ${error?.message || String(error)}`
    }
  } finally {
    clearTimeout(timeout)
  }
}

// Check if file size is reasonable for OCR processing
function isFileSizeReasonable(filePath: string): boolean {
  try {
    const stats = fs.statSync(filePath)
    const fileSizeInMB = stats.size / (1024 * 1024)
    // Skip files larger than 10MB as they're likely to timeout
    return fileSizeInMB <= 10
  } catch {
    return false
  }
}

// Extract text from image using Apple Vision framework
async function extractTextFromImage(imagePath: string, ctx?: { runId: string; task: { id: string } }): Promise<OCRResult> {
  console.log(`[OCR] Starting OCR for: ${imagePath}`)
  
  if (ctx) {
    db.addRunEvent(ctx.runId, {
      type: 'ocr_debug',
      taskId: ctx.task.id,
      message: `[OCR] Starting OCR for: ${path.basename(imagePath)}`
    })
  }
  
  // Check cache first
  const cached = getCachedResult(imagePath)
  if (cached) {
    console.log(`[OCR] Using cached result for: ${imagePath}`)
    if (ctx) {
      db.addRunEvent(ctx.runId, {
        type: 'ocr_debug',
        taskId: ctx.task.id,
        message: `[OCR] Using cached result`
      })
    }
    return cached
  }

  console.log(`[OCR] No cache found, proceeding with OCR for: ${imagePath}`)
  if (ctx) {
    db.addRunEvent(ctx.runId, {
      type: 'ocr_debug',
      taskId: ctx.task.id,
      message: `[OCR] No cache found, proceeding with OCR`
    })
  }
  
  return new Promise((resolve) => {
    // Create Swift script for OCR (fast path with downscaling and English-only)
    const swiftScript = `
import Foundation
import Vision
import AppKit

func downscaledCGImage(from image: NSImage, maxDim: CGFloat) -> CGImage? {
    let originalSize = image.size
    let maxSide = max(originalSize.width, originalSize.height)
    let scale: CGFloat = maxSide > maxDim ? (maxDim / maxSide) : 1.0
    let targetSize = NSSize(width: floor(originalSize.width * scale), height: floor(originalSize.height * scale))
    guard let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: Int(targetSize.width),
        pixelsHigh: Int(targetSize.height),
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    ) else {
        return image.cgImage(forProposedRect: nil, context: nil, hints: nil)
    }
    rep.size = targetSize
    NSGraphicsContext.saveGraphicsState()
    if let ctx = NSGraphicsContext(bitmapImageRep: rep) {
        NSGraphicsContext.current = ctx
        NSColor.clear.set()
        NSRect(origin: .zero, size: targetSize).fill()
        image.draw(in: NSRect(origin: .zero, size: targetSize), from: NSRect(origin: .zero, size: originalSize), operation: .copy, fraction: 1.0)
        ctx.flushGraphics()
    }
    NSGraphicsContext.restoreGraphicsState()
    return rep.cgImage
}

func extractText(from imagePath: String) {
    guard let image = NSImage(contentsOfFile: imagePath) else {
        let result = ["error": "Failed to load image", "text": "", "confidence": 0] as [String : Any]
        let jsonData = try! JSONSerialization.data(withJSONObject: result)
        print(String(data: jsonData, encoding: .utf8)!)
        return
    }

    let cgImage = downscaledCGImage(from: image, maxDim: 1600) ?? image.cgImage(forProposedRect: nil, context: nil, hints: nil)
    guard let finalImage = cgImage else {
        let result = ["error": "Failed to convert to CGImage", "text": "", "confidence": 0] as [String : Any]
        let jsonData = try! JSONSerialization.data(withJSONObject: result)
        print(String(data: jsonData, encoding: .utf8)!)
        return
    }

    let request = VNRecognizeTextRequest { (request, error) in
        if let error = error {
            let result = ["error": error.localizedDescription, "text": "", "confidence": 0] as [String : Any]
            let jsonData = try! JSONSerialization.data(withJSONObject: result)
            print(String(data: jsonData, encoding: .utf8)!)
            return
        }

        guard let observations = request.results as? [VNRecognizedTextObservation] else {
            let result = ["error": "No text found", "text": "", "confidence": 0] as [String : Any]
            let jsonData = try! JSONSerialization.data(withJSONObject: result)
            print(String(data: jsonData, encoding: .utf8)!)
            return
        }

        var allText = ""
        var totalConfidence: Float = 0
        var textCount = 0

        for observation in observations {
            guard let topCandidate = observation.topCandidates(1).first else { continue }
            allText += topCandidate.string + "\\n"
            totalConfidence += topCandidate.confidence
            textCount += 1
        }

        let avgConfidence = textCount > 0 ? totalConfidence / Float(textCount) : 0
        let result = [
            "text": allText.trimmingCharacters(in: .whitespacesAndNewlines),
            "confidence": avgConfidence,
            "filePath": imagePath
        ] as [String : Any]
        let jsonData = try! JSONSerialization.data(withJSONObject: result)
        print(String(data: jsonData, encoding: .utf8)!)
    }

    request.recognitionLevel = .fast
    request.usesLanguageCorrection = false
    request.minimumTextHeight = 0.015
    request.maximumCandidates = 1
    request.recognitionLanguages = ["en-US"]

    let handler = VNImageRequestHandler(cgImage: finalImage, options: [:])
    do {
        try handler.perform([request])
    } catch {
        let result = ["error": error.localizedDescription, "text": "", "confidence": 0] as [String : Any]
        let jsonData = try! JSONSerialization.data(withJSONObject: result)
        print(String(data: jsonData, encoding: .utf8)!)
    }
}

// Get command line argument
guard CommandLine.arguments.count > 1 else {
    let result = ["error": "No image path provided", "text": "", "confidence": 0] as [String : Any]
    let jsonData = try! JSONSerialization.data(withJSONObject: result)
    print(String(data: jsonData, encoding: .utf8)!)
    exit(1)
}

let imagePath = CommandLine.arguments[1]
extractText(from: imagePath)

// Keep the process alive for async completion
RunLoop.main.run()
`

    // Write Swift script to temporary file
    const tempDir = os.tmpdir()
    const scriptPath = path.join(tempDir, `ocr-${Date.now()}.swift`)
    
    try {
      console.log(`[OCR] Creating Swift script at: ${scriptPath}`)
      if (ctx) {
        db.addRunEvent(ctx.runId, {
          type: 'ocr_debug',
          taskId: ctx.task.id,
          message: `[OCR] Creating Swift script`
        })
      }
      
      fs.writeFileSync(scriptPath, swiftScript)
      console.log(`[OCR] Swift script created successfully`)
      if (ctx) {
        db.addRunEvent(ctx.runId, {
          type: 'ocr_debug',
          taskId: ctx.task.id,
          message: `[OCR] Swift script created successfully`
        })
      }
      
      // Execute Swift script
      console.log(`[OCR] Executing Swift script: swift ${scriptPath} ${imagePath}`)
      if (ctx) {
        db.addRunEvent(ctx.runId, {
          type: 'ocr_debug',
          taskId: ctx.task.id,
          message: `[OCR] Executing Swift script`
        })
      }
      
      const child = spawn('xcrun', ['swift', scriptPath, imagePath], {
        stdio: ['ignore', 'pipe', 'pipe']
      })
      
      console.log(`[OCR] Swift process spawned with PID: ${child.pid}`)
      if (ctx) {
        db.addRunEvent(ctx.runId, {
          type: 'ocr_debug',
          taskId: ctx.task.id,
          message: `[OCR] Swift process spawned with PID: ${child.pid}`
        })
      }
      
      let stdout = ''
      let stderr = ''
      
      child.stdout.on('data', (data) => {
        const output = data.toString()
        console.log(`[OCR] Swift stdout: ${output}`)
        stdout += output
      })
      
      child.stderr.on('data', (data) => {
        const error = data.toString()
        console.log(`[OCR] Swift stderr: ${error}`)
        stderr += error
      })
      
      const timeout = setTimeout(() => {
        console.log(`[OCR] TIMEOUT: Killing Swift process ${child.pid} after 10 seconds`)
        child.kill('SIGKILL') // Force kill for faster cleanup
        console.log(`[OCR] Process killed due to timeout`)
        resolve({
          filePath: imagePath,
          text: '',
          confidence: 0,
          error: 'OCR timeout (10s limit exceeded)'
        })
      }, 10000) // 10 second timeout - further reduced

      // Support external cancellation (if ctx provided)
      ;(ctx as any)?.signal?.addEventListener('abort', () => {
        try { child.kill('SIGKILL') } catch {}
      }, { once: true })
      
      child.on('close', (code) => {
        console.log(`[OCR] Swift process ${child.pid} closed with code: ${code}`)
        clearTimeout(timeout)
        
        // Clean up temporary script
        try {
          fs.unlinkSync(scriptPath)
          console.log(`[OCR] Cleaned up temporary script: ${scriptPath}`)
        } catch (cleanupError) {
          console.log(`[OCR] Failed to cleanup script: ${cleanupError}`)
        }
        
        if (code !== 0) {
          console.log(`[OCR] Swift execution failed with code ${code}`)
          console.log(`[OCR] stderr output: ${stderr}`)
          console.log(`[OCR] stdout output: ${stdout}`)
          
          const result: OCRResult = {
            filePath: imagePath,
            text: '',
            confidence: 0,
            error: stderr || `Swift execution failed with exit code ${code}`
          }
          resolve(result)
          return
        }
        
        try {
          const output = stdout.trim()
          console.log(`[OCR] Raw stdout output: "${output}"`)
          
          if (!output) {
            console.log(`[OCR] No output from Swift script`)
            const result: OCRResult = {
              filePath: imagePath,
              text: '',
              confidence: 0,
              error: 'No output from OCR'
            }
            resolve(result)
            return
          }
          
          console.log(`[OCR] Attempting to parse JSON output`)
          const parsed = JSON.parse(output)
          console.log(`[OCR] Parsed JSON:`, parsed)
          
          const result: OCRResult = {
            filePath: imagePath,
            text: parsed.text || '',
            confidence: parsed.confidence || 0,
            error: parsed.error
          }
          
          console.log(`[OCR] Final result:`, result)
          
          // Cache successful results
          if (!result.error && result.text) {
            saveCachedResult(imagePath, result)
            console.log(`[OCR] Cached successful result`)
          }
          
          resolve(result)
        } catch (parseError) {
          console.log(`[OCR] Failed to parse JSON output: ${parseError}`)
          console.log(`[OCR] Raw output was: "${stdout}"`)
          
          const result: OCRResult = {
            filePath: imagePath,
            text: '',
            confidence: 0,
            error: `Failed to parse OCR result: ${parseError}`
          }
          resolve(result)
        }
      })
      
      child.on('error', (error) => {
        console.log(`[OCR] Swift process error: ${error.message}`)
        console.log(`[OCR] Error details:`, error)
        
        clearTimeout(timeout)
        // Clean up temporary script
        try {
          fs.unlinkSync(scriptPath)
          console.log(`[OCR] Cleaned up script after error`)
        } catch (cleanupError) {
          console.log(`[OCR] Failed to cleanup after error: ${cleanupError}`)
        }
        
        resolve({
          filePath: imagePath,
          text: '',
          confidence: 0,
          error: `Failed to execute Swift: ${error.message}`
        })
      })
    } catch (error) {
      console.log(`[OCR] Failed to create Swift script: ${error}`)
      resolve({
        filePath: imagePath,
        text: '',
        confidence: 0,
        error: `Failed to create Swift script: ${error}`
      })
    }
  })
}

// Find image files and extract text content
async function findImagesWithText(searchText: string, searchPaths?: string[], ctx?: { runId: string; task: { id: string } }): Promise<{
  query: string
  results: Array<{
    path: string
    type: 'file'
    extractedText: string
    confidence: number
    matchScore: number
  }>
}> {
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp']
  console.log(`[OCR] findImagesWithText called with searchText: "${searchText}"`)
  console.log(`[OCR] searchPaths:`, searchPaths)
  
  // Debug: check if this should be treated as uploaded image
  const hasUploadedImage = searchPaths && searchPaths.length > 0 && searchPaths.some((p: string) => p.includes('uploaded-image-'))
  console.log(`[OCR] hasUploadedImage:`, hasUploadedImage)
  
  const results: Array<{
    path: string
    type: 'file'
    extractedText: string
    confidence: number
    matchScore: number
  }> = []
  
  // Check if we have specific file paths (uploaded images)
  if (searchPaths && searchPaths.length > 0 && searchPaths.some((p: string) => p.includes('uploaded-image-'))) {
    console.log(`[OCR] Processing specific uploaded image files:`, searchPaths)
    
          // Process only the specified uploaded images
      for (const imagePath of searchPaths) {
        if (!fs.existsSync(imagePath)) {
          console.log(`[OCR] Uploaded image not found: ${imagePath}`)
          continue
        }
        
        // Validate image file
        const stats = fs.statSync(imagePath)
        const fileSizeInMB = stats.size / (1024 * 1024)
        
        if (stats.size === 0) {
          if (ctx) {
            db.addRunEvent(ctx.runId, {
              type: 'ocr_file_skip',
              taskId: ctx.task.id,
              message: `Skipped uploaded image: File is empty (0 bytes)`,
              filePath: imagePath
            })
          }
          continue
        }
        
        if (fileSizeInMB > 20) {
          if (ctx) {
            db.addRunEvent(ctx.runId, {
              type: 'ocr_file_skip',
              taskId: ctx.task.id,
              message: `Skipped uploaded image: File too large (${fileSizeInMB.toFixed(1)}MB, limit 20MB)`,
              filePath: imagePath
            })
          }
          continue
        }
        
        if (ctx) {
          db.addRunEvent(ctx.runId, {
            type: 'ocr_file_start',
            taskId: ctx.task.id,
            message: `Processing uploaded image: ${path.basename(imagePath)} (${fileSizeInMB.toFixed(1)}MB)`,
            filePath: imagePath
          })
        }
      
      try {
        const ocrResult = OCR_BACKEND === 'vision'
          ? await extractTextFromImage(imagePath, ctx)
          : await extractTextWithTesseract(imagePath, ctx)
        
        if (ocrResult.error || !ocrResult.text) {
          if (ctx) {
            db.addRunEvent(ctx.runId, {
              type: 'ocr_file_skip',
              taskId: ctx.task.id,
              message: `Skipped uploaded image: ${ocrResult.error || 'No text found'}`,
              filePath: imagePath
            })
          }
          continue
        }
        
        // Calculate match score
        const extractedTextLower = ocrResult.text.toLowerCase()
        let matchScore: number
        
        if (searchText === "*") {
          // For general OCR requests, use confidence as relevance proxy
          matchScore = ocrResult.text.trim() ? ocrResult.confidence : 0
        } else {
          matchScore = calculateMatchScore(searchText.toLowerCase(), extractedTextLower)
        }
        
        if (ctx) {
          const preview = ocrResult.text.slice(0, 100) + (ocrResult.text.length > 100 ? '...' : '')
          db.addRunEvent(ctx.runId, {
            type: 'ocr_file_complete',
            taskId: ctx.task.id,
            message: `Uploaded image processed: ${Math.round(ocrResult.confidence * 100)}% confidence`,
            filePath: imagePath,
            extractedText: preview,
            confidence: ocrResult.confidence,
            matchScore: matchScore
          })
        }
        
        results.push({
          path: imagePath,
          type: 'file' as const,
          extractedText: ocrResult.text,
          confidence: ocrResult.confidence,
          matchScore
        })
        
        if (ctx) {
          db.addRunEvent(ctx.runId, {
            type: 'ocr_file_match',
            taskId: ctx.task.id,
            message: `✓ Text extracted from uploaded image`,
            filePath: imagePath
          })
        }
        
      } catch (error) {
        if (ctx) {
          db.addRunEvent(ctx.runId, {
            type: 'ocr_file_error',
            taskId: ctx.task.id,
            message: `Error processing uploaded image: ${error}`,
            filePath: imagePath
          })
        }
        console.warn(`OCR failed for uploaded image ${imagePath}:`, error)
      }
    }
    
    return {
      query: searchText,
      results
    }
  }
  
  // Default search paths for batch processing
  const defaultPaths = [
    path.join(os.homedir(), 'Desktop'),
    path.join(os.homedir(), 'Documents'),
    path.join(os.homedir(), 'Downloads'),
    path.join(os.homedir(), 'Pictures')
  ]
  
  const pathsToSearch = searchPaths || defaultPaths
  
  // Find all image files with detailed logging
  const imageFiles: string[] = []
  let totalFiles = 0
  let imageFilesFound = 0
  
  if (ctx) {
    db.addRunEvent(ctx.runId, {
      type: 'ocr_scan_start',
      taskId: ctx.task.id,
      message: `Scanning directories for images: ${pathsToSearch.join(', ')}`
    })
  }
  
  for (const searchPath of pathsToSearch) {
    try {
      if (!fs.existsSync(searchPath)) {
        if (ctx) {
          db.addRunEvent(ctx.runId, {
            type: 'ocr_scan_skip',
            taskId: ctx.task.id,
            message: `Directory not found: ${searchPath}`
          })
        }
        continue
      }
      
      const items = fs.readdirSync(searchPath, { withFileTypes: true })
      totalFiles += items.length
      
      for (const item of items) {
        if (item.isFile()) {
          const fullPath = path.join(searchPath, item.name)
          const ext = path.extname(item.name).toLowerCase()
          
          if (imageExtensions.includes(ext)) {
            imageFiles.push(fullPath)
            imageFilesFound++
          }
        }
      }
      
      // Reduce verbosity: only emit a compact scan summary per directory
      if (ctx) {
        const dirImageCount = items.filter(item => 
          item.isFile() && imageExtensions.includes(path.extname(item.name).toLowerCase())
        ).length
        db.addRunEvent(ctx.runId, {
          type: 'ocr_scan_directory',
          taskId: ctx.task.id,
          message: `${path.basename(searchPath)}: ${dirImageCount}/${items.length} images`
        })
      }
    } catch (error) {
      if (ctx) {
        db.addRunEvent(ctx.runId, {
          type: 'ocr_scan_error',
          taskId: ctx.task.id,
          message: `Failed to scan ${searchPath}: ${error}`
        })
      }
      console.warn(`Failed to search path ${searchPath}:`, error)
    }
  }
  
  if (ctx) {
    db.addRunEvent(ctx.runId, {
      type: 'ocr_scan_complete',
      taskId: ctx.task.id,
      message: `Scan complete: ${imageFilesFound} images found out of ${totalFiles} total files`
    })
  }
  
  // Process images in small parallel batches for speed while being mindful of resource limits
  const cpuCores = Math.max(2, os.cpus()?.length || 4)
  const batchSize = Math.min(4, Math.max(1, Math.floor(cpuCores / 2)))
  const minConfidenceGeneral = 0.85
  const minConfidenceSearch = 0.85
  const minRelevanceSearch = 0.85
  const requiredConfidence = searchText === "*" ? minConfidenceGeneral : minConfidenceSearch
  const searchTextLower = searchText.toLowerCase()
  let processedCount = 0
  let timeoutCount = 0
  
  if (ctx && imageFiles.length > 0) {
    db.addRunEvent(ctx.runId, {
      type: 'ocr_process_start',
      taskId: ctx.task.id,
      message: `Starting OCR processing of ${imageFiles.length} images in batches of ${batchSize}`
    })
  }
  
  let earlyStop = false
  for (let i = 0; i < imageFiles.length && !earlyStop; i += batchSize) {
    const batch = imageFiles.slice(i, i + batchSize)
    
    if (ctx) {
      db.addRunEvent(ctx.runId, {
        type: 'ocr_batch_start',
        taskId: ctx.task.id,
        message: `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(imageFiles.length / batchSize)} (${batch.length} files)`
      })
    }
    
    const batchPromises = batch.map(async (imagePath) => {
      const fileName = path.basename(imagePath)
      
      // Check file size before processing
      if (!isFileSizeReasonable(imagePath)) {
        const stats = fs.statSync(imagePath)
        const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(1)
        
        if (ctx) {
          db.addRunEvent(ctx.runId, {
            type: 'ocr_file_skip',
            taskId: ctx.task.id,
            message: `Skipped ${fileName}: File too large (${fileSizeInMB}MB, limit 10MB)`,
            filePath: imagePath
          })
        }
        return null
      }
      
      if (ctx) {
        db.addRunEvent(ctx.runId, {
          type: 'ocr_file_start',
          taskId: ctx.task.id,
          message: `Processing: ${fileName}`,
          filePath: imagePath
        })
      }
      
      try {
        const ocrResult = OCR_BACKEND === 'vision'
          ? await extractTextFromImage(imagePath)
          : await extractTextWithTesseract(imagePath, ctx)
        processedCount++
        
        if (ocrResult.error || !ocrResult.text) {
          // Track timeouts separately
          if (ocrResult.error && ocrResult.error.includes('timeout')) {
            timeoutCount++
          }
          
          if (ctx) {
            const eventType = ocrResult.error && ocrResult.error.includes('timeout') ? 'ocr_file_timeout' : 'ocr_file_skip'
            db.addRunEvent(ctx.runId, {
              type: eventType,
              taskId: ctx.task.id,
              message: `${ocrResult.error && ocrResult.error.includes('timeout') ? '⏰ Timeout' : 'Skipped'} ${fileName}: ${ocrResult.error || 'No text found'}`,
              filePath: imagePath
            })
          }
          return null
        }
        
        // Calculate match score
        const extractedTextLower = ocrResult.text.toLowerCase()
        let matchScore: number
        
        if (searchText === "*") {
          // For general OCR requests, use confidence as a proxy for relevance
          matchScore = ocrResult.text.trim() ? ocrResult.confidence : 0
        } else {
          matchScore = calculateMatchScore(searchTextLower, extractedTextLower)
        }

        // Enforce minimum relevance; allow high-relevance to override confidence for targeted queries
        const strongRelevance = searchText !== '*' && matchScore >= 0.95
        if (searchText !== '*' && matchScore < minRelevanceSearch) {
          if (ctx) {
            db.addRunEvent(ctx.runId, {
              type: 'ocr_file_skip',
              taskId: ctx.task.id,
              message: `${fileName}: Skipped due to low relevance (${Math.round(matchScore * 100)}% < ${Math.round(minRelevanceSearch * 100)}%)`,
              filePath: imagePath
            })
          }
          return null
        }
        if (ocrResult.confidence < requiredConfidence && !strongRelevance) {
          if (ctx) {
            db.addRunEvent(ctx.runId, {
              type: 'ocr_file_skip',
              taskId: ctx.task.id,
              message: `${fileName}: Skipped due to low confidence (${Math.round(ocrResult.confidence * 100)}% < ${Math.round(requiredConfidence * 100)}%)`,
              filePath: imagePath
            })
          }
          return null
        }
        
        if (ctx) {
          const preview = ocrResult.text.slice(0, 100) + (ocrResult.text.length > 100 ? '...' : '')
          db.addRunEvent(ctx.runId, {
            type: 'ocr_file_complete',
            taskId: ctx.task.id,
            message: `${fileName}: ${Math.round(ocrResult.confidence * 100)}% confidence, ${Math.round(matchScore * 100)}% match`,
            filePath: imagePath,
            extractedText: preview,
            confidence: ocrResult.confidence,
            matchScore: matchScore
          })
        }
        
        const threshold = searchText === "*" ? 0 : minRelevanceSearch
        if (matchScore >= threshold) {
          if (ctx) {
            db.addRunEvent(ctx.runId, {
              type: 'ocr_file_match',
              taskId: ctx.task.id,
              message: `✓ Match found in ${fileName} (${Math.round(ocrResult.confidence * 100)}% confidence, ${Math.round(matchScore * 100)}% relevance)`,
              filePath: imagePath
            })
          }
          
          return {
            path: imagePath,
            type: 'file' as const,
            extractedText: ocrResult.text,
            confidence: ocrResult.confidence,
            matchScore
          }
        }
        
        return null
      } catch (error) {
        if (ctx) {
          db.addRunEvent(ctx.runId, {
            type: 'ocr_file_error',
            taskId: ctx.task.id,
            message: `Error processing ${fileName}: ${error}`,
            filePath: imagePath
          })
        }
        console.warn(`OCR failed for ${imagePath}:`, error)
        return null
      }
    })
    
    const batchResults = await Promise.all(batchPromises)
    
    for (const result of batchResults) {
      if (result) {
        results.push(result)
      }
    }
    
    if (ctx) {
      const batchMatches = batchResults.filter(r => r !== null).length
      const batchTimeouts = batch.length - batchResults.length // Failed promises
      db.addRunEvent(ctx.runId, {
        type: 'ocr_batch_complete',
        taskId: ctx.task.id,
        message: `Batch complete: ${batchMatches} matches found in ${batch.length} files${batchTimeouts > 0 ? ` (${batchTimeouts} timeouts)` : ''}`
      })
    }

    // Early stop: if any result in this batch has very high relevance and confidence, stop the whole search
    if (searchText !== '*' ) {
      const killer = batchResults.find(r => r && r.matchScore >= 0.99)
      if (killer && ctx) {
        db.addRunEvent(ctx.runId, {
          type: 'ocr_early_stop',
          taskId: ctx.task.id,
          message: `Early stop on strong hit (${Math.round(killer.matchScore * 100)}% relevance${typeof killer.confidence === 'number' ? `, ${Math.round(killer.confidence * 100)}% confidence` : ''})`,
          filePath: killer.path
        })
        earlyStop = true
      }
    }
    
    // Do not early-exit; process all candidates to avoid missing the actual match
  }
  
  // Sort by match score (highest first)
  results.sort((a, b) => b.matchScore - a.matchScore)
  
  // Report timeout summary if any occurred
  if (ctx && timeoutCount > 0) {
    db.addRunEvent(ctx.runId, {
      type: 'ocr_timeout_summary',
      taskId: ctx.task.id,
      message: `⚠️ ${timeoutCount} files timed out during OCR processing (consider reducing image sizes or complexity)`
    })
  }
  
  return {
    query: searchText,
    results
  }
}

// Calculate match score between search text and extracted text
function calculateMatchScore(searchText: string, extractedText: string): number {
  if (!searchText || !extractedText) return 0
  
  // Exact phrase match gets highest score
  if (extractedText.includes(searchText)) {
    return 1.0
  }
  
  // Split into words and calculate word overlap
  const searchWords = searchText.split(/\s+/).filter(w => w.length > 2)
  const extractedWords = extractedText.split(/\s+/).map(w => w.toLowerCase())
  
  if (searchWords.length === 0) return 0
  
  let matchedWords = 0
  for (const word of searchWords) {
    if (extractedWords.some(ew => ew.includes(word.toLowerCase()))) {
      matchedWords++
    }
  }
  
  return matchedWords / searchWords.length
}

export async function spawnOCRAgent(ctx: Ctx) {
  try {
    // Test Swift availability first
    const swiftAvailable = await testSwiftAvailability()
    if (!swiftAvailable) {
      db.addRunEvent(ctx.runId, { 
        type: 'error', 
        taskId: ctx.task.id, 
        message: 'Swift is not available or not working. Falling back to Tesseract.'
      })
      OCR_BACKEND = 'tesseract'
    }
    
    // Test Vision framework specifically
    if (OCR_BACKEND === 'vision') {
      const visionAvailable = await testVisionFramework(ctx)
      if (!visionAvailable) {
        db.addRunEvent(ctx.runId, { 
          type: 'error', 
          taskId: ctx.task.id, 
          message: 'Vision framework is not working properly. Falling back to Tesseract.'
        })
        OCR_BACKEND = 'tesseract'
      } else {
        OCR_BACKEND = 'vision'
      }
    }
    
    // Parse task description for OCR operation
    const parsed = JSON.parse(ctx.task.description)
    
    if (parsed?.op === 'ocr_search' && typeof parsed.text === 'string') {
      const searchText = parsed.text
      const searchPaths = parsed.paths || undefined
      const originalPrompt = parsed.originalPrompt || searchText
      
      // Smart filtering: detect if user specifically mentioned images/pictures/screenshots
      const imageKeywords = ['screenshot', 'image', 'picture', 'photo', 'pic', 'snap', 'capture']
      const mentionsImages = imageKeywords.some(keyword => 
        originalPrompt.toLowerCase().includes(keyword)
      )
      
      if (mentionsImages) {
      db.addRunEvent(ctx.runId, { 
        type: 'ocr_smart_filter', 
        taskId: ctx.task.id, 
        message: `Smart filtering enabled: User mentioned images/screenshots, focusing search on image files only`
      })
      }
      
      const isGeneralOcr = searchText === "*"
      const displayText = isGeneralOcr ? "all text" : `"${searchText}"`
      
      db.addRunEvent(ctx.runId, { 
        type: 'ocr_start', 
        taskId: ctx.task.id, 
        searchText,
        smartFilter: mentionsImages,
        message: `Starting OCR ${isGeneralOcr ? 'text extraction' : 'search'} for: ${displayText}${mentionsImages ? ' (image files only)' : ''}`
      })
      
      const result = await findImagesWithText(searchText, searchPaths, ctx)
      
      db.addRunEvent(ctx.runId, { 
        type: 'ocr_complete', 
        taskId: ctx.task.id, 
        query: result.query,
        results: result.results.map(r => ({
          path: r.path,
          extractedText: r.extractedText.slice(0, 200), // Truncate for event
          confidence: r.confidence,
          matchScore: r.matchScore
        })),
        message: `OCR search complete: ${result.results.length} matching images found`
      })
      
      // For uploaded images, always emit a direct OCR response
      const isUploadedImage = searchPaths && searchPaths.length > 0 && searchPaths.some((p: string) => p.includes('uploaded-image-'))
      if (isUploadedImage) {
        const ocrResult = result.results[0]
        const hasText = !!ocrResult?.extractedText?.trim()
        const responseText = hasText
          ? `I can see the following text in your image:\n\n"${ocrResult!.extractedText}"\n\n(Confidence: ${Math.round(ocrResult!.confidence * 100)}%)`
          : "I couldn't detect any readable text in this image. The image might be too blurry, the text might be too small, or it might not contain text."

        db.addRunEvent(ctx.runId, {
          type: 'ocr_response',
          taskId: ctx.task.id,
          message: responseText,
          extractedText: ocrResult?.extractedText || '',
          confidence: ocrResult?.confidence ?? 0
        })
      } else {
        // Regular file_located event for batch searches
        db.addRunEvent(ctx.runId, { 
          type: 'file_located', 
          taskId: ctx.task.id, 
          query: searchText,
          results: result.results.map(r => r.path),
          searchType: 'content',
          ocrResults: result.results // Additional OCR data
        })
      }
      
      return result
    }
    
    throw new Error('Invalid OCR operation format')
  } catch (error) {
    db.addRunEvent(ctx.runId, { 
      type: 'error', 
      taskId: ctx.task.id, 
      message: `OCR operation failed: ${error}` 
    })
    throw error
  }
}
