 import type { ChatMessage } from "@/lib/ava-chat-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AVAExampleChips } from "./AVAExampleChips";

interface AVAMessageProps {
  message: ChatMessage;
  onExampleSelect?: (example: string) => void;
  onActionClick?: (action: string, videoUrl?: string) => void;
}

// Helper function to detect if content is HTML
const isHTMLContent = (content: string): boolean => {
  if (typeof content !== 'string') return false;
  // Check if content contains HTML tags
  const htmlTagRegex = /<[^>]+>/;
  const isHTML = htmlTagRegex.test(content);
  if (isHTML) {
    console.log('🔍 Detected HTML content:', content.substring(0, 100));
  }
  return isHTML;
}

export const AVAMessage = ({ message, onExampleSelect, onActionClick }: AVAMessageProps) => {
  const isAVA = message.role === "ava";
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  
  if (isSystem) {
    return (
      <div className="flex justify-center animate-fade-in my-4">
        <div className="px-6 py-3 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-cyan-400 text-sm font-medium shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isAVA ? 'justify-start' : 'justify-end'} animate-fade-in mb-6`}>
      <div className={`flex gap-3 ${isAVA ? 'flex-row' : 'flex-row-reverse'} w-full`}>
        {/* Avatars removed */}
        {/* Message Bubble */}
        <div className={`
          rounded-2xl ${isAVA ? 'rounded-tl-sm' : 'rounded-tr-sm'} p-4 w-[70%] shadow-sm
          ${isAVA 
            ? 'bg-slate-800/50 border border-slate-700/50 backdrop-blur-sm' 
            : 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30'
          }
        `}>
          {/* Badge (if exists) */}
          {message.metadata?.badge && (
            <Badge 
              variant="outline" 
              className="mb-3 bg-cyan-500/10 text-cyan-400 border-cyan-500/30 font-medium px-3 py-1 text-xs"
            >
              {message.metadata.badge}
            </Badge>
          )}

          {/* Content */}
          {(() => {
            const isHTML = isHTMLContent(message.content);
            return (
              <div className={`
                leading-relaxed text-base
                ${isUser ? 'font-medium text-slate-200' : 'text-white font-normal tracking-wide'}
                ${isHTML ? '' : 'whitespace-pre-wrap'}
              `}>
                {isHTML ? (
                  <div 
                    className="ava-message-content text-white"
                    dangerouslySetInnerHTML={{ __html: message.content }}
                  />
                ) : (
                  message.content
                )}
              </div>
            );
          })()}

          {/* Examples (if exists) */}
          {message.metadata?.examples && onExampleSelect && (
            <AVAExampleChips 
              examples={message.metadata.examples}
              onSelect={onExampleSelect}
            />
          )}

          {/* Actions (if exists) */}
          {message.metadata?.actions && onActionClick && (
            <div className="flex gap-2 mt-4">
              {message.metadata.actions.map((action: any, idx: number) => (
                <Button 
                  key={idx}
                  variant={action.variant || "default"}
                  size="sm"
                  onClick={() => onActionClick(action.actionType || "start", action.videoUrl)}
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:opacity-90 text-white border-0 shadow-md hover:shadow-lg shadow-cyan-500/30 transition-all font-medium text-xs"
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

