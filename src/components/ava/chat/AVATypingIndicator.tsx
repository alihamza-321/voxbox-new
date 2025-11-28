export const AVATypingIndicator = () => {
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1.5">
        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
      <span className="text-xs text-slate-400 font-medium">AVA is typing...</span>
    </div>
  );
};

