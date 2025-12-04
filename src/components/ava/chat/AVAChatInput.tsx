import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { useSidebarState } from "@/hooks/useSidebarState";

interface AVAChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const AVAChatInput = ({ 
  value, 
  onChange, 
  onSubmit, 
  disabled,
  placeholder = "Type your answer..."
}: AVAChatInputProps) => {
  const { leftOffset } = useSidebarState();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSubmit(value);
      }
    }
  };

  const handleSubmit = () => {
    if (value.trim() && !disabled) {
      onSubmit(value);
    }
  };

  return (
    <div 
      className="fixed bottom-0 bg-white backdrop-blur-xl border-t border-gray-200 z-50 shadow-2xl transition-all duration-300"
      style={{
        left: `${leftOffset}px`,
        width: `calc(100vw - ${leftOffset}px)`,
      }}
    >
      <div className="flex justify-center w-full">
        <div className="w-[80%] py-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <Textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                className="min-h-[56px] max-h-[140px] resize-none bg-white border-2 border-gray-300 focus:border-gray-500 rounded-xl text-sm pr-4 shadow-sm transition-all text-gray-900 placeholder:text-gray-500 overflow-y-auto chatgpt-scrollbar"
                rows={1}
              />
            </div>
            <Button 
              onClick={handleSubmit}
              disabled={!value.trim() || disabled}
              size="icon"
              className="h-14 w-14 bg-gray-900 hover:bg-gray-800 text-white shrink-0 rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
          <div className="text-xs text-gray-600 mt-2 text-center">
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] border border-gray-300 text-gray-700">Enter</kbd> to send • <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] border border-gray-300 text-gray-700">Shift+Enter</kbd> new line
          </div>
        </div>
      </div>
    </div>
  );
};

