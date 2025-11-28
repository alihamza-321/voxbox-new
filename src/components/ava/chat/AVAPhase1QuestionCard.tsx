import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Lightbulb, ChevronDown, ChevronUp, ArrowRight, Play } from "lucide-react";
import avaAvatar from "@/assets/ava-avatar.png";

interface AVAPhase1QuestionCardProps {
  sectionTitle: string;
  questionText: string;
  questionNumber: number;
  totalQuestions: number;
  examples: string[];
  videoUrl?: string;
  onSubmit: (answer: string) => void;
  isSubmitting?: boolean;
}

export const AVAPhase1QuestionCard = ({
  questionText,
  questionNumber,
  examples,
  videoUrl,
  onSubmit,
  isSubmitting = false,
}: AVAPhase1QuestionCardProps) => {
  const [showExamples, setShowExamples] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [showVideo, setShowVideo] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea based on content - properly handles long text and examples
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Function to resize textarea
    const resizeTextarea = () => {
      // Step 1: Remove all constraints and reset
      textarea.style.boxSizing = "border-box";
      textarea.style.maxHeight = "none";
      textarea.style.minHeight = "120px";
      textarea.style.height = "auto";
      textarea.style.overflow = "hidden";
      textarea.style.overflowY = "hidden";
      textarea.style.overflowX = "hidden";
      
      // Force reflow
      void textarea.offsetHeight;
      
      // Step 2: Calculate required height
      const minHeight = 120;
      
      if (inputValue.trim() === "") {
        // Empty state - use minimum height
        textarea.style.height = `${minHeight}px`;
        textarea.style.overflowY = "hidden";
        textarea.scrollTop = 0;
      } else {
        // Get computed styles to account for line-height and padding
        const computedStyle = window.getComputedStyle(textarea);
        const lineHeight = parseFloat(computedStyle.lineHeight) || 20;
        const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
        const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
        const borderTop = parseFloat(computedStyle.borderTopWidth) || 0;
        const borderBottom = parseFloat(computedStyle.borderBottomWidth) || 0;
        
        // Get the actual content height needed
        const scrollHeight = textarea.scrollHeight;
        
        // Add generous buffer to ensure ALL content is visible
        const totalPadding = paddingTop + paddingBottom + borderTop + borderBottom;
        const lineHeightBuffer = lineHeight * 0.8; // More generous buffer
        const safetyBuffer = 15; // Additional safety margin
        const extraHeight = totalPadding + lineHeightBuffer + safetyBuffer;
        
        let newHeight = Math.max(scrollHeight + extraHeight, minHeight);
        
        // Apply the calculated height
        textarea.style.height = `${newHeight}px`;
        textarea.style.maxHeight = "none";
        textarea.style.overflowY = "hidden";
        textarea.scrollTop = 0; // Reset scroll position
        
        // Verification: Check if we need more height - ensure scrollHeight fits
        requestAnimationFrame(() => {
          const currentScrollHeight = textarea.scrollHeight;
          const currentHeight = parseFloat(textarea.style.height) || newHeight;
          
          // If scrollHeight is greater than height, expand more
          if (currentScrollHeight > currentHeight) {
            // Still overflowing - add more height
            textarea.style.height = `${currentScrollHeight + extraHeight}px`;
            textarea.scrollTop = 0; // Reset scroll position
          }
        });
      }
    };

    // Execute resize with multiple timing strategies
    requestAnimationFrame(() => {
      resizeTextarea();
      setTimeout(resizeTextarea, 0);
      setTimeout(resizeTextarea, 10);
      setTimeout(resizeTextarea, 50);
    });
  }, [inputValue, questionNumber]);

  const handleExampleClick = (example: string) => {
    const textarea = textareaRef.current;
    
    // IMMEDIATE: Set value directly to DOM for instant update
    if (textarea) {
      textarea.value = example;
      
      // Function to calculate and apply correct height - ensures ALL content is visible
      const calculateAndApplyHeight = () => {
        // Step 1: Reset all constraints to get accurate scrollHeight
        textarea.style.boxSizing = "border-box";
        textarea.style.maxHeight = "none";
        textarea.style.minHeight = "120px";
        textarea.style.height = "auto";
        textarea.style.overflow = "hidden";
        textarea.style.overflowY = "hidden";
        textarea.style.overflowX = "hidden";
        
        // Force reflow to ensure accurate measurement
        void textarea.offsetHeight;
        
        // Step 2: Get computed styles to account for line-height and padding
        const computedStyle = window.getComputedStyle(textarea);
        const lineHeight = parseFloat(computedStyle.lineHeight) || 20;
        const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
        const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
        const borderTop = parseFloat(computedStyle.borderTopWidth) || 0;
        const borderBottom = parseFloat(computedStyle.borderBottomWidth) || 0;
        
        // Step 3: Calculate the actual scrollHeight needed
        const scrollHeight = textarea.scrollHeight;
        const minHeight = 120;
        
        // Step 4: Add generous buffer to ensure ALL content is visible without scrolling
        // Account for line-height, padding, borders, and browser rendering differences
        const totalPadding = paddingTop + paddingBottom + borderTop + borderBottom;
        const lineHeightBuffer = lineHeight * 0.8; // More generous buffer for line-height
        const safetyBuffer = 15; // Additional safety margin to prevent any scrolling
        const extraHeight = totalPadding + lineHeightBuffer + safetyBuffer;
        
        // Step 5: Calculate height - use scrollHeight directly, don't subtract anything
        let newHeight = Math.max(scrollHeight + extraHeight, minHeight);
        
        // Step 6: Apply the calculated height immediately
        textarea.style.height = `${newHeight}px`;
        textarea.style.maxHeight = "none";
        textarea.style.overflowY = "hidden";
        textarea.style.overflow = "hidden";
        textarea.scrollTop = 0; // Reset scroll position
        
        // Step 7: Verify and adjust - ensure scrollHeight fits within the height
        requestAnimationFrame(() => {
          const currentScrollHeight = textarea.scrollHeight;
          const currentHeight = parseFloat(textarea.style.height) || newHeight;
          
          // CRITICAL: If scrollHeight is greater than current height, expand more
          // We want scrollHeight <= height to prevent any scrolling
          if (currentScrollHeight > currentHeight) {
            // Expand to exactly fit the content plus buffer
            const adjustedHeight = currentScrollHeight + extraHeight;
            textarea.style.height = `${adjustedHeight}px`;
            
            // Final verification pass - ensure it's perfect
            requestAnimationFrame(() => {
              const finalScrollHeight = textarea.scrollHeight;
              const finalHeight = parseFloat(textarea.style.height) || adjustedHeight;
              
              // One more check - if still not enough, expand more
              if (finalScrollHeight > finalHeight) {
                textarea.style.height = `${finalScrollHeight + extraHeight}px`;
              }
              
              // Ensure no scrollbar is visible and scroll is at top
              textarea.style.overflowY = "hidden";
              textarea.scrollTop = 0;
              
              // Scroll the textarea into view smoothly so user can see all content
              textarea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              
              // Focus the textarea
              textarea.focus();
            });
          } else {
            // Height is sufficient - ensure scroll is at top and scroll into view
            textarea.scrollTop = 0;
            textarea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            textarea.focus();
          }
        });
      };
      
      // Execute immediately for instant feedback
      calculateAndApplyHeight();
      
      // Additional verification passes to ensure accuracy across different browsers
      setTimeout(calculateAndApplyHeight, 0);
      setTimeout(calculateAndApplyHeight, 10);
      setTimeout(calculateAndApplyHeight, 50);
      setTimeout(calculateAndApplyHeight, 100);
    }
    
    // Update React state (for form submission, but DOM is already updated)
    setInputValue(example);
  };

  const handleSubmit = () => {
    if (inputValue.trim()) {
      onSubmit(inputValue.trim());
      setInputValue(""); // Clear for next question - this will trigger auto-resize
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex gap-4 items-start w-full max-w-4xl mx-auto px-4 animate-fade-in">
      {/* AVA Avatar */}
      <div className="flex-shrink-0">
        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-vox-pink/30 shadow-lg">
          <img 
            src={avaAvatar} 
            alt="AVA" 
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="flex-1 bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
        {/* Question Text */}
        <div className="px-6 py-6">
          <p className="text-lg font-medium text-gray-900 leading-relaxed">
            {questionText}
          </p>
        </div>

        {/* Video Button (if question has videoUrl) */}
        {videoUrl && (
          <div className="px-6 pb-4">
            <Button
              onClick={() => setShowVideo(!showVideo)}
              variant="outline"
              className="gap-2 border-vox-pink/30 text-vox-pink hover:bg-vox-pink/10"
            >
              <Play className="w-4 h-4" />
              <span className="text-sm font-medium">
                {showVideo ? "Hide Video" : "Watch Help Video"}
              </span>
            </Button>
          </div>
        )}

        {/* Video Player */}
        {showVideo && videoUrl && (
          <div className="px-6 pb-4 animate-slide-down">
            <div className="relative w-full bg-black rounded-lg overflow-hidden border-2 border-vox-pink/20" style={{ paddingTop: '56.25%' }}>
              <iframe
                src={(() => {
                  // Extract video ID and privacy hash from Vimeo URL
                  // Supports formats: https://vimeo.com/1088047119/e13812494c or https://vimeo.com/1088047119
                  const match = videoUrl.match(/vimeo\.com\/(\d+)(?:\/([a-zA-Z0-9]+))?/);
                  if (!match) {
                    console.error('❌ Failed to parse Vimeo URL:', videoUrl);
                    return '';
                  }
                  
                  const videoId = match[1];
                  const privacyHash = match[2]; // May be undefined for public videos
                  
                  console.log('📹 Question Video URL:', videoUrl, 'Video ID:', videoId, 'Privacy Hash:', privacyHash);
                  
                  // Build embed URL with privacy hash if present
                  let embedUrl = `https://player.vimeo.com/video/${videoId}`;
                  const params = new URLSearchParams({
                    title: '0',
                    byline: '0',
                    portrait: '0',
                    autoplay: '0'
                  });
                  
                  if (privacyHash) {
                    params.set('h', privacyHash);
                  }
                  
                  embedUrl += '?' + params.toString();
                  console.log('📹 Embed URL:', embedUrl);
                  return embedUrl;
                })()}
                className="absolute top-0 left-0 w-full h-full"
                frameBorder="0"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                title="Question Help Video"
              />
            </div>
          </div>
        )}

        {/* Examples Toggle */}
        <div className="px-6 pb-4">
          <button
            onClick={() => setShowExamples(!showExamples)}
            className="flex items-center gap-2 text-vox-pink hover:text-vox-pink/80 transition-colors"
          >
            <Lightbulb className="w-4 h-4" />
            <span className="text-sm font-medium">
              {showExamples ? "Hide examples" : "Show examples"}
            </span>
            {showExamples ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Examples List */}
        {showExamples && examples && examples.length > 0 && (
          <div className="px-6 pb-6 space-y-3 animate-slide-down">
            {examples.map((example, idx) => (
              <button
                key={idx}
                onClick={() => handleExampleClick(example)}
                className="w-full text-left p-4 bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-200 hover:border-vox-pink hover:shadow-md transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-vox-pink/10 flex items-center justify-center text-vox-pink font-semibold text-sm group-hover:bg-vox-pink group-hover:text-white transition-colors">
                    {idx + 1}
                  </div>
                  <p className="flex-1 text-sm text-gray-700 leading-relaxed">
                    {example}
                  </p>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-vox-pink transition-colors opacity-0 group-hover:opacity-100" />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Answer Input */}
        <div className="px-6 pb-6 space-y-4">
          <div>
            <label htmlFor="phase1-answer-textarea" className="block text-sm font-medium text-gray-700 mb-2">
              Your Answer
            </label>
            <Textarea
              ref={textareaRef}
              id="phase1-answer-textarea"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your answer here, or click an example above to use it as a starting point..."
              className="min-h-[120px] resize-none border-gray-300 focus:border-vox-pink focus:ring-vox-pink"
              disabled={isSubmitting}
            />
            <p className="text-xs text-gray-500 mt-2">
              Tip: Press Ctrl+Enter (or Cmd+Enter) to submit
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={!inputValue.trim() || isSubmitting}
              className="bg-gradient-to-r from-vox-pink to-vox-orange text-white hover:shadow-lg transition-all"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Submitting...
                </>
              ) : (
                <>
                  Submit Answer
                  <ArrowRight className="ml-2 w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
