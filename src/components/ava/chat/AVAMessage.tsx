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
        <div className="px-6 py-3 rounded-full bg-gray-100 border border-gray-300 text-gray-700 text-sm font-medium shadow-sm">
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
            ? 'bg-white border border-gray-200 backdrop-blur-sm' 
            : 'bg-gray-50 border border-gray-200'
          }
        `}>
          {/* Badge (if exists) */}
          {message.metadata?.badge && (
            <Badge 
              variant="outline" 
              className="mb-3 bg-gray-100 text-gray-700 border-gray-300 font-medium px-3 py-1 text-xs"
            >
              {message.metadata.badge}
            </Badge>
          )}

          {/* Content */}
          {(() => {
            const isHTML = isHTMLContent(message.content);
            return (
              <div className={`
                leading-[1.75] text-base
                ${isUser ? 'font-medium text-gray-900' : 'text-gray-900 font-normal'}
                ${isHTML ? '' : 'whitespace-pre-wrap'}
              `}>
                {isHTML ? (
                  <div 
                    className="ava-message-content text-gray-900"
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
                  className="bg-gray-900 hover:bg-gray-800 text-white border-0 shadow-md hover:shadow-lg transition-all font-medium text-xs"
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

