import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { 
  Play, 
  Search, 
  FileText, 
  Terminal, 
  Zap, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  X 
} from 'lucide-react'

interface LogEntry {
  id: string
  timestamp: string
  type: string
  level: 'info' | 'success' | 'warning' | 'error'
  message: string
  taskId?: string
  runId?: string
  data?: any
}

interface LogsViewerProps {
  logs: LogEntry[]
  onClear?: () => void
}

export function LogsViewer({ logs, onClear }: LogsViewerProps) {
  const [filter, setFilter] = useState<string>('')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [showVerbose, setShowVerbose] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  // Filter logs
  const filteredLogs = logs.filter(log => {
    // Hide verbose OCR debug chatter unless enabled
    if (!showVerbose && (log.type === 'ocr_debug' || log.type === 'ocr_scan_directory' || log.type === 'ocr_batch_start')) {
      return false
    }
    const matchesText = !filter || 
      log.message.toLowerCase().includes(filter.toLowerCase()) ||
      log.type.toLowerCase().includes(filter.toLowerCase())
    
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter
    
    return matchesText && matchesLevel
  })

  const getLogIcon = (log: LogEntry) => {
    switch (log.type) {
      case 'graph_extract_start':
      case 'graph_extract_done':
      case 'graph_synthesize_start':
      case 'graph_synthesize_done':
        return <Search className="h-3 w-3 text-purple-300" />
      case 'run_started':
        return <Play className="h-3 w-3 text-blue-400" />
      case 'task_result':
      case 'file_located':
        return <CheckCircle className="h-3 w-3 text-green-400" />
      case 'error':
        return <AlertCircle className="h-3 w-3 text-red-400" />
      case 'research_result':
        return <Search className="h-3 w-3 text-purple-400" />
      case 'shell_start':
      case 'shell_output':
      case 'shell_end':
        return <Terminal className="h-3 w-3 text-yellow-400" />
      case 'file_write':
      case 'file_renamed':
        return <FileText className="h-3 w-3 text-orange-400" />
      case 'ocr_start':
      case 'ocr_smart_filter':
      case 'ocr_scan_start':
      case 'ocr_scan_directory':
      case 'ocr_scan_complete':
      case 'ocr_process_start':
      case 'ocr_batch_start':
      case 'ocr_file_start':
      case 'ocr_file_complete':
      case 'ocr_file_match':
      case 'ocr_file_skip':
      case 'ocr_file_timeout':
      case 'ocr_file_error':
      case 'ocr_batch_complete':
      case 'ocr_limit_reached':
      case 'ocr_timeout_summary':
      case 'ocr_complete':
      case 'ocr_response':
      case 'ocr_debug':
        return <Zap className="h-3 w-3 text-cyan-400" />
      default:
        return <Clock className="h-3 w-3 text-white/50" />
    }
  }

  const getLogColor = (log: LogEntry) => {
    switch (log.level) {
      case 'success':
        return 'text-green-300 border-green-500/20 bg-green-500/5'
      case 'error':
        return 'text-red-300 border-red-500/20 bg-red-500/5'
      case 'warning':
        return 'text-yellow-300 border-yellow-500/20 bg-yellow-500/5'
      default:
        return 'text-white/80 border-white/10 bg-white/5'
    }
  }

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp)
      return date.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        fractionalSecondDigits: 3
      })
    } catch {
      return timestamp
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header with controls (sticky) */}
      <div className="sticky top-0 z-40 flex items-center justify-between gap-2 p-3 border-b border-white/10 bg-[oklch(var(--background))]/80 backdrop-blur supports-[backdrop-filter]:bg-[oklch(var(--background))]/60">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-white/70" />
          <h3 className="text-sm font-semibold text-white/90">Agent Logs</h3>
          <span className="text-xs text-white/50 bg-white/5 px-2 py-1 rounded">
            {filteredLogs.length} entries
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Level filter */}
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1 text-white/80"
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
          
          {/* Auto-scroll toggle */}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setAutoScroll(!autoScroll)}
            className={cn(
              "h-7 text-xs px-2",
              autoScroll 
                ? "bg-blue-500/20 text-blue-300 border-blue-500/20" 
                : "bg-white/5 text-white/60 border-white/10"
            )}
          >
            Auto-scroll
          </Button>

          {/* Verbose toggle */}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowVerbose(!showVerbose)}
            className={cn(
              "h-7 text-xs px-2",
              showVerbose
                ? "bg-purple-500/20 text-purple-300 border-purple-500/20"
                : "bg-white/5 text-white/60 border-white/10"
            )}
          >
            Verbose
          </Button>
          
          {/* Clear button */}
          <Button
            size="sm"
            variant="secondary"
            onClick={onClear}
            className="h-7 text-xs px-2 bg-white/5 text-white/60 border-white/10 hover:bg-red-500/20 hover:text-red-300"
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Search filter */}
      <div className="p-2 border-b border-white/10">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-white/40" />
          <input
            type="text"
            placeholder="Filter logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded text-xs text-white/80 pl-7 pr-8 py-1.5 placeholder:text-white/40 focus:outline-none focus:border-white/20"
          />
          {filter && (
            <button
              onClick={() => setFilter('')}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white/40 hover:text-white/60"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Logs content */}
      <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
        <div className="p-2 space-y-1">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-white/50">
              <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No logs to display</p>
              {filter && (
                <p className="text-xs mt-1">Try adjusting your filter</p>
              )}
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className={cn(
                  "flex items-start gap-2 p-2 rounded-lg border text-xs font-mono",
                  getLogColor(log)
                )}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getLogIcon(log)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white/50 text-xs">
                      {formatTimestamp(log.timestamp)}
                    </span>
                    <span className="text-white/60 text-xs uppercase tracking-wider">
                      {log.type}
                    </span>
                    {log.taskId && (
                      <span className="text-white/40 text-xs bg-white/5 px-1 rounded">
                        {log.taskId}
                      </span>
                    )}
                  </div>
                  
                  <div className="text-white/80 leading-relaxed">
                    {log.message}
                  </div>
                  
                  {/* Show additional data if available */}
                  {log.data && typeof log.data === 'object' && (
                    <details className="mt-1">
                      <summary className="text-white/40 text-xs cursor-pointer hover:text-white/60">
                        Show data
                      </summary>
                      <pre className="mt-1 text-white/60 text-xs bg-black/20 p-2 rounded overflow-x-auto">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  )
}

// Helper function to convert agent events to log entries
export function eventToLogEntry(event: any, runId: string): LogEntry {
  const timestamp = event.created_at || new Date().toISOString()
  const payload = event.payload || event
  
  let level: LogEntry['level'] = 'info'
  let message = ''
  
  switch (payload.type) {
    case 'run_started':
      level = 'info'
      message = `Starting task: "${payload.prompt}" (${payload.model || 'default model'})`
      break
      
    case 'plan':
      level = 'info'
      message = `Task plan created with ${payload.tasks?.length || 0} steps`
      break
      
    case 'task_start':
      level = 'info'
      message = `Starting task: ${payload.title || 'Unnamed task'}`
      break
      
    case 'task_result':
      level = 'success'
      message = typeof payload.result === 'string' 
        ? `Task completed: ${payload.result.slice(0, 100)}${payload.result.length > 100 ? '...' : ''}`
        : 'Task completed successfully'
      break
      
    case 'file_located':
      level = 'success'
      const count = payload.results?.length || 0
      const searchType = payload.searchType === 'content' ? ' (OCR)' : ''
      message = `Found ${count} file(s) for "${payload.query}"${searchType}`
      break
      
    case 'ocr_start':
      level = 'info'
      message = payload.message || `Starting OCR search for: "${payload.searchText}"`
      break
      
    case 'ocr_smart_filter':
      level = 'info'
      message = payload.message || 'Smart filtering enabled for image files'
      break
      
    case 'ocr_scan_start':
      level = 'info'
      message = payload.message || 'Scanning directories for images'
      break
      
    case 'ocr_scan_directory':
      level = 'info'
      message = payload.message || 'Scanning directory for images'
      break
      
    case 'ocr_scan_complete':
      level = 'info'
      message = payload.message || 'Directory scan complete'
      break
      
    case 'ocr_process_start':
      level = 'info'
      message = payload.message || 'Starting OCR processing'
      break
      
    case 'ocr_batch_start':
      level = 'info'
      message = payload.message || 'Processing batch of images'
      break
      
    case 'ocr_file_start':
      level = 'info'
      message = payload.message || `Processing file: ${payload.filePath ? payload.filePath.split('/').pop() : 'unknown'}`
      break
      
    case 'ocr_file_complete':
      level = 'info'
      message = payload.message || 'File processing complete'
      break
      
    case 'ocr_file_match':
      level = 'success'
      message = payload.message || 'Match found in file'
      break
      
    case 'ocr_file_skip':
      level = 'warning'
      message = payload.message || 'File skipped'
      break
      
    case 'ocr_file_timeout':
      level = 'warning'
      message = payload.message || 'File processing timed out'
      break
      
    case 'ocr_file_error':
      level = 'error'
      message = payload.message || 'Error processing file'
      break
      
    case 'ocr_timeout_summary':
      level = 'warning'
      message = payload.message || 'Some files timed out during processing'
      break
      
    case 'ocr_batch_complete':
      level = 'info'
      message = payload.message || 'Batch processing complete'
      break
      
    case 'ocr_limit_reached':
      level = 'warning'
      message = payload.message || 'Result limit reached'
      break
      
    case 'ocr_complete':
      level = 'success'
      message = payload.message || `OCR search completed: ${payload.results?.length || 0} images processed`
      break
      
    case 'ocr_response':
      level = 'success'
      message = payload.message || 'OCR response generated'
      break
      
    case 'ocr_debug':
      level = 'info'
      message = payload.message || 'OCR debug message'
      break
      
    case 'research_result':
      level = 'success'
      message = `Research completed: ${payload.sources?.length || 0} sources found`
      break
      
    case 'shell_start':
      level = 'info'
      message = `Executing command: ${payload.cmd}`
      break
      
    case 'shell_output':
      level = 'info'
      message = `${payload.stream}: ${payload.chunk?.slice(0, 200)}${payload.chunk?.length > 200 ? '...' : ''}`
      break
      
    case 'shell_end':
      level = payload.exitCode === 0 ? 'success' : 'error'
      message = `Command ${payload.exitCode === 0 ? 'succeeded' : 'failed'} (exit code: ${payload.exitCode})`
      break
      
    case 'error':
      level = 'error'
      message = `Error: ${payload.message || 'Unknown error occurred'}`
      break
      
    case 'confirm_dangerous':
      level = 'warning'
      message = `Confirmation required for ${payload.op}: ${payload.path}`
      break
      
    default:
      level = 'info'
      message = payload.message || `${payload.type} event`
  }
  
  return {
    id: `${runId}-${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp,
    type: payload.type,
    level,
    message,
    taskId: payload.taskId,
    runId,
    data: payload
  }
}
